namespace backend.Models
{
    public class CommuneSubjectRecord
    {
        public int Id { get; set; }
        public string Stt { get; set; } = "";
        public string HoTen { get; set; } = "";
        public string NgaySinh { get; set; } = "";
        public string Cccd { get; set; } = "";
        public string DiaChi { get; set; } = "";
        public string DoiTuong { get; set; } = "";
        public string SourceFileName { get; set; } = "";
        public DateTime ImportedAt { get; set; } = DateTime.Now;
    }
}
