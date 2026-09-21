using System.ComponentModel.DataAnnotations;

namespace backend.Forms;

public class BusinessRequest
{
    public bool? HasIncome { get; set; }
    [Required, MaxLength(200)] public List<BusinessRow> Rows { get; set; } = [];
}

public class BusinessRow
{
    [StringLength(300)] public string Description { get; set; } = "";
    public decimal Sold { get; set; }
    public decimal Retained { get; set; }
    public decimal MaterialCost { get; set; }
    public decimal EnergyCost { get; set; }
    public decimal OtherCost { get; set; }
}

public record BusinessTotals(decimal Sold, decimal Retained, decimal Revenue, decimal MaterialCost,
    decimal EnergyCost, decimal OtherCost, decimal TotalCost, decimal Income);

public static class TnbqBusiness
{
    public static string? Validate(BusinessRequest data)
    {
        if (data.Rows.Any(row => row == null)) return "Mục 6: dòng hoạt động không hợp lệ.";
        if (data.HasIncome != true && data.Rows.Count > 0)
            return "Mục 6: chỉ nhập hoạt động khi chọn Có ở Câu 1.";
        foreach (var row in data.Rows)
        {
            decimal[] amounts = [row.Sold, row.Retained, row.MaterialCost, row.EnergyCost, row.OtherCost];
            if (amounts.Any(x => x < 0 || x > 1000000000m || decimal.Round(x, 3) != x))
                return "Mục 6: số tiền từ 0 đến 1.000.000.000 nghìn đồng, tối đa 3 chữ số thập phân.";
            if (amounts.Any(x => x != 0) && string.IsNullOrWhiteSpace(row.Description))
                return "Mục 6: nhập mô tả hoạt động cho dòng có số liệu.";
            row.Description = row.Description?.Trim() ?? "";
        }
        return null;
    }

    public static BusinessTotals RowTotals(BusinessRow row)
    {
        var revenue = row.Sold + row.Retained;
        var totalCost = row.MaterialCost + row.EnergyCost + row.OtherCost;
        return new(row.Sold, row.Retained, revenue, row.MaterialCost, row.EnergyCost, row.OtherCost, totalCost, revenue - totalCost);
    }

    public static BusinessTotals Totals(BusinessRequest data)
    {
        var rows = data.HasIncome == true ? data.Rows.Select(RowTotals).ToList() : [];
        return new(rows.Sum(x => x.Sold), rows.Sum(x => x.Retained), rows.Sum(x => x.Revenue),
            rows.Sum(x => x.MaterialCost), rows.Sum(x => x.EnergyCost), rows.Sum(x => x.OtherCost),
            rows.Sum(x => x.TotalCost), rows.Sum(x => x.Income));
    }
}
