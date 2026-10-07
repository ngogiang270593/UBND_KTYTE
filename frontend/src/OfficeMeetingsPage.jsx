import { useEffect, useMemo, useRef, useState } from "react";
import XLSX from "xlsx-js-style";
import api from "./api";
import TablePagination from "./TablePagination";
import { useNotification } from "./NotificationProvider";

const meetingTypes = ["Họp Trực Tuyến", "Họp Trực Tiếp", "Họp Chủ Tịch, Phó Chủ Tịch", "Họp Ủy Ban", "Họp Khác"];
const emptyForm = { number: "", meetingDate: null, meetingType: meetingTypes[0], content: "", attendeeCount: "", attachment: null };
const currentYear = new Date().getFullYear();
const emptyFilters = { keyword: "", number: "", year: String(currentYear), quarter: "", content: "" };
const allowedExtensions = new Set(["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "jpg", "jpeg", "png", "txt", "zip"]);
const maxAttachmentSize = 25 * 1024 * 1024;

const normalizeText = (value) => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/đ/gi, "d")
  .toLocaleLowerCase("vi-VN")
  .trim();

const formatDate = (value) => {
  const [year, month, day] = String(value ?? "").slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : "";
};

const formatDateInput = (value) => `${String(value.getDate()).padStart(2, "0")}/${String(value.getMonth() + 1).padStart(2, "0")}/${value.getFullYear()}`;

const parseDateInput = (value) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  let day;
  let month;
  let year;
  if (/^\d{8}$/.test(digits)) {
    day = Number(digits.slice(0, 2));
    month = Number(digits.slice(2, 4));
    year = Number(digits.slice(4, 8));
  } else {
    const match = String(value ?? "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return null;
    [, day, month, year] = match.map(Number);
  }

  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
};

const parseApiDate = (value) => {
  const [year, month, day] = String(value ?? "").slice(0, 10).split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
};

const toApiDate = (value) => `${String(value.getDate()).padStart(2, "0")}/${String(value.getMonth() + 1).padStart(2, "0")}/${value.getFullYear()}`;

const getErrorMessage = (error) => error.response?.data?.message
  || "Không thể hoàn tất yêu cầu. Vui lòng thử lại.";

const formatFileSize = (size) => size < 1024 * 1024
  ? `${Math.max(1, Math.round(size / 1024))} KB`
  : `${(size / (1024 * 1024)).toFixed(1)} MB`;

const formatCreatedAt = (value) => ({
  time: value.toLocaleTimeString("vi-VN", { hour: "numeric", minute: "2-digit", second: "2-digit" }),
  date: value.toLocaleDateString("vi-VN"),
});

function FileTypeIcon({ fileName }) {
  const extension = fileName.split(".").pop()?.toLowerCase() || "";
  const isWord = ["doc", "docx"].includes(extension);
  const isPdf = extension === "pdf";
  const color = isWord ? "#1686d9" : isPdf ? "#e23b3b" : "#64748b";
  const label = isWord ? "W" : isPdf ? "PDF" : extension.slice(0, 3).toUpperCase();
  return <span aria-label={`Tệp ${fileName}`} title={fileName} className="d-inline-flex align-items-center justify-content-center fw-bold"
    style={{ width: 26, height: 30, color, border: `2px solid ${color}`, borderRadius: 4, fontSize: label.length > 1 ? 8 : 14 }}>
    {label}
  </span>;
}

export default function OfficeMeetingsPage({ profile }) {
  const { confirm } = useNotification();
  const [meetings, setMeetings] = useState([]);
  const [yearCatalog, setYearCatalog] = useState([]);
  const [meetingTypeCatalog, setMeetingTypeCatalog] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [meetingDateInput, setMeetingDateInput] = useState("");
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [removeSavedAttachment, setRemoveSavedAttachment] = useState(false);
  const [attachmentCreatedAt, setAttachmentCreatedAt] = useState(null);
  const attachmentInputRef = useRef(null);
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      api.get("/OfficeMeetings"),
      api.get("/OfficeMeetingYears"),
      api.get("/OfficeMeetingTypes"),
    ])
      .then(([meetingResult, yearResult, typeResult]) => {
        if (cancelled) return;
        if (meetingResult.status === "fulfilled") {
          setMeetings(meetingResult.value.data);
        } else {
          setMessage({ type: "danger", text: getErrorMessage(meetingResult.reason) });
        }
        if (yearResult.status === "rejected") {
          setMessage({ type: "danger", text: getErrorMessage(yearResult.reason) });
          return;
        }
        const years = Array.isArray(yearResult.value.data) ? yearResult.value.data : [];
        setYearCatalog(years);
        if (typeResult.status === "fulfilled") {
          const types = Array.isArray(typeResult.value.data) ? typeResult.value.data : [];
          setMeetingTypeCatalog(types);
          const defaultType = types.find((item) => item.isDefault)?.name || types[0]?.name;
          if (defaultType) setForm((current) => current.meetingType === meetingTypes[0] ? { ...current, meetingType: defaultType } : current);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filteredMeetings = useMemo(() => {
    const number = normalizeText(appliedFilters.number);
    const content = normalizeText(appliedFilters.content);
    const keyword = normalizeText(appliedFilters.keyword);
    const year = appliedFilters.year;
    const quarter = appliedFilters.quarter;
    return meetings.filter((meeting) =>
      {
        const [meetingYear, meetingMonth] = String(meeting.meetingDate ?? "").slice(0, 10).split("-").map(Number);
        const meetingQuarter = meetingMonth ? Math.ceil(meetingMonth / 3) : null;
        return Boolean(year)
          && (!keyword ? (!number || normalizeText(meeting.number).includes(number)) && (!content || normalizeText(meeting.content).includes(content)) : (normalizeText(meeting.number).includes(keyword) || normalizeText(meeting.content).includes(keyword)))
          && meetingYear === Number(year)
          && (!quarter || meetingQuarter === Number(quarter))
          ;
      }
    );
  }, [appliedFilters, meetings]);
  const sortedFilteredMeetings = useMemo(() => [...filteredMeetings].sort((first, second) =>
    String(second.meetingDate).localeCompare(String(first.meetingDate)) || second.id - first.id
  ), [filteredMeetings]);
  const totalFilteredAttendees = useMemo(() => filteredMeetings.reduce(
    (total, meeting) => total + Number(meeting.attendeeCount || 0), 0
  ), [filteredMeetings]);
  const availableYears = useMemo(() => [...new Set([
    ...yearCatalog.map((item) => Number(item.name)),
    currentYear,
  ].filter((year) => Number.isInteger(year) && year > 0))].sort((first, second) => second - first), [yearCatalog]);

  const pageCount = Math.max(1, Math.ceil(filteredMeetings.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleMeetings = sortedFilteredMeetings.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const selectAttachment = (file) => {
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !allowedExtensions.has(extension)) {
      setMessage({ type: "danger", text: "Tệp đính kèm chỉ hỗ trợ PDF, Office, ảnh, TXT hoặc ZIP." });
      if (attachmentInputRef.current) attachmentInputRef.current.value = "";
      return;
    }
    if (file.size > maxAttachmentSize) {
      setMessage({ type: "danger", text: "Tệp đính kèm không được vượt quá 25 MB." });
      if (attachmentInputRef.current) attachmentInputRef.current.value = "";
      return;
    }
    setMessage(null);
    setRemoveSavedAttachment(false);
    setForm((current) => ({ ...current, attachment: file }));
    setAttachmentCreatedAt(new Date());
  };

  const removeAttachment = () => {
    setForm((current) => ({ ...current, attachment: null }));
    setAttachmentCreatedAt(null);
    if (attachmentInputRef.current) attachmentInputRef.current.value = "";
  };

  const resetMeetingForm = () => {
    setForm(emptyForm);
    setMeetingDateInput("");
    setEditingMeeting(null);
    setRemoveSavedAttachment(false);
    setAttachmentCreatedAt(null);
    if (attachmentInputRef.current) attachmentInputRef.current.value = "";
  };

  const startEditingMeeting = (meeting) => {
    const meetingDate = parseApiDate(meeting.meetingDate);
    setEditingMeeting(meeting);
    setForm({
      number: meeting.number,
      meetingDate,
      meetingType: meeting.meetingType || meetingTypeCatalog.find((item) => item.isDefault)?.name || meetingTypeCatalog[0]?.name || meetingTypes[0],
      content: meeting.content,
      attendeeCount: String(meeting.attendeeCount),
      attachment: null,
    });
    setMeetingDateInput(meetingDate ? formatDateInput(meetingDate) : "");
    setRemoveSavedAttachment(false);
    setAttachmentCreatedAt(null);
    if (attachmentInputRef.current) attachmentInputRef.current.value = "";
    setMessage(null);
    document.getElementById("office-meeting-number")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const saveMeeting = async (event) => {
    event.preventDefault();
    if (!(form.meetingDate instanceof Date) || Number.isNaN(form.meetingDate.getTime())) {
      setMessage({ type: "danger", text: "Vui lòng nhập ngày hợp lệ theo dd/MM/yyyy hoặc 8 chữ số ddMMyyyy." });
      return;
    }
    if (form.attachment) {
      const extension = form.attachment.name.split(".").pop()?.toLowerCase();
      if (!extension || !allowedExtensions.has(extension)) {
        setMessage({ type: "danger", text: "Tệp đính kèm chỉ hỗ trợ PDF, Office, ảnh, TXT hoặc ZIP." });
        return;
      }
      if (form.attachment.size > maxAttachmentSize) {
        setMessage({ type: "danger", text: "Tệp đính kèm không được vượt quá 25 MB." });
        return;
      }
    }

    setSaving(true);
    setMessage(null);
    const payload = new FormData();
    payload.append("Number", form.number);
    payload.append("MeetingDate", toApiDate(form.meetingDate));
    payload.append("MeetingType", form.meetingType);
    payload.append("Content", form.content);
    payload.append("AttendeeCount", form.attendeeCount);
    if (form.attachment) payload.append("Attachment", form.attachment);
    if (editingMeeting) payload.append("RemoveAttachment", String(removeSavedAttachment));

    try {
      const { data } = editingMeeting
        ? await api.put(`/OfficeMeetings/${editingMeeting.id}`, payload)
        : await api.post("/OfficeMeetings", payload);
      if (editingMeeting) {
        setMeetings((current) => [...current.filter((item) => item.id !== data.id), data]
          .sort((first, second) => String(second.meetingDate).localeCompare(String(first.meetingDate)) || second.id - first.id));
        setMessage({ type: "success", text: `Đã cập nhật cuộc họp số ${data.number}.` });
      } else {
        setMeetings((current) => [data, ...current]);
        setMessage({ type: "success", text: "Đã thêm cuộc họp vào danh sách." });
      }
      resetMeetingForm();
      setPage(1);
    } catch (error) {
      if (editingMeeting && error.response?.data?.updated && error.response.data.meeting) {
        const updatedMeeting = error.response.data.meeting;
        setMeetings((current) => [...current.filter((item) => item.id !== updatedMeeting.id), updatedMeeting]
          .sort((first, second) => String(second.meetingDate).localeCompare(String(first.meetingDate)) || second.id - first.id));
        resetMeetingForm();
      }
      setMessage({ type: "danger", text: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  const downloadFile = (blob, fileName) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const downloadSelectedAttachment = () => {
    if (form.attachment) downloadFile(form.attachment, form.attachment.name);
  };

  const downloadMeetingAttachment = async (meeting) => {
    setDownloadingId(meeting.id);
    setMessage(null);
    try {
      const { data } = await api.get(`/OfficeMeetings/${meeting.id}/attachment`, { responseType: "blob" });
      const fileName = meeting.attachmentName || "tep-dinh-kem";
      downloadFile(data, fileName);
    } catch (error) {
      const responseData = error.response?.data;
      const responseMessage = responseData instanceof Blob
        ? await responseData.text().then((text) => {
          try { return JSON.parse(text).message; }
          catch { return text; }
        })
        : null;
      setMessage({ type: "danger", text: responseMessage || getErrorMessage(error) });
    } finally {
      setDownloadingId(null);
    }
  };

  const deleteMeeting = async (meeting) => {
    if (!(await confirm({
      title: "Xóa cuộc họp?",
      message: `Bạn có chắc muốn xóa cuộc họp số “${meeting.number}”? Tệp đính kèm cũng sẽ bị xóa. Thao tác này không thể hoàn tác.`,
      confirmText: "Xóa cuộc họp",
    }))) return;

    setDeletingId(meeting.id);
    setMessage(null);
    try {
      await api.delete(`/OfficeMeetings/${meeting.id}`);
      setMeetings((current) => current.filter((item) => item.id !== meeting.id));
      if (editingMeeting?.id === meeting.id) resetMeetingForm();
      setMessage({ type: "success", text: `Đã xóa cuộc họp số ${meeting.number}.` });
    } catch (error) {
      if (error.response?.data?.deleted) {
        setMeetings((current) => current.filter((item) => item.id !== meeting.id));
        if (editingMeeting?.id === meeting.id) resetMeetingForm();
      }
      setMessage({ type: "danger", text: getErrorMessage(error) });
    } finally {
      setDeletingId(null);
    }
  };

  const deleteAllMeetings = async () => {
    if (!meetings.length) return;
    if (!(await confirm({
      title: "Xóa toàn bộ cuộc họp?",
      message: `Bạn sắp xóa toàn bộ ${meetings.length.toLocaleString("vi-VN")} cuộc họp đã lưu, kể cả những cuộc họp không nằm trong kết quả tìm kiếm hiện tại. Tệp đính kèm cũng sẽ bị xóa. Thao tác này không thể hoàn tác.`,
      confirmText: "Xóa toàn bộ",
    }))) return;

    setDeletingAll(true);
    setMessage(null);
    try {
      const { data } = await api.delete("/OfficeMeetings/all");
      setMeetings([]);
      resetMeetingForm();
      setPage(1);
      setMessage({ type: "success", text: data.message || `Đã xóa ${data.count} cuộc họp.` });
    } catch (error) {
      const deletedCount = Number(error.response?.data?.count || 0);
      if (deletedCount > 0) {
        setMeetings([]);
        resetMeetingForm();
        setPage(1);
      }
      setMessage({ type: "danger", text: getErrorMessage(error) });
    } finally {
      setDeletingAll(false);
    }
  };

  const exportExcel = () => {
    if (!sortedFilteredMeetings.length) return;
    setExporting(true);
    try {
      const exportedAt = new Date().toLocaleString("vi-VN");
      const createMeetingSheet = (sheetMeetings, sheetTitle, sheetName) => {
        const totalAttendees = sheetMeetings.reduce((total, meeting) => total + Number(meeting.attendeeCount || 0), 0);
        const rows = [
          [sheetTitle],
          [`Xuất lúc: ${exportedAt} · ${sheetMeetings.length.toLocaleString("vi-VN")} cuộc họp · ${totalAttendees.toLocaleString("vi-VN")} người tham dự`],
          [],
          ["Số", "Ngày nhập", "Nội dung", "Số người họp"],
          ...[...sheetMeetings].sort((first, second) =>
            String(second.meetingDate).localeCompare(String(first.meetingDate)) || second.id - first.id
          ).map((meeting) => [
            meeting.number,
            formatDate(meeting.meetingDate),
            meeting.content,
            Number(meeting.attendeeCount || 0),
          ]),
          ["TỔNG CỘNG", "", "", totalAttendees],
        ];
        const totalRowIndex = rows.length - 1;
        const sheet = XLSX.utils.aoa_to_sheet(rows);
        sheet["!merges"] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
          { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
          { s: { r: totalRowIndex, c: 0 }, e: { r: totalRowIndex, c: 2 } },
        ];
        sheet["!cols"] = [{ wch: 16 }, { wch: 16 }, { wch: 60 }, { wch: 18 }];
        sheet["!autofilter"] = { ref: `A4:D${4 + sheetMeetings.length}` };
        sheet["!rows"] = [
          { hpt: 30 },
          { hpt: 22 },
          { hpt: 8 },
          { hpt: 24 },
          ...sheetMeetings.map(() => ({ hpt: 22 })),
          { hpt: 28 },
        ];
        for (const cell of ["A1", "A2"]) {
          if (sheet[cell]) sheet[cell].s = {
            font: { name: "Arial", bold: cell === "A1", sz: cell === "A1" ? 16 : 10, color: { rgb: cell === "A1" ? "FFFFFF" : "334155" } },
            fill: { fgColor: { rgb: cell === "A1" ? "1D4ED8" : "EFF6FF" } },
            alignment: { vertical: "center", horizontal: cell === "A1" ? "center" : "left" },
          };
        }
        for (let column = 0; column < 4; column += 1) {
          const cell = XLSX.utils.encode_cell({ r: 3, c: column });
          if (sheet[cell]) sheet[cell].s = {
            font: { name: "Arial", bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "2563EB" } },
            alignment: { horizontal: "center", vertical: "center", wrapText: true },
            border: { bottom: { style: "thin", color: { rgb: "1E40AF" } } },
          };
          const totalCell = XLSX.utils.encode_cell({ r: totalRowIndex, c: column });
          if (sheet[totalCell]) sheet[totalCell].s = {
            font: { name: "Arial", bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
            fill: { fgColor: { rgb: "0F766E" } },
            alignment: { vertical: "center", horizontal: column === 3 ? "right" : "left" },
            border: { top: { style: "medium", color: { rgb: "115E59" } } },
            ...(column === 3 ? { numFmt: "#,##0" } : {}),
          };
        }
        XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
      };
      const workbook = XLSX.utils.book_new();
      if (appliedFilters.year && !appliedFilters.quarter) {
        for (let quarter = 1; quarter <= 4; quarter += 1) {
          const quarterMeetings = sortedFilteredMeetings.filter((meeting) => {
            const month = Number(String(meeting.meetingDate ?? "").slice(5, 7));
            return Math.ceil(month / 3) === quarter;
          });
          createMeetingSheet(quarterMeetings, `DANH SÁCH HỌP TRỰC TUYẾN - QUÝ ${quarter}/${appliedFilters.year}`, `Quy ${quarter}`);
        }
      } else {
        const sheetName = appliedFilters.quarter ? `Quy ${appliedFilters.quarter}` : "Hop truc tuyen";
        const sheetTitle = appliedFilters.quarter
          ? `DANH SÁCH HỌP TRỰC TUYẾN - QUÝ ${appliedFilters.quarter}${appliedFilters.year ? `/${appliedFilters.year}` : ""}`
          : "DANH SÁCH HỌP TRỰC TUYẾN";
        createMeetingSheet(sortedFilteredMeetings, sheetTitle, sheetName);
      }
      const fileDate = appliedFilters.year || new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `Danh_sach_hop_truc_tuyen_${fileDate}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="container-fluid py-2">
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="badge rounded-pill text-bg-primary">VĂN PHÒNG</span>
            <span className="text-muted small">Quản lý và tra cứu cuộc họp</span>
          </div>
        </div>
      </div>

      {message && <div className={`alert alert-${message.type} alert-dismissible`} role="alert">
        {message.text}
        <button type="button" className="btn-close" aria-label="Đóng thông báo" onClick={() => setMessage(null)} />
      </div>}

      <div className="card border-0 shadow-sm mb-4 overflow-hidden">
        <div className="card-header bg-white border-0 px-4 pt-4">
          <div className="d-flex align-items-center gap-3">
            <span className="d-inline-flex align-items-center justify-content-center rounded-3 text-primary bg-primary-subtle"
              style={{ width: 44, height: 44, fontSize: 22 }} aria-hidden="true">📝</span>
            <div>
              <h3 className="h5 fw-bold mb-1">{editingMeeting ? `Sửa cuộc họp số ${editingMeeting.number}` : "Nhập thông tin cuộc họp"}</h3>
              <p className="small text-muted mb-0">{editingMeeting ? "Cập nhật thông tin rồi chọn Lưu thay đổi." : "Điền thông tin bên dưới. Các trường có dấu * là bắt buộc."}</p>
            </div>
          </div>
        </div>
        <div className="card-body px-4 pb-4 pt-3">
          <form onSubmit={saveMeeting}>
            <fieldset disabled={saving || loading}>
              <div className="row g-3">
                <div className="col-lg-4 col-md-6">
                  <label htmlFor="office-meeting-number" className="form-label fw-semibold">Số <span className="text-danger">*</span></label>
                  <input id="office-meeting-number" className="form-control" required maxLength={50} value={form.number}
                    placeholder="Ví dụ: 01/2026" onChange={(event) => setForm({ ...form, number: event.target.value })} />
                </div>
                <div className="col-lg-4 col-md-6">
                  <label htmlFor="office-meeting-type" className="form-label fw-semibold">Cuộc Họp <span className="text-danger">*</span></label>
                  <select id="office-meeting-type" className="form-select" required value={form.meetingType}
                    onChange={(event) => setForm((current) => ({ ...current, meetingType: event.target.value }))}>
                    {(meetingTypeCatalog.length ? meetingTypeCatalog.map((item) => item.name) : meetingTypes).map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
                <div className="col-lg-4 col-md-6">
                  <label htmlFor="office-meeting-date" className="form-label fw-semibold">Ngày họp <span className="text-danger">*</span></label>
                  <div>
                    <input id="office-meeting-date" className="form-control" required inputMode="numeric"
                      placeholder="dd/MM/yyyy hoặc 01012026" value={meetingDateInput}
                      onChange={(event) => {
                        const value = event.target.value;
                        const parsed = parseDateInput(value);
                        setMeetingDateInput(parsed && /^\d{8}$/.test(value) ? formatDateInput(parsed) : value);
                        setForm((current) => ({ ...current, meetingDate: parsed }));
                      }}
                      onBlur={() => {
                        const parsed = parseDateInput(meetingDateInput);
                        if (parsed) {
                          setMeetingDateInput(formatDateInput(parsed));
                          setForm((current) => ({ ...current, meetingDate: parsed }));
                        }
                      }} autoComplete="off" />
                  </div>
                </div>
                <div className="col-lg-4 col-md-6">
                  <label htmlFor="office-meeting-attendee-count" className="form-label fw-semibold">Số người họp <span className="text-danger">*</span></label>
                  <input id="office-meeting-attendee-count" className="form-control" required type="number" min="1" max="100000" step="1"
                    placeholder="Nhập số người tham dự" value={form.attendeeCount}
                    onChange={(event) => setForm({ ...form, attendeeCount: event.target.value })} />
                </div>
                <div className="col-12">
                  <label htmlFor="office-meeting-content" className="form-label fw-semibold">Nội dung <span className="text-danger">*</span></label>
                  <textarea id="office-meeting-content" className="form-control" required maxLength={2000} rows={3}
                    placeholder="Nhập nội dung hoặc chủ đề cuộc họp"
                    value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} />
                  <div className="form-text text-end">{form.content.length}/2000 ký tự</div>
                </div>
              </div>
              <div className="mt-3 p-3 p-md-4 bg-light border rounded-3">
                <label htmlFor="office-meeting-attachment" className="form-label fw-semibold mb-2">Đính kèm file</label>
                <div className="d-flex align-items-center flex-wrap gap-2">
                  <input ref={attachmentInputRef} id="office-meeting-attachment" type="file" hidden
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.txt,.zip"
                    onChange={(event) => selectAttachment(event.target.files?.[0])} />
                  <button type="button" className="btn btn-outline-primary" disabled={saving || loading}
                    onClick={() => attachmentInputRef.current?.click()}>
                    <span aria-hidden="true" className="me-2">📎</span>{form.attachment ? "Chọn tệp khác" : "Chọn tệp"}
                  </button>
                  <span className="form-text m-0">Tối đa 25 MB; PDF, Office, ảnh, TXT, ZIP.</span>
                </div>
                {editingMeeting?.attachmentName && <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap border rounded bg-white p-3 mt-3">
                  <div className="d-flex align-items-center gap-2 text-break">
                    <FileTypeIcon fileName={editingMeeting.attachmentName} />
                    <span className={removeSavedAttachment ? "text-decoration-line-through text-muted" : "fw-medium"}>
                      {editingMeeting.attachmentName}
                    </span>
                    {form.attachment && <span className="badge text-bg-info">Sẽ thay bằng tệp mới</span>}
                  </div>
                  <button type="button" className={`btn btn-sm ${removeSavedAttachment ? "btn-outline-secondary" : "btn-outline-danger"}`}
                    disabled={saving || Boolean(form.attachment)}
                    onClick={() => setRemoveSavedAttachment((current) => !current)}>
                    {removeSavedAttachment ? "Hoàn tác gỡ tệp" : "Gỡ tệp hiện tại"}
                  </button>
                </div>}
                {form.attachment && attachmentCreatedAt && (() => {
                  const createdAt = formatCreatedAt(attachmentCreatedAt);
                  return <div className="table-responsive border rounded mt-3">
                    <table className="table table-hover align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th scope="col" className="text-center" style={{ width: 64 }}>STT</th>
                          <th scope="col">Tên tập tin</th>
                          <th scope="col" className="text-center" style={{ width: 90 }}>Tập tin</th>
                          <th scope="col" className="text-end" style={{ width: 130 }}>Kích thước</th>
                          <th scope="col" style={{ minWidth: 150 }}>Người tạo</th>
                          <th scope="col" style={{ minWidth: 160 }}>Ngày tạo</th>
                          <th scope="col" aria-label="Thao tác" style={{ width: 64 }} />
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="text-center text-muted">1</td>
                          <td className="fw-medium" style={{ minWidth: 260, overflowWrap: "anywhere" }}>{form.attachment.name}</td>
                          <td className="text-center">
                            <button type="button" className="btn btn-link p-1" onClick={downloadSelectedAttachment}
                              aria-label={`Tải xuống ${form.attachment.name}`} title={`Tải xuống ${form.attachment.name}`}>
                              <FileTypeIcon fileName={form.attachment.name} />
                            </button>
                          </td>
                          <td className="text-end text-nowrap">{formatFileSize(form.attachment.size)}</td>
                          <td className="text-nowrap">{profile?.fullName || "Người dùng"}</td>
                          <td className="text-nowrap">
                            <div>{createdAt.time}</div>
                            <div>{createdAt.date}</div>
                          </td>
                          <td>
                            <button type="button" className="btn btn-danger btn-sm d-inline-flex align-items-center justify-content-center"
                              style={{ width: 38, height: 38 }} aria-label="Gỡ tệp đính kèm" title="Gỡ tệp"
                              disabled={saving} onClick={removeAttachment}>
                              <span aria-hidden="true">×</span>
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>;
                })()}
              </div>
              <div className="d-flex justify-content-end mt-4 pt-3 border-top">
                <div className="d-flex gap-2">
                  {editingMeeting && <button className="btn btn-outline-secondary px-4 py-2" type="button" disabled={saving} onClick={resetMeetingForm}>Hủy sửa</button>}
                  <button className="btn btn-primary px-4 py-2" type="submit" disabled={saving}>
                    {saving ? <><span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />Đang lưu...</> : editingMeeting ? "Lưu thay đổi" : "Lưu cuộc họp"}
                  </button>
                </div>
              </div>
            </fieldset>
          </form>
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
            <div className="px-4 pt-4 pb-3 mb-0"><label htmlFor="meeting-filter-keyword" className="form-label fw-semibold mb-2">Tìm kiếm cuộc họp</label><div className="input-group input-group-lg"><input id="meeting-filter-keyword" className="form-control" placeholder="Tìm theo số hoặc nội dung" value={filters.keyword} onChange={(event) => { const value = event.target.value; setFilters((current) => ({ ...current, keyword: value })); setAppliedFilters((current) => ({ ...current, keyword: value })); setPage(1); }} /></div></div><div className="row g-3 d-none">
              <div className="col-lg-3 col-md-6">
                <label htmlFor="meeting-filter-number" className="form-label fw-semibold small">Số</label>
                <input id="meeting-filter-number" className="form-control" placeholder="Tìm theo số"
                  value={filters.number} onChange={(event) => { setFilters((current) => ({ ...current, number: event.target.value })); setPage(1); }} />
              </div>
              <div className="col-lg-3 col-md-6">
                <label htmlFor="meeting-filter-year" className="form-label fw-semibold small">Năm</label>
                <select id="meeting-filter-year" className="form-select" required value={filters.year}
                  onChange={(event) => { setFilters((current) => ({ ...current, year: event.target.value })); setPage(1); }}>
                  {availableYears.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
              </div>
              <div className="col-lg-3 col-md-6">
                <label htmlFor="meeting-filter-quarter" className="form-label fw-semibold small">Quý</label>
                <select id="meeting-filter-quarter" className="form-select" value={filters.quarter}
                  onChange={(event) => { setFilters((current) => ({ ...current, quarter: event.target.value })); setPage(1); }}>
                  <option value="">Tất cả các quý</option>
                  {[1, 2, 3, 4].map((quarter) => <option key={quarter} value={quarter}>Quý {quarter}</option>)}
                </select>
              </div>
              <div className="col-lg-3 col-md-6">
                <label htmlFor="meeting-filter-content" className="form-label fw-semibold small">Nội dung</label>
                <input id="meeting-filter-content" className="form-control" placeholder="Tìm trong nội dung"
                  value={filters.content} onChange={(event) => { setFilters((current) => ({ ...current, content: event.target.value })); setPage(1); }} />
              </div>
            </div>
            <div className="d-none">
              <button type="button" className="btn btn-primary d-inline-flex align-items-center gap-2 px-4"
                disabled={loading} onClick={() => { setAppliedFilters({ ...filters }); setPage(1); }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" />
                </svg>
                Tìm kiếm
              </button>
              <button type="button" className="btn btn-success d-inline-flex align-items-center gap-2 px-4 shadow-sm"
                onClick={exportExcel} disabled={!filteredMeetings.length || exporting}>
                {exporting
                  ? <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                  : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M12 3v12m-5-5 5 5 5-5M4 17v3h16v-3" />
                  </svg>}
                {exporting ? "Đang tạo Excel..." : "Xuất Excel"}
              </button>
            </div>
          </div>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 p-4 pb-3">
            <div>
              <h3 className="h5 fw-bold mb-1">Danh sách cuộc họp</h3>
              <div className="small text-muted" aria-live="polite">
                {appliedFilters.number || appliedFilters.year || appliedFilters.quarter || appliedFilters.content
                  ? `${filteredMeetings.length.toLocaleString("vi-VN")} / ${meetings.length.toLocaleString("vi-VN")} cuộc họp theo điều kiện`
                  : `${meetings.length.toLocaleString("vi-VN")} cuộc họp`}
              </div>
            </div>
            <div className="d-flex align-items-stretch flex-wrap gap-2">
              <div className="d-flex align-items-center gap-3 rounded-3 border bg-primary-subtle px-3 py-2"
                aria-live="polite" aria-label={`Tổng số người họp: ${totalFilteredAttendees.toLocaleString("vi-VN")}`}>
                <span className="d-inline-flex align-items-center justify-content-center rounded-circle bg-primary text-white"
                  style={{ width: 38, height: 38 }} aria-hidden="true">👥</span>
                <div>
                  <div className="small text-primary-emphasis fw-semibold">Tổng số người họp</div>
                  <div className="fs-5 fw-bold text-primary lh-1 mt-1">{totalFilteredAttendees.toLocaleString("vi-VN")}</div>
                </div>
              </div>
              <button type="button" className="btn btn-outline-danger btn-sm d-inline-flex align-items-center gap-2"
                disabled={!meetings.length || deletingAll || deletingId !== null || saving}
                onClick={deleteAllMeetings}>
                {deletingAll
                  ? <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                  : <span aria-hidden="true">🗑</span>}
                {deletingAll ? "Đang xóa..." : "Xóa hết"}
              </button>
            </div>
          </div>

          {loading ? <div className="text-center text-muted py-5" role="status">
            <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />Đang tải danh sách...
          </div> : <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light"><tr><th rowSpan="2" className="text-center" style={{ width: 70 }}>STT</th><th rowSpan="2" className="text-center" style={{ minWidth: 460 }}>Thông tin chung</th><th rowSpan="2">Nội dung</th></tr></thead><tbody>{visibleMeetings.map((meeting, index) => (<tr key={meeting.id}><td className="text-center fw-semibold">{(currentPage - 1) * pageSize + index + 1}</td><td><div className="row g-2"><div className="col-md-6"><strong>Số:</strong> {meeting.number}<br/><strong>Ngày họp:</strong> {formatDate(meeting.meetingDate)}</div><div className="col-md-6"><strong>Số người họp:</strong> {Number(meeting.attendeeCount).toLocaleString("vi-VN")}<br/>{meeting.attachmentName && <button type="button" className="btn btn-link p-1" title={meeting.attachmentName} onClick={() => downloadMeetingAttachment(meeting)}>{downloadingId === meeting.id ? <span className="spinner-border spinner-border-sm" /> : <FileTypeIcon fileName={meeting.attachmentName} />}</button>}<div className="mt-1"><button type="button" className="btn btn-outline-primary btn-sm me-1" onClick={() => startEditingMeeting(meeting)}>Sửa</button><button type="button" className="btn btn-outline-danger btn-sm" onClick={() => deleteMeeting(meeting)}>Xóa</button></div></div></div></td><td style={{ minWidth: 280, whiteSpace: "pre-wrap" }}>{meeting.content}</td></tr>))}{!visibleMeetings.length && <tr><td colSpan="3" className="text-center py-5">Chưa có cuộc họp phù hợp</td></tr>}</tbody>
            </table>
          </div>}

          {!loading && filteredMeetings.length > 0 && <div className="border-top px-4 py-3">
            <TablePagination total={filteredMeetings.length} page={currentPage} pageSize={pageSize}
              onPageChange={setPage} onPageSizeChange={(value) => { setPageSize(value); setPage(1); }} />
          </div>}
        </div>
    </section>
  );
}
