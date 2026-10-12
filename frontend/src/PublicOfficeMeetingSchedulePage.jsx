import { useCallback, useEffect, useMemo, useState } from "react";
import api from "./api";
import backgroundImage from "./assets/public-meeting-background.jpg";

const defaultSettings = { refreshSeconds: 15, scrollSeconds: 45 };
const validRefreshSeconds = [5, 10, 15, 30, 60];
const validScrollSeconds = [20, 30, 45, 60, 90];

const getTodayKey = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
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
  const [meetings, setMeetings] = useState([]);
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [settingsError, setSettingsError] = useState(false);

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
    const { data } = await api.get(`/PublicOfficeMeetings?date=${today}`, { signal });
    const nextMeetings = Array.isArray(data) ? data : [];
    setMeetings((current) => JSON.stringify(current) === JSON.stringify(nextMeetings) ? current : nextMeetings);
    setError("");
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

  useEffect(() => {
    let active = true;
    let inFlight = false;
    const refreshSettings = async () => {
      if (!active || inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      try {
        const { data } = await api.get("/PublicOfficeMeetings/settings");
        if (!active) return;
        const next = {
          refreshSeconds: validRefreshSeconds.includes(Number(data.refreshSeconds)) ? Number(data.refreshSeconds) : defaultSettings.refreshSeconds,
          scrollSeconds: validScrollSeconds.includes(Number(data.scrollSeconds)) ? Number(data.scrollSeconds) : defaultSettings.scrollSeconds,
        };
        setSettings((current) => current.refreshSeconds === next.refreshSeconds && current.scrollSeconds === next.scrollSeconds
          ? current
          : next);
        setSettingsError(false);
      } catch {
        if (active) setSettingsError(true);
      } finally {
        inFlight = false;
      }
    };

    void refreshSettings();
    const interval = window.setInterval(() => { void refreshSettings(); }, 15000);
    window.addEventListener("focus", refreshSettings);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshSettings);
    };
  }, []);

  return <main className="public-meeting-page" style={{ backgroundImage: `linear-gradient(180deg,rgba(42,20,3,.4),rgba(42,20,3,.12) 44%,rgba(42,20,3,.24)),url("${backgroundImage}")` }}>
    <style>{`
      *{box-sizing:border-box}
      .public-meeting-page{width:100%;height:100vh;height:100dvh;min-height:100dvh;overflow:hidden;padding:clamp(14px,3vw,36px);background-color:#6f3a09;background-size:cover;background-position:center;background-repeat:no-repeat;color:#fff6d6;font-family:Arial,sans-serif}
      .public-meeting-shell{display:flex;width:min(1280px,100%);height:100%;flex-direction:column;margin:0 auto}
      .public-meeting-title{position:relative;z-index:2;margin:0 0 clamp(14px,3vh,32px);color:#fff5cc;font-size:clamp(1.6rem,4vw,3.15rem);font-weight:900;line-height:1.15;letter-spacing:.015em;text-align:center;text-shadow:0 2px 5px rgba(35,16,2,.85)}
      .public-meeting-title::after{display:block;width:clamp(90px,12vw,160px);height:3px;margin:clamp(10px,2vh,18px) auto 0;border-radius:99px;background:#f4cc68;box-shadow:0 1px 5px rgba(35,16,2,.75);content:""}
      .public-meeting-board{position:relative;flex:1;min-height:0;overflow:hidden}
      .public-meeting-settings-error{position:absolute;right:12px;bottom:8px;z-index:2;color:#7a1111;font-size:.82rem;font-weight:700;text-shadow:0 1px 2px rgba(255,245,194,.95)}
      .public-meeting-track{height:100%;animation:public-meeting-scroll var(--scroll-duration,45s) linear infinite;will-change:transform}
      .public-meeting-board:hover .public-meeting-track,.public-meeting-board:focus-within .public-meeting-track{animation-play-state:paused}
      .public-meeting-group{display:flex;min-height:100%;flex-direction:column;justify-content:center;gap:clamp(18px,4vh,38px);padding:12px clamp(4px,3vw,32px)}
      .public-meeting-item{display:grid;grid-template-columns:minmax(135px,210px) 1fr;gap:clamp(14px,3vw,36px);align-items:center;padding:6px 0;color:#fff8e4;text-shadow:0 2px 5px rgba(35,16,2,.95)}
      .public-meeting-time{color:#ffe08a;font-size:clamp(1.05rem,2.1vw,1.55rem);font-weight:900}
      .public-meeting-content{margin:0;font-size:clamp(1.1rem,2.2vw,1.65rem);font-weight:800;line-height:1.35;white-space:pre-wrap}
      .public-meeting-meta{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:8px;font-size:clamp(.92rem,1.6vw,1.1rem);font-weight:700}
      .public-meeting-type{margin-top:7px;font-size:.9rem;font-weight:800}
      .public-meeting-message{display:grid;height:100%;place-items:center;padding:24px;text-align:center;color:#fff5cc;font-size:clamp(1.1rem,2vw,1.4rem);font-weight:800;text-shadow:0 2px 5px rgba(35,16,2,.95)}
      .public-meeting-error{color:#ffe1d7}
      @keyframes public-meeting-scroll{from{transform:translateY(0)}to{transform:translateY(-50%)}}
      @media(prefers-reduced-motion:reduce){.public-meeting-track{animation:none}}
      @media(max-width:640px){.public-meeting-page{padding:12px;background-position:center}.public-meeting-title{font-size:clamp(1.35rem,6vw,2rem)}.public-meeting-group{gap:20px;padding:8px}.public-meeting-item{grid-template-columns:1fr;gap:5px}}
    `}</style>
    <div className="public-meeting-shell">
      <h1 className="public-meeting-title">Lịch Họp - UBND xã Tân Hòa</h1>
      <section className="public-meeting-board" aria-label="Lịch họp công khai trong ngày">
        {settingsError && <p className="public-meeting-settings-error" role="status">Đang dùng cấu hình mặc định; chưa tải được cấu hình lịch họp.</p>}
        {error
          ? <div className="public-meeting-message public-meeting-error" role="alert">{error}</div>
          : loading
            ? <div className="public-meeting-message" role="status">Đang tải lịch họp...</div>
            : !sortedMeetings.length
              ? <div className="public-meeting-message">Hôm nay chưa có cuộc họp công khai.</div>
              : <div className="public-meeting-track" style={{ "--scroll-duration": `${settings.scrollSeconds}s` }}>
                {[0, 1].map((copy) => <div className="public-meeting-group" key={copy} aria-hidden={copy === 1}>
                  {sortedMeetings.map((meeting, index) => <article className="public-meeting-item"
                    key={`${meeting.meetingDate}-${meeting.meetingTimeRange}-${meeting.content}-${copy}-${index}`}>
                    <div className="public-meeting-time">{meeting.meetingTimeRange?.trim() || "Cả ngày"}</div>
                    <div>
                      <h2 className="public-meeting-content">{meeting.content}</h2>
                      {meeting.meetingRoom?.trim() && <div className="public-meeting-meta">Phòng họp: {meeting.meetingRoom.trim()}</div>}
                      {meeting.meetingType && <div className="public-meeting-type">{meeting.meetingType}</div>}
                    </div>
                  </article>)}
                </div>)}
              </div>}
      </section>
    </div>
  </main>;
}
