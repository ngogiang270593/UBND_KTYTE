namespace backend.Models
{
    public class PurchaseSheetDetail
    {
        public int Id { get; set; }
        public int PurchaseSheetId { get; set; }

        public DateTime Date { get; set; }

        public decimal WaterKg { get; set; }
        public decimal Tcs { get; set; }
        public decimal QkKg { get; set; }
        public decimal WaterPrice { get; set; }
        public decimal WaterAmount { get; set; }

        public decimal ScrapKg { get; set; }
        public decimal ScrapPrice { get; set; }
        public decimal ScrapAmount { get; set; }

        public decimal TotalAmount { get; set; }

        public PurchaseSheet? PurchaseSheet { get; set; }
    }
}