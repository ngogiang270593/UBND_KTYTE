namespace backend.Models
{
    public class TanChauOutpatientRecord
    {
        public int Id { get; set; }
        public string HoTen { get; set; } = "";
        public string NamSinh { get; set; } = "";
        public string GioiTinh { get; set; } = "";
        public string Cccd { get; set; } = "";
        public string DiaChi { get; set; } = "";
        public string SourceFileName { get; set; } = "";
        public DateTime ImportedAt { get; set; } = DateTime.Now;
    }
}
