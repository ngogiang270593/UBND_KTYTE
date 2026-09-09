namespace backend.Models
{
    public class TanChauInpatientRecord
    {
        public int Id { get; set; }
        public string Stt { get; set; } = "";
        public string HoTen { get; set; } = "";
        public string SoCccd { get; set; } = "";
        public string NgaySinh { get; set; } = "";
        public string GioiTinh { get; set; } = "";
        public string MaQuocTich { get; set; } = "";
        public string MaDanToc { get; set; } = "";
        public string DiaChi { get; set; } = "";
        public string MaHuyenCuTru { get; set; } = "";
        public string MaXaCuTru { get; set; } = "";
        public string DienThoai { get; set; } = "";
        public string MaTheBhyt { get; set; } = "";
        public string MaDkbd { get; set; } = "";
        public string GtTheTu { get; set; } = "";
        public string GtTheDen { get; set; } = "";
        public string NgayMienCct { get; set; } = "";
        public string LyDoVv { get; set; } = "";
        public string LyDoVnt { get; set; } = "";
        public string MaLyDoVnt { get; set; } = "";
        public string ChanDoanVao { get; set; } = "";
        public string ChanDoanRv { get; set; } = "";
        public string MaBenhChinh { get; set; } = "";
        public string MaBenhKt { get; set; } = "";
        public string MaBenhYhct { get; set; } = "";
        public string MaPtttQt { get; set; } = "";
        public string MaNoiDi { get; set; } = "";
        public string MaNoiDen { get; set; } = "";
        public string SoNgayDtri { get; set; } = "";
        public string SourceFileName { get; set; } = "";
        public DateTime ImportedAt { get; set; } = DateTime.UtcNow;
    }
}
