import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import api from "./api";
import TablePagination from "./TablePagination";
import { columns, parseElderly } from "./elderlyImport";

export default function ElderlyImportPage() {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState([]);
  const [saved, setSaved] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const load = async () => {
    setLoading(true);
    setLoadError("");
    try { const { data } = await api.get("/Elderly"); setSaved(data); }
    catch { setLoadError("Không tải được danh sách đã import."); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const readFile = async (event) => {
    const file = event.target.files?.[0];
    setPreview([]); setMessage(""); setPage(1);
    if (!file) return;
    setBusy(true);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true, dateNF: "dd/mm/yyyy" });
      const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, raw: false, defval: "", dateNF: "dd/mm/yyyy" });
      const rows = parseElderly(matrix);
      setPreview(rows);
      setMessage(`Đã đọc ${rows.length} dòng. Kiểm tra dữ liệu rồi bấm Lưu dữ liệu.`);
    } catch (error) { setMessage(error.message || "Không đọc được file Excel."); }
    finally { setBusy(false); }
  };
  const save = async () => {
    setBusy(true); setMessage("");
    try {
      const { data } = await api.post("/Elderly/import", preview);
      setPreview([]); setPage(1);
      if (inputRef.current) inputRef.current.value = "";
      setMessage(`Đã import ${data.savedCount} dòng người cao tuổi.`);
      await load();
    } catch (error) { setMessage(error.response?.data?.message || "Import thất bại. Vui lòng thử lại."); }
    finally { setBusy(false); }
  };
  const deleteAll = async () => {
    if (!saved.length || !window.confirm(`Xóa toàn bộ ${saved.length} dòng trong danh sách người cao tuổi?`)) return;
    setBusy(true); setMessage("");
    try {
      const { data } = await api.delete("/Elderly/all");
      setPreview([]); setPage(1);
      setMessage(`Đã xóa ${data.count} dòng.`);
      await load();
    } catch (error) { setMessage(error.response?.data?.message || "Xóa dữ liệu thất bại."); }
    finally { setBusy(false); }
  };
  const downloadTemplate = () => {
    const sheet = XLSX.utils.aoa_to_sheet([columns.map(([, label]) => label)]);
    sheet["!cols"] = [{ wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 60 }, { wch: 16 }];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Người cao tuổi");
    XLSX.writeFile(book, "MauNguoiCaoTuoi.xlsx");
  };
  const rows = preview.length ? preview : saved;
  return <div className="container-fluid py-4"><div className="card border-0 shadow-sm">
    <div className="card-header bg-white p-4"><h4 className="fw-bold text-primary mb-1">IMPORT NGƯỜI CAO TUỔI</h4>
      <p className="text-muted mb-0">Nhập danh sách gồm Họ và tên, Năm sinh, Giới tính, CCCD, Địa chỉ, NGÀY KHÁM.</p>
    </div>
    <div className="card-body p-4">
      <p className="small text-muted">Có thể thêm cột Ngày sinh (dd/mm/yyyy) để đối chiếu chính xác hơn. Đọc sheet đầu tiên của file Excel. Định dạng cột CCCD là Text trong Excel để giữ số 0 đầu.</p>
      <div className="d-flex flex-wrap gap-2 mb-3">
        <button className="btn btn-outline-success" onClick={downloadTemplate}>Tải file mẫu</button>
        <input ref={inputRef} type="file" accept=".xlsx,.xls" aria-label="Chọn file người cao tuổi" className="form-control w-auto" disabled={busy} onChange={readFile} />
        <button className="btn btn-primary" disabled={busy || !preview.length} onClick={save}>{busy ? "Đang xử lý..." : "Lưu dữ liệu"}</button>
        {!preview.length && <button className="btn btn-outline-danger" disabled={busy || loading || !saved.length} onClick={deleteAll}>Xóa toàn bộ dữ liệu đã import</button>}
        {preview.length > 0 && <button className="btn btn-outline-secondary" disabled={busy} onClick={() => { setPreview([]); setPage(1); setMessage(""); if (inputRef.current) inputRef.current.value = ""; }}>Hủy xem trước</button>}
      </div>
      {message && <div className="alert alert-info" role="status">{message}</div>}
      {loadError && <div className="alert alert-danger">{loadError} <button className="btn btn-sm btn-outline-danger" disabled={loading || busy} onClick={load}>Tải lại</button></div>}
      <h5>{preview.length ? "Xem trước dữ liệu" : "Danh sách đã import"} ({rows.length})</h5>
      <div className="table-responsive"><table className="table table-bordered table-hover align-middle">
        <thead className="table-light"><tr>{columns.map(([key, label]) => <th key={key}>{label}</th>)}</tr></thead>
        <tbody>{rows.slice((page - 1) * pageSize, page * pageSize).map((row, index) => <tr key={row.id ?? index}>{columns.map(([key]) => <td key={key}>{row[key]}</td>)}</tr>)}
          {!rows.length && <tr><td colSpan={columns.length} className="text-center text-muted py-4">{loading ? "Đang tải..." : "Chưa có dữ liệu."}</td></tr>}
        </tbody>
      </table></div>
      <TablePagination total={rows.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
    </div>
  </div></div>;
}
