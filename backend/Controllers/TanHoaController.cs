using Microsoft.EntityFrameworkCore;
using backend.Data;
using backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class TanHoaController : ControllerBase
    {
        private readonly AppDbContext _context;
        public TanHoaController(AppDbContext context) => _context = context;

        [HttpGet]
        public async Task<IActionResult> GetAll() => Ok(await _context.TanHoaRecords
            .AsNoTracking().OrderByDescending(x => x.ImportedAt).ThenBy(x => x.Id).ToListAsync());

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var count = await _context.TanHoaRecords.Where(x => x.Id == id).ExecuteDeleteAsync();
            return count == 0 ? NotFound(new { message = "Dòng dữ liệu không còn tồn tại." }) : Ok(new { count });
        }

        [HttpDelete("all")]
        public async Task<IActionResult> DeleteAll()
        {
            var count = await _context.TanHoaRecords.ExecuteDeleteAsync();
            return Ok(new { count });
        }

        [HttpPost("import")]
        public async Task<IActionResult> Import([FromBody] List<TanHoaRecord> rows)
        {
            var importedAt = DateTime.UtcNow;
            foreach (var row in rows)
            {
                row.Id = 0;
                row.ImportedAt = importedAt;
            }
            _context.TanHoaRecords.AddRange(rows);
            await _context.SaveChangesAsync();
            return Ok(new { savedCount = rows.Count });
        }
    }
}