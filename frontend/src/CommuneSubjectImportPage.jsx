import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import api from "./api";
import { useNotification } from "./NotificationProvider";

const columns = [["stt", "STT"], ["hoTen", "Họ và tên"], ["ngaySinh", "Ngày sinh"], ["cccd", "CCCD"], ["diaChi", "Địa chỉ"]];
const clean = (value) => String(value ?? "").trim();
const normalizeHeader = (value) => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/đ/g, "d").replace(/[^a-z0-9]/g, "");

function DataTable({ title, rows, onDelete }) {
  const colSpan = columns.length + 1 + (onDelete ? 1 : 0);
  return <div className="card shadow-sm mb-4"><div className="card-header bg-white fw-bold">{title}</div><div className="table-responsive"><table className="table table-bordered table-hover table-sm align-middle mb-0">
    <thead className="table-secondary text-center"><tr>{columns.map(([, label]) => <th key={label}>{label}</th>)}<th>Đối tượng</th>{onDelete && <th>Thao tác</th>}</tr></thead>
    <tbody>{rows.map((row, index) => <tr key={row.id || row.excelLine || index}>{columns.map(([key]) => <td key={key} className={key === "stt" ? "text-center" : ""}>{row[key]}</td>)}<td>{row.doiTuong}</td>{onDelete && <td className="text-center"><button className="btn btn-outline-danger btn-sm" onClick={() => onDelete(row)}>Xóa</button></td>}</tr>)}{!rows.length && <tr><td colSpan={colSpan} className="text-center text-muted py-4">Chưa có dữ liệu</td></tr>}</tbody>
  </table></div></div>;
}

