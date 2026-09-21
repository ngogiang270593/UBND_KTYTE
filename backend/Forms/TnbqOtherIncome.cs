using System.ComponentModel.DataAnnotations;

namespace backend.Forms;

public class OtherIncomeRequest
{
    public decimal Gifts { get; set; }
    public decimal SocialSupport { get; set; }
    public decimal Scholarship { get; set; }
    public decimal Rental { get; set; }
    public decimal Investment { get; set; }
    public decimal Other { get; set; }
}

public record OtherIncomeTotals(decimal Transfer, decimal Assets, decimal Other, decimal Total);

public static class TnbqOtherIncome
{
    public static string? Validate(OtherIncomeRequest data)
    {
        decimal[] values = [data.Gifts, data.SocialSupport, data.Scholarship, data.Rental, data.Investment, data.Other];
        return values.Any(value => value < 0 || value > 1000000000m || decimal.Round(value, 3) != value)
            ? "Mục 7: số tiền từ 0 đến 1.000.000.000 nghìn đồng, tối đa 3 chữ số thập phân."
            : null;
    }

    public static OtherIncomeTotals Totals(OtherIncomeRequest data)
    {
        var transfer = data.Gifts + data.SocialSupport + data.Scholarship;
        var assets = data.Rental + data.Investment;
        return new(transfer, assets, data.Other, transfer + assets + data.Other);
    }
}
