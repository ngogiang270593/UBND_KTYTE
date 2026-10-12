using backend.Data;
using backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public sealed class OfficeMeetingDisplaySettingsController(AppDbContext db) : ControllerBase
{
    private static readonly int[] RefreshOptions = [5, 10, 15, 30, 60];
    private static readonly int[] ScrollOptions = [20, 30, 45, 60, 90];
    private static readonly string[] FontOptions = ["Times New Roman", "Arial", "Tahoma", "Georgia", "Verdana"];
    private static readonly int[] FontSizeOptions = [10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 28, 32, 36];

    [HttpGet]
    public async Task<ActionResult<MeetingDisplaySettingsResponse>> Get(CancellationToken cancellationToken)
    {
        var settings = await db.OfficeMeetingDisplaySettings.AsNoTracking()
            .SingleAsync(item => item.Id == 1, cancellationToken);
        return Ok(ToResponse(settings));
    }

    [HttpPut]
    public async Task<ActionResult<MeetingDisplaySettingsResponse>> Update(
        [FromBody] UpdateMeetingDisplaySettingsRequest request,
        CancellationToken cancellationToken)
    {
        if (!RefreshOptions.Contains(request.RefreshSeconds)
            || !ScrollOptions.Contains(request.ScrollSeconds)
            || request.DisplayPeriod is not ("day" or "week")
            || !FontOptions.Contains(request.TitleFont, StringComparer.Ordinal)
            || !FontOptions.Contains(request.MeetingFont, StringComparer.Ordinal)
            || !FontSizeOptions.Contains(request.TitleFontSizePt)
            || !FontSizeOptions.Contains(request.MeetingFontSizePt))
            return BadRequest(new { message = "Cấu hình thời gian hoặc phông chữ không hợp lệ." });

        var settings = await db.OfficeMeetingDisplaySettings
            .SingleAsync(item => item.Id == 1, cancellationToken);
        settings.RefreshSeconds = request.RefreshSeconds;
        settings.ScrollSeconds = request.ScrollSeconds;
        settings.TitleFont = request.TitleFont;
        settings.MeetingFont = request.MeetingFont;
        settings.TitleFontSizePt = request.TitleFontSizePt;
        settings.MeetingFontSizePt = request.MeetingFontSizePt;
        settings.DisplayPeriod = request.DisplayPeriod;
        await db.SaveChangesAsync(cancellationToken);
        return Ok(ToResponse(settings));
    }

    private static MeetingDisplaySettingsResponse ToResponse(OfficeMeetingDisplaySettings settings) =>
        new(
            settings.RefreshSeconds,
            settings.ScrollSeconds,
            settings.TitleFont,
            settings.MeetingFont,
            settings.TitleFontSizePt,
            settings.MeetingFontSizePt,
            settings.DisplayPeriod);
}

public sealed record UpdateMeetingDisplaySettingsRequest(
    int RefreshSeconds,
    int ScrollSeconds,
    string TitleFont,
    string MeetingFont,
    int TitleFontSizePt,
    int MeetingFontSizePt,
    string DisplayPeriod);
public sealed record MeetingDisplaySettingsResponse(
    int RefreshSeconds,
    int ScrollSeconds,
    string TitleFont,
    string MeetingFont,
    int TitleFontSizePt,
    int MeetingFontSizePt,
    string DisplayPeriod);
