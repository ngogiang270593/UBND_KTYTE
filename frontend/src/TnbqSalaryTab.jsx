import { salaryHasData, salaryRow, salaryTotals } from "./tnbqSalary";

const money = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 });
export default function TnbqSalaryTab({ value, onChange }) {
  const totals = salaryTotals(value);
  const changeAnswer = (hasIncome) => {
    if (hasIncome === value.hasIncome) return;
    if (!hasIncome && value.rows.some(salaryHasData)
      && !window.confirm("Chọn Không sẽ xóa các dòng tiền lương, tiền công đã nhập. Bạn có tiếp tục không?")) return;
    onChange({ hasIncome, rows: hasIncome ? value.rows : Array.from({ length: 7 }, (_, index) => salaryRow(index + 1)) });
  };
  const updateRow = (key, field, next) => onChange({ ...value, rows: value.rows.map((row) => row.key === key ? { ...row, [field]: next } : row) });
  const removeRow = (row) => {
    if (salaryHasData(row) && !window.confirm("Xóa dòng thành viên " + (row.name || row.code) + "?")) return;
    onChange({ ...value, rows: value.rows.filter((item) => item.key !== row.key) });
  };
  const addRow = () => {
    const codes = new Set(value.rows.map((row) => row.code));
    let next = 1; while (codes.has(String(next))) next++;
    onChange({ ...value, rows: [...value.rows, salaryRow(next)] });
  };

  return <>
    <p><strong>Câu 1.</strong> Trong 12 tháng qua có ai trong hộ ông/bà đi làm để nhận tiền lương, tiền công và/hoặc nhận được lương hưu, trợ cấp thất nghiệp, thôi việc một lần không? <em>(Chỉ hỏi đối với người từ 6 tuổi trở lên)</em></p>
    <div className="survey-salary-answer">
      <label><input type="radio" name="salary-has-income" value="yes" checked={value.hasIncome === true} onChange={() => changeAnswer(true)} /> 1. Có</label>
      <label><input type="radio" name="salary-has-income" value="no" checked={value.hasIncome === false} onChange={() => changeAnswer(false)} /> 2. Không</label>
    </div>
    <p className="small text-muted"><strong>Mã 1:</strong> Hỏi thông tin thu nhập từ tiền lương, tiền công.<br /><strong>Mã 2:</strong> Chuyển qua Mục 2 (Thu nhập từ trồng trọt).</p>
    {value.hasIncome === null && <div className="alert alert-info">Chọn Có hoặc Không để nhập Mục 1. Bạn vẫn có thể lưu riêng thông tin hộ khi chưa trả lời mục này.</div>}
    {value.hasIncome === false && <div className="alert alert-info">Không phát sinh thu nhập ở Mục 1. Tổng thu nhập mục này bằng 0 nghìn đồng.</div>}
    {value.hasIncome === true && <>
      <p className="text-end fst-italic mb-2">Đơn vị tính: 1.000 đồng</p>
      <div className="table-responsive"><table className="table table-bordered survey-salary-table">
        <thead><tr><th>Mã thành viên</th><th>Họ tên</th>
          <th>Thu nhập từ tiền lương, tiền công và các khoản có tính chất tiền lương, tiền công (tính cả tiền mặt và hiện vật quy đổi thành tiền)</th>
          <th>Lương hưu và trợ cấp thất nghiệp, thôi việc một lần</th><th aria-label="Thao tác"></th></tr>
          <tr><th>A</th><th>B</th><th>1</th><th>2</th><th></th></tr></thead>
        <tbody>{value.rows.map((row, index) => <tr key={row.key}>
          <td><input className="form-control" aria-label={"Mã thành viên dòng " + (index + 1)} maxLength={20} required={salaryHasData(row)}
            value={row.code} onChange={(event) => updateRow(row.key, "code", event.target.value)} /></td>
          <td><input className="form-control" aria-label={"Họ tên dòng " + (index + 1)} maxLength={150} required={salaryHasData(row)}
            value={row.name} onChange={(event) => updateRow(row.key, "name", event.target.value)} /></td>
          {["wage", "pension"].map((field) => <td key={field}><input className="form-control text-end" type="number" inputMode="decimal" min="0" max="1000000000" step="0.001"
            aria-label={(field === "wage" ? "Tiền lương dòng " : "Lương hưu, trợ cấp dòng ") + (index + 1)}
            placeholder="0" value={row[field]} onChange={(event) => updateRow(row.key, field, event.target.value)} /></td>)}
          <td><button type="button" className="btn btn-sm btn-outline-danger" aria-label={"Xóa dòng " + (index + 1)} onClick={() => removeRow(row)}>Xóa</button></td>
        </tr>)}</tbody>
        <tfoot><tr><th colSpan={2}>TỔNG SỐ</th><td data-testid="salary-wage-total">{money.format(totals.wage)}</td><td data-testid="salary-pension-total">{money.format(totals.pension)}</td><td></td></tr></tfoot>
      </table></div>
      <button type="button" className="btn btn-outline-primary btn-sm" disabled={value.rows.length >= 200} onClick={addRow}>+ Thêm thành viên</button>
      <p className="small text-muted mt-2">Nhập số theo đơn vị nghìn đồng: 68.200.000 đồng nhập 68200. Dòng chưa nhập họ tên và số tiền được bỏ qua khi lưu.</p>
    </>}
    <div className="survey-salary-total"><strong>Câu 2. Tổng thu nhập = Dòng tổng số (cột 1 + cột 2)</strong>
      <span><strong data-testid="salary-total">{money.format(totals.total)}</strong> nghìn đồng</span>
    </div>
  </>;
}

