namespace backend.Models;

public class ElderlyRecord
{
    public int Id { get; set; }
    public string HoTen { get; set; } = "";
    public string NamSinh { get; set; } = "";
    public string GioiTinh { get; set; } = "";
    public string Cccd { get; set; } = "";
    public string DiaChi { get; set; } = "";
    public string NgayKham { get; set; } = "";
    public string NgaySinh { get; set; } = "";
    // Retained for compatibility with existing database columns; no review-state feature.
    [System.Text.Json.Serialization.JsonIgnore]
    public bool IsChecked { get; set; }
    public DateTime ImportedAt { get; set; }
}