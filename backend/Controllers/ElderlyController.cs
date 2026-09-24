using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using backend.Data;
using backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class ElderlyController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll() => Ok(await db.ElderlyRecords
        .AsNoTracking().OrderByDescending(x => x.ImportedAt).ThenBy(x => x.Id).ToListAsync());

    private static string Identity(string? value) => string.Concat((value ?? "").Where(c => !char.IsWhiteSpace(c)));
    private static string NameKey(string? value)
    {
        var decomposed = (value ?? "").Trim().Normalize(NormalizationForm.FormD);
        var plain = new string(decomposed.Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark).ToArray());
        return Regex.Replace(plain.Replace('đ', 'd').Replace('Đ', 'D').ToUpperInvariant(), @"\s+", " ");
    }
    private static DateTime? FullDate(string? value) =>
        DateTime.TryParseExact(value?.Trim(), new[] { "d/M/yyyy", "dd/MM/yyyy", "d-M-yyyy", "dd-MM-yyyy", "yyyy-MM-dd", "yyyy-MM-ddTHH:mm:ss", "yyyy-MM-ddTHH:mm:ssZ" },
            CultureInfo.InvariantCulture, DateTimeStyles.None, out var date) ? date.Date : null;
    private static string Year(string? value)
    {
        if (FullDate(value) is DateTime date) return date.Year.ToString();
        return Regex.IsMatch(value?.Trim() ?? "", @"^\d{4}$") ? value!.Trim() : "";
    }

    private sealed record SourceRow(int Id, string Source, string Label, string? Code, string? Name, string? BirthDate, string? BirthYear, string? Address);
    private async Task<List<SourceRow>> Sources()
    {
        var rows = new List<SourceRow>();
        rows.AddRange(await db.CommuneSubjectRecords.AsNoTracking().Select(x => new SourceRow(x.Id, "commune", "Đối tượng xã", x.Cccd, x.HoTen, x.NgaySinh, "", x.DiaChi)).ToListAsync());
        rows.AddRange(await db.TanChauInpatientRecords.AsNoTracking().Select(x => new SourceRow(x.Id, "inpatient", "Nội trú Tân Châu", x.SoCccd, x.HoTen, x.NgaySinh, "", x.DiaChi)).ToListAsync());
        rows.AddRange(await db.TanChauOutpatientRecords.AsNoTracking().Select(x => new SourceRow(x.Id, "outpatient", "Ngoại trú Tân Châu", x.Cccd, x.HoTen, "", x.NamSinh, x.DiaChi)).ToListAsync());
        rows.AddRange(await db.TanHoaNkRecords.AsNoTracking().Select(x => new SourceRow(x.Id, "nk", "Danh sách NK", x.Cccd, x.HoTen, x.NgaySinh, x.NamSinh, x.DiaChi)).ToListAsync());
        var medical = await db.MedicalRecords.AsNoTracking().ToListAsync();
        rows.AddRange(medical.Select(x => new SourceRow(x.Id, "medical", "Y bạ", x.CitizenId, x.FullName, x.DateOfBirth?.ToString("yyyy-MM-dd"), "", x.Address)));
        return rows.Where(x => Identity(x.Code) != "" || !string.IsNullOrWhiteSpace(x.Address)).ToList();
    }

    private sealed class SourceIndex(List<SourceRow> rows)
    {
        private readonly ILookup<string, SourceRow> byCode = rows.Where(x => Identity(x.Code) != "").ToLookup(x => Identity(x.Code));
        private readonly ILookup<(string, DateTime), SourceRow> byDate = rows.Where(x => NameKey(x.Name) != "" && FullDate(x.BirthDate).HasValue)
            .ToLookup(x => (NameKey(x.Name), FullDate(x.BirthDate)!.Value));
        private readonly ILookup<(string, string), SourceRow> byYear = rows.Where(x => NameKey(x.Name) != "")
            .ToLookup(x => (NameKey(x.Name), FullDate(x.BirthDate)?.Year.ToString() ?? Year(x.BirthYear)));
        public (string Method, List<SourceRow> Rows) Find(ElderlyRecord row)
        {
            var found = byCode[Identity(row.Cccd)].ToList();
            if (found.Count > 0) return ("Căn cước", found);
            var date = FullDate(row.NgaySinh) ?? FullDate(row.NamSinh);
            if (date.HasValue)
            {
                found = byDate[(NameKey(row.HoTen), date.Value)].ToList();
                if (found.Count > 0) return ("Họ tên + Ngày sinh", found);
            }
            var year = date?.Year.ToString() ?? Year(row.NamSinh);
            if (year != "") found = byYear[(NameKey(row.HoTen), year)].ToList();
            return (found.Count > 0 ? "Họ tên + Năm sinh" : "", found);
        }
    }

    private static (string Code, string Address) Proposed(ElderlyRecord row, SourceRow source) =>
        (Identity(source.Code) == "" ? row.Cccd : source.Code!.Trim(),
         string.IsNullOrWhiteSpace(source.Address) ? row.DiaChi : source.Address.Trim());

    public sealed class UpdateInformationRequest
    {
        public string Source { get; set; } = "";
        public int SourceId { get; set; }
        public string CurrentCode { get; set; } = "";
        public string CurrentAddress { get; set; } = "";
        public string NewCode { get; set; } = "";
        public string NewAddress { get; set; } = "";
    }

    [HttpPost("{id:int}/update-information")]
    public async Task<IActionResult> UpdateInformation(int id, [FromBody] UpdateInformationRequest request)
    {
        var row = await db.ElderlyRecords.FindAsync(id);
        if (row == null) return NotFound(new { message = "Không tìm thấy dòng import." });
        if (row.Cccd != request.CurrentCode || row.DiaChi != request.CurrentAddress)
            return Conflict(new { message = "Dữ liệu đã thay đổi. Vui lòng tải lại đối chiếu." });
        var customers = await db.Customers.AsNoTracking().Select(x => new { x.Code, x.Name, x.BirthDate, x.TaxCode }).ToListAsync();
        var date = FullDate(row.NgaySinh) ?? FullDate(row.NamSinh);
        var year = date?.Year.ToString() ?? Year(row.NamSinh);
        if (customers.Any(x => (Identity(row.Cccd) != "" && Identity(x.Code) == Identity(row.Cccd))
            || (NameKey(row.HoTen) != "" && NameKey(x.Name) == NameKey(row.HoTen)
                && ((date.HasValue && x.BirthDate?.Date == date.Value)
                    || (year != "" && (x.BirthDate?.Year.ToString() ?? Year(x.TaxCode)) == year)))))
            return Conflict(new { message = "Dòng này đã khớp hồ sơ khám. Vui lòng tải lại đối chiếu." });
        var source = new SourceIndex(await Sources()).Find(row).Rows
            .SingleOrDefault(x => x.Source == request.Source && x.Id == request.SourceId);
        if (source == null) return Conflict(new { message = "Nguồn đối chiếu không còn khớp. Vui lòng tải lại." });
        var proposed = Proposed(row, source);
        if (proposed.Code != request.NewCode || proposed.Address != request.NewAddress)
            return Conflict(new { message = "Thông tin nguồn đã thay đổi. Vui lòng tải lại đối chiếu." });
        row.Cccd = proposed.Code;
        row.DiaChi = proposed.Address;
        await db.SaveChangesAsync();
        return Ok(new { message = "Đã cập nhật căn cước và địa chỉ dòng người cao tuổi." });
    }
    [HttpGet("review")]
    public async Task<IActionResult> Review()
    {
        var imported = await db.ElderlyRecords.AsNoTracking().OrderByDescending(x => x.ImportedAt).ThenBy(x => x.Id).ToListAsync();
        var customers = await db.Customers.AsNoTracking().OrderBy(x => x.Id)
            .Select(x => new { x.Id, x.Code, x.Name, x.BirthDate, x.TaxCode, x.Address, x.ExaminationDate }).ToListAsync();
        var byCode = customers.Where(x => Identity(x.Code) != "").ToLookup(x => Identity(x.Code));
        var byDate = customers.Where(x => NameKey(x.Name) != "" && x.BirthDate.HasValue)
            .ToLookup(x => (NameKey(x.Name), x.BirthDate!.Value.Date));
        var byYear = customers.Where(x => NameKey(x.Name) != "")
            .ToLookup(x => (NameKey(x.Name), x.BirthDate?.Year.ToString() ?? Year(x.TaxCode)));
        var sourceIndex = new SourceIndex(await Sources());
        return Ok(imported.Select(row =>
        {
            var matches = byCode[Identity(row.Cccd)].ToList();
            var method = matches.Count > 0 ? "Căn cước" : "";
            var name = NameKey(row.HoTen);
            var date = FullDate(row.NgaySinh) ?? FullDate(row.NamSinh);
            if (matches.Count == 0 && name != "" && date.HasValue)
            {
                matches = byDate[(name, date.Value)].ToList();
                if (matches.Count > 0) method = "Họ tên + Ngày sinh";
            }
            var year = date?.Year.ToString() ?? Year(row.NamSinh);
            if (matches.Count == 0 && name != "" && year != "")
            {
                matches = byYear[(name, year)].ToList();
                if (matches.Count > 0) method = "Họ tên + Năm sinh";
            }
            var sourceMatches = matches.Count == 0 ? sourceIndex.Find(row) : ("", new List<SourceRow>());
            var suggestions = sourceMatches.Item2.Select(source =>
            {
                var proposed = Proposed(row, source);
                return new { source.Id, source.Source, source.Label, source.Name, source.BirthDate, source.BirthYear,
                    newCode = proposed.Code, newAddress = proposed.Address,
                    canUpdate = proposed.Code != row.Cccd || proposed.Address != row.DiaChi };
            }).ToList();
            return new { row.Id, row.HoTen, row.NamSinh, row.NgaySinh, row.GioiTinh, row.Cccd,
                row.DiaChi, row.NgayKham, method, matches, sourceMethod = sourceMatches.Item1, suggestions };
        }));
    }

    [HttpPost("import")]
    public async Task<IActionResult> Import([FromBody] List<ElderlyRecord> rows)
    {
        if (rows.Count == 0) return BadRequest(new { message = "Không có dữ liệu để import." });
        var importedAt = DateTime.UtcNow;
        for (var i = 0; i < rows.Count; i++)
        {
            var row = rows[i];
            if (row == null || string.IsNullOrWhiteSpace(row.HoTen))
                return BadRequest(new { message = $"Dòng {i + 1}: thiếu họ và tên." });
            row.Id = 0;
            row.HoTen = row.HoTen.Trim();
            row.NamSinh = row.NamSinh?.Trim() ?? "";
            row.GioiTinh = row.GioiTinh?.Trim() ?? "";
            row.Cccd = row.Cccd?.Trim() ?? "";
            row.DiaChi = row.DiaChi?.Trim() ?? "";
            row.NgayKham = row.NgayKham?.Trim() ?? "";
            row.NgaySinh = row.NgaySinh?.Trim() ?? "";
            row.IsChecked = false;
            row.ImportedAt = importedAt;
        }
        db.ElderlyRecords.AddRange(rows);
        await db.SaveChangesAsync();
        return Ok(new { savedCount = rows.Count });
    }

    [HttpDelete("all")]
    public async Task<IActionResult> DeleteAll()
    {
        var count = await db.ElderlyRecords.ExecuteDeleteAsync();
        return Ok(new { count });
    }
}