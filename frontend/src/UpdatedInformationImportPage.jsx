import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import api from "./api";
import TablePagination from "./TablePagination";
import { columns, parseUpdatedInformation } from "./updatedInformationImport";

export default function UpdatedInformationImportPage() {
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
    try { const { data } = await api.get("/UpdatedInformation"); setSaved(data); }
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
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, raw: false, defval: "" });
      const rows = parseUpdatedInformation(matrix);
      setPreview(rows);
      setMessage(`Đã đọc ${rows.length} dòng. Kiểm tra dữ liệu rồi bấm Lưu dữ liệu.`);
    } catch (error) { setMessage(error.message || "Không đọc được file Excel."); }
    finally { setBusy(false); }
  };
  const save = async () => {
    setBusy(true); setMessage("");
    try {
      const { data } = await api.post("/UpdatedInformation/import", preview);
      setPreview([]); setPage(1);
      if (inputRef.current) inputRef.current.value = "";
      setMessage(`Đã import ${data.savedCount} dòng thông tin cập nhật.`);
      await load();
    } catch (error) { setMessage(error.response?.data?.message || "Import thất bại. Vui lòng thử lại."); }
    finally { setBusy(false); }
  };
  const downloadTemplate = () => {
    const sheet = XLSX.utils.aoa_to_sheet([columns.map(([, label]) => label)]);
    sheet["!cols"] = [{ wch: 8 }, { wch: 20 }, { wch: 30 }, { wch: 60 }];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Thông tin cập nhật");
    XLSX.writeFile(book, "MauThongTinCapNhat.xlsx");
  };
  const rows = preview.length ? preview : saved;
  return <div className="container-fluid py-4"><div className="card border-0 shadow-sm">
    <div className="card-header bg-white p-4"><h4 className="fw-bold text-primary mb-1">IMPORT THÔNG TIN CẬP NHẬT</h4>
      <p className="text-muted mb-0">Nhập danh sách gồm STT, Căn cước, Họ và tên, Địa chỉ để lưu làm nguồn đối chiếu.</p>
    </div>
    <div className="card-body p-4">
      <p className="small text-muted">Đọc sheet đầu tiên của file Excel. Định dạng cột Căn cước là Text trong Excel để giữ số 0 đầu.</p>
      <div className="d-flex flex-wrap gap-2 mb-3">
        <button className="btn btn-outline-success" onClick={downloadTemplate}>Tải file mẫu</button>
        <input ref={inputRef} type="file" accept=".xlsx,.xls" aria-label="Chọn file thông tin cập nhật" className="form-control w-auto" disabled={busy} onChange={readFile} />
        <button className="btn btn-primary" disabled={busy || !preview.length} onClick={save}>{busy ? "Đang xử lý..." : "Lưu dữ liệu"}</button>
        {preview.length > 0 && <button className="btn btn-outline-secondary" disabled={busy} onClick={() => { setPreview([]); setPage(1); setMessage(""); if (inputRef.current) inputRef.current.value = ""; }}>Hủy xem trước</button>}
      </div>
      {message && <div className="alert alert-info" role="status">{message}</div>}
      {loadError && <div className="alert alert-danger">{loadError} <button className="btn btn-sm btn-outline-danger" disabled={loading || busy} onClick={load}>Tải lại</button></div>}
      <h5>{preview.length ? "Xem trước dữ liệu" : "Danh sách đã import"} ({rows.length})</h5>
      <div className="table-responsive"><table className="table table-bordered table-hover align-middle">
        <thead className="table-light"><tr>{columns.map(([key, label]) => <th key={key}>{label}</th>)}</tr></thead>
        <tbody>{rows.slice((page - 1) * pageSize, page * pageSize).map((row, index) => <tr key={row.id ?? index}>{columns.map(([key]) => <td key={key}>{row[key]}</td>)}</tr>)}
          {!rows.length && <tr><td colSpan={4} className="text-center text-muted py-4">{loading ? "Đang tải..." : "Chưa có dữ liệu."}</td></tr>}
        </tbody>
      </table></div>
      <TablePagination total={rows.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
    </div>
  </div></div>;
}
