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
    private const long MaxBackgroundImageSize = 5 * 1024 * 1024;

    [HttpGet]
    public async Task<ActionResult<MeetingDisplaySettingsResponse>> Get(CancellationToken cancellationToken)
    {
        var settings = await db.OfficeMeetingDisplaySettings.AsNoTracking()
            .Where(item => item.Id == 1)
            .Select(item => new MeetingDisplaySettingsResponse(
                item.RefreshSeconds,
                item.ScrollSeconds,
                item.TitleText,
                item.TitleFont,
                item.MeetingFont,
                item.TitleFontSizePt,
                item.MeetingFontSizePt,
                item.DisplayPeriod,
                item.BackgroundImageContentType != null))
            .SingleAsync(cancellationToken);
        return Ok(settings);
    }

    [HttpPut]
    public async Task<ActionResult<MeetingDisplaySettingsResponse>> Update(
        [FromBody] UpdateMeetingDisplaySettingsRequest request,
        CancellationToken cancellationToken)
    {
        if (!RefreshOptions.Contains(request.RefreshSeconds)
            || !ScrollOptions.Contains(request.ScrollSeconds)
            || string.IsNullOrWhiteSpace(request.TitleText) || request.TitleText.Length > 200
            || request.DisplayPeriod is not ("day" or "week" or "todayToWeekend")
            || !FontOptions.Contains(request.TitleFont, StringComparer.Ordinal)
            || !FontOptions.Contains(request.MeetingFont, StringComparer.Ordinal)
            || !FontSizeOptions.Contains(request.TitleFontSizePt)
            || !FontSizeOptions.Contains(request.MeetingFontSizePt))
            return BadRequest(new { message = "Cấu hình thời gian hoặc phông chữ không hợp lệ." });

        var settings = await db.OfficeMeetingDisplaySettings
            .SingleAsync(item => item.Id == 1, cancellationToken);
        settings.RefreshSeconds = request.RefreshSeconds;
        settings.ScrollSeconds = request.ScrollSeconds;
        settings.TitleText = request.TitleText.Trim();
        settings.TitleFont = request.TitleFont;
        settings.MeetingFont = request.MeetingFont;
        settings.TitleFontSizePt = request.TitleFontSizePt;
        settings.MeetingFontSizePt = request.MeetingFontSizePt;
        settings.DisplayPeriod = request.DisplayPeriod;
        await db.SaveChangesAsync(cancellationToken);
        return Ok(ToResponse(settings));
    }

    [HttpPost("background")]
    [RequestSizeLimit(MaxBackgroundImageSize + 64 * 1024)]
    public async Task<ActionResult<MeetingDisplaySettingsResponse>> UploadBackground(
        [FromForm] IFormFile? image,
        CancellationToken cancellationToken)
    {
        if (image is null || image.Length == 0)
            return BadRequest(new { message = "Vui lòng chọn ảnh nền." });
        if (image.Length > MaxBackgroundImageSize)
            return BadRequest(new { message = "Ảnh nền không được vượt quá 5 MB." });

        await using var imageStream = new MemoryStream((int)image.Length);
        await image.CopyToAsync(imageStream, cancellationToken);
        var imageData = imageStream.ToArray();
        if (!TryGetImageContentType(imageData, out var contentType))
            return BadRequest(new { message = "Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP hợp lệ." });

        var settings = await db.OfficeMeetingDisplaySettings
            .SingleAsync(item => item.Id == 1, cancellationToken);
        settings.BackgroundImageData = imageData;
        settings.BackgroundImageContentType = contentType;
        await db.SaveChangesAsync(cancellationToken);
        return Ok(ToResponse(settings));
    }

    [HttpDelete("background")]
    public async Task<ActionResult<MeetingDisplaySettingsResponse>> ResetBackground(CancellationToken cancellationToken)
    {
        var settings = await db.OfficeMeetingDisplaySettings
            .SingleAsync(item => item.Id == 1, cancellationToken);
        settings.BackgroundImageData = null;
        settings.BackgroundImageContentType = null;
        await db.SaveChangesAsync(cancellationToken);
        return Ok(ToResponse(settings));
    }

    private static MeetingDisplaySettingsResponse ToResponse(OfficeMeetingDisplaySettings settings) =>
        new(
            settings.RefreshSeconds,
            settings.ScrollSeconds,
            settings.TitleText,
            settings.TitleFont,
            settings.MeetingFont,
            settings.TitleFontSizePt,
            settings.MeetingFontSizePt,
            settings.DisplayPeriod,
            settings.BackgroundImageContentType is not null);

    private static bool TryGetImageContentType(byte[] imageData, out string contentType)
    {
        contentType = string.Empty;
        if (imageData.Length >= 3 && imageData.AsSpan(0, 3).SequenceEqual(new byte[] { 0xFF, 0xD8, 0xFF }))
            contentType = "image/jpeg";
        else if (imageData.Length >= 8
            && imageData.AsSpan(0, 8).SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }))
            contentType = "image/png";
        else if (imageData.Length >= 12
            && imageData.AsSpan(0, 4).SequenceEqual("RIFF"u8)
            && imageData.AsSpan(8, 4).SequenceEqual("WEBP"u8))
            contentType = "image/webp";
        return contentType.Length > 0;
    }
}

public sealed record UpdateMeetingDisplaySettingsRequest(
    int RefreshSeconds,
    int ScrollSeconds,
    string TitleText,
    string TitleFont,
    string MeetingFont,
    int TitleFontSizePt,
    int MeetingFontSizePt,
    string DisplayPeriod,
    bool HasCustomBackground);
public sealed record MeetingDisplaySettingsResponse(
    int RefreshSeconds,
    int ScrollSeconds,
    string TitleText,
    string TitleFont,
    string MeetingFont,
    int TitleFontSizePt,
    int MeetingFontSizePt,
    string DisplayPeriod,
    bool HasCustomBackground);
