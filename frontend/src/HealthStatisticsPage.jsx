import { useEffect, useMemo, useState } from "react";
import api from "./api";
import HealthSummaryCards from "./HealthSummaryCards";

const normalize = (value) => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/đ/gi, "d")
  .toLowerCase()
  .replace(/\s+/g, " ")
  .trim();

const normalizeHamlet = (value) => normalize(value)
  .replace(/\([^)]*\)/g, " ")
  .replace(/^[\s.:;-]*ap\s+/, "")
  .replace(/[\s.:;-]+$/g, "")
  .trim();


const localDateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const sortHamlets = (rows) => [...rows].sort((first, second) => {
  if (first.label === "Chưa xác định") return 1;
  if (second.label === "Chưa xác định") return -1;
  return first.label.localeCompare(second.label, "vi", { sensitivity: "base" });
});
const findHamlet = (customer, hamlets) => {
  const parts = String(customer.address ?? "").split(/[,;]/).map(normalizeHamlet).filter(Boolean);
  const normalized = hamlets.map((hamlet) => ({ ...hamlet, normalizedName: normalizeHamlet(hamlet.name) })).filter((hamlet) => hamlet.normalizedName);
  const exact = normalized.find((hamlet) => parts.some((part) => part === hamlet.normalizedName));
  if (exact) return exact;
  return normalized.filter((hamlet) => parts.some((part) => part.startsWith(`${hamlet.normalizedName} `) || part.endsWith(` ${hamlet.normalizedName}`))).sort((first, second) => second.normalizedName.length - first.normalizedName.length)[0] ?? null;
};

const isElderly = (customer) => normalize(customer.objectType).includes("nguoi cao tuoi");
const isUnder18 = (customer) => {
  if (!customer.birthDate) return false;
  const birthDate = new Date(customer.birthDate);
  const examinationDate = customer.examinationDate ? new Date(customer.examinationDate) : new Date();
  if (Number.isNaN(birthDate.getTime()) || Number.isNaN(examinationDate.getTime())) return false;
  const eighteenthBirthday = new Date(birthDate);
  eighteenthBirthday.setFullYear(eighteenthBirthday.getFullYear() + 18);
  return eighteenthBirthday > examinationDate;
};



function buildSummary(records) {
  const groups = new Map();
  let under18 = 0;
  let elderly = 0;
  records.forEach(({ customer, hamlet }) => {
    const key = hamlet?.id ?? "unknown";
    if (!groups.has(key)) groups.set(key, { id: hamlet?.id, label: hamlet?.name || "Chưa xác định", count: 0, under18: 0, elderly: 0 });
    const row = groups.get(key);
    row.count++;
    if (isUnder18(customer)) { row.under18++; under18++; }
    if (isElderly(customer)) { row.elderly++; elderly++; }
  });
  return { total: records.length, under18, elderly, hamlets: sortHamlets([...groups.values()]) };
}

function HealthStatisticsPage({ onViewPlace }) {
  const [customers, setCustomers] = useState([]);
  const [hamlets, setHamlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([api.get("/PrintVoucher/customers"), api.get("/CatalogItems", { params: { category: "hamlet" } })])
      .then(([people, places]) => {
        if (!active) return;
        setCustomers(Array.isArray(people.data) ? people.data : []);
        setHamlets(Array.isArray(places.data) ? places.data : []);
      })
      .catch(() => { if (active) setMessage("Không tải được dữ liệu thống kê khám sức khỏe."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const today = localDateKey();
  const records = useMemo(() => customers.map(customer => ({ customer, hamlet: findHamlet(customer, hamlets) })), [customers, hamlets]);
  const todaySummary = useMemo(() => buildSummary(records.filter(({ customer }) => String(customer.examinationDate || "").slice(0, 10) === today)), [records, today]);
  const allSummary = useMemo(() => buildSummary(records), [records]);
  return <div className="health-statistics-page">
    {message && <div className="alert alert-warning" role="alert">{message}</div>}
    {loading ? <div className="health-empty" role="status">Đang tải dữ liệu thống kê…</div> : !message && <>
      <HealthSummaryCards title="Thống kê hôm nay" summary={todaySummary} onViewPlace={onViewPlace} />
      <HealthSummaryCards title="Thống kê toàn bộ" summary={allSummary} allTime onViewPlace={onViewPlace} />
    </>}
  </div>;
}
export default HealthStatisticsPage;
