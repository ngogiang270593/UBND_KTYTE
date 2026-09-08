import { createContext, useCallback, useContext, useRef, useState } from "react";

const NotificationContext = createContext(null);

const styles = {
  success: { icon: "✓", color: "#15803d", background: "#f0fdf4", border: "#86efac" },
  error: { icon: "!", color: "#b91c1c", background: "#fef2f2", border: "#fca5a5" },
  warning: { icon: "!", color: "#a16207", background: "#fffbeb", border: "#fcd34d" },
  info: { icon: "i", color: "#1d4ed8", background: "#eff6ff", border: "#93c5fd" },
};

export function NotificationProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmation, setConfirmation] = useState(null);
  const nextId = useRef(1);

  const notify = useCallback((message, type = "info", title) => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, message, type, title }]);
    setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4000);
  }, []);

  const confirm = useCallback((options) =>
    new Promise((resolve) => {
      const config = typeof options === "string" ? { message: options } : options;
      setConfirmation({ ...config, resolve });
    }), []);

  const closeConfirmation = (result) => {
    confirmation?.resolve(result);
    setConfirmation(null);
  };

  return (
    <NotificationContext.Provider value={{ notify, confirm }}>
      {children}

      <div className="position-fixed top-0 end-0 p-3 d-grid gap-2" style={{ zIndex: 11000, width: "390px", maxWidth: "100vw" }}>
        {toasts.map((toast) => {
          const theme = styles[toast.type] || styles.info;
          return (
            <div key={toast.id} className="shadow-lg d-flex gap-3 align-items-start" style={{ background: theme.background, border: `1px solid ${theme.border}`, borderLeft: `5px solid ${theme.color}`, borderRadius: "14px", padding: "15px 16px", color: "#172033" }}>
              <div className="flex-shrink-0 d-flex align-items-center justify-content-center fw-bold" style={{ width: "28px", height: "28px", borderRadius: "50%", color: "white", background: theme.color }}>{theme.icon}</div>
              <div className="flex-grow-1">
                <div className="fw-bold mb-1">{toast.title || (toast.type === "error" ? "Có lỗi xảy ra" : toast.type === "success" ? "Thành công" : "Thông báo")}</div>
                <div style={{ whiteSpace: "pre-line", fontSize: "14px" }}>{toast.message}</div>
              </div>
              <button type="button" className="btn-close" aria-label="Đóng" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))} />
            </div>
          );
        })}
      </div>

      {confirmation && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3" style={{ zIndex: 12000, background: "rgba(15, 23, 42, 0.55)", backdropFilter: "blur(3px)" }} onMouseDown={(event) => event.target === event.currentTarget && closeConfirmation(false)}>
          <div className="bg-white shadow-lg" style={{ width: "440px", maxWidth: "100%", borderRadius: "18px", overflow: "hidden" }}>
            <div className="p-4 pb-3 d-flex gap-3">
              <div className="flex-shrink-0 d-flex align-items-center justify-content-center fw-bold" style={{ width: "46px", height: "46px", borderRadius: "14px", background: "#fff7ed", color: "#c2410c", fontSize: "24px" }}>!</div>
              <div>
                <h5 className="fw-bold mb-2">{confirmation.title || "Xác nhận thao tác"}</h5>
                <div className="text-secondary" style={{ whiteSpace: "pre-line" }}>{confirmation.message}</div>
              </div>
            </div>
            <div className="px-4 py-3 d-flex justify-content-end gap-2" style={{ background: "#f8fafc" }}>
              <button type="button" className="btn btn-outline-secondary px-4" onClick={() => closeConfirmation(false)}>{confirmation.cancelText || "Hủy"}</button>
              <button type="button" className={`btn px-4 ${confirmation.danger === false ? "btn-primary" : "btn-danger"}`} autoFocus onClick={() => closeConfirmation(true)}>{confirmation.confirmText || "Xác nhận"}</button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotification phải nằm trong NotificationProvider");
  return context;
}
