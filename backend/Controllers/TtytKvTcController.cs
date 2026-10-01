using backend.Data;
using backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class TtytKvTcController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll() => Ok(await db.TtytKvTcRecords.AsNoTracking().OrderByDescending(x => x.ImportedAt).ThenBy(x => x.Id).ToListAsync());

    [HttpPost("import")]
    public async Task<IActionResult> Import([FromBody] List<TtytKvTcRecord>? rows)
    {
        if (rows == null || rows.Count == 0) return BadRequest(new { message = "Không có dữ liệu tổng khám TTYTKVTC để import." });
        var importedAt = DateTime.UtcNow;
        for (var i = 0; i < rows.Count; i++)
        {
            var row = rows[i];
            if (row == null || string.IsNullOrWhiteSpace(row.HoTen)) return BadRequest(new { message = $"Dòng {i + 2}: thiếu Họ và tên." });
            row.Id = 0; row.Stt = (row.Stt ?? "").Trim(); row.HoTen = row.HoTen.Trim(); row.NamSinh = (row.NamSinh ?? "").Trim(); row.GioiTinh = (row.GioiTinh ?? "").Trim(); row.Cccd = (row.Cccd ?? "").Trim(); row.DiaChi = (row.DiaChi ?? "").Trim(); row.NgayVao = (row.NgayVao ?? "").Trim(); row.SourceFileName = (row.SourceFileName ?? "").Trim(); row.ImportedAt = importedAt;
        }
        await db.TtytKvTcRecords.AddRangeAsync(rows); await db.SaveChangesAsync();
        return Ok(new { message = "Import tổng khám TTYTKVTC hoàn tất.", savedCount = rows.Count });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var row = await db.TtytKvTcRecords.FindAsync(id); if (row == null) return NotFound(new { message = "Không tìm thấy dữ liệu." });
        db.TtytKvTcRecords.Remove(row); await db.SaveChangesAsync(); return Ok(new { message = "Đã xóa dữ liệu." });
    }

    [HttpDelete("all")]
    public async Task<IActionResult> DeleteAll()
    {
        var count = await db.TtytKvTcRecords.ExecuteDeleteAsync(); return Ok(new { message = "Đã xóa toàn bộ dữ liệu tổng khám TTYTKVTC.", count });
    }
}
