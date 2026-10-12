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
        if (!RefreshOptions.Contains(request.RefreshSeconds) || !ScrollOptions.Contains(request.ScrollSeconds))
            return BadRequest(new { message = "Thời gian cập nhật hoặc chạy lịch không hợp lệ." });

        var settings = await db.OfficeMeetingDisplaySettings
            .SingleAsync(item => item.Id == 1, cancellationToken);
        settings.RefreshSeconds = request.RefreshSeconds;
        settings.ScrollSeconds = request.ScrollSeconds;
        await db.SaveChangesAsync(cancellationToken);
        return Ok(ToResponse(settings));
    }

    private static MeetingDisplaySettingsResponse ToResponse(OfficeMeetingDisplaySettings settings) =>
        new(settings.RefreshSeconds, settings.ScrollSeconds);
}

public sealed record UpdateMeetingDisplaySettingsRequest(int RefreshSeconds, int ScrollSeconds);
public sealed record MeetingDisplaySettingsResponse(int RefreshSeconds, int ScrollSeconds);
