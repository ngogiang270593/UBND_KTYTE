import { useCallback, useEffect, useMemo, useState } from "react";
import api from "./api";
import backgroundImage from "./assets/public-meeting-background.jpg";

const defaultSettings = { refreshSeconds: 15, scrollSeconds: 45, displayPeriod: "day" };
const validRefreshSeconds = [5, 10, 15, 30, 60];
const validScrollSeconds = [20, 30, 45, 60, 90];
const fontOptions = ["Times New Roman", "Arial", "Tahoma", "Georgia", "Verdana"];
const fontSizeOptions = [10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 28, 32, 36];
const defaultFont = "Times New Roman";
const meetingTypePalette = [
  ["#0d6efd", "#e7f1ff"], ["#198754", "#e8f7ef"], ["#dc3545", "#ffebee"],
  ["#fd7e14", "#fff1e5"], ["#6f42c1", "#f1eafd"], ["#0891b2", "#e5f8fb"],
  ["#d63384", "#fdeaf4"], ["#495057", "#eef0f2"], ["#8a5a00", "#fff4d6"], ["#087f5b", "#e6fcf5"],
];

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

const formatMeetingDate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
};

const formatMeetingWeekday = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return "";
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Intl.DateTimeFormat("vi-VN", { weekday: "long" }).format(date);
};

const getMeetingTypeColor = (value) => {
  const text = String(value || "Khác");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  const [accent, soft] = meetingTypePalette[hash % meetingTypePalette.length];
  return { accent, soft };
};

const getErrorMessage = (error) => error.response?.data?.message
  || "Không tải được lịch họp công khai. Vui lòng thử lại sau.";

