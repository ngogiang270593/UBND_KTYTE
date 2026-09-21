import { useRef, useState } from "react";
import * as XLSX from "xlsx-js-style";

const clean = (value) => String(value ?? "").trim();
const normalize = (value) => clean(value).toLocaleLowerCase("vi").replaceAll(/\s+/g, " ");
const readCell = (sheet, address) => clean(sheet[address]?.v);

const parseAreaType = (value) => {
  const normalized = normalize(value);
  if (/^(1\b|.*\(1\))/.test(normalized) || normalized.includes("thành thị")) return "1";
  if (/^(2\b|.*\(2\))/.test(normalized) || normalized.includes("nông thôn")) return "2";
  return "";
};

function ImportTnbqPage({ year, onYearChange, onImport }) {
  const currentYear = new Date().getFullYear();
  const inputRef = useRef(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState([]);
  const [errors, setErrors] = useState([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [metadata, setMetadata] = useState({ province: "Tây Ninh", commune: "", hamlet: "", areaType: "2", preparer: "", phone: "" });
  const metadataComplete = Object.values(metadata).every((value) => clean(value));
  const updateMetadata = (field) => (event) => setMetadata((current) => ({ ...current, [field]: event.target.value }));

  const readFile = async (file) => {
    setFileName(file?.name || "");
    setRows([]);
    setErrors([]);
    setMessage("");
    if (!file) return;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const importedMetadata = {
        province: readCell(sheet, "B5"),
        commune: readCell(sheet, "E5"),
        hamlet: readCell(sheet, "B6"),
        areaType: parseAreaType(readCell(sheet, "E6")),
        preparer: readCell(sheet, "B7"),
        phone: readCell(sheet, "E7"),
      };
      setMetadata((current) => ({
        province: importedMetadata.province || current.province,
        commune: importedMetadata.commune || current.commune,
        hamlet: importedMetadata.hamlet || current.hamlet,
        areaType: importedMetadata.areaType || current.areaType,
        preparer: importedMetadata.preparer || current.preparer,
        phone: importedMetadata.phone || current.phone,
      }));
      const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
      const headerIndex = matrix.findIndex((line) => line.some((cell) => normalize(cell).includes("họ và tên chủ hộ")));
      if (headerIndex < 0) throw new Error("Không tìm thấy dòng tiêu đề có cột ‘Họ và tên chủ hộ’. ");
      const header = matrix[headerIndex].map(normalize);
      const findColumn = (...names) => header.findIndex((cell) => names.some((name) => cell.includes(name)));
      const columns = {
        houseNumber: findColumn("stt nhà"), householdNumber: findColumn("stt hộ"), headName: findColumn("họ và tên chủ hộ"),
        address: findColumn("địa chỉ của hộ", "địa chỉ"), members: findColumn("số nhân khẩu"), note: findColumn("ghi chú"),
      };
      if (Object.values(columns).some((index) => index < 0)) throw new Error("Tệp chưa có đủ 6 cột của bảng kê hộ.");
      const imported = matrix.slice(headerIndex + 1).map((line, index) => ({
        sourceRow: headerIndex + index + 2,
        houseNumber: clean(line[columns.houseNumber]), householdNumber: clean(line[columns.householdNumber]),
        headName: clean(line[columns.headName]), address: clean(line[columns.address]),
        members: Number(line[columns.members]), note: clean(line[columns.note]),
      })).filter((row) => row.headName || row.address || row.houseNumber || row.householdNumber || row.note || row.members);
      const validRows = imported.filter((row) => {
        const headName = normalize(row.headName);
        return !["c", "họ và tên chủ hộ", "tổng cộng"].includes(headName);
      });
      const validationErrors = validRows.flatMap((row) => {
        const reasons = [];
        if (!row.headName) reasons.push("Thiếu họ và tên chủ hộ");
        if (!Number.isInteger(row.members) || row.members < 0) reasons.push("Số nhân khẩu không hợp lệ");
        return reasons.length ? [{ ...row, reasons }] : [];
      });
      setRows(validRows);
      setErrors(validationErrors);
      if (validRows.length === 0) setMessage("Tệp không có dòng dữ liệu hộ nào.");
    } catch (error) {
      setMessage(error.message || "Không thể đọc tệp đã chọn.");
    }
  };

  const confirmImport = async () => {
    if (!rows.length || errors.length) return;
    setSaving(true);
    setMessage("");
    try {
      await onImport(rows.map((row) => ({ ...row, year: Number(year), ...metadata })));
    } catch (error) {
      setMessage(error.response?.data?.message || error.message || "Không thể lưu dữ liệu vào database.");
      setSaving(false);
    }
  };

  const metadataPanel = rows.length > 0 && <>
    <div className="import-metadata">
      <div className="import-metadata-heading"><span className="status-badge">THÔNG TIN BẢNG KÊ</span><h3>Thông tin địa bàn trước khi lưu</h3><p>Thông tin đọc từ file Excel có thể chỉnh lại trước khi lưu {rows.length} hộ.</p></div>
      <div className="import-metadata-grid">
        <div className="field"><label htmlFor="meta-province">Tỉnh/thành phố *</label><input id="meta-province" value={metadata.province} onChange={updateMetadata("province")} /></div>
        <div className="field"><label htmlFor="meta-commune">Xã/phường *</label><input id="meta-commune" value={metadata.commune} onChange={updateMetadata("commune")} placeholder="Ví dụ: Xã Tân Hòa" /></div>
        <div className="field"><label htmlFor="meta-hamlet">Ấp/Khu phố *</label><input id="meta-hamlet" value={metadata.hamlet} onChange={updateMetadata("hamlet")} placeholder="Ví dụ: Ấp Suối Bà Chiêm" /></div>
        <div className="field"><label htmlFor="meta-area-type">Thành thị/Nông thôn *</label><select id="meta-area-type" value={metadata.areaType} onChange={updateMetadata("areaType")}><option value="1">1 - Thành thị</option><option value="2">2 - Nông thôn</option></select></div>
        <div className="field"><label htmlFor="meta-preparer">Người lập bảng kê *</label><input id="meta-preparer" value={metadata.preparer} onChange={updateMetadata("preparer")} /></div>
        <div className="field"><label htmlFor="meta-phone">Số điện thoại *</label><input id="meta-phone" type="tel" value={metadata.phone} onChange={updateMetadata("phone")} placeholder="Nhập số điện thoại liên hệ" /></div>
      </div>
    </div>
    <div className="form-actions"><button className="primary-button" type="button" disabled={saving || errors.length > 0 || !metadataComplete} onClick={confirmImport}>{saving ? "Đang lưu..." : `Lưu ${rows.length} hộ vào ${metadata.hamlet || "bảng kê"}`}</button></div>
    {!metadataComplete && <p className="import-required-note">Vui lòng nhập đầy đủ các trường có dấu * trước khi lưu.</p>}
  </>;

  return <div className="tnbq-page"><section className="panel import-panel">
    <div className="panel-heading"><div className="import-icon">↑</div><div><span className="status-badge">IMPORT</span><h2>Import bảng kê hộ</h2><p>Đọc dữ liệu từ tệp Excel và kiểm tra trước khi đưa vào bảng kê.</p></div></div>
    <div className="import-controls"><div className="field"><label htmlFor="import-year">Năm điều tra</label><select id="import-year" value={year} onChange={(event) => onYearChange(Number(event.target.value))}>{[currentYear, currentYear - 1, currentYear - 2, currentYear - 3].map((item) => <option key={item}>{item}</option>)}</select></div><div className="import-dropzone" onClick={() => inputRef.current?.click()}><input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" onChange={(event) => readFile(event.target.files?.[0])} hidden /><strong>{fileName || "Chọn tệp bảng kê hộ"}</strong><span>Hỗ trợ .xlsx, .xls và .csv</span><button className="secondary-button" type="button">Chọn tệp</button></div></div>
    {message && <div className="message message-danger">{message}</div>}
    {metadataPanel}
    {errors.length > 0 && <div className="import-error-section"><div className="import-error-title"><strong>Phát hiện {errors.length} dòng lỗi cần sửa trong tệp Excel</strong><span>Kiểm tra các thông tin bên dưới tại đúng dòng Excel tương ứng, sau đó chọn lại tệp.</span></div><div className="config-table-wrap import-error-table-wrap"><table className="config-table import-error-table"><thead><tr><th>Dòng Excel</th><th>STT nhà</th><th>STT hộ</th><th>Họ và tên chủ hộ</th><th>Địa chỉ</th><th>Nhân khẩu</th><th>Ghi chú</th><th>Lỗi cần sửa</th></tr></thead><tbody>{errors.map((error) => <tr key={error.sourceRow}><td><strong>{error.sourceRow}</strong></td><td>{error.houseNumber || "—"}</td><td>{error.householdNumber || "—"}</td><td className={!error.headName ? "invalid-cell" : ""}>{error.headName || "Đang để trống"}</td><td>{error.address || "—"}</td><td className={!Number.isInteger(error.members) || error.members < 0 ? "invalid-cell" : ""}>{Number.isNaN(error.members) ? "Không hợp lệ" : error.members}</td><td>{error.note || "—"}</td><td><div className="error-reasons">{error.reasons.map((reason) => <span key={reason}>{reason}</span>)}</div></td></tr>)}</tbody></table></div></div>}
    {rows.length > 0 && <><div className="editor-heading import-preview-heading"><h3>Xem trước dữ liệu</h3><span>{rows.length} hộ từ trang tính đầu tiên</span></div><div className="config-table-wrap"><table className="config-table"><thead><tr><th>STT nhà</th><th>STT hộ</th><th>Họ và tên chủ hộ</th><th>Địa chỉ</th><th>Nhân khẩu</th><th>Ghi chú</th></tr></thead><tbody>{rows.slice(0, 50).map((row) => <tr key={row.sourceRow}><td>{row.houseNumber}</td><td>{row.householdNumber}</td><td><strong>{row.headName || "—"}</strong></td><td>{row.address}</td><td>{Number.isNaN(row.members) ? "Không hợp lệ" : row.members}</td><td>{row.note}</td></tr>)}</tbody></table></div></>}
  </section></div>;
}

export default ImportTnbqPage;
