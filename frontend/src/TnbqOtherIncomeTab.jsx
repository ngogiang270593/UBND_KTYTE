import { otherIncomeTotals } from "./tnbqOtherIncome";

const money = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 });

export default function TnbqOtherIncomeTab({ value, onChange }) {
  const totals = otherIncomeTotals(value);
  const update = (field, next) => onChange({ ...value, [field]: next });
  const input = (field, label) => <input type="number" inputMode="decimal" className="form-control text-end"
    min="0" max="1000000000" step="0.001" placeholder="0" value={value[field]} aria-label={label}
    onChange={(event) => update(field, event.target.value)} />;
  const calculated = (amount) => <span className="crop-calculated">{money.format(amount)}</span>;
  const rows = [
    ["1", <strong>Thu nhập từ chuyển nhượng (=1.1+1.2+1.3)</strong>, calculated(totals.transfer)],
    ["1.1", "Tiền và trị giá hiện vật hộ nhận được do người ngoài hộ cho/biếu/tặng/mừng/giúp (dùng cho sinh hoạt của hộ) *", input("gifts", "Tiền cho, biếu, tặng")],
    ["1.2", "Các khoản trợ cấp xã hội (cho thương binh, liệt sỹ, cá nhân/hộ có công với cách mạng, các đối tượng bảo trợ xã hội, hộ nghèo, cận nghèo, hộ chính sách khác); trợ cấp cho sinh hoạt của hộ do thiên tai, hỏa hoạn, dịch bệnh, …", input("socialSupport", "Trợ cấp xã hội")],
    ["1.3", "Học bổng, thưởng giáo dục, trợ giúp y tế", input("scholarship", "Học bổng, thưởng, trợ giúp")],
    ["2", <strong>Thu nhập từ sở hữu tài sản, đầu tư tài chính (=2.1+2.2)</strong>, calculated(totals.assets)],
    ["2.1", "Thu từ cho thuê tài sản, đất đai, nhà ở", input("rental", "Thu cho thuê tài sản")],
    ["2.2", "Thu từ lãi đầu tư, tín dụng (lãi đầu tư, lãi tiết kiệm, cổ phần, cổ phiếu, cho vay, góp vốn…)", input("investment", "Thu lãi đầu tư")],
    ["3", <strong>Thu nhập khác</strong>, input("other", "Thu nhập khác")],
  ];

  return <>
    <p><strong>Câu 1.</strong> Xin ông/bà cho biết trong 12 tháng qua, hộ ông/bà có nhận được các nguồn thu nhập nào sau đây không?</p>
    <p className="text-end fst-italic mb-2">Đơn vị tính: 1.000 đồng</p>
    <div className="table-responsive"><table className="table table-bordered survey-other-income-table">
      <colgroup><col style={{ width: 56 }} /><col /><col style={{ width: 160 }} /></colgroup>
      <thead><tr><th>STT</th><th>Nguồn thu</th><th>Trị giá</th></tr><tr><th>A</th><th>B</th><th>1</th></tr></thead>
      <tbody>{rows.map(([code, label, field]) => <tr key={code} data-other-income-row={code}><td className="text-center">{code}</td><td>{label}</td><td className="text-end">{field}</td></tr>)}</tbody>
      <tfoot><tr><th colSpan={2}>TỔNG SỐ (dòng 1+2+3)</th><td data-testid="other-income-total">{money.format(totals.total)}</td></tr></tfoot>
    </table></div>
    <p className="small text-muted">Ghi chú: không bao gồm khoản tiền người ngoài thành viên hộ gửi về từ nước ngoài để trả nợ hoặc nhờ giữ hộ, không dùng cho sinh hoạt của hộ.</p>
    <div className="survey-salary-total"><strong>Câu 2. Tổng thu nhập khác = Dòng tổng số cột (1)</strong>
      <span><strong>{money.format(totals.total)}</strong> nghìn đồng</span>
    </div>
  </>;
}
