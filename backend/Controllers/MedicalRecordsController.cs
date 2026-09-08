using backend.Data;
using backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers
{
    public class MedicalRecordImportRow
    {
        public int ExcelLine { get; set; }
        public int? SequenceNumber { get; set; }
        public string? PatientId { get; set; }
        public string? FullName { get; set; }
        public DateTime? DateOfBirth { get; set; }
        public string? Gender { get; set; }
        public string? PhoneNumber { get; set; }
        public string? CitizenId { get; set; }
        public string? HealthInsuranceNumber { get; set; }
        public string? Address { get; set; }
        public string? Note { get; set; }
        public string? SourceFileName { get; set; }
    }

    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class MedicalRecordsController : ControllerBase
    {
        private readonly AppDbContext _context;
        public MedicalRecordsController(AppDbContext context) => _context = context;

        [HttpGet]
        public async Task<IActionResult> GetAll(string? keyword, string? gender, DateTime? fromBirthDate, DateTime? toBirthDate)
        {
            var query = _context.MedicalRecords.AsNoTracking().AsQueryable();
            if (!string.IsNullOrWhiteSpace(keyword))
            {
                var value = keyword.Trim().ToLower();
                query = query.Where(x =>
                    AppDbContext.UnicodeLower(x.PatientId).Contains(value) ||
                    AppDbContext.UnicodeLower(x.FullName).Contains(value) ||
                    AppDbContext.UnicodeLower(x.PhoneNumber).Contains(value) ||
                    AppDbContext.UnicodeLower(x.CitizenId).Contains(value) ||
                    AppDbContext.UnicodeLower(x.HealthInsuranceNumber).Contains(value) ||
                    AppDbContext.UnicodeLower(x.Address).Contains(value));
            }
            if (!string.IsNullOrWhiteSpace(gender))
            {
                var value = gender.Trim().ToLower();
                query = query.Where(x => AppDbContext.UnicodeLower(x.Gender).Contains(value));
            }
            if (fromBirthDate.HasValue) query = query.Where(x => x.DateOfBirth >= fromBirthDate.Value.Date);
            if (toBirthDate.HasValue) query = query.Where(x => x.DateOfBirth <= toBirthDate.Value.Date);
            return Ok(await query.OrderByDescending(x => x.ImportedAt).ThenBy(x => x.SequenceNumber).ToListAsync());
        }

        [HttpPost("import")]
        public async Task<IActionResult> Import([FromBody] List<MedicalRecordImportRow>? rows)
        {
            if (rows == null || rows.Count == 0)
                return BadRequest(new { message = "Không có dữ liệu y bạ để import." });

            var valid = new List<MedicalRecord>();

            foreach (var row in rows)
            {
                var pid = (row.PatientId ?? "").Trim();
                var name = (row.FullName ?? "").Trim();
                valid.Add(new MedicalRecord {
                    SequenceNumber = row.SequenceNumber, PatientId = pid, FullName = name,
                    DateOfBirth = row.DateOfBirth?.Date, Gender = (row.Gender ?? "").Trim(),
                    PhoneNumber = (row.PhoneNumber ?? "").Trim(), CitizenId = (row.CitizenId ?? "").Trim(),
                    HealthInsuranceNumber = (row.HealthInsuranceNumber ?? "").Trim(), Address = (row.Address ?? "").Trim(),
                    Note = (row.Note ?? "").Trim(), SourceFileName = (row.SourceFileName ?? "").Trim()
                });
            }
            if (valid.Count > 0) { await _context.MedicalRecords.AddRangeAsync(valid); await _context.SaveChangesAsync(); }
            return Ok(new { message = "Import dữ liệu y bạ hoàn tất.", totalCount = rows.Count, savedCount = valid.Count, errorCount = 0, errors = Array.Empty<string>() });
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var item = await _context.MedicalRecords.FindAsync(id);
            if (item == null) return NotFound(new { message = "Không tìm thấy dữ liệu y bạ." });
            _context.Remove(item); await _context.SaveChangesAsync(); return Ok(new { message = "Đã xóa dữ liệu y bạ." });
        }

        [HttpDelete("all")]
        public async Task<IActionResult> DeleteAll()
        {
            var count = await _context.MedicalRecords.ExecuteDeleteAsync();
            return Ok(new { message = "Đã xóa toàn bộ dữ liệu y bạ.", count });
        }
    }
}
