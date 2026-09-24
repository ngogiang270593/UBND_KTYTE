namespace backend.Models;

public class UpdatedInformationRecord
{
    public int Id { get; set; }
    public string Stt { get; set; } = "";
    public string Cccd { get; set; } = "";
    public string HoTen { get; set; } = "";
    public string DiaChi { get; set; } = "";
    public DateTime ImportedAt { get; set; }
}
