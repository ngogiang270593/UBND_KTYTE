import { useState } from "react";
import XLSX from "xlsx-js-style";
import api from "./api";

const normalize = (value) => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/đ/gi, "d")
  .toLocaleLowerCase("vi-VN")
  .trim();

const getValue = (row, ...names) => {
  const matchingNames = new Set(names.map(normalize));
  const key = Object.keys(row).find((name) => matchingNames.has(normalize(name)));
  return key ? row[key] : "";
};
const isPublicValue = (value) => value === true || ["true", "1", "x", "yes", "co", "cong khai"].includes(normalize(value));

const formatDate = (value) => {
  if (value instanceof Date) return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  const text = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const match = text.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  return match ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}` : text;
};

const parseRows = (data) => (Array.isArray(data) ? data : []).map((row) => ({
  number: String(getValue(row, "số", "so", "number")),
  meetingDate: formatDate(getValue(row, "ngày họp", "ngay hop", "meetingdate", "meeting date")),
  meetingType: String(getValue(row, "cuộc họp", "cuoc hop", "meetingtype", "meeting type")),
  content: String(getValue(row, "nội dung", "noi dung", "content")),
  attendeeCount: Number(getValue(row, "số người họp", "so nguoi hop", "attendeecount", "attendee count")) || 1,
  meetingTimeRange: String(getValue(row, "khoảng thời gian họp", "khoang thoi gian hop", "meetingtimerange", "meeting time range")),
  meetingRoom: String(getValue(row, "phòng họp", "phong hop", "meetingroom", "meeting room")),
  isPublic: isPublicValue(getValue(row, "công khai", "cong khai", "ispublic", "is public")),
})).filter((row) => row.number || row.content);

export default function OfficeMeetingSyncPage() {
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const readFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      let data;
      if (file.name.toLowerCase().endsWith(".json")) {
        data = JSON.parse(await file.text());
      } else {
        const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        data = sheet ? XLSX.utils.sheet_to_json(sheet, { defval: "" }) : [];
      }
      const parsedRows = parseRows(data);
      setRows(parsedRows);
      setMessage(`Đã đọc ${parsedRows.length} dòng dữ liệu.`);
    } catch (error) {
      setRows([]);
      setMessage(error instanceof Error ? `Không thể đọc file: ${error.message}` : "Không thể đọc file import.");
    }
  };

  const exportData = async () => {
    setBusy(true);
    try {
      const { data } = await api.get("/OfficeMeetings");
      const clean = (data || []).map((meeting) => ({
        Số: meeting.number,
        "Ngày họp": meeting.meetingDate,
        "Cuộc họp": meeting.meetingType,
        "Nội dung": meeting.content,
        "Số người họp": meeting.attendeeCount,
        "Khoảng thời gian họp": meeting.meetingTimeRange || "",
        "Phòng họp": meeting.meetingRoom || "",
        "Công khai": meeting.isPublic ? "Có" : "Không",
      }));
      const blob = new Blob([JSON.stringify(clean, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "du-lieu-dong-bo-cuoc-hop.json";
      link.click();
      URL.revokeObjectURL(url);
      setMessage("Đã xuất dữ liệu.");
    } catch (error) {
      setMessage(error.response?.data?.message || "Xuất dữ liệu thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const importData = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/OfficeMeetings/sync/import", rows);
      setMessage(`Đã thêm ${data.added}, bỏ qua ${data.skipped} bản ghi trùng.`);
      setRows([]);
    } catch (error) {
      setMessage(error.response?.data?.message || "Nhập dữ liệu thất bại.");
    } finally {
      setBusy(false);
    }
  };

  return <section className="container-fluid py-2">
    <div className="card shadow-sm border-0">
      <div className="card-body p-4">
        <h2 className="h3 fw-bold">Đồng bộ dữ liệu</h2>
        <p className="text-muted">Dữ liệu đồng bộ không bao gồm tệp đính kèm.</p>
        <div className="d-flex gap-2 flex-wrap mb-3">
          <button className="btn btn-primary" onClick={exportData} disabled={busy}>Xuất data đồng bộ</button>
          <label className="btn btn-outline-primary mb-0">Chọn file import
            <input type="file" accept=".json,.xlsx,.xls" hidden onChange={readFile} />
          </label>
          <button className="btn btn-success" onClick={importData} disabled={busy || !rows.length}>Nhập dữ liệu đồng bộ</button>
        </div>
        {message && <div className="alert alert-info">{message}</div>}
        <div className="fw-semibold mb-2">Tổng số cuộc họp: {rows.length}</div>
        {rows.length > 0 && <div className="table-responsive border rounded">
          <table className="table table-sm align-middle mb-0">
            <thead><tr><th>Số</th><th>Ngày họp</th><th>Nội dung</th><th>Khoảng thời gian họp</th><th>Phòng họp</th><th>Công khai</th></tr></thead>
            <tbody>{rows.slice(0, 20).map((row, index) => <tr key={`${row.number}-${index}`}>
              <td>{row.number}</td><td>{row.meetingDate}</td><td>{row.content}</td>
              <td>{row.meetingTimeRange}</td><td>{row.meetingRoom}</td><td>{row.isPublic ? "Có" : "Không"}</td>
            </tr>)}</tbody>
          </table>
        </div>}
      </div>
    </div>
  </section>;
}
