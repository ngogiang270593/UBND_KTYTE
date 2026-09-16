import TanHoaPaidKskListPage from "./TanHoaPaidKskListPage";
import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import api from "./api";

const columns = [
  ["stt", "STT"], ["hoTen", "Họ và tên"], ["namSinh", "Năm sinh"],
  ["gioiTinh", "Giới tính"], ["cccd", "CCCD"], ["diaChi", "Địa chỉ"],
];

export default function TanHoaPaidKskImportPage() {
  const inputRef = useRef(null);
  const [savedVersion, setSavedVersion] = useState(0);
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const readFile = async (event) => {
    const file = event.target.files?.[0];
    setRows([]);
    setMessage("");
    if (!file) return;
    setBusy(true);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error("File không có trang dữ liệu.");
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "", blankrows: false })
        .slice(1).map((cells) => Object.fromEntries([
          ...columns.map(([key], index) => [key, String(cells[index] ?? "")]),
          ["sourceFileName", file.name],
        ]));
      setRows(data);
      setMessage(data.length ? `Đã đọc ${data.length} dòng. Bấm Import để lưu dữ liệu.` : "File không có dòng dữ liệu.");
    } catch (error) {
      setMessage(error.message || "Không đọc được file Excel.");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    setMessage("");
    try {
      const response = await api.post("/TanHoaPaidKsk/import", rows);
      setMessage(`Đã import thành công ${response.data.savedCount} dòng KSK (đóng phí) Tân Hòa.`);
      setRows([]);
      setSavedVersion((version) => version + 1);
      if (inputRef.current) inputRef.current.value = "";
    } catch (error) {
      setMessage(error.response?.data?.message || "Không lưu được dữ liệu. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  };

  return <div className="container-fluid px-0">
    <div className="card shadow-sm mb-4"><div className="card-body">
      <h5 className="fw-bold text-primary">Import KSK (đóng phí) Tân Hòa</h5>
      <p className="text-muted">Dòng 1 là tiêu đề. Dữ liệu từ dòng 2, cột A đến F theo thứ tự: STT, Họ và tên, Năm sinh, Giới tính, CCCD, Địa chỉ.</p>
      <p className="text-muted">Import trực tiếp, không kiểm tra dữ liệu hoặc loại bỏ dòng trùng. Giữ nguyên giá trị hiển thị trong Excel.</p>
      <div className="row g-3 align-items-end">
        <div className="col-md-9"><label htmlFor="tan-hoa-paid-ksk-file" className="form-label">File Excel</label><input id="tan-hoa-paid-ksk-file" ref={inputRef} type="file" accept=".xlsx,.xls" className="form-control" disabled={busy} onChange={readFile} /></div>
        <div className="col-md-3"><button className="btn btn-primary w-100" disabled={busy || !rows.length} onClick={save}>{busy ? "Đang xử lý..." : "Import"}</button></div>
      </div>
      {message && <div className="alert alert-info mt-3 mb-0" role="status">{message}</div>}
    </div></div>
    {rows.length > 0 && <div className="card shadow-sm">
      <div className="card-header bg-white fw-bold">Xem trước {Math.min(rows.length, 100)} / {rows.length} dòng</div>
      <div className="table-responsive"><table className="table table-bordered table-sm mb-0">
        <thead><tr>{columns.map(([key, label]) => <th key={key}>{label}</th>)}</tr></thead>
        <tbody>{rows.slice(0, 100).map((row, index) => <tr key={index}>{columns.map(([key]) => <td key={key}>{row[key]}</td>)}</tr>)}</tbody>
      </table></div>
    </div>}
    <div className="mt-4"><TanHoaPaidKskListPage key={savedVersion} /></div>
  </div>;
}