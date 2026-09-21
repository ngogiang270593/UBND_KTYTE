using System.ComponentModel.DataAnnotations;

namespace backend.Forms;

public class LivestockRequest
{
    public bool? HasIncome { get; set; }
    [Required, MaxLength(200)] public List<LivestockRow> Rows { get; set; } = [];
}
public class LivestockRow
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
public record LivestockTotals(decimal Sold, decimal Retained, decimal Revenue, decimal SeedCost,
    decimal MaterialCost, decimal OtherCost, decimal TotalCost, decimal Income);

public static class TnbqLivestock
{
    public static string? Validate(LivestockRequest data)
    {
        if (data.Rows.Any(row => row == null)) return "Mục 3: dòng nguồn thu không hợp lệ.";
        if (data.HasIncome != true && data.Rows.Count > 0)
            return "Mục 3: chỉ nhập nguồn thu khi chọn Có ở Câu 1.";
        string[] categories = ["cattle", "poultry", "otherAnimals", "animalProducts", "breeding", "byproducts", "services", "hunting", "compensation"];
        foreach (var row in data.Rows)
        {
            if (!categories.Contains(row.Category)) return "Mục 3: nguồn thu không hợp lệ.";
            decimal[] amounts = [row.Sold, row.Retained, row.SeedCost, row.MaterialCost, row.OtherCost, row.ServiceRevenue, row.Compensation];
            if (amounts.Any(x => x < 0 || x > 1000000000m || decimal.Round(x, 3) != x))
                return "Mục 3: số tiền từ 0 đến 1.000.000.000 nghìn đồng, tối đa 3 chữ số thập phân.";
            if (new[] { "cattle", "poultry", "otherAnimals", "animalProducts" }.Contains(row.Category) && amounts.Any(x => x != 0) && string.IsNullOrWhiteSpace(row.Description))
                return "Mục 3: nhập tên sản phẩm cho dòng có số liệu.";
            var invalid = row.Category switch
            {
                "cattle" or "poultry" or "otherAnimals" or "animalProducts" or "breeding" => row.ServiceRevenue != 0 || row.Compensation != 0,
                "byproducts" => row.SeedCost != 0 || row.MaterialCost != 0 || row.ServiceRevenue != 0 || row.Compensation != 0,
                "services" or "hunting" => row.Sold != 0 || row.Retained != 0 || row.SeedCost != 0 || row.MaterialCost != 0 || row.Compensation != 0,
                "compensation" => amounts.Take(6).Any(x => x != 0),
                _ => true
            };
            if (invalid) return "Mục 3: không nhập số liệu vào các ô đánh dấu x trong mẫu.";
            row.Description = row.Description?.Trim() ?? "";
        }
        if (data.Rows.Where(x => !new[] { "cattle", "poultry", "otherAnimals", "animalProducts" }.Contains(x.Category)).GroupBy(x => x.Category).Any(g => g.Count() > 1))
            return "Mục 3: nguồn thu cố định không được nhập trùng.";
        return null;
    }

    public static LivestockTotals RowTotals(LivestockRow row)
    {
        if (row.Category == "compensation") return new(0, 0, 0, 0, 0, 0, 0, row.Compensation);
        var revenue = row.Category is "services" or "hunting" ? row.ServiceRevenue : row.Sold + row.Retained;
        var seedCost = row.Category is "cattle" or "poultry" or "otherAnimals" or "animalProducts" or "breeding" ? row.SeedCost : 0;
        var materialCost = row.Category is "cattle" or "poultry" or "otherAnimals" or "animalProducts" or "breeding" ? row.MaterialCost : 0;
        var cost = seedCost + materialCost + row.OtherCost;
        return new(row.Sold, row.Retained, revenue, seedCost, materialCost, row.OtherCost, cost, revenue - cost);
    }
    public static LivestockTotals Totals(LivestockRequest data)
    {
        var rows = data.HasIncome == true ? data.Rows.Select(RowTotals).ToList() : [];
        return new(rows.Sum(x => x.Sold), rows.Sum(x => x.Retained), rows.Sum(x => x.Revenue),
            rows.Sum(x => x.SeedCost), rows.Sum(x => x.MaterialCost), rows.Sum(x => x.OtherCost),
            rows.Sum(x => x.TotalCost), rows.Sum(x => x.Income));
    }
}

