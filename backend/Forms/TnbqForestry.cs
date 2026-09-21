using System.ComponentModel.DataAnnotations;

namespace backend.Forms;

public class ForestryRequest
{
    public bool? HasIncome { get; set; }
    [Required, MaxLength(200)] public List<ForestryRow> Rows { get; set; } = [];
}

public class ForestryRow
{
    [Required] public string Category { get; set; } = "";
    [StringLength(300)] public string Description { get; set; } = "";
    public decimal Sold { get; set; }
    public decimal Retained { get; set; }
    public decimal SeedCost { get; set; }
    public decimal MaterialCost { get; set; }
    public decimal OtherCost { get; set; }
    public decimal Compensation { get; set; }
}

public record ForestryTotals(decimal Sold, decimal Retained, decimal Revenue, decimal SeedCost,
    decimal MaterialCost, decimal OtherCost, decimal TotalCost, decimal Income);

public static class TnbqForestry
{
    private static readonly string[] Categories = ["harvesting", "nursery", "forestCare", "services", "compensation"];
    private static readonly string[] Standard = ["nursery", "forestCare"];

    public static string? Validate(ForestryRequest data)
    {
        if (data.Rows.Any(row => row == null)) return "Mục 4: dòng nguồn thu không hợp lệ.";
        if (data.HasIncome != true && data.Rows.Count > 0)
            return "Mục 4: chỉ nhập nguồn thu khi chọn Có ở Câu 1.";

        foreach (var row in data.Rows)
        {
            if (!Categories.Contains(row.Category)) return "Mục 4: nguồn thu không hợp lệ.";
            decimal[] amounts = [row.Sold, row.Retained, row.SeedCost, row.MaterialCost, row.OtherCost, row.Compensation];
            if (amounts.Any(x => x < 0 || x > 1000000000m || decimal.Round(x, 3) != x))
                return "Mục 4: số tiền từ 0 đến 1.000.000.000 nghìn đồng, tối đa 3 chữ số thập phân.";
            if (row.Category == "harvesting" && amounts.Any(x => x != 0) && string.IsNullOrWhiteSpace(row.Description))
                return "Mục 4: nhập tên lâm sản cho dòng có số liệu.";

            var invalid = row.Category switch
            {
                "nursery" or "forestCare" => row.Compensation != 0,
                "harvesting" or "services" => row.SeedCost != 0 || row.MaterialCost != 0 || row.Compensation != 0,
                "compensation" => amounts.Take(5).Any(x => x != 0),
                _ => true
            };
            if (invalid) return "Mục 4: không nhập số liệu vào các ô đánh dấu x trong mẫu.";
            row.Description = row.Description?.Trim() ?? "";
        }

        if (data.Rows.Where(x => x.Category != "harvesting").GroupBy(x => x.Category).Any(g => g.Count() > 1))
            return "Mục 4: nguồn thu cố định không được nhập trùng.";
        return null;
    }

    public static ForestryTotals RowTotals(ForestryRow row)
    {
        if (row.Category == "compensation") return new(0, 0, 0, 0, 0, 0, 0, row.Compensation);
        var standard = Standard.Contains(row.Category);
        var revenue = row.Sold + row.Retained;
        var seedCost = standard ? row.SeedCost : 0;
        var materialCost = standard ? row.MaterialCost : 0;
        var totalCost = seedCost + materialCost + row.OtherCost;
        return new(row.Sold, row.Retained, revenue, seedCost, materialCost, row.OtherCost, totalCost, revenue - totalCost);
    }

    public static ForestryTotals Totals(ForestryRequest data)
    {
        var rows = data.HasIncome == true ? data.Rows.Select(RowTotals).ToList() : [];
        return new(rows.Sum(x => x.Sold), rows.Sum(x => x.Retained), rows.Sum(x => x.Revenue),
            rows.Sum(x => x.SeedCost), rows.Sum(x => x.MaterialCost), rows.Sum(x => x.OtherCost),
            rows.Sum(x => x.TotalCost), rows.Sum(x => x.Income));
    }
}
