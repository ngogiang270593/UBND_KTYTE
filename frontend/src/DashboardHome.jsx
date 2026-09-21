import "./DashboardHome.css";

function DashboardHome({ selectedModule, onSelectModule, modules }) {
  return (
    <section className="home-dashboard">
      <div className="home-heading">
        <span className="home-kicker">HỆ THỐNG QUẢN LÝ XÃ TÂN HÒA</span>
        <h1>Chọn module làm việc</h1>
        <p>Bấm vào một module để hiển thị các chức năng của module đó trên thanh bên.</p>
      </div>
      {modules.length === 0 && <div className="alert alert-info">Bạn chưa được cấp module. Vui lòng liên hệ quản trị hệ thống.</div>}
      <div className="module-grid" role="list">
        {modules.map((module) => (
          <button type="button" role="listitem" key={module.id}
            className={`module-tile module-${module.id}${selectedModule === module.id ? " is-selected" : ""}`}
            onClick={() => onSelectModule(module.id)}>
            <span className="module-icon" aria-hidden="true">{module.icon}</span>
            <span className="module-title">{module.title}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export default DashboardHome;
