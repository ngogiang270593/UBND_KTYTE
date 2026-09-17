import { useEffect, useMemo, useRef, useState } from "react";
import api from "./api";
import * as XLSX from "xlsx";
import { createObjectExport } from "./objectStatisticsExport";
import { useNotification } from "./NotificationProvider";
import TablePagination from "./TablePagination";

import { groupHealthObjects, normalizeObjectType as normalize } from "./healthObjectStatistics";
const formatDate = (value) => {
  const date = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.split("-").reverse().join("/") : date;
};

export default function HealthObjectStatisticsPage({ initialObjectType = null }) {
  const { notify } = useNotification();
  const [exporting, setExporting] = useState(false);
  const exportLock = useRef(false);
  const [customers, setCustomers] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState(initialObjectType);
  const [keyword, setKeyword] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    let active = true;
    Promise.all([api.get("/PrintVoucher/customers"), api.get("/CatalogItems", { params: { category: "objectType" } })])
      .then(([people, types]) => {
        if (!active) return;
        setCustomers(Array.isArray(people.data) ? people.data : []);
        setCatalog(Array.isArray(types.data) ? types.data : []);
      })
      .catch(() => { if (active) setError("Không tải được thống kê đối tượng. Vui lòng mở lại menu để thử lại."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const search = normalize(keyword);
    return customers.filter((customer) => {
      const date = String(customer.examinationDate || "").slice(0, 10);
      return (!fromDate || date >= fromDate) && (!toDate || (date && date <= toDate)) &&
        (!search || [customer.name, customer.code, customer.address, customer.objectType].some((value) => normalize(value).includes(search)));
    });
  }, [customers, keyword, fromDate, toDate]);
  const groups = useMemo(() => groupHealthObjects(filtered, catalog), [filtered, catalog]);
  const selected = groups.find((group) => group.key === tab);
  const records = selected ? selected.records : filtered;
  const activeTab = selected ? selected.key : null;
  const totalPages = Math.max(1, Math.ceil(records.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRecords = records.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const changeFilter = (setter) => (event) => { setter(event.target.value); setPage(1); setTab(null); };

  const invalidDates = Boolean(fromDate && toDate && fromDate > toDate);
  const exportDisabled = loading || Boolean(error) || invalidDates || !records.length || exporting;
  const exportExcel = async () => {
    if (exportDisabled || exportLock.current) return;
    exportLock.current = true;
    setExporting(true);
    const snapshot = { records, label: selected?.label || "Tổng", keyword, fromDate, toDate };
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      const { workbook, fileName } = createObjectExport(snapshot);
      XLSX.writeFile(workbook, fileName, { compression: true });
      notify(`Đã tạo tệp Excel gồm ${snapshot.records.length.toLocaleString("vi-VN")} hồ sơ — ${snapshot.label}.`, "success");
    } catch {
      notify("Không thể xuất Excel. Vui lòng thử lại.", "error");
    } finally {
      exportLock.current = false;
      setExporting(false);
    }
  };
  return <div className="card shadow-sm">
    <div className="card-header bg-white p-4">
      <h4 className="fw-bold text-primary">TK Đối tượng</h4>
      <div className="text-muted">Thống kê theo đối tượng trong danh sách khám sức khỏe. Số lượng tính theo hồ sơ khám.</div>
    </div>
    <div className="card-body">
      <div className="row g-3 mb-3">
        <div className="col-md-6"><label className="form-label" htmlFor="object-search">Tìm kiếm</label><input id="object-search" className="form-control" placeholder="Họ tên, mã hồ sơ, địa chỉ, đối tượng" value={keyword} onChange={changeFilter(setKeyword)} /></div>
        <div className="col-md-3"><label className="form-label" htmlFor="object-from">Khám từ ngày</label><input id="object-from" type="date" className="form-control" value={fromDate} onChange={changeFilter(setFromDate)} /></div>
        <div className="col-md-3"><label className="form-label" htmlFor="object-to">Đến ngày</label><input id="object-to" type="date" className="form-control" value={toDate} onChange={changeFilter(setToDate)} /></div>
      </div>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 border rounded-3 bg-light p-3 mb-3">
        <div>
          <div className="fw-semibold">{selected?.label || "Tổng"}{!loading && !error && !invalidDates && `: ${records.length.toLocaleString("vi-VN")} hồ sơ khám`}</div>
          <div id="object-export-help" className="small text-muted">{loading ? "Đang tải dữ liệu..." : error ? "Cần tải dữ liệu thành công để xuất Excel." : invalidDates ? "Vui lòng kiểm tra lại khoảng ngày khám." : !records.length ? "Không có hồ sơ phù hợp để xuất Excel." : "Xuất toàn bộ hồ sơ thuộc tab và bộ lọc đang chọn, bao gồm các trang khác."}</div>
        </div>
        <button type="button" className="btn btn-success d-inline-flex align-items-center justify-content-center gap-2 px-3" onClick={exportExcel} disabled={exportDisabled} aria-busy={exporting} aria-describedby="object-export-help">
          {exporting ? <span className="spinner-border spinner-border-sm" aria-hidden="true" /> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></svg>}
          <span aria-live="polite">{exporting ? "Đang xuất..." : "Xuất Excel"}</span>
        </button>
      </div>
      {error ? <div className="alert alert-danger" role="alert">{error}</div> : loading ? <div role="status">Đang tải thống kê đối tượng...</div> : invalidDates ? <div className="alert alert-warning" role="alert">Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.</div> : <>
        <div className="nav nav-tabs mb-3" aria-label="Thống kê theo đối tượng">
          {[{ key: null, label: "Tổng", records: filtered }, ...groups].map((group) => <button type="button" key={group.key === null ? "total" : `object:${group.key}`} className={`nav-link ${activeTab === group.key ? "active" : ""}`} aria-pressed={activeTab === group.key} onClick={() => { setTab(group.key); setPage(1); }}>{group.label} <span className="badge bg-secondary ms-1">{group.records.length.toLocaleString("vi-VN")}</span></button>)}
        </div>

        <div className="table-responsive">
          <table className="table table-bordered table-hover align-middle">
            <thead className="table-light"><tr>{["STT", "Mã hồ sơ", "Họ tên", "Ngày sinh", "Địa chỉ", "Đối tượng", "Ngày khám"].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
            <tbody>{pagedRecords.map((customer, index) => <tr key={customer.id}><td>{(currentPage - 1) * pageSize + index + 1}</td><td>{customer.code}</td><td>{customer.name}</td><td>{formatDate(customer.birthDate)}</td><td>{customer.address}</td><td>{customer.objectType || "Chưa xác định"}</td><td>{formatDate(customer.examinationDate)}</td></tr>)}
              {!records.length && <tr><td colSpan={7} className="text-center text-muted py-4">Không có hồ sơ khám phù hợp.</td></tr>}
            </tbody>
          </table>
        </div>
        <TablePagination total={records.length} page={currentPage} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} disabled={loading || Boolean(error) || invalidDates} />
      </>}
    </div>
  </div>;
}
