using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using backend.Data;
using backend.Models;
using backend.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class UsersController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var users = await db.Users.AsNoTracking().OrderBy(x => x.Username).ToListAsync();
        var result = new List<AccessProfile>();
        foreach (var user in users) result.Add(await ModuleAccess.GetProfile(db, user));
        return Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateUserRequest request)
    {
        var username = request.Username.Trim().ToLowerInvariant();
        if (request.Modules.Any(x => !ModuleAccess.ModuleIds.Contains(x)))
            return BadRequest(new { message = "Module không hợp lệ." });
        if (await db.Users.AnyAsync(x => x.Username.ToLower() == username))
            return Conflict(new { message = "Tên đăng nhập đã tồn tại." });
        var strategy = db.Database.CreateExecutionStrategy();
        User? user = null;
        try
        {
            await strategy.ExecuteAsync(async () =>
            {
                await using var transaction = await db.Database.BeginTransactionAsync();
                user = new User { Username = username, FullName = request.FullName.Trim(),
                    Password = BCrypt.Net.BCrypt.HashPassword(request.Password), Role = "User" };
                db.Users.Add(user);
                await db.SaveChangesAsync();
                db.UserModuleAccesses.Add(new UserModuleAccess { UserId = user.Id,
                    ModuleIds = JsonSerializer.Serialize(request.Modules.Distinct().ToArray()), IsActive = true });
                await db.SaveChangesAsync();
                await transaction.CommitAsync();
            });
        }
        catch (DbUpdateException)
        {
            return Conflict(new { message = "Không thể tạo tài khoản. Vui lòng kiểm tra tên đăng nhập và thử lại." });
        }
        return Ok(await ModuleAccess.GetProfile(db, user!));
    }

    [HttpPut("{id:int}/access")]
    public async Task<IActionResult> UpdateAccess(int id, UpdateAccessRequest request)
    {
        var user = await db.Users.FindAsync(id);
        if (user == null) return NotFound();
        if (user.Role == ModuleAccess.SystemAdminRole)
            return BadRequest(new { message = "Không thể khóa hoặc thu hồi quyền của quản trị hệ thống." });
        if (request.Modules.Any(x => !ModuleAccess.ModuleIds.Contains(x)))
            return BadRequest(new { message = "Module không hợp lệ." });
        var access = await db.UserModuleAccesses.FindAsync(id);
        if (access == null) { access = new UserModuleAccess { UserId = id }; db.UserModuleAccesses.Add(access); }
        access.ModuleIds = JsonSerializer.Serialize(request.Modules.Distinct().ToArray());
        access.IsActive = request.IsActive;
        await db.SaveChangesAsync();
        return Ok(await ModuleAccess.GetProfile(db, user));
    }
}

public class CreateUserRequest
{
    [Required, RegularExpression(@"[a-zA-Z0-9_.-]{3,50}")]
    public string Username { get; set; } = "";
    [Required, StringLength(150)]
    public string FullName { get; set; } = "";
    [Required, StringLength(72, MinimumLength = 6)]
    public string Password { get; set; } = "";
    [Required]
    public string[] Modules { get; set; } = [];
}

public class UpdateAccessRequest
{
    [Required]
    public string[] Modules { get; set; } = [];
    public bool IsActive { get; set; } = true;
}


