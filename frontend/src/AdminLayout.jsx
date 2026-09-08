import { useState } from "react";
import { appModules, findModuleByPage } from "./navigationConfig";

function AdminLayout({ children, onLogout, activePage, setActivePage, selectedModule, setSelectedModule }) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const fullName = localStorage.getItem("fullName") || "Admin";
  const role = localStorage.getItem("role") || "User";
  const pageModule = findModuleByPage(activePage);
  const currentModule = appModules.find((module) => module.id === (pageModule?.id || selectedModule));
  const currentLink = pageModule?.links.find((link) => link.key === activePage);
  const currentTitle = activePage === "dashboard" ? "Dashboard" : activePage === "changePassword" ? "Đổi mật khẩu" : currentLink?.label || "Dashboard";

  const goHome = () => setActivePage("dashboard");

  return (
    <div className="d-flex" style={{ minHeight: "100vh", background: "#e8eef7" }}>
      <aside className="shadow-sm d-flex flex-column" style={{ width: 260, minWidth: 260, flexShrink: 0, background: "#f3f6fb", borderRight: "1px solid #cbd5e1" }}>
        <button type="button" onClick={goHome} className="border-0 text-start p-4" style={{ background: "#1d4ed8", color: "white" }}>
          <h3 className="fw-bold mb-1">UBND<br />XÃ TÂN HÒA</h3>
          <div style={{ fontSize: 14, opacity: .9 }}>Hệ thống quản lý</div>
        </button>

        <div className="p-3 flex-grow-1">
          <button type="button" onClick={goHome} className="btn text-start fw-semibold d-flex align-items-center gap-2 w-100 mb-3"
            style={{ background: activePage === "dashboard" ? "#1d4ed8" : "#fff", color: activePage === "dashboard" ? "white" : "#334155", border: "1px solid #dbe3ef", borderRadius: 12, padding: "12px 14px" }}>
            <span style={{ fontSize: 18 }}>⌂</span><span>Dashboard</span>
          </button>

          {currentModule ? <>
            <div className="d-flex align-items-center gap-2 px-1 mb-3">
              <span style={{ width: 38, height: 38, display: "grid", placeItems: "center", borderRadius: 11, background: "#e2eaf8", fontSize: 21 }}>{currentModule.icon}</span>
              <div><div className="text-uppercase text-muted fw-bold" style={{ fontSize: 10, letterSpacing: 1 }}>Module</div><div className="fw-bold text-dark">{currentModule.title}</div></div>
            </div>
            <div className="d-grid gap-2">
              {currentModule.links.map((item) => {
                const isActive = activePage === item.key;
                return <button type="button" key={item.key} onClick={() => setActivePage(item.key)} className="btn text-start fw-semibold d-flex align-items-center gap-2"
                  style={{ background: isActive ? "#1d4ed8" : "#fff", color: isActive ? "white" : "#334155", border: isActive ? "1px solid #1d4ed8" : "1px solid #dbe3ef", borderRadius: 12, padding: "12px 14px", boxShadow: isActive ? "0 6px 14px rgba(29,78,216,.25)" : "none" }}>
                  <span style={{ fontSize: 18 }}>{item.icon}</span><span>{item.label}</span>
                </button>;
              })}
            </div>
            <button type="button" className="btn btn-link text-decoration-none text-muted px-1 mt-3" onClick={() => { setSelectedModule(null); goHome(); }}>← Chọn module khác</button>
          </> : <div className="text-center text-muted px-3 py-4"><div style={{ fontSize: 32 }}>☰</div><div className="small mt-2">Chọn một module trên Dashboard để xem chức năng.</div></div>}
        </div>
      </aside>

      <main className="flex-grow-1" style={{ minWidth: 0, overflowX: "auto" }}>
        <div className="d-flex justify-content-between align-items-center px-4" style={{ height: 76, background: "#f8fafc", borderBottom: "1px solid #cbd5e1" }}>
          <div><h4 className="fw-bold mb-0" style={{ color: "#1e3a8a" }}>{currentTitle}</h4><small className="text-muted">Xin chào, {fullName} - {role}</small></div>
          <div className="position-relative">
            <button className="btn border-0 shadow-sm d-flex align-items-center gap-2 px-3" onClick={() => setShowUserMenu((value) => !value)} style={{ background: "#fff", borderRadius: 12, height: 48, minWidth: 180 }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#2563eb", color: "white", display: "grid", placeItems: "center", fontWeight: "bold" }}>{fullName.charAt(0)}</div>
              <div className="text-start flex-grow-1"><div style={{ fontSize: 14, fontWeight: 600 }}>{fullName}</div><div className="text-muted" style={{ fontSize: 12 }}>{role}</div></div><span className="text-muted">▼</span>
            </button>
            {showUserMenu && <div className="position-absolute end-0 mt-2 bg-white shadow" style={{ width: 220, borderRadius: 14, zIndex: 9999, overflow: "hidden" }}>
              <button className="btn w-100 text-start border-0 px-3 py-2" onClick={() => { setActivePage("changePassword"); setShowUserMenu(false); }}>🔑 Đổi mật khẩu</button>
              <div style={{ height: 1, background: "#e2e8f0" }} />
              <button className="btn w-100 text-start border-0 text-danger px-3 py-2" onClick={onLogout}>🚪 Đăng xuất</button>
            </div>}
          </div>
        </div>
        <div className="p-4">{children}</div>
      </main>
    </div>
  );
}

export default AdminLayout;
