namespace backend.Models
{
    public class PurchaseSheet
    {
        public int Id { get; set; }
        public int CustomerId { get; set; }

        public string SheetNo { get; set; } = "";
        public DateTime FromDate { get; set; }
        public DateTime ToDate { get; set; }

        public decimal TotalAmount { get; set; }

        public Customer? Customer { get; set; }
        public List<PurchaseSheetDetail> Details { get; set; } = new();
    }
}