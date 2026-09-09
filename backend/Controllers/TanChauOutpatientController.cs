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
    public class TanChauOutpatientController : ControllerBase
    {
        private readonly AppDbContext _context;
        public TanChauOutpatientController(AppDbContext context) => _context = context;

        [HttpGet]
        public async Task<IActionResult> GetAll() => Ok(await _context.TanChauOutpatientRecords
            .AsNoTracking().OrderByDescending(x => x.ImportedAt).ThenBy(x => x.Id).ToListAsync());

        [HttpPost("import")]
        public async Task<IActionResult> Import([FromBody] List<TanChauOutpatientRecord>? rows)
        {
            if (rows == null || rows.Count == 0)
                return BadRequest(new { message = "Không có dữ liệu ngoại trú Tân Châu để import." });
            foreach (var row in rows) { row.Id = 0; row.ImportedAt = DateTime.UtcNow; }
            await _context.TanChauOutpatientRecords.AddRangeAsync(rows);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Import ngoại trú Tân Châu hoàn tất.", savedCount = rows.Count });
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var row = await _context.TanChauOutpatientRecords.FindAsync(id);
            if (row == null) return NotFound(new { message = "Không tìm thấy dữ liệu." });
            _context.Remove(row); await _context.SaveChangesAsync();
            return Ok(new { message = "Đã xóa dữ liệu." });
        }

        [HttpDelete("all")]
        public async Task<IActionResult> DeleteAll()
        {
            var count = await _context.TanChauOutpatientRecords.ExecuteDeleteAsync();
            return Ok(new { message = "Đã xóa toàn bộ dữ liệu ngoại trú Tân Châu.", count });
        }
    }
}
