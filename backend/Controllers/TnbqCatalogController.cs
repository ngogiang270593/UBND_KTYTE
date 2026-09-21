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
public class TnbqCatalogController(AppDbContext db) : ControllerBase
{
    [HttpGet("communes")]
    public async Task<IActionResult> GetCommunes() => Ok(await db.TnbqCommunes.AsNoTracking()
        .OrderByDescending(x => x.IsDefault).ThenBy(x => x.Name)
        .Select(x => new { x.Id, x.Name, x.Code, x.Province, x.IsDefault }).ToListAsync());

    [HttpPost("communes")]
    public Task<IActionResult> CreateCommune(CommuneRequest request) => SaveCommune(null, request);

    [HttpPut("communes/{id:int}")]
    public Task<IActionResult> UpdateCommune(int id, CommuneRequest request) => SaveCommune(id, request);

    [HttpDelete("communes/{id:int}")]
    public async Task<IActionResult> DeleteCommune(int id)
    {
        var item = await db.TnbqCommunes.Include(x => x.Hamlets).SingleOrDefaultAsync(x => x.Id == id);
        if (item == null) return NotFound(new { message = "Không tìm thấy xã cần xóa." });
        db.TnbqCommunes.Remove(item);
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("hamlets")]
    public async Task<IActionResult> GetHamlets([FromQuery] int communeId)
    {
        if (!await db.TnbqCommunes.AnyAsync(x => x.Id == communeId))
            return NotFound(new { message = "Không tìm thấy xã đã chọn." });
        return Ok(await db.TnbqHamlets.AsNoTracking().Where(x => x.CommuneId == communeId)
            .OrderByDescending(x => x.IsDefault).ThenBy(x => x.Name)
            .Select(x => new { x.Id, x.CommuneId, x.Name, x.Code, x.IsDefault }).ToListAsync());
    }

    [HttpPost("hamlets")]
    public Task<IActionResult> CreateHamlet(HamletRequest request) => SaveHamlet(null, request);

    [HttpPut("hamlets/{id:int}")]
    public Task<IActionResult> UpdateHamlet(int id, HamletRequest request) => SaveHamlet(id, request);

    [HttpDelete("hamlets/{id:int}")]
    public async Task<IActionResult> DeleteHamlet(int id)
    {
        var item = await db.TnbqHamlets.FindAsync(id);
        if (item == null) return NotFound(new { message = "Không tìm thấy ấp cần xóa." });
        db.TnbqHamlets.Remove(item);
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("defaults")]
    public async Task<IActionResult> GetDefaults()
    {
        var commune = await db.TnbqCommunes.AsNoTracking().Where(x => x.IsDefault)
            .Select(x => new { x.Id, x.Name, x.Code, x.Province }).SingleOrDefaultAsync();
        if (commune == null) return Ok(new { commune = (object?)null, hamlet = (object?)null });
        var hamlet = await db.TnbqHamlets.AsNoTracking().Where(x => x.CommuneId == commune.Id && x.IsDefault)
            .Select(x => new { x.Id, x.CommuneId, x.Name, x.Code }).SingleOrDefaultAsync();
        return Ok(new { commune, hamlet });
    }

    private async Task<IActionResult> SaveCommune(int? id, CommuneRequest request)
    {
        var name = request.Name.Trim(); var code = request.Code.Trim(); var province = request.Province.Trim();
        if (await db.TnbqCommunes.AnyAsync(x => x.Code == code && x.Id != (id ?? 0)))
            return Conflict(new { message = "Mã xã đã tồn tại." });
        var item = id.HasValue ? await db.TnbqCommunes.FindAsync(id) : new TnbqCommune();
        if (item == null) return NotFound(new { message = "Không tìm thấy xã cần sửa." });
        if (request.IsDefault)
            await db.TnbqCommunes.Where(x => x.Id != item.Id && x.IsDefault)
                .ExecuteUpdateAsync(x => x.SetProperty(other => other.IsDefault, false));
        item.Name = name; item.Code = code; item.Province = province; item.IsDefault = request.IsDefault;
        if (!id.HasValue) db.TnbqCommunes.Add(item);
        await db.SaveChangesAsync();
        return Ok(new { item.Id, item.Name, item.Code, item.Province, item.IsDefault });
    }

    private async Task<IActionResult> SaveHamlet(int? id, HamletRequest request)
    {
        var name = request.Name.Trim(); var code = request.Code.Trim();
        if (!await db.TnbqCommunes.AnyAsync(x => x.Id == request.CommuneId))
            return BadRequest(new { message = "Vui lòng chọn xã hợp lệ." });
        if (await db.TnbqHamlets.AnyAsync(x => x.CommuneId == request.CommuneId && x.Code == code && x.Id != (id ?? 0)))
            return Conflict(new { message = "Mã ấp đã tồn tại trong xã đã chọn." });
        var item = id.HasValue ? await db.TnbqHamlets.FindAsync(id) : new TnbqHamlet();
        if (item == null) return NotFound(new { message = "Không tìm thấy ấp cần sửa." });
        if (request.IsDefault)
            await db.TnbqHamlets.Where(x => x.CommuneId == request.CommuneId && x.Id != item.Id && x.IsDefault)
                .ExecuteUpdateAsync(x => x.SetProperty(other => other.IsDefault, false));
        item.CommuneId = request.CommuneId; item.Name = name; item.Code = code; item.IsDefault = request.IsDefault;
        if (!id.HasValue) db.TnbqHamlets.Add(item);
        await db.SaveChangesAsync();
        return Ok(new { item.Id, item.CommuneId, item.Name, item.Code, item.IsDefault });
    }
}

public class CommuneRequest
{
    [Required, StringLength(150)] public string Name { get; set; } = "";
    [Required, StringLength(20)] public string Code { get; set; } = "";
    [Required, StringLength(150)] public string Province { get; set; } = "";
    public bool IsDefault { get; set; }
}

public class HamletRequest
{
    [Range(1, int.MaxValue)] public int CommuneId { get; set; }
    [Required, StringLength(150)] public string Name { get; set; } = "";
    [Required, StringLength(20)] public string Code { get; set; } = "";
    public bool IsDefault { get; set; }
}
