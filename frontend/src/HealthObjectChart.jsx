import { useMemo } from "react";
import { groupHealthRecords } from "./healthObjectStatistics";
import "./HealthObjectChart.css";

const colors = ["#2563eb", "#059669", "#d97706", "#9333ea", "#dc2626", "#0891b2", "#db2777", "#4f46e5"];
const number = (value) => value.toLocaleString("vi-VN");

export default function HealthObjectChart({ customers, catalog, onViewObject, field = "objectType", groupLabel = "đối tượng" }) {
  const groups = useMemo(() => groupHealthRecords(customers, catalog, field), [customers, catalog, field]);
  const total = customers.length;
  const segments = groups.reduce((result, group, index) => {
    const start = result.length ? result[result.length - 1].end : 0;
    const percent = group.records.length / total * 100;
    result.push({ ...group, start, end: start + percent, percent, color: colors[index % colors.length] });
    return result;
  }, []);

  return <section className="health-summary-section health-object-section" aria-labelledby={`health-chart-title-${field}`}>
    <div className="health-section-title">
      <span className="health-scope-label">{`Theo ${groupLabel}`.toLocaleUpperCase("vi-VN")}</span>
      <h2 id={`health-chart-title-${field}`}>Thống kê theo {groupLabel}</h2>
      <p>Toàn bộ hồ sơ khám đã lưu. Nhấn số liệu để xem danh sách theo {groupLabel}.</p>
    </div>
    <div className="health-object-layout">
      <div className="health-object-donut">
        <svg viewBox="0 0 240 240" aria-label={`Biểu đồ Donut phân bố hồ sơ khám theo ${groupLabel}`}>
          <circle cx="120" cy="120" r="90" fill="none" stroke="#e2e8f0" strokeWidth="30" />
          {segments.map((group) => <circle key={group.key} cx="120" cy="120" r="90" fill="none" stroke={group.color} strokeWidth="30" pathLength="100"
            strokeDasharray={`${group.percent} ${100 - group.percent}`} strokeDashoffset={-group.start} transform="rotate(-90 120 120)"
            className="health-object-segment" role="button" tabIndex={0}
            aria-label={`${group.label}: ${number(group.records.length)} hồ sơ, ${group.percent.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%. Xem danh sách`}
            onClick={() => onViewObject(group.key)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onViewObject(group.key); } }}>
            <title>{group.label}: {number(group.records.length)} hồ sơ ({group.percent.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%)</title>
          </circle>)}
        </svg>
        <button type="button" className="health-object-total" onClick={() => onViewObject(null)} aria-label={`Xem tổng ${number(total)} hồ sơ khám`}>
          <span>Tổng hồ sơ</span><strong>{number(total)}</strong><small>Xem tất cả →</small>
        </button>
      </div>
      <div className="health-object-kpis">
        <button type="button" className="health-object-kpi health-object-kpi-total" onClick={() => onViewObject(null)}>
          <span className="health-object-kpi-label">Tổng hồ sơ khám</span><strong>{number(total)}</strong><small>Xem tab Tổng →</small>
        </button>
        {segments.map((group) => <button type="button" key={group.key} className="health-object-kpi" style={{ "--object-color": group.color }} onClick={() => onViewObject(group.key)}>
          <span className="health-object-kpi-label"><i aria-hidden="true" />{group.label}</span>
          <strong>{number(group.records.length)}</strong>
          <small>{group.percent.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}% tổng hồ sơ · Xem danh sách →</small>
        </button>)}
        {!total && <p className="text-muted mb-0">Chưa có hồ sơ khám để thống kê theo {groupLabel}.</p>}
      </div>
    </div>
  </section>;
}
