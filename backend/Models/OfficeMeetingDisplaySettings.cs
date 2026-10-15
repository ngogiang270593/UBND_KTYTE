namespace backend.Models;

public sealed class OfficeMeetingDisplaySettings
{
    public int Id { get; set; } = 1;
    public int RefreshSeconds { get; set; } = 15;
    public int ScrollSeconds { get; set; } = 45;
    public string TitleText { get; set; } = "Lịch Họp - UBND xã Tân Hòa";
    public string TitleFont { get; set; } = "Times New Roman";
    public string MeetingFont { get; set; } = "Times New Roman";
    public int TitleFontSizePt { get; set; } = 14;
    public int MeetingFontSizePt { get; set; } = 13;
    public string DisplayPeriod { get; set; } = "day";
    public byte[]? BackgroundImageData { get; set; }
    public string? BackgroundImageContentType { get; set; }
}
