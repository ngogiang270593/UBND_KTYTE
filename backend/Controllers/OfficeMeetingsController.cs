using System.Globalization;
using backend.Data;
using backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public sealed class OfficeMeetingsController(AppDbContext db, ILogger<OfficeMeetingsController> logger) : ControllerBase
{
    private const long MaxAttachmentBytes = 25 * 1024 * 1024;
    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
        ".jpg", ".jpeg", ".png", ".txt", ".zip"
    };

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<OfficeMeetingResponse>>> GetAll(CancellationToken cancellationToken)
    {
        var meetings = await db.OfficeMeetings.AsNoTracking()
            .OrderByDescending(x => x.MeetingDate)
            .ThenByDescending(x => x.Id)
            .Select(x => ToResponse(x))
            .ToListAsync(cancellationToken);
        return Ok(meetings);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<OfficeMeetingResponse>> GetById(int id, CancellationToken cancellationToken)
    {
        var meeting = await db.OfficeMeetings.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        return meeting is null ? NotFound() : Ok(ToResponse(meeting));
    }

    [HttpPost]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(MaxAttachmentBytes + 1024 * 1024)]
    public async Task<ActionResult<OfficeMeetingResponse>> Create(
        [FromForm] CreateOfficeMeetingRequest request,
        CancellationToken cancellationToken)
    {
        if (!TryParseMeetingDate(request.MeetingDate, out var meetingDate))
            return BadRequest(new { message = "Ngày họp không hợp lệ. Vui lòng nhập theo định dạng dd/MM/yyyy." });

        if (request.AttendeeCount < 1)
            return BadRequest(new { message = "Số người họp phải lớn hơn 0." });

        string? savedPath = null;
        string? attachmentName = null;
        if (request.Attachment is { Length: > 0 } attachment)
        {
            if (attachment.Length > MaxAttachmentBytes)
                return BadRequest(new { message = "Tệp đính kèm không được vượt quá 25 MB." });

            var originalName = Path.GetFileName(attachment.FileName.Replace('\\', '/'));
            var safeName = new string(originalName.Where(character => !char.IsControl(character)).ToArray());
            var extension = Path.GetExtension(safeName);
            if (!AllowedExtensions.Contains(extension))
                return BadRequest(new { message = "Định dạng tệp chưa được hỗ trợ. Hãy chọn PDF, Office, ảnh, TXT hoặc ZIP." });

            var attachmentDirectory = GetAttachmentDirectory();
            Directory.CreateDirectory(attachmentDirectory);
            savedPath = Path.Combine(attachmentDirectory, $"{Guid.NewGuid():N}{extension.ToLowerInvariant()}");
            attachmentName = string.IsNullOrWhiteSpace(safeName) ? $"tep-dinh-kem{extension}" : safeName;
            await using var stream = new FileStream(savedPath, FileMode.CreateNew, FileAccess.Write, FileShare.None);
            await attachment.CopyToAsync(stream, cancellationToken);
        }

        var utcMeetingDate = EnsureUtc(meetingDate.Date);
        var meeting = new OfficeMeeting
        {
            Number = request.Number.Trim(),
            MeetingDate = utcMeetingDate,
            MeetingType = request.MeetingType.Trim(),
            Content = request.Content.Trim(),
            AttendeeCount = request.AttendeeCount,
            AttachmentName = attachmentName,
            AttachmentPath = savedPath,
            CreatedAt = EnsureUtc(DateTime.UtcNow)
        };

        try
        {
            db.OfficeMeetings.Add(meeting);
            await db.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            if (savedPath is not null && System.IO.File.Exists(savedPath))
                System.IO.File.Delete(savedPath);
            throw;
        }

        var response = ToResponse(meeting);
        return CreatedAtAction(nameof(GetById), new { id = meeting.Id }, response);
    }

    [HttpPut("{id:int}")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(MaxAttachmentBytes + 1024 * 1024)]
    public async Task<ActionResult<OfficeMeetingResponse>> Update(
        int id,
        [FromForm] CreateOfficeMeetingRequest request,
        CancellationToken cancellationToken)
    {
        var meeting = await db.OfficeMeetings.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (meeting is null) return NotFound(new { message = "Không tìm thấy cuộc họp cần cập nhật." });

        if (!TryParseMeetingDate(request.MeetingDate, out var meetingDate))
            return BadRequest(new { message = "Ngày họp không hợp lệ. Vui lòng nhập theo định dạng dd/MM/yyyy." });
        if (request.AttendeeCount < 1)
            return BadRequest(new { message = "Số người họp phải lớn hơn 0." });
        if (request.RemoveAttachment && request.Attachment is { Length: > 0 })
            return BadRequest(new { message = "Chỉ chọn thay tệp hoặc gỡ tệp hiện tại trong một lần cập nhật." });

        IFormFile? newAttachment = request.Attachment is { Length: > 0 } ? request.Attachment : null;
        string? newAttachmentPath = null;
        string? newAttachmentName = null;
        if (newAttachment is not null)
        {
            if (newAttachment.Length > MaxAttachmentBytes)
                return BadRequest(new { message = "Tệp đính kèm không được vượt quá 25 MB." });

            var originalName = Path.GetFileName(newAttachment.FileName.Replace('\\', '/'));
            var safeName = new string(originalName.Where(character => !char.IsControl(character)).ToArray());
            var extension = Path.GetExtension(safeName);
            if (!AllowedExtensions.Contains(extension))
                return BadRequest(new { message = "Định dạng tệp chưa được hỗ trợ. Hãy chọn PDF, Office, ảnh, TXT hoặc ZIP." });

            var attachmentDirectory = GetAttachmentDirectory();
            Directory.CreateDirectory(attachmentDirectory);
            newAttachmentPath = Path.Combine(attachmentDirectory, $"{Guid.NewGuid():N}{extension.ToLowerInvariant()}");
            newAttachmentName = string.IsNullOrWhiteSpace(safeName) ? $"tep-dinh-kem{extension}" : safeName;
            try
            {
                await using var stream = new FileStream(newAttachmentPath, FileMode.CreateNew, FileAccess.Write, FileShare.None);
                await newAttachment.CopyToAsync(stream, cancellationToken);
            }
            catch
            {
                if (System.IO.File.Exists(newAttachmentPath))
                    System.IO.File.Delete(newAttachmentPath);
                throw;
            }
        }

        var previousAttachmentPath = meeting.AttachmentPath;
        var utcMeetingDate = EnsureUtc(meetingDate.Date);
        meeting.Number = request.Number.Trim();
        meeting.MeetingDate = utcMeetingDate;
        meeting.MeetingType = request.MeetingType.Trim();
        meeting.Content = request.Content.Trim();
        meeting.AttendeeCount = request.AttendeeCount;
        if (newAttachmentPath is not null)
        {
            meeting.AttachmentPath = newAttachmentPath;
            meeting.AttachmentName = newAttachmentName;
        }
        else if (request.RemoveAttachment)
        {
            meeting.AttachmentPath = null;
            meeting.AttachmentName = null;
        }

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            if (newAttachmentPath is not null && System.IO.File.Exists(newAttachmentPath))
                System.IO.File.Delete(newAttachmentPath);
            throw;
        }

        if (newAttachmentPath is not null || request.RemoveAttachment)
        {
            try
            {
                DeleteAttachmentFile(previousAttachmentPath);
            }
            catch (IOException exception)
            {
                logger.LogError(exception, "Meeting {MeetingId} was updated but its previous attachment could not be removed.", id);
                return StatusCode(StatusCodes.Status500InternalServerError, new
                {
                    updated = true,
                    meeting = ToResponse(meeting),
                    message = "Đã cập nhật cuộc họp nhưng không xóa được tệp đính kèm cũ trên máy chủ."
                });
            }
            catch (UnauthorizedAccessException exception)
            {
                logger.LogError(exception, "Meeting {MeetingId} was updated but its previous attachment could not be removed.", id);
                return StatusCode(StatusCodes.Status500InternalServerError, new
                {
                    updated = true,
                    meeting = ToResponse(meeting),
                    message = "Đã cập nhật cuộc họp nhưng máy chủ không có quyền xóa tệp đính kèm cũ."
                });
            }
        }

        return Ok(ToResponse(meeting));
    }

    [HttpPut("category")]
    public async Task<IActionResult> UpdateCategory([FromBody] UpdateMeetingCategoryRequest request, CancellationToken cancellationToken)
    {
        if (request.Ids is null || request.Ids.Count == 0 || string.IsNullOrWhiteSpace(request.MeetingType)) return BadRequest(new { message = "Chưa chọn cuộc họp hoặc danh mục." });
        var meetings = await db.OfficeMeetings.Where(x => request.Ids.Contains(x.Id)).ToListAsync(cancellationToken);
        foreach (var meeting in meetings) meeting.MeetingType = request.MeetingType.Trim();
        await db.SaveChangesAsync(cancellationToken); return Ok(new { count = meetings.Count });
    }

    [HttpGet("{id:int}/attachment")]
    public async Task<IActionResult> DownloadAttachment(int id, CancellationToken cancellationToken)
    {
        var meeting = await db.OfficeMeetings.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (meeting is null) return NotFound();
        if (string.IsNullOrWhiteSpace(meeting.AttachmentPath) || string.IsNullOrWhiteSpace(meeting.AttachmentName))
            return NotFound(new { message = "Cuộc họp không có tệp đính kèm." });

        var path = GetStoredAttachmentPath(meeting.AttachmentPath);
        if (!System.IO.File.Exists(path)) return NotFound(new { message = "Tệp đính kèm không còn tồn tại." });

        return PhysicalFile(path, "application/octet-stream", meeting.AttachmentName, enableRangeProcessing: true);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        var meeting = await db.OfficeMeetings.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (meeting is null) return NotFound(new { message = "Không tìm thấy cuộc họp cần xóa." });

        db.OfficeMeetings.Remove(meeting);
        await db.SaveChangesAsync(cancellationToken);

        try
        {
            DeleteAttachmentFile(meeting.AttachmentPath);
        }
        catch (IOException exception)
        {
            logger.LogError(exception, "Meeting {MeetingId} was deleted but its attachment could not be removed.", id);
            return StatusCode(StatusCodes.Status500InternalServerError, new
            {
                deleted = true,
                message = "Đã xóa cuộc họp nhưng không xóa được tệp đính kèm trên máy chủ."
            });
        }
        catch (UnauthorizedAccessException exception)
        {
            logger.LogError(exception, "Meeting {MeetingId} was deleted but its attachment could not be removed.", id);
            return StatusCode(StatusCodes.Status500InternalServerError, new
            {
                deleted = true,
                message = "Đã xóa cuộc họp nhưng máy chủ không có quyền xóa tệp đính kèm."
            });
        }

        return NoContent();
    }

    [HttpDelete("all")]
    public async Task<IActionResult> DeleteAll(CancellationToken cancellationToken)
    {
        var meetings = await db.OfficeMeetings.ToListAsync(cancellationToken);
        if (meetings.Count == 0) return Ok(new { count = 0, message = "Danh sách cuộc họp đã trống." });

        db.OfficeMeetings.RemoveRange(meetings);
        await db.SaveChangesAsync(cancellationToken);

        var failedAttachmentCount = 0;
        foreach (var meeting in meetings)
        {
            try
            {
                DeleteAttachmentFile(meeting.AttachmentPath);
            }
            catch (IOException exception)
            {
                failedAttachmentCount++;
                logger.LogError(exception, "Meeting {MeetingId} was deleted but its attachment could not be removed.", meeting.Id);
            }
            catch (UnauthorizedAccessException exception)
            {
                failedAttachmentCount++;
                logger.LogError(exception, "Meeting {MeetingId} was deleted but its attachment could not be removed.", meeting.Id);
            }
        }

        if (failedAttachmentCount > 0)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, new
            {
                count = meetings.Count,
                failedAttachmentCount,
                message = $"Đã xóa {meetings.Count} cuộc họp nhưng còn {failedAttachmentCount} tệp đính kèm không thể xóa trên máy chủ."
            });
        }

        return Ok(new { count = meetings.Count, message = $"Đã xóa {meetings.Count} cuộc họp." });
    }

    private string GetStoredAttachmentPath(string storedPath)
    {
        var fileName = Path.GetFileName(storedPath);
        if (string.IsNullOrWhiteSpace(fileName))
            throw new InvalidOperationException("Đường dẫn tệp đính kèm không hợp lệ.");
        return Path.Combine(GetAttachmentDirectory(), fileName);
    }

    private static bool TryParseMeetingDate(string value, out DateTime meetingDate) =>
        DateTime.TryParseExact(value, ["dd/MM/yyyy", "ddMMyyyy"], CultureInfo.InvariantCulture,
            DateTimeStyles.None, out meetingDate);

    private static DateTime EnsureUtc(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
    };

    private void DeleteAttachmentFile(string? storedPath)
    {
        if (string.IsNullOrWhiteSpace(storedPath)) return;
        var path = GetStoredAttachmentPath(storedPath);
        if (System.IO.File.Exists(path)) System.IO.File.Delete(path);
    }

    private string GetAttachmentDirectory()
    {
        var configuredDirectory = Environment.GetEnvironmentVariable("UBND_KTYTE_DATA_DIR");
        var isWebProfile = string.Equals(
            Environment.GetEnvironmentVariable("UBND_KTYTE_DATA_PROFILE"), "web", StringComparison.OrdinalIgnoreCase);
        var dataDirectory = isWebProfile
            ? Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "UBND_KTYTE", "web")
            : !string.IsNullOrWhiteSpace(configuredDirectory)
                ? configuredDirectory
                : Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "UBND_KTYTE");
        return Path.GetFullPath(Path.Combine(dataDirectory, "OfficeMeetingAttachments"));
    }

    private static OfficeMeetingResponse ToResponse(OfficeMeeting meeting) =>
        new(meeting.Id, meeting.Number, meeting.MeetingDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            meeting.MeetingType, meeting.Content, meeting.AttendeeCount, meeting.AttachmentName);
}

