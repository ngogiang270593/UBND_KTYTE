import { useEffect, useMemo, useState } from "react";
import api from "./api";

const refreshOptions = [5, 10, 15, 30, 60];
const scrollOptions = [20, 30, 45, 60, 90];
const displayPeriodOptions = [
  { value: "day", label: "Ngày hiện tại" },
  { value: "week", label: "Tuần hiện tại (Thứ Hai – Chủ nhật)" },
  { value: "todayToWeekend", label: "Hôm nay đến Cuối tuần" },
];
const fontOptions = ["Times New Roman", "Arial", "Tahoma", "Georgia", "Verdana"];
const fontSizeOptions = [10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 28, 32, 36];
const initialSettings = {
  refreshSeconds: 15,
  scrollSeconds: 45,
  titleText: "Lịch Họp - UBND xã Tân Hòa",
  titleFont: "Times New Roman",
  meetingFont: "Times New Roman",
  titleFontSizePt: 14,
  meetingFontSizePt: 13,
  displayPeriod: "day",
  hasCustomBackground: false,
};
const errorMessage = (error) => error.response?.data?.message || "Không thể hoàn tất yêu cầu. Vui lòng thử lại.";

export default function OfficeMeetingDisplaySettingsPage() {
  const [settings, setSettings] = useState(initialSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backgroundFile, setBackgroundFile] = useState(null);
  const [backgroundPreview, setBackgroundPreview] = useState(null);
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [message, setMessage] = useState(null);
  const localBackgroundPreview = useMemo(
    () => backgroundFile ? URL.createObjectURL(backgroundFile) : null,
    [backgroundFile],
  );

  useEffect(() => () => {
    if (localBackgroundPreview) URL.revokeObjectURL(localBackgroundPreview);
  }, [localBackgroundPreview]);

  useEffect(() => {
    let active = true;
    api.get("/OfficeMeetingDisplaySettings")
      .then(({ data }) => {
        if (active) setSettings({
          refreshSeconds: data.refreshSeconds,
          scrollSeconds: data.scrollSeconds,
          titleText: data.titleText,
          titleFont: data.titleFont,
          meetingFont: data.meetingFont,
          titleFontSizePt: data.titleFontSizePt,
          meetingFontSizePt: data.meetingFontSizePt,
          displayPeriod: data.displayPeriod,
          hasCustomBackground: data.hasCustomBackground,
        });
      })
      .catch((error) => {
        if (active) setMessage({ type: "danger", text: errorMessage(error) });
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (backgroundFile || !settings.hasCustomBackground) return undefined;
    let previewUrl;
    api.get("/PublicOfficeMeetings/background", { responseType: "blob" })
      .then(({ data, status }) => {
        if (!active || status === 204) return;
        previewUrl = URL.createObjectURL(data);
        setBackgroundPreview(previewUrl);
      })
      .catch((error) => {
        if (active) setMessage({ type: "danger", text: errorMessage(error) });
      });

    return () => {
      active = false;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [backgroundFile, settings.hasCustomBackground]);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const { data } = await api.put("/OfficeMeetingDisplaySettings", settings);
      setSettings({
        refreshSeconds: data.refreshSeconds,
        scrollSeconds: data.scrollSeconds,
        titleText: data.titleText,
        titleFont: data.titleFont,
        meetingFont: data.meetingFont,
        titleFontSizePt: data.titleFontSizePt,
        meetingFontSizePt: data.meetingFontSizePt,
        displayPeriod: data.displayPeriod,
        hasCustomBackground: data.hasCustomBackground,
      });
      setMessage({ type: "success", text: "Đã lưu cấu hình màn hình lịch họp." });
    } catch (error) {
      setMessage({ type: "danger", text: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  const uploadBackground = async () => {
    if (!backgroundFile) {
      setMessage({ type: "warning", text: "Vui lòng chọn ảnh nền trước khi tải lên." });
      return;
    }
    if (backgroundFile.size > 5 * 1024 * 1024) {
      setMessage({ type: "warning", text: "Ảnh nền không được vượt quá 5 MB." });
      return;
    }

    setUploadingBackground(true);
    setMessage(null);
    const formData = new FormData();
    formData.append("image", backgroundFile);
    try {
      const { data } = await api.post("/OfficeMeetingDisplaySettings/background", formData);
      setSettings((current) => ({ ...current, hasCustomBackground: data.hasCustomBackground }));
      setBackgroundFile(null);
      setMessage({ type: "success", text: "Đã tải ảnh nền. Trang lịch công khai sẽ tự động cập nhật." });
    } catch (error) {
      setMessage({ type: "danger", text: errorMessage(error) });
    } finally {
      setUploadingBackground(false);
    }
  };

  const resetBackground = async () => {
    setUploadingBackground(true);
    setMessage(null);
    try {
      const { data } = await api.delete("/OfficeMeetingDisplaySettings/background");
      setSettings((current) => ({ ...current, hasCustomBackground: data.hasCustomBackground }));
      setBackgroundFile(null);
      setMessage({ type: "success", text: "Đã khôi phục ảnh nền trống đồng mặc định." });
    } catch (error) {
      setMessage({ type: "danger", text: errorMessage(error) });
    } finally {
      setUploadingBackground(false);
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
        <div className="border rounded-3 p-3 mb-4">
          <h3 className="h5 fw-bold">Ảnh nền lịch họp</h3>
          <p className="text-muted">Tải JPEG, PNG hoặc WebP tối đa 5 MB. Ảnh được lưu dùng chung và không mất khi ứng dụng khởi động lại.</p>
          <div className="row g-3 align-items-start">
            <div className="col-lg-7">
              <label className="form-label fw-semibold" htmlFor="office-display-background">Chọn ảnh nền</label>
              <input id="office-display-background" type="file" className="form-control" accept="image/jpeg,image/png,image/webp"
                disabled={uploadingBackground}
                onChange={(event) => setBackgroundFile(event.target.files?.[0] || null)} />
              <div className="d-flex flex-wrap gap-2 mt-3">
                <button type="button" className="btn btn-primary" onClick={uploadBackground}
                  disabled={!backgroundFile || uploadingBackground}>
                  {uploadingBackground ? "Đang xử lý..." : "Tải ảnh nền lên"}
                </button>
                <button type="button" className="btn btn-outline-secondary" onClick={resetBackground}
                  disabled={!settings.hasCustomBackground || uploadingBackground}>
                  Dùng nền trống đồng mặc định
                </button>
              </div>
            </div>
            <div className="col-lg-5">
              {(localBackgroundPreview || backgroundPreview) && (localBackgroundPreview || settings.hasCustomBackground)
                ? <img src={localBackgroundPreview || backgroundPreview} alt="Xem trước ảnh nền lịch họp" className="img-fluid rounded-3 border"
                  style={{ maxHeight: 190, width: "100%", objectFit: "cover" }} />
                : <div className="rounded-3 border bg-light d-flex align-items-center justify-content-center text-muted"
                  style={{ minHeight: 120 }}>Đang dùng nền trống đồng mặc định</div>}
            </div>
          </div>
        </div>
        <form onSubmit={save}>
          <fieldset disabled={loading || saving}>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label fw-semibold" htmlFor="office-display-title-text">Tiêu đề lịch họp</label>
                <input id="office-display-title-text" className="form-control" maxLength={200} value={settings.titleText}
                  onChange={(event) => setSettings((current) => ({ ...current, titleText: event.target.value }))} />
                <div className="form-text">Nội dung hiển thị ở đầu màn hình lịch họp công khai.</div>
              </div>
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
              <div className="col-md-6">
                <label className="form-label fw-semibold" htmlFor="office-display-period">Phạm vi lịch chạy</label>
                <select id="office-display-period" className="form-select" value={settings.displayPeriod}
                  onChange={(event) => setSettings((current) => ({ ...current, displayPeriod: event.target.value }))}>
                  {displayPeriodOptions.map((period) => <option key={period.value} value={period.value}>{period.label}</option>)}
                </select>
                <div className="form-text">Chọn phạm vi ngày bắt đầu hiển thị lịch họp công khai.</div>
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold" htmlFor="office-display-title-font">Phông chữ tiêu đề</label>
                <select id="office-display-title-font" className="form-select" value={settings.titleFont}
                  onChange={(event) => setSettings((current) => ({ ...current, titleFont: event.target.value }))}>
                  {fontOptions.map((font) => <option key={font} value={font}>{font}</option>)}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold" htmlFor="office-display-meeting-font">Phông chữ cuộc họp</label>
                <select id="office-display-meeting-font" className="form-select" value={settings.meetingFont}
                  onChange={(event) => setSettings((current) => ({ ...current, meetingFont: event.target.value }))}>
                  {fontOptions.map((font) => <option key={font} value={font}>{font}</option>)}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold" htmlFor="office-display-title-size">Kích thước chữ tiêu đề</label>
                <select id="office-display-title-size" className="form-select" value={settings.titleFontSizePt}
                  onChange={(event) => setSettings((current) => ({ ...current, titleFontSizePt: Number(event.target.value) }))}>
                  {fontSizeOptions.map((size) => <option key={size} value={size}>{size} pt</option>)}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold" htmlFor="office-display-meeting-size">Kích thước chữ cuộc họp</label>
                <select id="office-display-meeting-size" className="form-select" value={settings.meetingFontSizePt}
                  onChange={(event) => setSettings((current) => ({ ...current, meetingFontSizePt: Number(event.target.value) }))}>
                  {fontSizeOptions.map((size) => <option key={size} value={size}>{size} pt</option>)}
                </select>
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
