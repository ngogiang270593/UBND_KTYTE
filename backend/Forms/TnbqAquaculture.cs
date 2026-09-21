using System.ComponentModel.DataAnnotations;

namespace backend.Forms;

public class AquacultureRequest
{
    public bool? HasIncome { get; set; }
    [Required, MaxLength(200)] public List<AquacultureRow> Rows { get; set; } = [];
}

public class AquacultureRow
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

public record AquacultureTotals(decimal Sold, decimal Retained, decimal Revenue, decimal SeedCost,
    decimal MaterialCost, decimal OtherCost, decimal TotalCost, decimal Income);

public static class TnbqAquaculture
{
    private static readonly string[] Categories = ["farming", "fishing", "breeding", "services", "compensation"];
    private static readonly string[] Standard = ["farming", "breeding"];
    private static readonly string[] Repeated = ["farming", "fishing", "breeding"];

    public static string? Validate(AquacultureRequest data)
    {
        if (data.Rows.Any(row => row == null)) return "Mục 5: dòng nguồn thu không hợp lệ.";
        if (data.HasIncome != true && data.Rows.Count > 0)
            return "Mục 5: chỉ nhập nguồn thu khi chọn Có ở Câu 1.";

        foreach (var row in data.Rows)
        {
            if (!Categories.Contains(row.Category)) return "Mục 5: nguồn thu không hợp lệ.";
            decimal[] amounts = [row.Sold, row.Retained, row.SeedCost, row.MaterialCost, row.OtherCost, row.ServiceRevenue, row.Compensation];
            if (amounts.Any(x => x < 0 || x > 1000000000m || decimal.Round(x, 3) != x))
                return "Mục 5: số tiền từ 0 đến 1.000.000.000 nghìn đồng, tối đa 3 chữ số thập phân.";
            if (Repeated.Contains(row.Category) && amounts.Any(x => x != 0) && string.IsNullOrWhiteSpace(row.Description))
                return "Mục 5: nhập tên thủy sản cho dòng có số liệu.";

            var invalid = row.Category switch
            {
                "farming" or "breeding" => row.ServiceRevenue != 0 || row.Compensation != 0,
                "fishing" => row.SeedCost != 0 || row.MaterialCost != 0 || row.ServiceRevenue != 0 || row.Compensation != 0,
                "services" => row.Sold != 0 || row.Retained != 0 || row.SeedCost != 0 || row.MaterialCost != 0 || row.OtherCost != 0 || row.Compensation != 0,
                "compensation" => amounts.Take(6).Any(x => x != 0),
                _ => true
            };
            if (invalid) return "Mục 5: không nhập số liệu vào các ô đánh dấu x trong mẫu.";
            row.Description = row.Description?.Trim() ?? "";
        }

        if (data.Rows.Where(x => !Repeated.Contains(x.Category)).GroupBy(x => x.Category).Any(g => g.Count() > 1))
            return "Mục 5: nguồn thu cố định không được nhập trùng.";
        return null;
    }

    public static AquacultureTotals RowTotals(AquacultureRow row)
    {
        if (row.Category == "compensation") return new(0, 0, 0, 0, 0, 0, 0, row.Compensation);
        if (row.Category == "services") return new(0, 0, row.ServiceRevenue, 0, 0, 0, 0, row.ServiceRevenue);
        var standard = Standard.Contains(row.Category);
        var revenue = row.Sold + row.Retained;
        var seedCost = standard ? row.SeedCost : 0;
        var materialCost = standard ? row.MaterialCost : 0;
        var totalCost = seedCost + materialCost + row.OtherCost;
        return new(row.Sold, row.Retained, revenue, seedCost, materialCost, row.OtherCost, totalCost, revenue - totalCost);
    }

    public static AquacultureTotals Totals(AquacultureRequest data)
    {
        var rows = data.HasIncome == true ? data.Rows.Select(RowTotals).ToList() : [];
        return new(rows.Sum(x => x.Sold), rows.Sum(x => x.Retained), rows.Sum(x => x.Revenue),
            rows.Sum(x => x.SeedCost), rows.Sum(x => x.MaterialCost), rows.Sum(x => x.OtherCost),
            rows.Sum(x => x.TotalCost), rows.Sum(x => x.Income));
    }
}