export default function CommuneSubjectImportPage() {
  const { confirm } = useNotification();
  const inputRef = useRef(null);
  const [objectTypes, setObjectTypes] = useState([]);
  const [objectType, setObjectType] = useState("");
  const [hasObjectTypeColumn, setHasObjectTypeColumn] = useState(false);
  const [preview, setPreview] = useState([]);
  const [saved, setSaved] = useState([]);
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try { const res = await api.get("/CommuneSubjects"); setSaved(res.data || []); }
    catch { setMessage("Không tải được dữ liệu đối tượng xã."); }
  };
  useEffect(() => {
    load();
    api.get("/CatalogItems", { params: { category: "objectType" } }).then((res) => {
      const items = res.data || []; setObjectTypes(items);
      const defaultItem = items.find((item) => item.isDefault);
      if (defaultItem) setObjectType(defaultItem.name);
    }).catch(() => setMessage("Không tải được danh mục đối tượng."));
  }, []);

  const readFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name); setPreview([]); setHasObjectTypeColumn(false); setMessage("");
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error("File Excel không có sheet dữ liệu.");
      const sheetRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false, blankrows: true });
      const objectTypeColumnIndex = (sheetRows[0] || []).findIndex((header) => normalizeHeader(header) === "doituong");
      const fileHasObjectType = objectTypeColumnIndex >= 0;
      const data = sheetRows.slice(1).map((cells, rowIndex) => {
        const row = { excelLine: rowIndex + 2, sourceFileName: file.name, doiTuong: fileHasObjectType ? clean(cells[objectTypeColumnIndex]) : objectType };
        columns.forEach(([key], columnIndex) => { row[key] = clean(cells[columnIndex]); });
        return row;
      }).filter((row) => columns.some(([key]) => row[key]));
      if (!data.length) throw new Error("Không tìm thấy dữ liệu từ dòng 2, cột A đến E.");
      if (fileHasObjectType) {
        const missingRow = data.find((row) => !row.doiTuong);
        if (missingRow) throw new Error(`Cột Đối tượng đang trống tại dòng ${missingRow.excelLine}.`);
      }
      setHasObjectTypeColumn(fileHasObjectType);
      setPreview(data); setMessage(fileHasObjectType
        ? `Đã đọc ${data.length} dòng và lấy đối tượng từ file. Bấm “Lưu dữ liệu” để import.`
        : `Đã đọc ${data.length} dòng. Chọn danh mục đối tượng rồi bấm “Lưu dữ liệu”.`);
    } catch (error) { setMessage(error.message || "Không đọc được file Excel."); }
  };

  const changeObjectType = (value) => { setObjectType(value); setPreview((rows) => rows.map((row) => ({ ...row, doiTuong: value }))); };
  const save = async () => {
    if (!hasObjectTypeColumn && !objectType) return setMessage("Vui lòng chọn danh mục đối tượng.");
    if (!preview.length) return setMessage("Chưa có dữ liệu để lưu.");
    setLoading(true);
    try {
      const res = await api.post("/CommuneSubjects/import", preview.map((row) => ({ ...row, doiTuong: hasObjectTypeColumn ? row.doiTuong : objectType })));
      setMessage(`${res.data.message}\nĐã lưu: ${res.data.savedCount} dòng.`); await load();
      setPreview([]); setFileName(""); setHasObjectTypeColumn(false); if (inputRef.current) inputRef.current.value = "";
    } catch (error) {
      const fallback = error.response?.status === 404
        ? "Backend chưa được cập nhật. Vui lòng khởi động lại ứng dụng rồi thử lưu lại."
        : "Import thất bại. Vui lòng kiểm tra kết nối và dữ liệu Excel.";
      setMessage(error.response?.data?.message || fallback);
    }
    finally { setLoading(false); }
  };
  const deleteOne = async (row) => { if (await confirm({ title: "Xóa dữ liệu?", message: `Xóa “${row.hoTen}”?`, confirmText: "Xóa" })) { await api.delete(`/CommuneSubjects/${row.id}`); await load(); } };
  const deleteAll = async () => {
    if (!saved.length) return setMessage("Danh sách đối tượng xã đang trống.");
    if (!await confirm({ title: "Xóa toàn bộ danh sách?", message: `Bạn có chắc muốn xóa toàn bộ ${saved.length} dòng đối tượng xã? Dữ liệu đã xóa không thể khôi phục.`, confirmText: "Xóa toàn bộ" })) return;
    try {
      const res = await api.delete("/CommuneSubjects/all");
      await load();
      setMessage(`${res.data.message}\nĐã xóa: ${res.data.count} dòng.`);
    } catch (error) {
      setMessage(error.response?.data?.message || "Không thể xóa toàn bộ danh sách.");
    }
  };

  return <div className="container-fluid px-0">
    <div className="card shadow-sm mb-4"><div className="card-body"><h5 className="fw-bold text-primary">Import đối tượng xã</h5><p className="text-muted">Dòng 1 là tiêu đề. Dữ liệu bắt đầu từ A2, gồm 5 cột: STT, Họ và tên, Ngày sinh, CCCD, Địa chỉ.</p>
      <div className="row g-3 align-items-end"><div className="col-lg-4"><label className="form-label fw-semibold">Danh mục đối tượng {!hasObjectTypeColumn && <span className="text-danger">*</span>}</label><select className="form-select" value={hasObjectTypeColumn ? "" : objectType} disabled={hasObjectTypeColumn} onChange={(e) => changeObjectType(e.target.value)}><option value="">{hasObjectTypeColumn ? "-- Lấy đối tượng từ file --" : "-- Chọn đối tượng --"}</option>{objectTypes.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></div><div className="col-lg-5"><label className="form-label fw-semibold">File Excel</label><input ref={inputRef} type="file" accept=".xlsx,.xls" className="form-control" onChange={readFile}/></div><div className="col-lg-3"><button className="btn btn-primary w-100" disabled={loading || !preview.length || (!hasObjectTypeColumn && !objectType)} onClick={save}>{loading ? "Đang lưu..." : "Lưu dữ liệu"}</button></div></div>
      {fileName && <div className="text-muted mt-2">File: {fileName}</div>}{message && <div className="alert alert-info mt-3 mb-0" style={{whiteSpace:"pre-line"}}>{message}</div>}
    </div></div>
    {preview.length > 0 && <DataTable title={`Xem trước (${preview.length})`} rows={preview}/>}<div className="d-flex justify-content-between align-items-center mb-2"><span className="text-muted">Danh sách đã lưu: <strong>{saved.length.toLocaleString("vi-VN")}</strong> dòng</span><button className="btn btn-danger" disabled={!saved.length} onClick={deleteAll}>🗑 Xóa toàn bộ danh sách</button></div><DataTable title={`Dữ liệu đã lưu (${saved.length})`} rows={saved} onDelete={deleteOne}/>
  </div>;
}
