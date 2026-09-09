using backend.Data;
using backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class CommuneSubjectsController : ControllerBase
    {
        private readonly AppDbContext _context;
        public CommuneSubjectsController(AppDbContext context) => _context = context;

        [HttpGet]
        public async Task<IActionResult> GetAll() => Ok(await _context.CommuneSubjectRecords
            .AsNoTracking().OrderByDescending(x => x.ImportedAt).ThenBy(x => x.Id).ToListAsync());

        [HttpGet("summary")]
        public async Task<IActionResult> Summary()
        {
            var groups = await _context.CommuneSubjectRecords.AsNoTracking().GroupBy(x => x.DoiTuong)
                .Select(group => new { objectType = group.Key, count = group.Count() }).OrderBy(x => x.objectType).ToListAsync();
            return Ok(new { total = groups.Sum(x => x.count), groups });
        }

        [HttpGet("search")]
        public async Task<IActionResult> Search(string? objectType, string? keyword, int page = 1, int pageSize = 50)
        {
            page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 1, 100000);
            var query = _context.CommuneSubjectRecords.AsNoTracking();
            if (!string.IsNullOrWhiteSpace(objectType)) { var selected = objectType.Trim(); query = query.Where(x => x.DoiTuong == selected); }
            if (!string.IsNullOrWhiteSpace(keyword))
            {
                var search = keyword.Trim().ToLower();
                query = query.Where(x => AppDbContext.UnicodeLower(x.Stt).Contains(search) || AppDbContext.UnicodeLower(x.HoTen).Contains(search) || AppDbContext.UnicodeLower(x.NgaySinh).Contains(search) || AppDbContext.UnicodeLower(x.Cccd).Contains(search) || AppDbContext.UnicodeLower(x.DiaChi).Contains(search));
            }
            var total = await query.CountAsync();
            var rows = await query.OrderBy(x => x.Id).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
            return Ok(new { rows, total, page, pageSize, totalPages = Math.Max(1, (int)Math.Ceiling(total / (double)pageSize)) });
        }

        [HttpPost("import")]
        public async Task<IActionResult> Import([FromBody] List<CommuneSubjectRecord>? rows)
        {
            if (rows == null || rows.Count == 0) return BadRequest(new { message = "Không có dữ liệu đối tượng xã để import." });
            var missingObjectTypeIndex = rows.FindIndex(x => string.IsNullOrWhiteSpace(x.DoiTuong));
            if (missingObjectTypeIndex >= 0)
                return BadRequest(new { message = $"Vui lòng bổ sung đối tượng tại dòng {missingObjectTypeIndex + 2}." });

            foreach (var row in rows)
            {
                row.Id = 0;
                row.Stt = (row.Stt ?? "").Trim(); row.HoTen = (row.HoTen ?? "").Trim();
                row.NgaySinh = (row.NgaySinh ?? "").Trim(); row.Cccd = (row.Cccd ?? "").Trim();
                row.DiaChi = (row.DiaChi ?? "").Trim();
                row.DoiTuong = (row.DoiTuong ?? "").Trim(); row.ImportedAt = DateTime.UtcNow;
            }
            await _context.CommuneSubjectRecords.AddRangeAsync(rows);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Import đối tượng xã hoàn tất.", savedCount = rows.Count });
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var row = await _context.CommuneSubjectRecords.FindAsync(id);
            if (row == null) return NotFound(new { message = "Không tìm thấy dữ liệu." });
            _context.Remove(row); await _context.SaveChangesAsync();
            return Ok(new { message = "Đã xóa dữ liệu." });
        }

        [HttpDelete("all")]
        public async Task<IActionResult> DeleteAll()
        {
            var count = await _context.CommuneSubjectRecords.ExecuteDeleteAsync();
            return Ok(new { message = "Đã xóa toàn bộ dữ liệu đối tượng xã.", count });
        }
    }
}
