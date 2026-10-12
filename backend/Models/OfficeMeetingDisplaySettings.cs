namespace backend.Models;

public sealed class OfficeMeetingDisplaySettings
{
    public int Id { get; set; } = 1;
    public int RefreshSeconds { get; set; } = 15;
    public int ScrollSeconds { get; set; } = 45;
}
