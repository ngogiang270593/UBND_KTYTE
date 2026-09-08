import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import api from "./api";
import { useNotification } from "./NotificationProvider";

const columns = [
  ["stt","STT"], ["hoTen","HO_TEN"], ["soCccd","SO_CCCD"], ["ngaySinh","NGAY_SINH"],
  ["gioiTinh","GIOI_TINH"], ["maQuocTich","MA_QUOCTICH"], ["maDanToc","MA_DANTOC"], ["diaChi","DIA_CHI"],
  ["maHuyenCuTru","MAHUYEN_CU_TRU"], ["maXaCuTru","MAXA_CU_TRU"], ["dienThoai","DIEN_THOAI"],
  ["maTheBhyt","MA_THE_BHYT"], ["maDkbd","MA_DKBD"], ["gtTheTu","GT_THE_TU"], ["gtTheDen","GT_THE_DEN"],
  ["ngayMienCct","NGAY_MIEN_CCT"], ["lyDoVv","LY_DO_VV"], ["lyDoVnt","LY_DO_VNT"],
  ["maLyDoVnt","MA_LY_DO_VNT"], ["chanDoanVao","CHAN_DOAN_VAO"], ["chanDoanRv","CHAN_DOAN_RV"],
  ["maBenhChinh","MA_BENH_CHINH"], ["maBenhKt","MA_BENH_KT"], ["maBenhYhct","MA_BENH_YHCT"],
  ["maPtttQt","MA_PTTT_QT"], ["maNoiDi","MA_NOI_DI"], ["maNoiDen","MA_NOI_DEN"], ["soNgayDtri","SO_NGAY_DTRI"],
];
const clean = (value) => String(value ?? "").trim();

function TanChauInpatientImportPage() {
  const { confirm } = useNotification();
  const inputRef = useRef(null);
  const [preview, setPreview] = useState([]);
  const [saved, setSaved] = useState([]);
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try { const res = await api.get("/TanChauInpatient"); setSaved(res.data || []); }
    catch { setMessage("Không tải được dữ liệu nội trú Tân Châu."); }
  };
  useEffect(() => { load(); }, []);

  const readFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name); setPreview([]); setMessage("");
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error("File Excel không có sheet dữ liệu.");
      const sheetRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false, blankrows: true });
      const data = sheetRows.slice(1).map((cells, rowIndex) => {
        const row = { excelLine: rowIndex + 2, sourceFileName: file.name };
        columns.forEach(([key], columnIndex) => { row[key] = clean(cells[columnIndex]); });
        return row;
      }).filter((row) => columns.some(([key]) => row[key]));
      if (!data.length) throw new Error("Không tìm thấy dữ liệu từ dòng 2, cột A đến AB.");
      setPreview(data); setMessage(`Đã đọc ${data.length} dòng từ A2:AB. Bấm “Lưu dữ liệu” để import.`);
    } catch (error) { setMessage(error.message || "Không đọc được file Excel."); }
  };

  const save = async () => {
    if (!preview.length) return setMessage("Chưa có dữ liệu để lưu.");
    setLoading(true);
    try {
      const res = await api.post("/TanChauInpatient/import", preview);
      setMessage(`${res.data.message}\nĐã lưu: ${res.data.savedCount} dòng.`); await load();
      setPreview([]); setFileName(""); if (inputRef.current) inputRef.current.value = "";
    } catch (error) { setMessage(error.response?.data?.message || "Import thất bại."); }
    finally { setLoading(false); }
  };

  const deleteOne = async (row) => {
    if (!await confirm({ title: "Xóa dữ liệu?", message: `Xóa dòng của “${row.hoTen || row.stt}”?`, confirmText: "Xóa" })) return;
    await api.delete(`/TanChauInpatient/${row.id}`); await load();
  };
  const deleteAll = async () => {
    if (!saved.length) return setMessage("Danh sách đang trống.");
    if (!await confirm({ title: "Xóa toàn bộ dữ liệu?", message: `Xóa toàn bộ ${saved.length} dòng nội trú Tân Châu?`, confirmText: "Xóa toàn bộ" })) return;
    const res = await api.delete("/TanChauInpatient/all"); await load(); setMessage(`${res.data.message}\nĐã xóa: ${res.data.count} dòng.`);
  };

  return <div className="container-fluid px-0">
    <div className="card shadow-sm mb-4"><div className="card-body">
      <h5 className="fw-bold text-primary">Import nội trú Tân Châu</h5>
      <p className="text-muted">Dòng 1 là tiêu đề. Dữ liệu bắt đầu từ A2 và gồm 28 cột, kết thúc tại cột AB.</p>
      <div className="d-flex gap-2 align-items-center flex-wrap"><input ref={inputRef} type="file" accept=".xlsx,.xls" className="form-control" style={{maxWidth:430}} onChange={readFile}/><button className="btn btn-primary" disabled={loading || !preview.length} onClick={save}>{loading ? "Đang lưu..." : "Lưu dữ liệu"}</button>{fileName && <span className="text-muted">{fileName}</span>}</div>
      {message && <div className="alert alert-info mt-3 mb-0" style={{whiteSpace:"pre-line"}}>{message}</div>}
    </div></div>
    {preview.length > 0 && <DataTable title={`Xem trước (${preview.length})`} rows={preview}/>} 
    <div className="d-flex justify-content-end mb-2"><button className="btn btn-danger" disabled={!saved.length} onClick={deleteAll}>Xóa toàn bộ dữ liệu</button></div>
    <DataTable title={`Dữ liệu đã lưu (${saved.length})`} rows={saved} onDelete={deleteOne}/>
  </div>;
}

function DataTable({ title, rows, onDelete }) {
  return <div className="card shadow-sm mb-4"><div className="card-header bg-white fw-bold">{title}</div><div className="table-responsive"><table className="table table-bordered table-hover table-sm align-middle mb-0">
    <thead className="table-secondary text-center"><tr>{columns.map(([,label]) => <th key={label} style={{whiteSpace:"nowrap"}}>{label}</th>)}{onDelete && <th>Thao tác</th>}</tr></thead>
    <tbody>{rows.map((row,index) => <tr key={row.id || row.excelLine || index}>{columns.map(([key]) => <td key={key} style={{whiteSpace:"nowrap"}}>{row[key]}</td>)}{onDelete && <td><button className="btn btn-outline-danger btn-sm" onClick={() => onDelete(row)}>Xóa</button></td>}</tr>)}{!rows.length && <tr><td colSpan={columns.length + (onDelete ? 1 : 0)} className="text-center text-muted py-4">Chưa có dữ liệu</td></tr>}</tbody>
  </table></div></div>;
}

export default TanChauInpatientImportPage;
