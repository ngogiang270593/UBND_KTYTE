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
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PublicOfficeMeetingResponse>>> Get(
        [FromQuery] string? date,
        CancellationToken cancellationToken)
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

        var start = DateTime.SpecifyKind(meetingDay.Date, DateTimeKind.Utc);
        var end = start.AddDays(1);
        var meetings = await db.OfficeMeetings.AsNoTracking()
            .Where(meeting => meeting.IsPublic && meeting.MeetingDate >= start && meeting.MeetingDate < end)
            .OrderBy(meeting => meeting.MeetingTimeRange)
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
