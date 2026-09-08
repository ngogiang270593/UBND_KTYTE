import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import api from "./api";
import { useNotification } from "./NotificationProvider";

const text = (value) => String(value ?? "").trim();

function excelDate(value, date1904) {
  if (value === "" || value == null) return null;
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value, { date1904 });
    if (!parsed) return null;
    return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  const match = text(value).match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  const iso = text(value).match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  return iso ? `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}` : null;
}

function MedicalRecordImportPage() {
  const { confirm } = useNotification();
  const inputRef = useRef(null);
  const [preview, setPreview] = useState([]);
  const [saved, setSaved] = useState([]);
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);

  const load = async () => {
    try { const res = await api.get("/MedicalRecords"); setSaved(res.data || []); }
    catch { setMessage("Không tải được danh sách y bạ."); }
  };
  useEffect(() => { load(); }, []);

  const chooseFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name); setMessage(""); setPreview([]);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error("File Excel không có sheet dữ liệu.");
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true, blankrows: true });
      const date1904 = workbook.Workbook?.WBProps?.date1904 === true || workbook.Workbook?.WBProps?.date1904 === 1;
      const data = rows.slice(1).map((cells, index) => ({
        excelLine: index + 2,
        sequenceNumber: Number.isFinite(Number(cells[0])) && text(cells[0]) ? Number(cells[0]) : null,
        patientId: text(cells[1]), fullName: text(cells[2]), dateOfBirth: excelDate(cells[3], date1904),
        gender: text(cells[4]), phoneNumber: text(cells[5]), citizenId: text(cells[6]),
        healthInsuranceNumber: text(cells[7]), address: text(cells[8]), note: text(cells[9]), sourceFileName: file.name,
      })).filter((row) => Object.entries(row).some(([key, value]) => !["excelLine", "sourceFileName"].includes(key) && value !== "" && value !== null));
      if (!data.length) throw new Error("Không tìm thấy dữ liệu từ dòng 2 (A2:J2) trở xuống.");
      setPreview(data);
      setMessage(`Đã đọc ${data.length} dòng. Kiểm tra dữ liệu rồi bấm “Lưu dữ liệu”.`);
    } catch (error) { setMessage(error.message || "Không đọc được file Excel."); }
  };

  const save = async () => {
    if (!preview.length) return setMessage("Chưa có dữ liệu để lưu.");
    setLoading(true);
    try {
      const res = await api.post("/MedicalRecords/import", preview);
      const data = res.data;
      setMessage(`${data.message}\nĐã lưu: ${data.savedCount}/${data.totalCount}.\n${data.errors?.join("\n") || ""}`);
      await load();
      if (!data.errorCount) { setPreview([]); setFileName(""); if (inputRef.current) inputRef.current.value = ""; }
    } catch (error) { setMessage(error.response?.data?.message || "Import dữ liệu y bạ thất bại."); }
    finally { setLoading(false); }
  };

  const remove = async (row) => {
    if (!await confirm({ title: "Xóa dữ liệu y bạ?", message: `Xóa y bạ của “${row.fullName}” (PID: ${row.patientId})?`, confirmText: "Xóa" })) return;
    await api.delete(`/MedicalRecords/${row.id}`); await load();
  };

  const clearAll = async () => {
    if (!saved.length) return setMessage("Danh sách y bạ đang trống.");
    if (!await confirm({ title: "Xóa toàn bộ dữ liệu y bạ?", message: `Bạn sắp xóa ${saved.length} dòng. Thao tác này không thể hoàn tác.`, confirmText: "Xóa toàn bộ" })) return;
    setClearing(true);
    try { const res = await api.delete("/MedicalRecords/all"); await load(); setMessage(`${res.data.message}\nSố dòng đã xóa: ${res.data.count}.`); }
    catch (error) { setMessage(error.response?.data?.message || `Không thể xóa toàn bộ dữ liệu y bạ${error.response?.status ? ` (HTTP ${error.response.status})` : ""}.`); }
    finally { setClearing(false); }
  };

  const headers = ["STT", "Mã định danh (PID)", "Họ và tên", "Ngày sinh", "Giới tính", "Số điện thoại", "Số CCCD", "Số thẻ BHYT", "Địa chỉ", "Ghi chú"];
  const cells = (row, index) => [row.sequenceNumber ?? index + 1, row.patientId, row.fullName, row.dateOfBirth ? String(row.dateOfBirth).slice(0, 10).split("-").reverse().join("/") : "", row.gender, row.phoneNumber, row.citizenId, row.healthInsuranceNumber, row.address, row.note];

  return <div className="container-fluid px-0">
    <div className="card shadow-sm mb-4"><div className="card-body">
      <h5 className="fw-bold text-primary">Import dữ liệu y bạ</h5>
      <p className="text-muted">Dòng 1 là tiêu đề. Dữ liệu bắt đầu từ dòng 2, theo đúng thứ tự cột A đến J.</p>
      <div className="d-flex gap-2 align-items-center flex-wrap">
        <input ref={inputRef} className="form-control" style={{maxWidth: 430}} type="file" accept=".xlsx,.xls" onChange={chooseFile}/>
        <button className="btn btn-primary" disabled={loading || !preview.length} onClick={save}>{loading ? "Đang lưu..." : "Lưu dữ liệu"}</button>
        {fileName && <span className="text-muted">{fileName}</span>}
      </div>
      {message && <div className="alert alert-info mt-3 mb-0" style={{whiteSpace: "pre-line"}}>{message}</div>}
    </div></div>
    {preview.length > 0 && <RecordTable title={`Dữ liệu xem trước (${preview.length})`} rows={preview} headers={headers} cells={cells}/>} 
    <div className="d-flex justify-content-end mb-2"><button className="btn btn-danger" disabled={clearing || !saved.length} onClick={clearAll}>{clearing ? "Đang xóa..." : "Xóa toàn bộ dữ liệu"}</button></div>
    <RecordTable title={`Dữ liệu y bạ đã lưu (${saved.length})`} rows={saved} headers={headers} cells={cells} onDelete={remove}/>
  </div>;
}

function RecordTable({ title, rows, headers, cells, onDelete }) {
  return <div className="card shadow-sm mb-4"><div className="card-header bg-white fw-bold">{title}</div><div className="table-responsive">
    <table className="table table-hover table-bordered align-middle mb-0"><thead className="table-secondary text-center"><tr>{headers.map((h) => <th key={h}>{h}</th>)}{onDelete && <th>Thao tác</th>}</tr></thead>
    <tbody>{rows.map((row, index) => <tr key={row.id || row.excelLine}>{cells(row, index).map((value, i) => <td key={i}>{value}</td>)}{onDelete && <td><button className="btn btn-outline-danger btn-sm" onClick={() => onDelete(row)}>Xóa</button></td>}</tr>)}
    {!rows.length && <tr><td colSpan={headers.length + (onDelete ? 1 : 0)} className="text-center text-muted py-4">Chưa có dữ liệu</td></tr>}</tbody></table>
  </div></div>;
}

export default MedicalRecordImportPage;
