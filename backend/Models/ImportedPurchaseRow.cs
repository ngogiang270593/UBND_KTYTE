namespace backend.Models
{
    public class ImportedPurchaseRow
    {
        public int Id { get; set; }

        public string CustomerCode { get; set; } = "";

        public DateTime PurchaseDate { get; set; }

        public decimal WaterKg { get; set; }

        public decimal Tcs { get; set; }

        public decimal QkKg { get; set; }

        public decimal WaterPrice { get; set; }

        public decimal WaterAmount { get; set; }

        public decimal ScrapKg { get; set; }

        public decimal ScrapPrice { get; set; }

        public decimal ScrapAmount { get; set; }

        public decimal TotalAmount { get; set; }

        public string SourceFileName { get; set; } = "";

        public DateTime ImportedAt { get; set; } = DateTime.Now;
    }
}