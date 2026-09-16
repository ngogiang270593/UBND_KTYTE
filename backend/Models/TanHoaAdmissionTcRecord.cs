namespace backend.Models
{
    public class TanHoaAdmissionTcRecord
    {
        public int Id { get; set; }
        public string? SoTheBhyt { get; set; }
        public string? NgheNghiep { get; set; }
        public string? ChanDoanVaoVien { get; set; }
        public string? Stt { get; set; }
        public string? NamSinh { get; set; }
        public string? HoTen { get; set; }
        public string? DiaChi { get; set; }
        public string? GioiTinh { get; set; }
        public string? SourceFileName { get; set; }
        public DateTime ImportedAt { get; set; }
    }
}