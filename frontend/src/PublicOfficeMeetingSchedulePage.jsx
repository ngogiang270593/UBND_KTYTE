import { useEffect, useMemo, useState } from "react";
import api from "./api";

const getTodayKey = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
};

const formatDate = (value) => {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
};

const parseTimeRange = (value) => {
  const matches = [...String(value || "").matchAll(/(\d{1,2})\s*(?::|h|giờ)\s*(\d{1,2})?/gi)];
  if (matches.length < 2) return null;
  const toMinutes = (match) => {
    const hour = Number(match[1]);
    const minute = Number(match[2] || 0);
    return hour <= 23 && minute <= 59 ? hour * 60 + minute : null;
  };
  const start = toMinutes(matches[0]);
  const end = toMinutes(matches[1]);
  return start === null || end === null ? null : { start, end };
};

const getErrorMessage = (error) => error.response?.data?.message
  || "Không tải được lịch họp công khai. Vui lòng thử lại sau.";

export default function PublicOfficeMeetingSchedulePage() {
  const [dateKey, setDateKey] = useState(getTodayKey);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const sortedMeetings = useMemo(() => [...meetings].sort((first, second) => {
    const firstStart = parseTimeRange(first.meetingTimeRange)?.start ?? -1;
    const secondStart = parseTimeRange(second.meetingTimeRange)?.start ?? -1;
    return firstStart - secondStart;
  }), [meetings]);

  useEffect(() => {
    let active = true;
    let inFlight = false;

    const refresh = async () => {
      if (inFlight) return;
      inFlight = true;
      const today = getTodayKey();
      setDateKey(today);
      try {
        const { data } = await api.get(`/PublicOfficeMeetings?date=${today}`);
        if (active) {
          setMeetings(Array.isArray(data) ? data : []);
          setError("");
          setUpdatedAt(new Date());
        }
      } catch (requestError) {
        if (active) setError(getErrorMessage(requestError));
      } finally {
        inFlight = false;
        if (active) setLoading(false);
      }
    };

    void refresh();
    const interval = window.setInterval(() => { void refresh(); }, 15000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  return <main className="public-meeting-page">
    <style>{`
      *{box-sizing:border-box}
      .public-meeting-page{min-height:100vh;padding:clamp(18px,4vw,48px);background:radial-gradient(circle at top right,#1e40af 0,#111827 42%,#080d18 100%);color:#f8fafc;font-family:Arial,sans-serif}
      .public-meeting-shell{max-width:1100px;margin:0 auto}
      .public-meeting-header{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:24px}
      .public-meeting-kicker{margin:0 0 8px;color:#93c5fd;font-size:.85rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase}
      .public-meeting-title{margin:0;font-size:clamp(2rem,5vw,3.5rem);font-weight:800;letter-spacing:-.04em}
      .public-meeting-date{margin:8px 0 0;color:#cbd5e1;font-size:clamp(1rem,2vw,1.25rem)}
      .public-meeting-live{display:flex;align-items:center;gap:9px;color:#bbf7d0;font-size:.9rem;white-space:nowrap}
      .public-meeting-live i{width:10px;height:10px;border-radius:50%;background:#4ade80;box-shadow:0 0 16px #4ade80}
      .public-meeting-board{position:relative;height:min(70vh,720px);min-height:380px;overflow:hidden;border:1px solid #334155;border-radius:24px;background:rgba(15,23,42,.88);box-shadow:0 24px 80px rgba(0,0,0,.35)}
      .public-meeting-board:before,.public-meeting-board:after{position:absolute;z-index:1;right:0;left:0;height:64px;content:"";pointer-events:none}
      .public-meeting-board:before{top:0;background:linear-gradient(#0f172a,transparent)}
      .public-meeting-board:after{bottom:0;background:linear-gradient(transparent,#0f172a)}
      .public-meeting-track{height:100%;padding:34px 24px;animation:public-meeting-scroll 48s linear infinite}
      .public-meeting-board:hover .public-meeting-track,.public-meeting-board:focus-within .public-meeting-track{animation-play-state:paused}
      .public-meeting-group{display:flex;min-height:100%;flex-direction:column;justify-content:center;gap:16px;padding:10px 0}
      .public-meeting-card{display:grid;grid-template-columns:minmax(130px,190px) 1fr;gap:20px;align-items:center;padding:22px 24px;border:1px solid #334155;border-left:5px solid #38bdf8;border-radius:18px;background:linear-gradient(110deg,rgba(30,41,59,.98),rgba(15,23,42,.9));}
      .public-meeting-time{color:#7dd3fc;font-size:clamp(1.1rem,2vw,1.45rem);font-weight:800}
      .public-meeting-content{margin:0;color:#f8fafc;font-size:clamp(1.1rem,2vw,1.5rem);font-weight:700;line-height:1.4;white-space:pre-wrap}
      .public-meeting-meta{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:12px;color:#cbd5e1;font-size:1rem}
      .public-meeting-type{display:inline-flex;align-items:center;width:max-content;margin-top:12px;padding:5px 11px;border:1px solid #475569;border-radius:999px;color:#bfdbfe;font-size:.85rem}
      .public-meeting-empty,.public-meeting-error{display:grid;height:100%;place-items:center;padding:30px;text-align:center;color:#cbd5e1;font-size:1.2rem}
      .public-meeting-error{color:#fecaca}
      .public-meeting-footer{display:flex;justify-content:space-between;gap:16px;margin-top:16px;color:#94a3b8;font-size:.85rem}
      @keyframes public-meeting-scroll{from{transform:translateY(0)}to{transform:translateY(-50%)}}
      @media(prefers-reduced-motion:reduce){.public-meeting-track{animation:none}}
      @media(max-width:640px){.public-meeting-header{align-items:flex-start;flex-direction:column}.public-meeting-live{white-space:normal}.public-meeting-board{height:68vh;min-height:360px}.public-meeting-track{padding:28px 14px}.public-meeting-card{grid-template-columns:1fr;gap:8px;padding:18px}.public-meeting-footer{flex-direction:column}}
    `}</style>
    <div className="public-meeting-shell">
      <header className="public-meeting-header">
        <div>
          <p className="public-meeting-kicker">UBND Xã Tân Hòa · Thông tin công khai</p>
          <h1 className="public-meeting-title">Lịch họp hôm nay</h1>
          <p className="public-meeting-date">{formatDate(dateKey)}</p>
        </div>
        <div className="public-meeting-live"><i aria-hidden="true" /> Tự cập nhật mỗi 15 giây</div>
      </header>
      <section className="public-meeting-board" aria-label="Lịch họp công khai trong ngày">
        {error
          ? <div className="public-meeting-error" role="alert">{error}</div>
          : loading
            ? <div className="public-meeting-empty" role="status">Đang tải lịch họp...</div>
            : !sortedMeetings.length
              ? <div className="public-meeting-empty">Hôm nay chưa có cuộc họp công khai.</div>
              : <div className="public-meeting-track">
                {[0, 1].map((copy) => <div className="public-meeting-group" key={copy} aria-hidden={copy === 1}>
                  {sortedMeetings.map((meeting, index) => {
                    const timeRange = meeting.meetingTimeRange?.trim();
                    const room = meeting.meetingRoom?.trim();
                    return <article className="public-meeting-card" key={`${copy}-${index}`}>
                      <div className="public-meeting-time">{timeRange || "Cả ngày"}</div>
                      <div>
                        <h2 className="public-meeting-content">{meeting.content}</h2>
                        <div className="public-meeting-meta">
                          {room && <span>Phòng họp: {room}</span>}
                        </div>
                        {meeting.meetingType && <span className="public-meeting-type">{meeting.meetingType}</span>}
                      </div>
                    </article>;
                  })}
                </div>)}
              </div>}
      </section>
      <footer className="public-meeting-footer">
        <span>Chỉ hiển thị các cuộc họp được đơn vị đánh dấu công khai.</span>
        <span>{updatedAt ? `Cập nhật lúc ${updatedAt.toLocaleTimeString("vi-VN")}` : ""}</span>
      </footer>
    </div>
  </main>;
}
