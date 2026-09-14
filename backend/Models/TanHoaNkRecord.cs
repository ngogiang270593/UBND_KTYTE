namespace backend.Models
{
    public class TanHoaNkRecord
    {
        public int Id { get; set; }
        public string? Cccd { get; set; }
        public string? NgaySinh { get; set; }
        public string? NamSinh { get; set; }
        public string? HoTen { get; set; }
        public string? DiaChi { get; set; }
        public string? SoTheBhyt { get; set; }
        public string? SourceFileName { get; set; }
        public DateTime ImportedAt { get; set; }
    }
}