/// <summary>Form fields used to register a meeting and its optional attachment.</summary>
public sealed class CreateOfficeMeetingRequest
{
    [FromForm(Name = "Number"), System.ComponentModel.DataAnnotations.Required, System.ComponentModel.DataAnnotations.StringLength(50)]
    public string Number { get; set; } = "";

    [FromForm(Name = "MeetingDate"), System.ComponentModel.DataAnnotations.Required]
    public string MeetingDate { get; set; } = "";

    [FromForm(Name = "MeetingType"), System.ComponentModel.DataAnnotations.Required]
    public string MeetingType { get; set; } = "Họp Trực Tuyến";

    [FromForm(Name = "Content"), System.ComponentModel.DataAnnotations.Required, System.ComponentModel.DataAnnotations.StringLength(2000)]
    public string Content { get; set; } = "";

    [FromForm(Name = "AttendeeCount"), System.ComponentModel.DataAnnotations.Range(1, 100000)]
    public int AttendeeCount { get; set; }

    [FromForm(Name = "Attachment")]
    public IFormFile? Attachment { get; set; }

    [FromForm(Name = "RemoveAttachment")]
    public bool RemoveAttachment { get; set; }
}

public sealed record UpdateMeetingCategoryRequest(List<int> Ids, string MeetingType);

/// <summary>Meeting details returned by the office meetings API.</summary>
public sealed record OfficeMeetingResponse(
    int Id,
    string Number,
    string MeetingDate,
    string MeetingType,
    string Content,
    int AttendeeCount,
    string? AttachmentName);
