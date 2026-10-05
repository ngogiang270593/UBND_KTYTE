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
public sealed class OfficeMeetingYearsController(AppDbContext db) : ControllerBase
{
    private const string CatalogCategory = "officeMeetingYear";

    /// <summary>Lists meeting years in descending order.</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<OfficeMeetingYearResponse>>> GetAll(CancellationToken cancellationToken)
    {
        var years = await db.CatalogItems.AsNoTracking()
            .Where(item => item.Category == CatalogCategory)
            .OrderByDescending(item => item.Name)
            .Select(item => new OfficeMeetingYearResponse(item.Id, item.Name))
            .ToListAsync(cancellationToken);
        return Ok(years);
    }

    /// <summary>Gets a meeting year by its identifier.</summary>
    [HttpGet("{id:int}")]
    public async Task<ActionResult<OfficeMeetingYearResponse>> GetById(int id, CancellationToken cancellationToken)
    {
        var year = await db.CatalogItems.AsNoTracking()
            .Where(item => item.Id == id && item.Category == CatalogCategory)
            .Select(item => new OfficeMeetingYearResponse(item.Id, item.Name))
            .SingleOrDefaultAsync(cancellationToken);
        return year is null ? NotFound() : Ok(year);
    }

    /// <summary>Adds a year to the meeting year catalog.</summary>
    [HttpPost]
    public async Task<ActionResult<OfficeMeetingYearResponse>> Create(
        [FromBody] SaveOfficeMeetingYearRequest request,
        CancellationToken cancellationToken)
    {
        if (!IsValidYear(request.Name))
            return BadRequest(new { message = "Năm phải là số có 4 chữ số từ 1000 đến 9999." });
        if (await ExistsAsync(request.Name, null, cancellationToken))
            return Conflict(new { message = "Năm này đã có trong danh mục." });

        var year = new CatalogItem
        {
            Category = CatalogCategory,
            Name = request.Name,
            IsDefault = false
        };
        db.CatalogItems.Add(year);
        await db.SaveChangesAsync(cancellationToken);

        var response = new OfficeMeetingYearResponse(year.Id, year.Name);
        return CreatedAtAction(nameof(GetById), new { id = year.Id }, response);
    }

    /// <summary>Updates a year in the meeting year catalog.</summary>
    [HttpPut("{id:int}")]
    public async Task<ActionResult<OfficeMeetingYearResponse>> Update(
        int id,
        [FromBody] SaveOfficeMeetingYearRequest request,
        CancellationToken cancellationToken)
    {
        var year = await db.CatalogItems.SingleOrDefaultAsync(
            item => item.Id == id && item.Category == CatalogCategory, cancellationToken);
        if (year is null) return NotFound();
        if (!IsValidYear(request.Name))
            return BadRequest(new { message = "Năm phải là số có 4 chữ số từ 1000 đến 9999." });
        if (await ExistsAsync(request.Name, id, cancellationToken))
            return Conflict(new { message = "Năm này đã có trong danh mục." });

        year.Name = request.Name;
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new OfficeMeetingYearResponse(year.Id, year.Name));
    }

    /// <summary>Deletes a year from the meeting year catalog.</summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        var year = await db.CatalogItems.SingleOrDefaultAsync(
            item => item.Id == id && item.Category == CatalogCategory, cancellationToken);
        if (year is null) return NotFound();

        db.CatalogItems.Remove(year);
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private Task<bool> ExistsAsync(string name, int? exceptId, CancellationToken cancellationToken)
    {
        var query = db.CatalogItems.Where(item => item.Category == CatalogCategory && item.Name == name);
        if (exceptId.HasValue)
            query = query.Where(item => item.Id != exceptId.Value);
        return query.AnyAsync(cancellationToken);
    }

    private static bool IsValidYear(string name) =>
        int.TryParse(name, out var year) && year is >= 1000 and <= 9999 && name.Length == 4;
}

/// <summary>Request payload for creating or updating a meeting year.</summary>
public sealed record SaveOfficeMeetingYearRequest
{
    /// <summary>The four-digit calendar year.</summary>
    [Required, RegularExpression(@"^\d{4}$")]
    public required string Name { get; init; }
}

/// <summary>A year available for filtering online meetings.</summary>
public sealed record OfficeMeetingYearResponse(int Id, string Name);
