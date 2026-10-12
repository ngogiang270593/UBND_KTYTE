import { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import viLocale from "@fullcalendar/core/locales/vi";
import api from "./api";

const meetingPalette = [
  ["#0d6efd", "#e7f1ff"], ["#198754", "#e8f7ef"], ["#dc3545", "#ffebee"],
  ["#fd7e14", "#fff1e5"], ["#6f42c1", "#f1eafd"], ["#0891b2", "#e5f8fb"],
  ["#d63384", "#fdeaf4"], ["#495057", "#eef0f2"], ["#8a5a00", "#fff4d6"], ["#087f5b", "#e6fcf5"],
];

const meetingTypeStyle = (value) => {
  const text = String(value || "Khác");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  const [accent, soft] = meetingPalette[hash % meetingPalette.length];
  return { accent, soft };
};

const dayKey = (value) => String(value || "").slice(0, 10);
const calendarDayKey = (value) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const formatDate = (value) => {
  const [year, month, day] = dayKey(value).split("-");
  return year && month && day ? `${day}/${month}/${year}` : "";
};

const parseMeetingTimeRange = (value) => {
  const matches = [...String(value || "").matchAll(/(\d{1,2})\s*(?::|h|giờ)\s*(\d{1,2})?/gi)];
  if (matches.length < 2) return null;
  const toTime = (match) => {
    const hour = Number(match[1]);
    const minute = Number(match[2] || 0);
    return hour <= 23 && minute <= 59
      ? `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`
      : null;
  };
  const start = toTime(matches[0]);
  const end = toTime(matches[1]);
  return start && end ? { start, end } : null;
};

export default function OfficeMeetingCalendarPage() {
  const [meetings, setMeetings] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const selectedMeetings = useMemo(
    () => meetings.filter((meeting) => dayKey(meeting.meetingDate) === selectedDate),
    [meetings, selectedDate],
  );
  const counts = useMemo(() => meetings.reduce((result, meeting) => {
    const key = dayKey(meeting.meetingDate);
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {}), [meetings]);
  const calendarEvents = useMemo(() => meetings.map((meeting, index) => {
    const date = dayKey(meeting.meetingDate);
    const range = parseMeetingTimeRange(meeting.meetingTimeRange);
    let start = date;
    let end;
    let allDay = true;
    if (range) {
      start = `${date}T${range.start}`;
      end = `${date}T${range.end}`;
      if (range.end <= range.start) {
        const nextDay = new Date(`${date}T12:00:00`);
        nextDay.setDate(nextDay.getDate() + 1);
        end = `${calendarDayKey(nextDay)}T${range.end}`;
      }
      allDay = false;
    }
    const { accent, soft } = meetingTypeStyle(meeting.meetingType);
    return {
      id: String(meeting.id ?? index),
      title: meeting.number ? `Cuộc họp ${meeting.number}` : meeting.content || "Cuộc họp",
      start,
      ...(end ? { end } : {}),
      allDay,
      backgroundColor: soft,
      borderColor: accent,
      textColor: accent,
      extendedProps: {
        content: meeting.content || "",
        meetingRoom: meeting.meetingRoom || "",
      },
    };
  }), [meetings]);

  useEffect(() => {
    api.get("/OfficeMeetings").then(({ data }) => setMeetings(Array.isArray(data) ? data : []));
  }, []);

  useEffect(() => {
    if (!selectedDate) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setSelectedDate("");
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedDate]);

  return <section className="container-fluid py-2">
    <h2 className="h3 fw-bold mb-1">Lịch Họp</h2>
    <p className="text-muted mb-3">Theo dõi số lượng và khung giờ cuộc họp theo ngày.</p>
    <style>{`
      .fc-dayGridMonth-view .fc-daygrid-day-frame{min-height:110px!important;display:flex;flex-direction:column}
      .fc-dayGridMonth-view .fc-daygrid-day-top{display:flex!important;flex:1 1 auto;align-items:center;justify-content:center!important;width:100%;height:100%;text-align:center!important}
      .fc-dayGridMonth-view .fc-daygrid-day-top .fc-daygrid-day-number{float:none!important;margin:0 auto!important;text-align:center!important}
      .fc-dayGridMonth-view .fc-event{display:none!important}
      .calendar-day-content{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;width:100%;text-align:center}
      .calendar-day-content strong{display:block!important;text-align:center!important;width:100%!important;margin:0 auto!important}
      .meeting-modal .modal-header{background:linear-gradient(135deg,#0d6efd,#4f8dfd);color:#fff}
      .meeting-modal .modal-header .btn-close{filter:invert(1)}
      .meeting-modal .modal-body{background:#f8fafc}
      .meeting-modal .table{background:#fff;border-radius:12px;overflow:hidden}
      .meeting-modal .table thead th{font-size:.78rem;text-transform:uppercase;letter-spacing:.03em;color:#53657d}
      .meeting-modal .meeting-info{font-size:.9rem;padding:8px 10px}
      .meeting-modal .meeting-info .row{row-gap:.3rem}
      @media (min-width:576px){.meeting-modal .meeting-info .col-sm-6:nth-child(5){margin-left:50%}}
      .meeting-modal .meeting-info .col-sm-6{min-width:0}
      .meeting-modal .meeting-info{line-height:1.15}
      .meeting-modal .meeting-info strong{white-space:nowrap}
      .meeting-modal .meeting-info .col-sm-6:nth-child(4){white-space:nowrap}
      .meeting-modal .meeting-info{background:#f5f8ff;border:1px solid #e2eafa;border-radius:10px;padding:10px 12px}
      .meeting-modal tbody tr{transition:transform .18s ease,box-shadow .18s ease}
      .meeting-modal tbody tr:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(15,23,42,.08)}
      .meeting-modal .meeting-type{display:inline-block;margin-top:6px;padding:3px 9px;border-radius:999px;font-size:.78rem;font-weight:600}
      .meeting-count{display:block;margin:4px auto 0;border:0;border-radius:999px;padding:2px 7px;background:#fff1f2;color:#dc3545;font-size:.72rem;font-weight:700;cursor:pointer;transition:all .18s ease;animation:meetingPulse 1.6s ease-in-out infinite}
      .meeting-count:hover{background:#dc3545;color:#fff;transform:scale(1.04)}
      @keyframes meetingPulse{0%,100%{box-shadow:0 0 0 0 rgba(220,53,69,.18)}50%{box-shadow:0 0 0 4px rgba(220,53,69,.08)}}
    `}</style>
    <FullCalendar
      plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
      locale={viLocale}
      initialView="dayGridMonth"
      height="auto"
      events={calendarEvents}
      eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
      eventClick={(info) => setSelectedDate(dayKey(info.event.startStr))}
      dateClick={(info) => setSelectedDate(calendarDayKey(info.date))}
      headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" }}
      buttonText={{ today: "Hôm nay", month: "Tháng", week: "Tuần", day: "Ngày" }}
      dayCellContent={(info) => {
        const key = calendarDayKey(info.date);
        const count = info.view.type === "dayGridMonth" ? counts[key] || 0 : 0;
        return <div className="calendar-day-content">
          <strong>{info.dayNumberText}</strong>
          {count > 0 && <button
            type="button"
            className="meeting-count"
            onClick={(event) => {
              event.stopPropagation();
              setSelectedDate(key);
            }}
          >{String(count).padStart(2, "0")} cuộc họp</button>}
        </div>;
      }}
      eventContent={(info) => <div className="overflow-hidden">
        <div className="fw-semibold text-truncate">{info.timeText && `${info.timeText} · `}{info.event.title}</div>
        {info.event.extendedProps.content && <div className="text-truncate">{info.event.extendedProps.content}</div>}
        {info.event.extendedProps.meetingRoom && <div className="text-truncate">Phòng: {info.event.extendedProps.meetingRoom}</div>}
      </div>}
    />
    {selectedDate && <div
      className="modal d-block"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => event.target === event.currentTarget && setSelectedDate("")}
    >
      <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content meeting-modal">
          <div className="modal-header">
            <h3 className="modal-title h5">Danh sách cuộc họp ngày {formatDate(selectedDate)}</h3>
            <span className="badge bg-light text-primary ms-2">{selectedMeetings.length} cuộc họp</span>
            <button type="button" className="btn-close" aria-label="Đóng" onClick={() => setSelectedDate("")} />
          </div>
          <div className="modal-body">
            {selectedMeetings.length
              ? <div className="table-responsive border rounded">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light"><tr>
                    <th className="text-center" style={{ width: 70 }}>STT</th>
                    <th style={{ minWidth: 360 }}>Thông tin chung</th>
                    <th>Nội dung</th>
                  </tr></thead>
                  <tbody>{selectedMeetings.map((meeting, index) => {
                    const { accent, soft } = meetingTypeStyle(meeting.meetingType);
                    return <tr key={meeting.id || index} style={{ borderLeft: `4px solid ${accent}` }}>
                      <td className="text-center fw-semibold">{index + 1}</td>
                      <td><div className="meeting-info">
                        <div className="row g-2">
                          <div className="col-sm-6"><strong>Số:</strong> {meeting.number || index + 1}</div>
                          <div className="col-sm-6"><strong>Ngày họp:</strong> {formatDate(meeting.meetingDate)}</div>
                          {meeting.meetingTimeRange && <div className="col-sm-6"><strong>Giờ họp:</strong> {meeting.meetingTimeRange}</div>}
                          {meeting.meetingRoom && <div className="col-sm-6"><strong>Phòng họp:</strong> {meeting.meetingRoom}</div>}
                          <div className="col-sm-6"><strong>Số người họp:</strong> {Number(meeting.attendeeCount || 0).toLocaleString("vi-VN")}</div>
                        </div>
                        {meeting.meetingType && <span className="meeting-type" style={{ backgroundColor: soft, color: accent, border: `1px solid ${accent}44` }}>
                          {meeting.meetingType}
                        </span>}
                      </div></td>
                      <td style={{ minWidth: 280, whiteSpace: "pre-wrap" }}>{meeting.content || ""}</td>
                    </tr>;
                  })}</tbody>
                </table>
              </div>
              : <div>Không có lịch họp trong ngày này</div>}
          </div>
          <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setSelectedDate("")}>Đóng</button></div>
        </div>
      </div>
    </div>}
  </section>;
}
