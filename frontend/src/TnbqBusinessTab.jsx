import { businessFields, businessHasData, businessRow, businessRowTotals, businessTotals, loadBusiness } from "./tnbqBusiness";

const money = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 });
const columns = ["sold", "retained", "revenue", "materialCost", "energyCost", "otherCost", "totalCost", "income"];
const names = {
  sold: "Giá trị đã bán", retained: "Giá trị để lại sử dụng", materialCost: "Nguyên vật liệu",
  energyCost: "Năng lượng, nhiên liệu", otherCost: "Chi khác",
};

export default function TnbqBusinessTab({ value, onChange }) {
  const totals = businessTotals(value);
  const answer = (hasIncome) => {
    if (hasIncome === value.hasIncome) return;
    if (!hasIncome && value.rows.some(businessHasData)
      && !window.confirm("Chọn Không sẽ xóa số liệu sản xuất kinh doanh đã nhập. Bạn có tiếp tục không?")) return;
    onChange(hasIncome ? { ...value, hasIncome } : { ...loadBusiness(), hasIncome: false });
  };
  const update = (key, field, next) => onChange({
    ...value, rows: value.rows.map((row) => row.key === key ? { ...row, [field]: next } : row),
  });
  const remove = (row) => {
    if (value.rows.length <= 5) return;
    if (businessHasData(row) && !window.confirm("Xóa hoạt động " + (row.description || "này") + "?")) return;
    onChange({ ...value, rows: value.rows.filter((item) => item.key !== row.key) });
  };
  const moneyInput = (row, field, code) => <input type="number" inputMode="decimal" className="form-control text-end"
    min="0" max="1000000000" step="0.001" placeholder="0" value={row[field]}
    aria-label={names[field] + " dòng " + code} onChange={(event) => update(row.key, field, event.target.value)} />;

  return <>
    <p><strong>Câu 1.</strong> Trong 12 tháng qua hộ ông/bà có phát sinh thu nhập - chi phí từ hoạt động sản xuất kinh doanh phi nông, lâm nghiệp, thủy sản hoặc chế biến sản phẩm nông, lâm nghiệp, thủy sản của hộ không?</p>
    <div className="survey-salary-answer">
      <label><input type="radio" name="business-has-income" value="yes" checked={value.hasIncome === true} onChange={() => answer(true)} /> 1. Có</label>
      <label><input type="radio" name="business-has-income" value="no" checked={value.hasIncome === false} onChange={() => answer(false)} /> 2. Không</label>
    </div>
    <p className="small text-muted"><strong>Mã 1:</strong> Hỏi thông tin thu nhập - chi phí từ hoạt động sản xuất kinh doanh, dịch vụ phi nông, lâm nghiệp, thủy sản hoặc chế biến sản phẩm của hộ.<br />
      <strong>Mã 2:</strong> Chuyển qua Mục 7 (Thu nhập khác).</p>
    {value.hasIncome === null && <div className="alert alert-info">Chọn Có hoặc Không để nhập Mục 6. Có thể lưu phiếu khi chưa trả lời mục này.</div>}
    {value.hasIncome === false && <div className="alert alert-info">Không phát sinh hoạt động sản xuất kinh doanh. Thu nhập Mục 6 bằng 0 nghìn đồng.</div>}
    {value.hasIncome === true && <>
      <p className="text-end fst-italic mb-2">Đơn vị tính: 1.000 đồng</p>
      <div className="table-responsive"><table className="table table-bordered survey-crops-table">
        <colgroup><col style={{ width: 48 }} /><col style={{ width: 175 }} />{columns.map((column) => <col key={column} style={{ width: 100 }} />)}<col style={{ width: 50 }} /></colgroup>
        <thead>
          <tr><th rowSpan={2}>STT</th><th rowSpan={2}>Mô tả hoạt động</th><th colSpan={3}>Tổng thu</th><th colSpan={4}>Chi phí</th><th rowSpan={2}>Thu nhập</th><th rowSpan={2}></th></tr>
          <tr><th>Giá trị đã bán/đổi/cho/biếu/tặng</th><th>Giá trị để lại sử dụng (phục vụ sản xuất kinh doanh và tiêu dùng)</th><th>Tổng thu</th>
            <th>Nguyên vật liệu chính, phụ, thực liệu</th><th>Năng lượng, nhiên liệu</th><th>Chi khác</th><th>Tổng chi phí</th></tr>
          <tr>{["A", "B", "1", "2", "3 = 1 + 2", "4", "5", "6", "7 = 4 + 5 + 6", "8 = 3 − 7", ""].map((label, index) => <th key={index}>{label}</th>)}</tr>
        </thead>
        <tbody>{value.rows.map((row, index) => {
          const code = index + 1, numbers = businessRowTotals(row);
          return <tr key={row.key} data-business-row={code}>
            <td className="text-center">{code}</td>
            <td><input className="form-control" aria-label={"Mô tả hoạt động dòng " + code} placeholder="Mô tả hoạt động" value={row.description} maxLength={300}
              required={businessFields.some((field) => Number(row[field]))} onChange={(event) => update(row.key, "description", event.target.value)} /></td>
            {columns.map((column) => <td key={column} className="text-end">{["revenue", "totalCost", "income"].includes(column)
              ? <span className="crop-calculated">{money.format(numbers[column])}</span> : moneyInput(row, column, code)}</td>)}
            <td>{value.rows.length > 5 && <button type="button" className="btn btn-sm btn-outline-danger" aria-label={"Xóa hoạt động dòng " + code} onClick={() => remove(row)}>Xóa</button>}</td>
          </tr>;
        })}</tbody>
        <tfoot><tr><th colSpan={2}>TỔNG SỐ</th>{columns.map((column) => <td key={column} data-testid={"business-" + column + "-total"}>{money.format(totals[column])}</td>)}<td></td></tr></tfoot>
      </table></div>
      <button type="button" className="btn btn-outline-primary btn-sm" disabled={value.rows.length >= 200}
        onClick={() => onChange({ ...value, rows: [...value.rows, businessRow()] })}>+ Thêm hoạt động</button>
      <p className="small text-muted mt-2">Tổng thu, tổng chi phí và thu nhập được tự tính. Thu nhập có thể âm khi chi phí lớn hơn tổng thu.</p>
    </>}
    <div className="survey-salary-total"><strong>Câu 2. Tổng thu nhập từ hoạt động sản xuất kinh doanh = Dòng tổng số cột (8)</strong>
      <span><strong data-testid="business-total">{money.format(totals.income)}</strong> nghìn đồng</span>
    </div>
  </>;
}
