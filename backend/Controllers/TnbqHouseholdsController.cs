using backend.Data;
using backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class TnbqHouseholdsController(AppDbContext context) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll() => Ok(await context.TnbqHouseholds
        .AsNoTracking().OrderBy(x => x.Id).ToListAsync());

    [HttpPost("import")]
    public async Task<IActionResult> Import(List<TnbqHouseholdImport> rows)
    {
        if (rows.Count == 0) return BadRequest(new { message = "Không có dữ liệu để lưu." });

        var now = DateTime.UtcNow;
        var households = rows.Select(row => new TnbqHousehold
        {
            Year = row.Year,
            HouseNumber = row.HouseNumber.Trim(),
            HouseholdNumber = row.HouseholdNumber.Trim(),
            HeadName = row.HeadName.Trim(),
            Address = row.Address.Trim(),
            Members = row.Members,
            Note = row.Note.Trim(),
            Province = row.Province.Trim(),
            Commune = row.Commune.Trim(),
            Hamlet = row.Hamlet.Trim(),
            AreaType = row.AreaType.Trim(),
            Preparer = row.Preparer.Trim(),
            Phone = row.Phone.Trim(),
            CreatedAt = now
        }).ToList();

        context.TnbqHouseholds.AddRange(households);
        await context.SaveChangesAsync();
        return Ok(new { inserted = households.Count, items = households });
    }

    [HttpDelete]
    public async Task<IActionResult> Delete([FromQuery] int year, [FromQuery] string? hamlet)
    {
        var query = context.TnbqHouseholds.Where(x => x.Year == year);
        if (!string.IsNullOrWhiteSpace(hamlet)) query = query.Where(x => x.Hamlet == hamlet);
        var deleted = await query.ExecuteDeleteAsync();
        return Ok(new { deleted });
    }
}

public record TnbqHouseholdImport(
    int Year, string HouseNumber, string HouseholdNumber, string HeadName, string Address,
    int Members, string Note, string Province, string Commune, string Hamlet,
    string AreaType, string Preparer, string Phone);
