import { salaryTotals } from "./tnbqSalary";
import { cropsTotals } from "./tnbqCrops";
import { livestockTotals } from "./tnbqLivestock";
import { forestryTotals } from "./tnbqForestry";
import { aquacultureTotals } from "./tnbqAquaculture";
import { businessTotals } from "./tnbqBusiness";
import { otherIncomeTotals } from "./tnbqOtherIncome";

const units = (value) => Math.round(Number(value || 0) * 1000);
const money = (value) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(Number(value || 0));

export default function TnbqSummaryTab({ salary, crops, livestock, forestry, aquaculture, business, otherIncome }) {
  const rows = [
    ["1", "Thu nhập từ tiền lương, tiền công (Câu 2 Mục 1)", salaryTotals(salary).total],
    ["2", "Thu nhập từ trồng trọt (Câu 2 Mục 2)", cropsTotals(crops).income],
    ["3", "Thu nhập từ chăn nuôi (Câu 2 Mục 3)", livestockTotals(livestock).income],
    ["4", "Thu nhập từ lâm nghiệp (Câu 2 Mục 4)", forestryTotals(forestry).income],
    ["5", "Thu nhập từ thủy sản (Câu 2 Mục 5)", aquacultureTotals(aquaculture).income],
    ["6", "Thu nhập từ hoạt động sản xuất kinh doanh phi nông, lâm nghiệp, thủy sản hoặc chế biến sản phẩm nông, lâm nghiệp, thủy sản (Câu 2 Mục 6)", businessTotals(business).income],
    ["7", "Thu nhập khác (Câu 2 Mục 7)", otherIncomeTotals(otherIncome).total],
  ];
  const total = rows.reduce((sum, [, , income]) => sum + units(income), 0) / 1000;

  return <>
    <p className="text-end fst-italic mb-2">Đơn vị tính: 1.000 đồng</p>
    <div className="table-responsive">
      <table className="table table-bordered survey-summary-table">
        <thead>
          <tr><th>Nguồn thu</th><th>Tổng thu nhập</th></tr>
          <tr><th>A</th><th>1</th></tr>
        </thead>
        <tbody>
          {rows.map(([code, label, income]) => <tr key={code}>
            <td><span className="survey-summary-code">{code}.</span>{label}</td><td className="text-end fw-semibold">{money(income)}</td>
          </tr>)}
        </tbody>
        <tfoot><tr><td>Tổng thu nhập hộ</td><td className="text-end" data-testid="summary-total">{money(total)}</td></tr></tfoot>
      </table>
    </div>
    <p className="small text-muted mb-0">Số liệu được tổng hợp tự động từ Mục 1 đến Mục 7.</p>
  </>;
}
