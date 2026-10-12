import { useEffect, useState } from "react";
import api from "./api";

const refreshOptions = [5, 10, 15, 30, 60];
const scrollOptions = [20, 30, 45, 60, 90];
const initialSettings = { refreshSeconds: 15, scrollSeconds: 45 };
const errorMessage = (error) => error.response?.data?.message || "Không thể hoàn tất yêu cầu. Vui lòng thử lại.";

export default function OfficeMeetingDisplaySettingsPage() {
  const [settings, setSettings] = useState(initialSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let active = true;
    api.get("/OfficeMeetingDisplaySettings")
      .then(({ data }) => {
        if (active) setSettings({ refreshSeconds: data.refreshSeconds, scrollSeconds: data.scrollSeconds });
      })
      .catch((error) => {
        if (active) setMessage({ type: "danger", text: errorMessage(error) });
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const { data } = await api.put("/OfficeMeetingDisplaySettings", settings);
      setSettings({ refreshSeconds: data.refreshSeconds, scrollSeconds: data.scrollSeconds });
      setMessage({ type: "success", text: "Đã lưu cấu hình màn hình lịch họp." });
    } catch (error) {
      setMessage({ type: "danger", text: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  return <section className="container-fluid py-2">
    <div className="card border-0 shadow-sm rounded-4">
      <div className="card-body p-4">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-3">
          <div>
            <h2 className="h3 fw-bold mb-1">Cấu hình màn hình lịch họp</h2>
            <p className="text-muted mb-0">Thiết lập được áp dụng chung cho trang lịch họp công khai trên mọi thiết bị.</p>
          </div>
          <a className="btn btn-outline-primary" href="/lich-hop" target="_blank" rel="noreferrer">Mở màn hình lịch họp</a>
        </div>
        {message && <div className={`alert alert-${message.type}`} role="alert">{message.text}</div>}
        <form onSubmit={save}>
          <fieldset disabled={loading || saving}>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label fw-semibold" htmlFor="office-display-refresh">Thời gian tự động cập nhật</label>
                <select id="office-display-refresh" className="form-select" value={settings.refreshSeconds}
                  onChange={(event) => setSettings((current) => ({ ...current, refreshSeconds: Number(event.target.value) }))}>
                  {refreshOptions.map((seconds) => <option key={seconds} value={seconds}>{seconds} giây</option>)}
                </select>
                <div className="form-text">Lịch sẽ lấy dữ liệu mới sau mỗi khoảng thời gian này.</div>
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold" htmlFor="office-display-scroll">Thời gian chạy tuần tự các cuộc họp</label>
                <select id="office-display-scroll" className="form-select" value={settings.scrollSeconds}
                  onChange={(event) => setSettings((current) => ({ ...current, scrollSeconds: Number(event.target.value) }))}>
                  {scrollOptions.map((seconds) => <option key={seconds} value={seconds}>{seconds} giây mỗi lượt</option>)}
                </select>
                <div className="form-text">Thời gian để danh sách chạy hết một lượt từ dưới lên trên.</div>
              </div>
            </div>
            <button type="submit" className="btn btn-primary mt-4" disabled={loading || saving}>
              {loading ? "Đang tải..." : saving ? "Đang lưu..." : "Lưu cấu hình"}
            </button>
          </fieldset>
        </form>
      </div>
    </div>
  </section>;
}
