import { Fragment } from "react";
import { livestockCategories, livestockFields, livestockHasData, livestockRow, livestockRowTotals, livestockTotals, loadLivestock } from "./tnbqLivestock";

const money = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 });
const columns = ["sold", "retained", "revenue", "seedCost", "materialCost", "otherCost", "totalCost", "income"];
const names = { sold: "Giá trị đã bán", retained: "Giá trị để lại sử dụng", seedCost: "Chi phí giống", materialCost: "Thức ăn, thuốc", otherCost: "Chi khác", serviceRevenue: "Tổng thu", compensation: "Đền bù, hỗ trợ" };

export default function TnbqLivestockTab({ value, onChange }) {
  const totals = livestockTotals(value);
  const answer = (hasIncome) => {
    if (hasIncome === value.hasIncome) return;
    if (!hasIncome && value.rows.some(livestockHasData)
      && !window.confirm("Chọn Không sẽ xóa số liệu chăn nuôi đã nhập. Bạn có tiếp tục không?")) return;
    onChange(hasIncome ? { ...value, hasIncome } : { ...loadLivestock(), hasIncome: false });
  };
  const update = (key, field, next) => onChange({ ...value, rows: value.rows.map((row) => row.key === key ? { ...row, [field]: next } : row) });
  const remove = (row) => {
    if (livestockHasData(row) && !window.confirm("Xóa dòng sản phẩm " + (row.description || "") + "?")) return;
    onChange({ ...value, rows: value.rows.filter((item) => item.key !== row.key) });
  };
  const blocked = <span className="crop-blocked" aria-label="Không áp dụng">x</span>;
  const moneyInput = (row, field, code) => <input type="number" inputMode="decimal" className="form-control text-end"
    min="0" max="1000000000" step="0.001" placeholder="0" value={row[field]}
    aria-label={names[field] + " dòng " + code} onChange={(event) => update(row.key, field, event.target.value)} />;
  const renderRow = (row, category, index) => {
    const code = category.repeated ? category.code + "." + (index + 1) : category.code;
    const numbers = livestockRowTotals(row);
    return <tr key={row.key} data-livestock-category={category.id}>
      <td className="text-center">{code}</td>
      <td>{category.repeated ? <input className="form-control" aria-label={"Tên sản phẩm dòng " + code}
        placeholder="Tên sản phẩm" value={row.description} maxLength={300}
        required={livestockFields.some((field) => Number(row[field]))}
        onChange={(event) => update(row.key, "description", event.target.value)} /> : category.label}</td>
      {columns.map((column) => {
        let content;
        const inputField = ["services", "hunting"].includes(category.id) && column === "revenue" ? "serviceRevenue"
          : category.id === "compensation" && column === "income" ? "compensation" : column;
        if (category.fields.includes(inputField)) content = moneyInput(row, inputField, code);
        else if (category.id === "compensation") content = blocked;
        else if (["revenue", "totalCost", "income"].includes(column)) content = <span className="crop-calculated">{money.format(numbers[column])}</span>;
        else content = blocked;
        return <td key={column} className="text-end">{content}</td>;
      })}
      <td>{category.repeated && <button type="button" className="btn btn-sm btn-outline-danger" aria-label={"Xóa sản phẩm dòng " + code} onClick={() => remove(row)}>Xóa</button>}</td>
    </tr>;
  };

  return <>
    <p><strong>Câu 1.</strong> Trong 12 tháng qua hộ ông/bà có phát sinh thu nhập - chi phí từ hoạt động chăn nuôi hoặc từ săn bắt, đánh bẫy, thuần dưỡng chim, thú không?</p>
    <div className="survey-salary-answer">
      <label><input type="radio" name="livestock-has-income" value="yes" checked={value.hasIncome === true} onChange={() => answer(true)} /> 1. Có</label>
      <label><input type="radio" name="livestock-has-income" value="no" checked={value.hasIncome === false} onChange={() => answer(false)} /> 2. Không</label>
    </div>
    <p className="small text-muted"><strong>Mã 1:</strong> Hỏi thông tin thu nhập - chi phí từ chăn nuôi.<br /><strong>Mã 2:</strong> Chuyển qua Mục 4 (Thu nhập từ lâm nghiệp).</p>
    {value.hasIncome === null && <div className="alert alert-info">Chọn Có hoặc Không để nhập Mục 3. Có thể lưu phiếu khi chưa trả lời mục này.</div>}
    {value.hasIncome === false && <div className="alert alert-info">Không phát sinh thu nhập - chi phí từ chăn nuôi. Thu nhập Mục 3 bằng 0 nghìn đồng.</div>}
    {value.hasIncome === true && <>
      <p className="text-end fst-italic mb-2">Đơn vị tính: 1.000 đồng</p>
      <div className="table-responsive"><table className="table table-bordered survey-crops-table">
        <colgroup><col style={{ width: 48 }} /><col style={{ width: 175 }} />{columns.map((column) => <col key={column} style={{ width: 100 }} />)}<col style={{ width: 50 }} /></colgroup>
        <thead>
          <tr><th rowSpan={2}>STT</th><th rowSpan={2}>Sản phẩm/dịch vụ</th><th colSpan={3}>Tổng thu</th><th colSpan={4}>Chi phí</th><th rowSpan={2}>Thu nhập</th><th rowSpan={2}></th></tr>
          <tr><th>Giá trị đã bán/đổi/cho/biếu/tặng</th><th>Giá trị đã thu hoạch để lại sử dụng (phục vụ sản xuất kinh doanh và tiêu dùng)</th>
            <th>Tổng trị giá sản phẩm đã thu hoạch</th><th>Giống (bao gồm cả giống tự sản xuất)</th><th>Thức ăn, thuốc phòng và chữa bệnh</th><th>Chi khác</th><th>Tổng chi phí</th></tr>
          <tr>{["A", "B", "1", "2", "3 = 1 + 2", "4", "5", "6", "7 = 4 + 5 + 6", "8 = 3 − 7", ""].map((label, index) => <th key={index}>{label}</th>)}</tr>
        </thead>
        <tbody>{livestockCategories.map((category) => <Fragment key={category.id}>
          {category.repeated && <tr className="crop-group"><th>{category.code}</th><th colSpan={10}>{category.label} <button type="button" className="btn btn-outline-primary btn-sm ms-2"
            disabled={value.rows.length >= 200} onClick={() => onChange({ ...value, rows: [...value.rows, livestockRow(category.id)] })} aria-label={"Thêm dòng " + category.label}>+ Thêm dòng</button></th></tr>}
          {value.rows.filter((row) => row.category === category.id).map((row, index) => renderRow(row, category, index))}
        </Fragment>)}</tbody>
        <tfoot><tr><th colSpan={2}>TỔNG SỐ</th>{columns.map((column) => <td key={column} data-testid={"livestock-" + column + "-total"}>{money.format(totals[column])}</td>)}<td></td></tr></tfoot>
      </table></div>
      <p className="small text-muted mt-2">Ô “x” không áp dụng. Tổng thu, tổng chi phí và thu nhập được tự tính; khoản đền bù/hỗ trợ nhập trực tiếp ở cột thu nhập. Thu nhập có thể âm khi chi phí lớn hơn tổng thu.</p>
    </>}
    <div className="survey-salary-total"><strong>Câu 2. Tổng thu nhập từ chăn nuôi = Dòng tổng số cột (8)</strong>
      <span><strong data-testid="livestock-total">{money.format(totals.income)}</strong> nghìn đồng</span>
    </div>
  </>;
}

