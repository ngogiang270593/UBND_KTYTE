using backend.Data;
using backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class UpdatedInformationController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll() => Ok(await db.UpdatedInformationRecords
        .AsNoTracking().OrderByDescending(x => x.ImportedAt).ThenBy(x => x.Id).ToListAsync());


    public sealed class AddressUpdateRequest
    {
        public List<AddressUpdateItem> Items { get; set; } = new();
    }

    public sealed class AddressUpdateItem
    {
        public int CustomerId { get; set; }
        public string CurrentAddress { get; set; } = "";
        public string NewAddress { get; set; } = "";
        public string Code { get; set; } = "";
    }

    private static string Identity(string? value) =>
        string.Concat((value ?? "").Where(c => !char.IsWhiteSpace(c)));

    private async Task<Dictionary<string, List<UpdatedInformationRecord>>> AddressSources() =>
        (await db.UpdatedInformationRecords.AsNoTracking().OrderByDescending(x => x.ImportedAt)
            .ThenByDescending(x => x.Id).ToListAsync())
        .Where(x => Identity(x.Cccd).Length > 0)
        .GroupBy(x => Identity(x.Cccd)).ToDictionary(x => x.Key, x => x.ToList());

    private static (string Address, string Name, string Status) ResolveAddress(
        string? code, string? currentAddress, Dictionary<string, List<UpdatedInformationRecord>> sources)
    {
        var identity = Identity(code);
        if (identity.Length == 0) return ("", "", "Thiếu căn cước");
        if (!sources.TryGetValue(identity, out var matches)) return ("", "", "Không khớp căn cước");
        var addresses = matches.Select(x => x.DiaChi.Trim()).Where(x => x.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        if (addresses.Count == 0) return ("", matches[0].HoTen, "Nguồn chưa có địa chỉ");
        if (addresses.Count > 1) return ("", matches[0].HoTen, "Trùng căn cước, khác địa chỉ");
        var address = addresses[0];
        return (address, matches.First(x => string.Equals(x.DiaChi.Trim(), address, StringComparison.OrdinalIgnoreCase)).HoTen,
            string.Equals(currentAddress?.Trim(), address, StringComparison.OrdinalIgnoreCase)
                ? "Địa chỉ đã trùng" : "Có thể cập nhật");
    }

    [HttpGet("address-preview")]
    public async Task<IActionResult> PreviewAddresses()
    {
        // Keep one result per imported record, including duplicates and unmatched identities.
        var imported = await db.UpdatedInformationRecords.AsNoTracking()
            .OrderByDescending(x => x.ImportedAt).ThenBy(x => x.Id).ToListAsync();
        var sources = imported.Where(x => Identity(x.Cccd).Length > 0)
            .GroupBy(x => Identity(x.Cccd)).ToDictionary(x => x.Key, x => x.ToList());
        var customers = await db.Customers.AsNoTracking().OrderBy(x => x.Name).ThenBy(x => x.Id)
            .Select(x => new { x.Id, x.Code, x.Name, x.Address }).ToListAsync();
        var byIdentity = customers.Where(x => Identity(x.Code).Length > 0).ToLookup(x => Identity(x.Code));
        var rows = imported.Select(source =>
        {
            var identity = Identity(source.Cccd);
            var matches = byIdentity[identity].Select(customer =>
            {
                var match = ResolveAddress(customer.Code, customer.Address, sources);
                var status = string.IsNullOrWhiteSpace(source.DiaChi) ? "Nguồn chưa có địa chỉ" : match.Status;
                return new
                {
                    customerId = customer.Id, customer.Code, customer.Name,
                    currentAddress = customer.Address, newAddress = source.DiaChi.Trim(),
                    status, canUpdate = status == "Có thể cập nhật"
                };
            }).ToList();
            var status = identity.Length == 0 ? "Thiếu căn cước"
                : matches.Count == 0 ? "Không tìm thấy hồ sơ khám"
                : string.Join("; ", matches.Select(x => x.status).Distinct());
            return new
            {
                importId = source.Id, source.Stt, code = source.Cccd,
                sourceName = source.HoTen, newAddress = source.DiaChi,
                duplicateCount = identity.Length > 0 ? sources[identity].Count : 0,
                matches, status, canUpdate = matches.Any(x => x.canUpdate)
            };
        }).ToList();
        return Ok(rows);
    }

    [HttpPost("update-addresses")]
    public async Task<IActionResult> UpdateAddresses([FromBody] AddressUpdateRequest request)
    {
        if (request.Items == null || request.Items.Count == 0 || request.Items.Any(x => x == null))
            return BadRequest(new { message = "Không có hồ sơ cần cập nhật." });
        var items = request.Items.DistinctBy(x => x.CustomerId).ToList();
        var ids = items.Select(x => x.CustomerId).ToList();
        var sources = await AddressSources();
        var customers = await db.Customers.Where(x => ids.Contains(x.Id)).ToDictionaryAsync(x => x.Id);
        var updated = 0;
        foreach (var item in items)
        {
            if (!customers.TryGetValue(item.CustomerId, out var customer)) continue;
            var match = ResolveAddress(customer.Code, customer.Address, sources);
            // Recheck both the source and the values the user previewed before changing anything.
            if (match.Status != "Có thể cập nhật"
                || !string.Equals(customer.Address, item.CurrentAddress, StringComparison.Ordinal)
                || !string.Equals(customer.Code, item.Code, StringComparison.Ordinal)
                || !string.Equals(match.Address, item.NewAddress, StringComparison.Ordinal)) continue;
            customer.Address = match.Address;
            updated++;
        }
        await db.SaveChangesAsync();
        return Ok(new
        {
            updated, skipped = items.Count - updated,
            message = $"Đã cập nhật địa chỉ {updated} hồ sơ; bỏ qua {items.Count - updated} hồ sơ không còn đủ điều kiện hoặc dữ liệu đã thay đổi."
        });
    }

    [HttpPost("import")]
    public async Task<IActionResult> Import([FromBody] List<UpdatedInformationRecord> rows)
    {
        if (rows.Count == 0) return BadRequest(new { message = "Không có dữ liệu để import." });
        var importedAt = DateTime.UtcNow;
        for (var i = 0; i < rows.Count; i++)
        {
            var row = rows[i];
            if (row == null || string.IsNullOrWhiteSpace(row.HoTen))
                return BadRequest(new { message = $"Dòng {i + 1}: thiếu họ và tên." });
            row.Id = 0;
            row.Stt = string.IsNullOrWhiteSpace(row.Stt) ? (i + 1).ToString() : row.Stt.Trim();
            row.Cccd = row.Cccd?.Trim() ?? "";
            row.HoTen = row.HoTen.Trim();
            row.DiaChi = row.DiaChi?.Trim() ?? "";
            row.ImportedAt = importedAt;
        }
        db.UpdatedInformationRecords.AddRange(rows);
        await db.SaveChangesAsync();
        return Ok(new { savedCount = rows.Count });
    }

    [HttpDelete("all")]
    public async Task<IActionResult> DeleteAll()
    {
        var count = await db.UpdatedInformationRecords.ExecuteDeleteAsync();
        return Ok(new { count });
    }
}
