using System.ComponentModel.DataAnnotations;
using backend.Data;
using backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public sealed class OfficeMeetingTypesController(AppDbContext db) : ControllerBase
{
    private const string Category = "officeMeetingType";
    private static readonly string[] Defaults = ["Họp Trực Tuyến", "Họp Trực Tiếp", "Họp Chủ Tịch, Phó Chủ Tịch", "Họp Ủy Ban", "Họp Khác"];

    [HttpGet]
    public async Task<ActionResult> GetAll(CancellationToken ct)
    {
        var items = await db.CatalogItems.AsNoTracking().Where(x => x.Category == Category)
            .OrderByDescending(x => x.IsDefault).ThenBy(x => x.Name)
            .Select(x => new { x.Id, x.Name, x.IsDefault, x.Location }).ToListAsync(ct);
        if (items.Count == 0) {
            foreach (var name in Defaults) db.CatalogItems.Add(new CatalogItem { Category = Category, Name = name, IsDefault = name == Defaults[0] });
            await db.SaveChangesAsync(ct);
            items = await db.CatalogItems.AsNoTracking().Where(x => x.Category == Category).OrderByDescending(x => x.IsDefault).ThenBy(x => x.Name).Select(x => new { x.Id, x.Name, x.IsDefault, x.Location }).ToListAsync(ct);
        }
        return Ok(items);
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] SaveMeetingTypeRequest request, CancellationToken ct)
    {
        var name = request.Name.Trim();
        if (name.Length is < 2 or > 200) return BadRequest(new { message = "Tên cuộc họp phải từ 2 đến 200 ký tự." });
        if (await db.CatalogItems.AnyAsync(x => x.Category == Category && x.Name == name, ct)) return Conflict(new { message = "Danh mục đã tồn tại." });
        var item = new CatalogItem { Category = Category, Name = name, Location = request.Location?.Trim() ?? "", IsDefault = false }; db.CatalogItems.Add(item); await db.SaveChangesAsync(ct); return Ok(new { item.Id, item.Name, item.IsDefault, item.Location });
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult> Update(int id, [FromBody] SaveMeetingTypeRequest request, CancellationToken ct)
    {
        var item = await db.CatalogItems.SingleOrDefaultAsync(x => x.Id == id && x.Category == Category, ct); if (item is null) return NotFound();
        var name = request.Name.Trim(); if (name.Length is < 2 or > 200) return BadRequest(new { message = "Tên cuộc họp không hợp lệ." });
        if (await db.CatalogItems.AnyAsync(x => x.Category == Category && x.Id != id && x.Name == name, ct)) return Conflict(new { message = "Danh mục đã tồn tại." });
        item.Name = name; item.Location = request.Location?.Trim() ?? ""; await db.SaveChangesAsync(ct); return Ok(new { item.Id, item.Name, item.IsDefault, item.Location });
    }

    [HttpPut("{id:int}/default")]
    public async Task<ActionResult> SetDefault(int id, CancellationToken ct)
    {
        var item = await db.CatalogItems.SingleOrDefaultAsync(x => x.Id == id && x.Category == Category, ct); if (item is null) return NotFound();
        await db.CatalogItems.Where(x => x.Category == Category).ExecuteUpdateAsync(s => s.SetProperty(x => x.IsDefault, false), ct); item.IsDefault = true; await db.SaveChangesAsync(ct); return Ok(new { item.Id, item.Name, item.IsDefault });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct) { var item = await db.CatalogItems.SingleOrDefaultAsync(x => x.Id == id && x.Category == Category, ct); if (item is null) return NotFound(); db.CatalogItems.Remove(item); await db.SaveChangesAsync(ct); return NoContent(); }
}

public sealed record SaveMeetingTypeRequest([Required, MinLength(2), MaxLength(200)] string Name, string? Location);
