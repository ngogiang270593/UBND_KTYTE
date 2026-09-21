using System.ComponentModel.DataAnnotations;

namespace backend.Forms;

public class CropsRequest
{
    public bool? HasIncome { get; set; }
    [Required, MaxLength(200)] public List<CropRow> Rows { get; set; } = [];
}
public class CropRow
{
    [Required] public string Category { get; set; } = "";
    [StringLength(300)] public string Description { get; set; } = "";
    public decimal Sold { get; set; }
    public decimal Retained { get; set; }
    public decimal SeedCost { get; set; }
    public decimal MaterialCost { get; set; }
    public decimal OtherCost { get; set; }
    public decimal ServiceRevenue { get; set; }
    public decimal Compensation { get; set; }
}
public record CropTotals(decimal Sold, decimal Retained, decimal Revenue, decimal SeedCost,
    decimal MaterialCost, decimal OtherCost, decimal TotalCost, decimal Income);

public static class TnbqCrops
{
    public static string? Validate(CropsRequest data)
    {
        if (data.Rows.Any(row => row == null)) return "Mục 2: dòng nguồn thu không hợp lệ.";
        if (data.HasIncome != true && data.Rows.Count > 0)
            return "Mục 2: chỉ nhập nguồn thu khi chọn Có ở Câu 1.";
        string[] categories = ["plants", "nursery", "byproducts", "services", "compensation"];
        foreach (var row in data.Rows)
        {
            if (!categories.Contains(row.Category)) return "Mục 2: nguồn thu không hợp lệ.";
            decimal[] amounts = [row.Sold, row.Retained, row.SeedCost, row.MaterialCost, row.OtherCost, row.ServiceRevenue, row.Compensation];
            if (amounts.Any(x => x < 0 || x > 1000000000m || decimal.Round(x, 3) != x))
                return "Mục 2: số tiền từ 0 đến 1.000.000.000 nghìn đồng, tối đa 3 chữ số thập phân.";
            if (row.Category == "plants" && amounts.Any(x => x != 0) && string.IsNullOrWhiteSpace(row.Description))
                return "Mục 2: nhập tên cây trồng cho dòng có số liệu.";
            var invalid = row.Category switch
            {
                "plants" or "nursery" => row.ServiceRevenue != 0 || row.Compensation != 0,
                "byproducts" => row.SeedCost != 0 || row.MaterialCost != 0 || row.ServiceRevenue != 0 || row.Compensation != 0,
                "services" => row.Sold != 0 || row.Retained != 0 || row.SeedCost != 0 || row.MaterialCost != 0 || row.Compensation != 0,
                "compensation" => amounts.Take(6).Any(x => x != 0),
                _ => true
            };
            if (invalid) return "Mục 2: không nhập số liệu vào các ô đánh dấu x trong mẫu.";
            row.Description = row.Description?.Trim() ?? "";
        }
        if (data.Rows.Where(x => x.Category != "plants").GroupBy(x => x.Category).Any(g => g.Count() > 1))
            return "Mục 2: nguồn thu cố định không được nhập trùng.";
        return null;
    }

    public static CropTotals RowTotals(CropRow row)
    {
        if (row.Category == "compensation") return new(0, 0, 0, 0, 0, 0, 0, row.Compensation);
        var revenue = row.Category == "services" ? row.ServiceRevenue : row.Sold + row.Retained;
        var seedCost = row.Category is "plants" or "nursery" ? row.SeedCost : 0;
        var materialCost = row.Category is "plants" or "nursery" ? row.MaterialCost : 0;
        var cost = seedCost + materialCost + row.OtherCost;
        return new(row.Sold, row.Retained, revenue, seedCost, materialCost, row.OtherCost, cost, revenue - cost);
    }
    public static CropTotals Totals(CropsRequest data)
    {
        var rows = data.HasIncome == true ? data.Rows.Select(RowTotals).ToList() : [];
        return new(rows.Sum(x => x.Sold), rows.Sum(x => x.Retained), rows.Sum(x => x.Revenue),
            rows.Sum(x => x.SeedCost), rows.Sum(x => x.MaterialCost), rows.Sum(x => x.OtherCost),
            rows.Sum(x => x.TotalCost), rows.Sum(x => x.Income));
    }
}

