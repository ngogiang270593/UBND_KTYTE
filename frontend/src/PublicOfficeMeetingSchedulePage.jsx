import { useCallback, useEffect, useMemo, useState } from "react";
import api from "./api";

const settingsKey = "public-office-meeting-settings";
const refreshOptions = [5, 10, 15, 30, 60];
const scrollOptions = [20, 30, 45, 60, 90];
const defaultSettings = { refreshSeconds: 15, scrollSeconds: 45 };

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

const readSettings = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(settingsKey) || "{}");
    return {
      refreshSeconds: refreshOptions.includes(Number(saved.refreshSeconds))
        ? Number(saved.refreshSeconds)
        : defaultSettings.refreshSeconds,
      scrollSeconds: scrollOptions.includes(Number(saved.scrollSeconds))
        ? Number(saved.scrollSeconds)
        : defaultSettings.scrollSeconds,
    };
  } catch {
    return defaultSettings;
  }
};

const getErrorMessage = (error) => error.response?.data?.message
  || "Không tải được lịch họp công khai. Vui lòng thử lại sau.";

export default function PublicOfficeMeetingSchedulePage() {
  const [dateKey, setDateKey] = useState(getTodayKey);
  const [meetings, setMeetings] = useState([]);
  const [settings, setSettings] = useState(readSettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const sortedMeetings = useMemo(() => [...meetings].sort((first, second) => {
    const firstStart = parseTimeRange(first.meetingTimeRange)?.start ?? -1;
    const secondStart = parseTimeRange(second.meetingTimeRange)?.start ?? -1;
    return firstStart - secondStart;
  }), [meetings]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Lịch Họp - UBND xã Tân Hòa";
    return () => { document.title = previousTitle; };
  }, []);

  const refreshSchedule = useCallback(async (signal) => {
    const today = getTodayKey();
    setDateKey((current) => current === today ? current : today);
    const { data } = await api.get(`/PublicOfficeMeetings?date=${today}`, { signal });
    const nextMeetings = Array.isArray(data) ? data : [];
    setMeetings((current) => JSON.stringify(current) === JSON.stringify(nextMeetings) ? current : nextMeetings);
    setError("");
    setUpdatedAt((current) => {
      const next = new Date();
      return current && current.toLocaleTimeString("vi-VN") === next.toLocaleTimeString("vi-VN") ? current : next;
    });
  }, []);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    let controller;

    const refresh = async () => {
      if (!active || inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      controller = new AbortController();
      try {
        await refreshSchedule(controller.signal);
      } catch (requestError) {
        if (active && requestError.code !== "ERR_CANCELED") setError(getErrorMessage(requestError));
      } finally {
        inFlight = false;
        if (active) setLoading(false);
      }
    };

    void refresh();
    const interval = window.setInterval(() => { void refresh(); }, settings.refreshSeconds * 1000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [refreshSchedule, settings.refreshSeconds]);

  const updateSettings = (key, value) => {
    const next = { ...settings, [key]: Number(value) };
    setSettings(next);
    try {
      localStorage.setItem(settingsKey, JSON.stringify(next));
      setSettingsError("");
    } catch (storageError) {
      setSettingsError(`Không lưu được cấu hình trên thiết bị này: ${storageError.message}`);
    }
  };

  return <main className="public-meeting-page">
    <style>{`
      *{box-sizing:border-box}
      .public-meeting-page{position:relative;isolation:isolate;width:100%;height:100vh;height:100dvh;min-height:100dvh;overflow:hidden;padding:clamp(12px,3vw,38px);background:radial-gradient(ellipse at 50% 20%,#ffe680 0,#e8b93c 42%,#b67b16 100%);color:#452b08;font-family:Arial,sans-serif}
      .public-meeting-map{position:absolute;z-index:-1;top:50%;left:50%;width:min(78vw,820px);height:115vh;transform:translate(-50%,-50%);opacity:.22;pointer-events:none}
      .public-meeting-map path{fill:#fff2b2;stroke:#93630d;stroke-width:2}
      .public-meeting-shell{display:flex;width:min(1280px,100%);height:100%;flex-direction:column;margin:0 auto}
      .public-meeting-header{position:relative;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:4px 0 20px}
      .public-meeting-title{margin:0;color:#422809;font-size:clamp(1.8rem,4.4vw,3.3rem);font-weight:900;letter-spacing:-.035em;text-shadow:0 1px rgba(255,255,255,.35)}
      .public-meeting-date{margin:7px 0 0;color:#684710;font-size:clamp(.95rem,1.7vw,1.15rem);font-weight:600}
      .public-meeting-header-actions{display:flex;align-items:center;gap:14px}
      .public-meeting-live{display:flex;align-items:center;gap:9px;color:#31531c;font-size:.9rem;font-weight:700;white-space:nowrap}
      .public-meeting-live i{width:10px;height:10px;border-radius:50%;background:#3b8b23;box-shadow:0 0 12px #5fb52d}
      .public-meeting-settings{position:relative;z-index:3}
      .public-meeting-settings summary{padding:9px 13px;border:1px solid rgba(82,54,10,.35);border-radius:10px;background:rgba(255,248,218,.78);color:#53370d;font-size:.9rem;font-weight:700;cursor:pointer;list-style:none;white-space:nowrap}
      .public-meeting-settings summary::-webkit-details-marker{display:none}
      .public-meeting-settings[open] summary{border-radius:10px 10px 0 0}
      .public-meeting-settings-panel{position:absolute;top:100%;right:0;width:min(330px,88vw);padding:16px;border:1px solid rgba(82,54,10,.35);border-radius:10px 0 10px 10px;background:#fff8de;box-shadow:0 12px 30px rgba(60,39,7,.22)}
      .public-meeting-settings-panel label{display:block;margin-bottom:5px;color:#53370d;font-size:.84rem;font-weight:700}
      .public-meeting-settings-panel select{width:100%;margin-bottom:14px;padding:9px;border:1px solid #cfb36a;border-radius:8px;background:white;color:#38280b}
      .public-meeting-settings-panel select:last-of-type{margin-bottom:5px}
      .public-meeting-settings-note{margin:5px 0 0;color:#75613a;font-size:.8rem;line-height:1.4}
      .public-meeting-settings-error{margin:8px 0 0;color:#b42318;font-size:.8rem}
      .public-meeting-board{position:relative;flex:1;min-height:0;overflow:hidden;border:2px solid rgba(120,78,11,.42);border-radius:22px;background:rgba(255,248,216,.79);box-shadow:0 20px 55px rgba(76,48,6,.25)}
      .public-meeting-board:before,.public-meeting-board:after{position:absolute;z-index:1;right:0;left:0;height:45px;content:"";pointer-events:none}
      .public-meeting-board:before{top:0;background:linear-gradient(rgba(255,248,216,.96),transparent)}
      .public-meeting-board:after{bottom:0;background:linear-gradient(transparent,rgba(255,248,216,.96))}
      .public-meeting-track{height:100%;padding:28px 22px;animation:public-meeting-scroll var(--scroll-duration,45s) linear infinite;will-change:transform}
      .public-meeting-board:hover .public-meeting-track,.public-meeting-board:focus-within .public-meeting-track{animation-play-state:paused}
      .public-meeting-group{display:flex;min-height:100%;flex-direction:column;justify-content:center;gap:14px;padding:10px 0}
      .public-meeting-card{display:grid;grid-template-columns:minmax(130px,190px) 1fr;gap:18px;align-items:center;padding:20px 22px;border:1px solid rgba(135,93,19,.35);border-left:6px solid #ba7b12;border-radius:15px;background:linear-gradient(110deg,rgba(255,255,255,.93),rgba(255,248,223,.97));box-shadow:0 5px 16px rgba(104,70,13,.12)}
      .public-meeting-time{color:#885500;font-size:clamp(1.05rem,2vw,1.4rem);font-weight:900}
      .public-meeting-content{margin:0;color:#35250c;font-size:clamp(1.1rem,2vw,1.45rem);font-weight:800;line-height:1.4;white-space:pre-wrap}
      .public-meeting-meta{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:10px;color:#604713;font-size:1rem;font-weight:600}
      .public-meeting-type{display:inline-flex;align-items:center;width:max-content;margin-top:10px;padding:5px 11px;border:1px solid #c59a41;border-radius:999px;background:#fff3c4;color:#67440b;font-size:.83rem;font-weight:700}
      .public-meeting-empty,.public-meeting-error{display:grid;height:100%;place-items:center;padding:28px;text-align:center;color:#604713;font-size:1.15rem;font-weight:700}
      .public-meeting-error{color:#9a2018}
      .public-meeting-footer{display:flex;justify-content:space-between;gap:14px;padding-top:12px;color:#684710;font-size:.82rem;font-weight:600}
      @keyframes public-meeting-scroll{from{transform:translateY(0)}to{transform:translateY(-50%)}}
      @media(prefers-reduced-motion:reduce){.public-meeting-track{animation:none}}
      @media(max-width:720px){.public-meeting-page{padding:14px}.public-meeting-header{align-items:flex-start}.public-meeting-header-actions{align-items:flex-end;flex-direction:column;gap:9px}.public-meeting-live{font-size:.76rem}.public-meeting-title{font-size:clamp(1.55rem,6vw,2.3rem)}.public-meeting-board{border-radius:16px}.public-meeting-track{padding:22px 12px}.public-meeting-card{grid-template-columns:1fr;gap:7px;padding:16px}.public-meeting-footer{font-size:.72rem}}
      @media(max-width:430px){.public-meeting-live{max-width:150px;white-space:normal}.public-meeting-settings summary{padding:8px;font-size:.8rem}}
    `}</style>
    <svg className="public-meeting-map" viewBox="0 0 320 760" role="presentation" aria-hidden="true">
      <path d="M120 20c-15 4-28 16-42 14-16-1-24 14-19 29 5 14-10 25-17 37-12 20-2 38 12 50 11 12 5 31-6 46-13 19-5 39 10 54 12 14-1 30-6 48-7 26 13 46 30 61 12 11 10 29-3 43-15 16-11 35 6 46 12 8 10 27-1 42-14 20-8 40 11 51 13 8 14 25 0 38-17 17-10 34 8 42 13 6 17 20 10 35-8 18 6 34 25 42 11 6 7 21-6 30-13 10 5 21 24 16 17-6 23-25 14-40-6-14 6-23 21-31 18-12 11-29-7-38-15-8-15-26 2-36 17-11 15-29-2-37-15-8-14-25 3-35 17-12 13-30-5-39-15-8-15-25 0-35 16-12 11-28-5-37-14-8-14-25 0-36 16-14 8-30-6-40-15-10-12-27 3-38 14-11 8-27-8-34-16-7-13-26 4-39 18-13 11-30-6-36-18-7-14-25 4-35 18-12 10-28-8-34-17-6-16-23-1-35 18-14 6-31-12-38-14-7-8-22-14-32z"/>
    </svg>
    <div className="public-meeting-shell">
      <header className="public-meeting-header">
        <div>
          <h1 className="public-meeting-title">Lịch Họp - UBND xã Tân Hòa</h1>
          <p className="public-meeting-date">{formatDate(dateKey)}</p>
        </div>
        <div className="public-meeting-header-actions">
          <div className="public-meeting-live"><i aria-hidden="true" /> Tự cập nhật mỗi {settings.refreshSeconds} giây</div>
          <details className="public-meeting-settings">
            <summary>⚙ Cấu hình</summary>
            <div className="public-meeting-settings-panel">
              <label htmlFor="public-schedule-refresh">Thời gian tự động cập nhật</label>
              <select id="public-schedule-refresh" value={settings.refreshSeconds}
                onChange={(event) => updateSettings("refreshSeconds", event.target.value)}>
                {refreshOptions.map((seconds) => <option key={seconds} value={seconds}>{seconds} giây</option>)}
              </select>
              <label htmlFor="public-schedule-scroll">Thời gian chạy tuần tự các cuộc họp</label>
              <select id="public-schedule-scroll" value={settings.scrollSeconds}
                onChange={(event) => updateSettings("scrollSeconds", event.target.value)}>
                {scrollOptions.map((seconds) => <option key={seconds} value={seconds}>{seconds} giây mỗi lượt</option>)}
              </select>
              <p className="public-meeting-settings-note">Cấu hình được lưu trên thiết bị đang mở trang lịch này.</p>
              {settingsError && <p className="public-meeting-settings-error" role="alert">{settingsError}</p>}
            </div>
          </details>
        </div>
      </header>
      <section className="public-meeting-board" aria-label="Lịch họp công khai trong ngày">
        {error
          ? <div className="public-meeting-error" role="alert">{error}</div>
          : loading
            ? <div className="public-meeting-empty" role="status">Đang tải lịch họp...</div>
            : !sortedMeetings.length
              ? <div className="public-meeting-empty">Hôm nay chưa có cuộc họp công khai.</div>
              : <div className="public-meeting-track" style={{ "--scroll-duration": `${settings.scrollSeconds}s` }}>
                {[0, 1].map((copy) => <div className="public-meeting-group" key={copy} aria-hidden={copy === 1}>
                  {sortedMeetings.map((meeting, index) => {
                    const timeRange = meeting.meetingTimeRange?.trim();
                    const room = meeting.meetingRoom?.trim();
                    return <article className="public-meeting-card" key={`${meeting.meetingDate}-${meeting.meetingTimeRange}-${meeting.content}-${copy}-${index}`}>
                      <div className="public-meeting-time">{timeRange || "Cả ngày"}</div>
                      <div>
                        <h2 className="public-meeting-content">{meeting.content}</h2>
                        {room && <div className="public-meeting-meta"><span>Phòng họp: {room}</span></div>}
                        {meeting.meetingType && <span className="public-meeting-type">{meeting.meetingType}</span>}
                      </div>
                    </article>;
                  })}
                </div>)}
              </div>}
      </section>
      <footer className="public-meeting-footer">
        <span>Chỉ hiển thị các cuộc họp được đánh dấu công khai.</span>
        <span>{updatedAt ? `Cập nhật lúc ${updatedAt.toLocaleTimeString("vi-VN")}` : ""}</span>
      </footer>
    </div>
  </main>;
}
