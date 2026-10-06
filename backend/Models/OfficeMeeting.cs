namespace backend.Models;

public class OfficeMeeting
{
    public int Id { get; set; }
    public string Number { get; set; } = "";
    public DateTime MeetingDate { get; set; }
    public string MeetingType { get; set; } = "Họp Trực Tuyến";
    public string Content { get; set; } = "";
    public int AttendeeCount { get; set; }
    public string? AttachmentName { get; set; }
    public string? AttachmentPath { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
