import "./HealthStatisticsPage.css";
const formatNumber = (value) => Number(value || 0).toLocaleString("vi-VN");
export default function HealthSummaryCards({ title, summary, allTime = false, onViewPlace }) {
  return <section className={`health-summary-section${allTime ? " health-summary-all" : ""}`}>
    <div className="health-summary-heading">
      <div className="health-section-title"><span className="health-scope-label">{allTime ? "TÍCH LŨY" : "TRONG NGÀY"}</span><h2>{title}</h2><p>{allTime ? "Tổng hợp toàn bộ hồ sơ đã lưu" : "Hồ sơ khám ngày " + new Date().toLocaleDateString("vi-VN")}</p></div>
      <div className="health-summary-metrics">
        <div><span>Tổng hồ sơ</span><strong>{formatNumber(summary.total)}</strong></div>
        {summary.under18 > 0 && <div className="health-under18"><span>Dưới 18 tuổi</span><strong>{formatNumber(summary.under18)}</strong></div>}
        {summary.elderly > 0 && <div className="health-elderly"><span>Người cao tuổi</span><strong>{formatNumber(summary.elderly)}</strong></div>}
      </div>
    </div>
    <div className="health-summary-label">Phân bố theo ấp</div>
    <div className="health-hamlet-grid">
      {summary.hamlets.map(row => {
        const interactive = row.id != null && Boolean(onViewPlace);
        const Card = interactive ? "button" : "article";
        return <Card
          className="health-hamlet-item"
          key={row.id ?? row.label}
          {...(interactive ? { type: "button", onClick: () => onViewPlace(row.id), "aria-label": "Xem danh sách " + row.label } : {})}
        >
          <strong className="health-hamlet-name">{row.label}</strong>
          <div className="health-hamlet-count"><b className="health-hamlet-total">{formatNumber(row.count)}</b><span className="visually-hidden">hồ sơ</span></div>
          {(row.under18 > 0 || row.elderly > 0) && <div className="health-highlight-line">
            {row.under18 > 0 && <em className="health-under18"><span>Dưới 18</span><b>{formatNumber(row.under18)}</b></em>}
            {row.elderly > 0 && <em className="health-elderly"><span>Cao tuổi</span><b>{formatNumber(row.elderly)}</b></em>}
          </div>}
        </Card>;
      })}
      {!summary.hamlets.length && <div className="health-empty">Chưa có dữ liệu để thống kê.</div>}
    </div>
  </section>;
}

