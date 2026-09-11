import { useEffect, useMemo, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import api from "./api";

const emptyForm = { code: "", name: "", fromDate: null, toDate: null, address: "", objectType: "", occupation: "" };
const normalize = (value) => String(value ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase();
const normalizeHamlet = (value) => normalize(value).replace(/\([^)]*\)/g, " ").replace(/^[\s.:;-]*ap\s+/, "").replace(/[\s.:;-]+$/g, "").replace(/\s+/g, " ").trim();
const addressParts = (address) => String(address ?? "").split(/[,;]/).map(normalizeHamlet).filter(Boolean);
const customerHamletId = (customer, hamlets) => {
  const parts = addressParts(customer.address);
  const normalizedHamlets = hamlets
    .map((hamlet) => ({ ...hamlet, normalizedName: normalizeHamlet(hamlet.name) }))
    .filter((hamlet) => hamlet.normalizedName);

  const exactMatch = normalizedHamlets.find((hamlet) =>
    parts.some((part) => part === hamlet.normalizedName)
  );

  if (exactMatch) return exactMatch.id;

  return normalizedHamlets
    .filter((hamlet) =>
      parts.some(
        (part) =>
          part.startsWith(`${hamlet.normalizedName} `) ||
          part.endsWith(` ${hamlet.normalizedName}`)
      )
    )
    .sort((first, second) => second.normalizedName.length - first.normalizedName.length)[0]
    ?.id ?? null;
};
const apiDate = (date) => date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` : null;
const displayDate = (value) => { const parts = String(value || "").slice(0, 10).split("-"); return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : "—"; };

export default function PrintVoucherPage() {
  const [customers, setCustomers] = useState([]), [hamlets, setHamlets] = useState([]), [activeTab, setActiveTab] = useState("all");
  const [form, setForm] = useState(emptyForm), [loading, setLoading] = useState(false), [exporting, setExporting] = useState(false), [message, setMessage] = useState("");
  const [page, setPage] = useState(1), [pageSize, setPageSize] = useState(20);
  const buildParams = (filters) => { const params = {}; ["code", "name", "address", "objectType", "occupation"].forEach((key) => { if (filters[key]?.trim()) params[key] = filters[key].trim(); }); if (filters.fromDate) params.fromDate = apiDate(filters.fromDate); if (filters.toDate) params.toDate = apiDate(filters.toDate); return params; };
  const loadData = async (filters = emptyForm) => { setLoading(true); setMessage(""); try { const response = await api.get("/PrintVoucher/customers", { params: buildParams(filters) }); setCustomers(Array.isArray(response.data) ? response.data : []); const pendingHamletId = sessionStorage.getItem("printVoucherHamlet"); setActiveTab(pendingHamletId ? `hamlet-${pendingHamletId}` : "all"); if (pendingHamletId) sessionStorage.removeItem("printVoucherHamlet"); setPage(1); } catch { setCustomers([]); setMessage("Không tải được dữ liệu in ấn."); } finally { setLoading(false); } };
  useEffect(() => {
    api.get("/CatalogItems", { params: { category: "hamlet" } }).then((response) => {
      const nextHamlets = Array.isArray(response.data) ? response.data : [];
      setHamlets(nextHamlets);
    }).catch(() => setMessage("Không tải được danh mục ấp."));
    Promise.resolve().then(loadData);
  }, []);
  const counts = useMemo(() => { const value = { all: customers.length, unknown: 0 }; hamlets.forEach((hamlet) => { value[`hamlet-${hamlet.id}`] = 0; }); customers.forEach((customer) => { const id = customerHamletId(customer, hamlets); id === null ? value.unknown++ : value[`hamlet-${id}`]++; }); return value; }, [customers, hamlets]);
  const selected = useMemo(() => { if (activeTab === "all") return customers; if (activeTab === "unknown") return customers.filter((customer) => customerHamletId(customer, hamlets) === null); const id = Number(activeTab.replace("hamlet-", "")); return customers.filter((customer) => customerHamletId(customer, hamlets) === id); }, [activeTab, customers, hamlets]);
  const tabs = [{ key: "all", label: "Tổng" }, ...[...hamlets].sort((first, second) => first.name.localeCompare(second.name, "vi", { sensitivity: "base" })).map((item) => ({ key: `hamlet-${item.id}`, label: item.name })), { key: "unknown", label: "Chưa có thông tin" }];
  const totalPages = Math.max(1, Math.ceil(selected.length / pageSize)), safePage = Math.min(page, totalPages), rows = selected.slice((safePage - 1) * pageSize, safePage * pageSize);
  const exportExcel = async () => { setExporting(true); setMessage(""); try { const response = await api.post("/PrintVoucher/customers/export", { customerIds: selected.map((item) => item.id) }, { responseType: "blob" }); const disposition = response.headers["content-disposition"]; const utf8 = disposition?.match(/filename\*=UTF-8''([^;]+)/i), normal = disposition?.match(/filename="?([^";]+)"?/i); const fileName = utf8?.[1] ? decodeURIComponent(utf8[1]) : normal?.[1] || "DanhSachKhamSucKhoe.xlsx"; const url = URL.createObjectURL(response.data), link = document.createElement("a"); link.href = url; link.download = fileName; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); } catch (error) { setMessage(error.response?.data instanceof Blob ? await error.response.data.text() : "Xuất Excel thất bại."); } finally { setExporting(false); } };
  const field = (label, name, placeholder) => <div className="col-xl-4 col-md-6"><label className="form-label fw-semibold">{label}</label><input className="form-control" value={form[name]} onChange={(event) => setForm((current) => ({ ...current, [name]: event.target.value }))} placeholder={placeholder} /></div>;
  return <div className="container-fluid py-4"><div className="card border-0 shadow-sm"><div className="card-header bg-primary text-white p-4"><h4 className="fw-bold mb-1">IN ẤN DANH SÁCH KHÁM SỨC KHỎE</h4><div className="opacity-75">Tìm kiếm, phân nhóm theo ấp và xuất danh sách Excel.</div></div><div className="card-body p-4">{message && <div className="alert alert-warning">{message}</div>}
    <div className="row g-3">{field("Căn cước", "code", "Nhập căn cước")}{field("Họ và tên", "name", "Nhập họ và tên")}<div className="col-xl-2 col-md-6"><label className="form-label fw-semibold d-block">Từ ngày</label><DatePicker wrapperClassName="w-100" selected={form.fromDate} onChange={(date) => setForm((current) => ({ ...current, fromDate: date }))} dateFormat="dd/MM/yyyy" className="form-control" isClearable /></div><div className="col-xl-2 col-md-6"><label className="form-label fw-semibold d-block">Đến ngày</label><DatePicker wrapperClassName="w-100" selected={form.toDate} onChange={(date) => setForm((current) => ({ ...current, toDate: date }))} dateFormat="dd/MM/yyyy" className="form-control" isClearable /></div>{field("Địa chỉ", "address", "Tìm trong địa chỉ")}{field("Đối tượng", "objectType", "Nhập đối tượng")}{field("Nghề nghiệp", "occupation", "Nhập nghề nghiệp")}</div>
    <div className="d-flex justify-content-end gap-2 mt-3"><button className="btn btn-primary" onClick={() => { if (form.fromDate && form.toDate && form.fromDate > form.toDate) { setMessage("Từ ngày không được lớn hơn Đến ngày."); return; } loadData(form); }} disabled={loading}>Tìm kiếm</button><button className="btn btn-outline-secondary" onClick={() => { setForm(emptyForm); setActiveTab("all"); loadData(); }}>Làm mới</button><button className="btn btn-success" onClick={exportExcel} disabled={loading || exporting || !selected.length}>{exporting ? "Đang xuất..." : "Xuất Excel"}</button></div>
    <div className="d-flex gap-2 py-4 overflow-auto">{tabs.map((tab) => <button key={tab.key} className={`btn rounded-pill text-nowrap ${activeTab === tab.key ? "btn-primary" : "btn-light border"}`} onClick={() => { setActiveTab(tab.key); setPage(1); }}>{tab.label} <span className="badge bg-secondary-subtle text-secondary ms-1">{counts[tab.key] || 0}</span></button>)}</div>
    <div className="d-flex justify-content-between align-items-center mb-2"><strong>{tabs.find((tab) => tab.key === activeTab)?.label}: {selected.length} hồ sơ</strong><select className="form-select form-select-sm" style={{ width: 85 }} value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}><option>10</option><option>20</option><option>50</option><option>100</option></select></div>
    <div className="table-responsive"><table className="table table-hover align-middle"><thead className="table-light"><tr><th>STT</th><th>Ngày khám</th><th>Người khám</th><th>SĐT</th><th>Địa chỉ</th></tr></thead><tbody>{rows.map((customer, index) => <tr key={customer.id}><td>{(safePage - 1) * pageSize + index + 1}</td><td>{displayDate(customer.examinationDate)}</td><td><strong>{customer.name || "Chưa có họ tên"}</strong><div className="small text-muted">CCCD: {customer.code || "—"} · Ngày sinh: {displayDate(customer.birthDate)}</div></td><td>{customer.phoneNumber || "—"}</td><td>{customer.address || <span className="badge bg-warning-subtle text-warning-emphasis">Chưa có thông tin</span>}</td></tr>)}{!loading && !rows.length && <tr><td colSpan="5" className="text-center text-muted py-5">Không có dữ liệu trong nhóm này.</td></tr>}</tbody></table></div>
    <div className="d-flex justify-content-end gap-2"><button className="btn btn-sm btn-outline-primary" disabled={safePage <= 1} onClick={() => setPage((value) => value - 1)}>Trước</button><span className="btn btn-sm btn-primary disabled">{safePage} / {totalPages}</span><button className="btn btn-sm btn-outline-primary" disabled={safePage >= totalPages} onClick={() => setPage((value) => value + 1)}>Sau</button></div>
  </div></div></div>;
}
