import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import api from "./api";
import { useNotification } from "./NotificationProvider";

const columns = [["stt", "STT"], ["hoTen", "Họ và tên"], ["namSinh", "Năm sinh"], ["gioiTinh", "Giới tính"], ["cccd", "CCCD"], ["diaChi", "Địa chỉ"], ["ngayVao", "Ngày vào"]];
const clean = (value) => String(value ?? "").trim();
const normalize = (value) => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/[^a-z0-9]/g, "");
const aliases = [["stt", "sothutu"], ["hoten", "hovaten", "ten"], ["namsinh", "namsinh"], ["gioitinh"], ["cccd", "cancuoc", "socccd", "socancuoc"], ["diachi"], ["ngayvao", "ngaynhapvien", "ngayvaovien"]];
const findHeader = (row, names) => row.findIndex((cell) => names.includes(normalize(cell)));

function parseRows(matrix, fileName) {
  const headerIndex = matrix.findIndex((row) => aliases.slice(1).every((names) => findHeader(row, names) >= 0));
  if (headerIndex < 0) throw new Error("File phải có đủ cột: STT, Họ và tên, Năm sinh, Giới tính, CCCD, Địa chỉ, Ngày vào.");
  const indexes = aliases.map((names) => findHeader(matrix[headerIndex], names));
  const rows = matrix.slice(headerIndex + 1).map((cells, offset) => {
    const row = { excelLine: headerIndex + offset + 2, sourceFileName: fileName };
    columns.forEach(([key], index) => { row[key] = clean(indexes[index] < 0 ? "" : cells[indexes[index]]); });
    return row;
  }).filter((row) => columns.some(([key]) => row[key]));
  if (!rows.length) throw new Error("File không có dữ liệu.");
  const missing = rows.find((row) => !row.hoTen);
  if (missing) throw new Error(`Dòng Excel ${missing.excelLine}: thiếu Họ và tên.`);
  return rows;
}

function DataTable({ title, rows, onDelete }) {
  return <div className="card shadow-sm mb-4"><div className="card-header bg-white fw-bold">{title}</div><div className="table-responsive"><table className="table table-bordered table-hover table-sm align-middle mb-0"><thead className="table-secondary text-center"><tr>{columns.map(([, label]) => <th key={label}>{label}</th>)}{onDelete && <th>Thao tác</th>}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.id || row.excelLine || index}>{columns.map(([key]) => <td key={key} className={key === "stt" ? "text-center" : ""}>{row[key]}</td>)}{onDelete && <td className="text-center"><button className="btn btn-outline-danger btn-sm" onClick={() => onDelete(row)}>Xóa</button></td>}</tr>)}{!rows.length && <tr><td colSpan={columns.length + (onDelete ? 1 : 0)} className="text-center text-muted py-4">Chưa có dữ liệu</td></tr>}</tbody></table></div></div>;
}

export default function TtytKvTcImportPage() {
  const { confirm } = useNotification(); const inputRef = useRef(null);
  const [preview, setPreview] = useState([]); const [saved, setSaved] = useState([]); const [fileName, setFileName] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const load = async () => { try { const { data } = await api.get("/TtytKvTc"); setSaved(data || []); } catch { setMessage("Không tải được dữ liệu tổng khám TTYTKVTC."); } };
  useEffect(() => { load(); }, []);
  const readFile = async (event) => { const file = event.target.files?.[0]; if (!file) return; setFileName(file.name); setPreview([]); setMessage(""); try { const book = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false }); const sheet = book.Sheets[book.SheetNames[0]]; if (!sheet) throw new Error("File Excel không có sheet dữ liệu."); setPreview(parseRows(XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false, blankrows: true }), file.name)); } catch (error) { setMessage(error.message || "Không đọc được file Excel."); } };
  const save = async () => { if (!preview.length) return; setBusy(true); try { const { data } = await api.post("/TtytKvTc/import", preview); setMessage(`${data.message} Đã lưu: ${data.savedCount} dòng.`); setPreview([]); setFileName(""); if (inputRef.current) inputRef.current.value = ""; await load(); } catch (error) { setMessage(error.response?.data?.message || "Import thất bại."); } finally { setBusy(false); } };
  const deleteOne = async (row) => { if (await confirm({ title: "Xóa dữ liệu?", message: `Xóa “${row.hoTen}”?`, confirmText: "Xóa" })) { await api.delete(`/TtytKvTc/${row.id}`); await load(); } };
  const deleteAll = async () => { if (!saved.length || !await confirm({ title: "Xóa toàn bộ danh sách?", message: `Xóa toàn bộ ${saved.length} dòng tổng khám TTYTKVTC?`, confirmText: "Xóa toàn bộ" })) return; const { data } = await api.delete("/TtytKvTc/all"); setMessage(`${data.message} Đã xóa: ${data.count} dòng.`); await load(); };
  return <div className="container-fluid px-0"><div className="card shadow-sm mb-4"><div className="card-body"><h5 className="fw-bold text-primary">Import tổng khám TTYTKVTC</h5><p className="text-muted">Dòng đầu là tiêu đề. Dữ liệu gồm 7 cột: STT, Họ và tên, Năm sinh, Giới tính, CCCD, Địa chỉ, Ngày vào.</p><div className="row g-3 align-items-end"><div className="col-lg-7"><label className="form-label fw-semibold">File Excel</label><input ref={inputRef} type="file" accept=".xlsx,.xls" className="form-control" onChange={readFile}/></div><div className="col-lg-3"><button className="btn btn-primary w-100" disabled={busy || !preview.length} onClick={save}>{busy ? "Đang lưu..." : "Import"}</button></div></div>{fileName && <div className="text-muted mt-2">File: {fileName}</div>}{message && <div className="alert alert-info mt-3 mb-0">{message}</div>}</div></div>{preview.length > 0 && <DataTable title={`Xem trước (${preview.length})`} rows={preview}/>}<div className="d-flex justify-content-between align-items-center mb-2"><span className="text-muted">Danh sách đã lưu: <strong>{saved.length.toLocaleString("vi-VN")}</strong> dòng</span><button className="btn btn-danger" disabled={!saved.length} onClick={deleteAll}>Xóa toàn bộ danh sách</button></div><DataTable title={`Dữ liệu đã lưu (${saved.length})`} rows={saved} onDelete={deleteOne}/></div>;
}
