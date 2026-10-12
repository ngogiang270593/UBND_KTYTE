using System.Globalization;
using backend.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[AllowAnonymous]
[ApiController]
[Route("api/[controller]")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class PublicOfficeMeetingsController(AppDbContext db) : ControllerBase
{
    [HttpGet("settings")]
    public async Task<ActionResult<PublicMeetingDisplaySettingsResponse>> GetSettings(CancellationToken cancellationToken)
    {
        var settings = await db.OfficeMeetingDisplaySettings.AsNoTracking()
            .Where(item => item.Id == 1)
            .Select(item => new PublicMeetingDisplaySettingsResponse(
                item.RefreshSeconds,
                item.ScrollSeconds,
                item.TitleFont,
                item.MeetingFont,
                item.TitleFontSizePt,
                item.MeetingFontSizePt,
                item.DisplayPeriod))
            .SingleOrDefaultAsync(cancellationToken);
        return settings is null
            ? StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = "Cấu hình lịch họp chưa sẵn sàng." })
            : Ok(settings);
    }

    [HttpGet("background")]
    public async Task<IActionResult> GetBackground(CancellationToken cancellationToken)
    {
        var background = await db.OfficeMeetingDisplaySettings.AsNoTracking()
            .Where(item => item.Id == 1)
            .Select(item => new { item.BackgroundImageData, item.BackgroundImageContentType })
            .SingleOrDefaultAsync(cancellationToken);
        if (background?.BackgroundImageData is not { Length: > 0 } image
            || background.BackgroundImageContentType is not ("image/jpeg" or "image/png" or "image/webp"))
        {
            return NoContent();
        }

        return File(image, background.BackgroundImageContentType);
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PublicOfficeMeetingResponse>>> Get(
        [FromQuery] string? date,
        CancellationToken cancellationToken,
        [FromQuery] string period = "day")
    {
        if (!DateTime.TryParseExact(
                date,
                "yyyy-MM-dd",
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out var meetingDay))
        {
            return BadRequest(new { message = "Ngày cần xem không hợp lệ." });
        }

        if (period is not ("day" or "week"))
            return BadRequest(new { message = "Phạm vi lịch họp không hợp lệ." });

        var firstDay = meetingDay.Date;
        if (period == "week")
        {
            var daysSinceMonday = ((int)firstDay.DayOfWeek + 6) % 7;
            firstDay = firstDay.AddDays(-daysSinceMonday);
        }
        var start = DateTime.SpecifyKind(firstDay, DateTimeKind.Utc);
        var end = start.AddDays(period == "week" ? 7 : 1);
        var meetings = await db.OfficeMeetings.AsNoTracking()
            .Where(meeting => meeting.IsPublic && meeting.MeetingDate >= start && meeting.MeetingDate < end)
            .OrderBy(meeting => meeting.MeetingDate)
            .ThenBy(meeting => meeting.MeetingTimeRange)
            .ThenBy(meeting => meeting.Content)
            .Select(meeting => new PublicOfficeMeetingResponse(
                meeting.MeetingDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                meeting.MeetingType,
                meeting.Content,
                meeting.MeetingTimeRange,
                meeting.MeetingRoom))
            .ToListAsync(cancellationToken);

        return Ok(meetings);
    }
}

public sealed record PublicOfficeMeetingResponse(
    string MeetingDate,
    string MeetingType,
    string Content,
    string? MeetingTimeRange,
    string? MeetingRoom);

public sealed record PublicMeetingDisplaySettingsResponse(
    int RefreshSeconds,
    int ScrollSeconds,
    string TitleFont,
    string MeetingFont,
    int TitleFontSizePt,
    int MeetingFontSizePt,
    string DisplayPeriod);