export default function PublicOfficeMeetingSchedulePage() {
  const [meetings, setMeetings] = useState([]);
  const [backgroundUrl, setBackgroundUrl] = useState(backgroundImage);
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [settingsError, setSettingsError] = useState(false);
  const [backgroundError, setBackgroundError] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const currentDateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const sortedMeetings = useMemo(() => [...meetings].sort((first, second) => {
    const dateOrder = String(first.meetingDate || "").localeCompare(String(second.meetingDate || ""));
    if (dateOrder !== 0) return dateOrder;
    const firstStart = parseTimeRange(first.meetingTimeRange)?.start ?? -1;
    const secondStart = parseTimeRange(second.meetingTimeRange)?.start ?? -1;
    return firstStart - secondStart;
  }), [meetings]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Lịch Họp - UBND xã Tân Hòa";
    return () => { document.title = previousTitle; };
  }, []);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
    let active = true;
    let objectUrl;
    const controller = new AbortController();

    api.get("/PublicOfficeMeetings/background", { responseType: "blob", signal: controller.signal })
      .then(({ data, status }) => {
        if (!active || status === 204) return;
        objectUrl = URL.createObjectURL(data);
        setBackgroundUrl(objectUrl);
        setBackgroundError(false);
      })
      .catch((requestError) => {
        if (active && requestError.code !== "ERR_CANCELED") setBackgroundError(true);
      });

    return () => {
      active = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  const refreshSchedule = useCallback(async (signal) => {
    const today = getTodayKey();
    const { data } = await api.get("/PublicOfficeMeetings", {
      params: { date: today, period: settings.displayPeriod },
      signal,
    });
    const nextMeetings = Array.isArray(data) ? data : [];
    setMeetings((current) => JSON.stringify(current) === JSON.stringify(nextMeetings) ? current : nextMeetings);
    setError("");
  }, [settings.displayPeriod]);

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
          titleFont: fontOptions.includes(data.titleFont) ? data.titleFont : defaultFont,
          meetingFont: fontOptions.includes(data.meetingFont) ? data.meetingFont : defaultFont,
          titleFontSizePt: fontSizeOptions.includes(Number(data.titleFontSizePt)) ? Number(data.titleFontSizePt) : 14,
          meetingFontSizePt: fontSizeOptions.includes(Number(data.meetingFontSizePt)) ? Number(data.meetingFontSizePt) : 13,
          displayPeriod: data.displayPeriod === "week" ? "week" : "day",
        };
        setSettings((current) => current.refreshSeconds === next.refreshSeconds && current.scrollSeconds === next.scrollSeconds
          && current.titleFont === next.titleFont && current.meetingFont === next.meetingFont
          && current.titleFontSizePt === next.titleFontSizePt && current.meetingFontSizePt === next.meetingFontSizePt
          && current.displayPeriod === next.displayPeriod
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

  return <main className="public-meeting-page" style={{ backgroundImage: `linear-gradient(180deg,rgba(42,20,3,.4),rgba(42,20,3,.12) 44%,rgba(42,20,3,.24)),url("${backgroundUrl}")` }}>
    <style>{`
      *{box-sizing:border-box}
      .public-meeting-page{width:100%;height:100vh;height:100dvh;min-height:100dvh;overflow:hidden;padding:clamp(14px,3vw,36px);background-color:#6f3a09;background-size:cover;background-position:center;background-repeat:no-repeat;color:#fff6d6;font-family:var(--meeting-font,"Times New Roman"),serif}
      .public-meeting-shell{display:flex;width:min(1280px,100%);height:100%;flex-direction:column;margin:0 auto}
      .public-meeting-title{position:relative;z-index:2;margin:0 0 clamp(14px,3vh,32px);color:#fff5cc;font-family:var(--title-font,"Times New Roman"),serif;font-size:var(--title-font-size,14pt);font-weight:700;line-height:1.2;text-align:center;text-shadow:0 2px 5px rgba(35,16,2,.85)}
      .public-meeting-title::after{display:block;width:clamp(90px,12vw,160px);height:3px;margin:clamp(10px,2vh,18px) auto 0;border-radius:99px;background:#f4cc68;box-shadow:0 1px 5px rgba(35,16,2,.75);content:""}
      .public-meeting-board{position:relative;flex:1;min-height:0;overflow:hidden}
      .public-meeting-settings-error{position:absolute;right:12px;bottom:8px;z-index:2;color:#7a1111;font-size:.82rem;font-weight:700;text-shadow:0 1px 2px rgba(255,245,194,.95)}
      .public-meeting-track{height:100%;animation:public-meeting-scroll var(--scroll-duration,45s) linear infinite;will-change:transform}
      .public-meeting-board:hover .public-meeting-track,.public-meeting-board:focus-within .public-meeting-track{animation-play-state:paused}
      .public-meeting-group{display:flex;min-height:100%;flex-direction:column;justify-content:center;gap:clamp(18px,4vh,38px);padding:12px clamp(4px,3vw,32px)}
      .public-meeting-item{position:relative;display:grid;grid-template-columns:minmax(135px,210px) 1fr;gap:clamp(14px,3vw,36px);align-items:center;padding:10px 16px;border-left:2px solid rgba(255,224,138,.62);border-bottom:1px solid rgba(255,245,204,.22);border-radius:5px;background:linear-gradient(100deg,rgba(32,19,8,.56),rgba(32,19,8,.34) 70%,rgba(32,19,8,.18));box-shadow:0 3px 14px rgba(24,13,4,.16);backdrop-filter:blur(2px);color:#fff8e4;font-size:var(--meeting-font-size,13pt);text-shadow:0 2px 5px rgba(20,10,2,.98);transition:background-color .35s ease,filter .35s ease}
      .public-meeting-item.is-active{border-left:5px solid #ffe08a;background:linear-gradient(100deg,rgba(93,57,10,.86),rgba(70,42,9,.68) 70%,rgba(50,30,8,.45));box-shadow:0 0 22px rgba(255,224,138,.3);filter:brightness(1.16)}
      .public-meeting-date-time{display:grid;grid-template-columns:30px 1fr;align-items:center;gap:10px}
      .public-meeting-order{display:grid;width:28px;height:28px;place-items:center;border:1px solid rgba(255,224,138,.76);border-radius:50%;background:rgba(255,224,138,.16);color:#fff1a8;font-size:11pt;font-weight:700}
      .public-meeting-date{margin-bottom:3px;color:#fff0b6;font-size:.85em;font-weight:700}
      .public-meeting-time{color:#ffe08a;font-size:1em;font-weight:700}
      .public-meeting-item.is-active .public-meeting-time{color:#fff1a8}
      .public-meeting-content{margin:0;font-size:1em;font-weight:400;line-height:1.35;white-space:pre-wrap}
      .public-meeting-meta{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:8px;font-size:.95em;font-weight:400}
      .public-meeting-type{display:inline-block;margin-top:7px;padding:2px 9px;border:1px solid color-mix(in srgb,var(--type-color) 72%,transparent);border-radius:999px;background-color:var(--type-soft);color:var(--type-color);font-size:.95em;font-weight:700;line-height:1.2;text-shadow:none}
      .public-meeting-message{display:grid;height:100%;place-items:center;padding:24px;text-align:center;color:#fff5cc;font-size:13pt;font-weight:700;text-shadow:0 2px 5px rgba(35,16,2,.95)}
      .public-meeting-error{color:#ffe1d7}
      @keyframes public-meeting-scroll{from{transform:translateY(0)}to{transform:translateY(-50%)}}
      @media(prefers-reduced-motion:reduce){.public-meeting-track{animation:none}}
      @media(max-width:640px){.public-meeting-page{padding:12px;background-position:center}.public-meeting-group{gap:20px;padding:8px}.public-meeting-item{grid-template-columns:1fr;gap:5px}.public-meeting-date-time{grid-template-columns:28px 1fr}}
    `}</style>
    <div className="public-meeting-shell" style={{
      "--title-font": settings.titleFont,
      "--meeting-font": settings.meetingFont,
      "--title-font-size": `${settings.titleFontSizePt}pt`,
      "--meeting-font-size": `${settings.meetingFontSizePt}pt`,
    }}>
      <h1 className="public-meeting-title">Lịch Họp - UBND xã Tân Hòa</h1>
      <section className="public-meeting-board" aria-label="Lịch họp công khai trong ngày">
        {settingsError && <p className="public-meeting-settings-error" role="status">Đang dùng cấu hình mặc định; chưa tải được cấu hình lịch họp.</p>}
        {backgroundError && <p className="public-meeting-settings-error" role="status">Không tải được ảnh nền tùy chỉnh; đang dùng nền mặc định.</p>}
        {error
          ? <div className="public-meeting-message public-meeting-error" role="alert">{error}</div>
          : loading
            ? <div className="public-meeting-message" role="status">Đang tải lịch họp...</div>
            : !sortedMeetings.length
              ? <div className="public-meeting-message">Hôm nay chưa có cuộc họp công khai.</div>
              : <div className="public-meeting-track" style={{ "--scroll-duration": `${settings.scrollSeconds}s` }}>
                {[0, 1].map((copy) => <div className="public-meeting-group" key={copy} aria-hidden={copy === 1}>
                  {sortedMeetings.map((meeting, index) => {
                    const timeRange = parseTimeRange(meeting.meetingTimeRange);
                    const isActive = meeting.meetingDate === currentDateKey
                      && timeRange && timeRange.start <= currentMinutes && currentMinutes < timeRange.end;
                    const typeColor = getMeetingTypeColor(meeting.meetingType);
                    return <article className={`public-meeting-item${isActive ? " is-active" : ""}`}
                    key={`${meeting.meetingDate}-${meeting.meetingTimeRange}-${meeting.content}-${copy}-${index}`}>
                      <div className="public-meeting-date-time">
                        <span className="public-meeting-order">{String(index + 1).padStart(2, "0")}</span>
                        <div>
                          <div className="public-meeting-date">{formatMeetingWeekday(meeting.meetingDate)}, {formatMeetingDate(meeting.meetingDate)}</div>
                          <div className="public-meeting-time">{meeting.meetingTimeRange?.trim() || "Cả ngày"}</div>
                        </div>
                      </div>
                      <div>
                        <h2 className="public-meeting-content">{meeting.content}</h2>
                        {meeting.meetingRoom?.trim() && <div className="public-meeting-meta">Phòng họp: {meeting.meetingRoom.trim()}</div>}
                        {meeting.meetingType && <div className="public-meeting-type" style={{ "--type-color": typeColor.accent, "--type-soft": typeColor.soft }}>{meeting.meetingType}</div>}
                      </div>
                    </article>;
                  })}
                </div>)}
              </div>}
      </section>
    </div>
  </main>;
}
