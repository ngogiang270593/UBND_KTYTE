import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import api from "./api";

const initialFilters = { keyword: "", gender: "", fromBirthDate: "", toBirthDate: "" };
const formatDate = (value) => value ? String(value).slice(0, 10).split("-").reverse().join("/") : "";
const normalize = (value) => String(value ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase();

function MedicalRecordListPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const groups = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const result = { all: rows, under18: [], dn: [], inpatient: [], outpatient: [], other: [] };

    rows.forEach((row) => {
      const birthYear = row.dateOfBirth ? Number(String(row.dateOfBirth).slice(0, 4)) : null;
      const insurance = String(row.healthInsuranceNumber ?? "").trim().toUpperCase();
      const note = normalize(row.note);

      if ((birthYear && currentYear - birthYear < 18) || insurance.startsWith("TE")) result.under18.push(row);
      else if (insurance.startsWith("DN")) result.dn.push(row);
      else if (note.includes("noi tru")) result.inpatient.push(row);
      else if (note.includes("ngoai tru")) result.outpatient.push(row);
      else result.other.push(row);
    });

    const removeDuplicateInsurance = (items) => {
      const keys = new Set();
      return items.filter((row) => {
        const insurance = String(row.healthInsuranceNumber ?? "").trim().toUpperCase();
        if (!insurance) return true;
        const key = insurance.slice(2);
        if (keys.has(key)) return false;
        keys.add(key);
        return true;
      });
    };

    result.under18Filtered = removeDuplicateInsurance(result.under18);
    result.dnFiltered = removeDuplicateInsurance(result.dn);
    result.inpatientFiltered = removeDuplicateInsurance(result.inpatient);
    result.outpatientFiltered = removeDuplicateInsurance(result.outpatient);

    return result;
  }, [rows]);

  const displayedRows = groups[activeTab] || rows;
  const filteredSourceKeys = { under18Filtered: "under18", dnFiltered: "dn", inpatientFiltered: "inpatient", outpatientFiltered: "outpatient" };
  const filteredSourceKey = filteredSourceKeys[activeTab];
  const removedDuplicateCount = filteredSourceKey ? groups[filteredSourceKey].length - displayedRows.length : 0;

  const search = async (values = filters) => {
    setLoading(true); setMessage("");
    try {
      const params = Object.fromEntries(Object.entries(values).filter(([, value]) => value));
      const res = await api.get("/MedicalRecords", { params });
      setRows(res.data || []);
    } catch { setMessage("Không tải được danh sách y bạ."); }
    finally { setLoading(false); }
  };
  useEffect(() => { search(initialFilters); }, []);

  const reset = () => { setFilters(initialFilters); search(initialFilters); };
  const exportExcel = () => {
    if (!displayedRows.length) return setMessage("Không có dữ liệu để xuất báo cáo.");
    const report = displayedRows.map((row, index) => ({
      "STT": row.sequenceNumber ?? index + 1,
      "Mã định danh (PID)": row.patientId,
      "Họ và tên": row.fullName,
      "Ngày sinh": formatDate(row.dateOfBirth),
      "Giới tính": row.gender,
      "Số điện thoại": row.phoneNumber,
      "Số CCCD": row.citizenId,
      "Số thẻ BHYT": row.healthInsuranceNumber,
      "Địa chỉ": row.address,
      "Ghi chú": row.note,
    }));
    const sheet = XLSX.utils.json_to_sheet(report);
    sheet["!cols"] = [{wch:8},{wch:20},{wch:28},{wch:14},{wch:12},{wch:16},{wch:18},{wch:20},{wch:35},{wch:30}];
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, "Danh sach y ba");
    XLSX.writeFile(workbook, `Bao_cao_y_ba_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const update = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }));
  const tabs = [
    { key: "all", label: "Tổng" },
    { key: "under18", label: "Dưới 18" },
    { key: "dn", label: "DN" },
    { key: "inpatient", label: "Nội trú" },
    { key: "outpatient", label: "Ngoại trú" },
    { key: "other", label: "Khác" },
    { key: "under18Filtered", label: "Dưới 18 lọc" },
    { key: "dnFiltered", label: "DN lọc" },
    { key: "inpatientFiltered", label: "Nội trú lọc" },
    { key: "outpatientFiltered", label: "Ngoại trú lọc" },
  ];
  const headers = ["STT", "Mã định danh (PID)", "Họ và tên", "Ngày sinh", "Giới tính", "Số điện thoại", "Số CCCD", "Số thẻ BHYT", "Địa chỉ", "Ghi chú"];
  return <div className="container-fluid px-0">
    <div className="card shadow-sm mb-4"><div className="card-body">
      <h5 className="fw-bold text-primary mb-3">Tìm kiếm danh sách y bạ</h5>
      <div className="row g-3">
        <div className="col-lg-4"><label className="form-label">Từ khóa</label><input className="form-control" value={filters.keyword} onChange={update("keyword")} placeholder="PID, họ tên, điện thoại, CCCD, BHYT, địa chỉ"/></div>
        <div className="col-lg-2"><label className="form-label">Giới tính</label><input className="form-control" value={filters.gender} onChange={update("gender")} placeholder="Nam/Nữ"/></div>
        <div className="col-lg-3"><label className="form-label">Ngày sinh từ</label><input type="date" className="form-control" value={filters.fromBirthDate} onChange={update("fromBirthDate")}/></div>
        <div className="col-lg-3"><label className="form-label">Ngày sinh đến</label><input type="date" className="form-control" value={filters.toBirthDate} onChange={update("toBirthDate")}/></div>
      </div>
      <div className="d-flex justify-content-end gap-2 mt-3"><button className="btn btn-primary" onClick={() => search()} disabled={loading}>{loading ? "Đang tìm..." : "Tìm kiếm"}</button><button className="btn btn-outline-secondary" onClick={reset}>Làm mới</button><button className="btn btn-success" onClick={exportExcel}>Xuất báo cáo Excel</button></div>
      {message && <div className="alert alert-info mt-3 mb-0">{message}</div>}
    </div></div>
    <div className="card shadow-sm">
      <div className="card-header bg-white p-0">
        <ul className="nav nav-tabs border-0 px-3 pt-3 gap-1">
          {tabs.map((tab) => <li className="nav-item" key={tab.key}><button type="button" className={`nav-link fw-semibold ${activeTab === tab.key ? "active" : ""}`} onClick={() => setActiveTab(tab.key)}>{tab.label} <span className={`badge rounded-pill ms-1 ${activeTab === tab.key ? "bg-primary" : "bg-secondary"}`}>{groups[tab.key].length}</span></button></li>)}
        </ul>
      </div>
      {filteredSourceKey && <div className="px-3 py-2 bg-light border-bottom text-muted">Đã lọc bỏ {removedDuplicateCount} dòng trùng số thẻ BHYT (sau khi bỏ 2 ký tự đầu). Dòng không có BHYT được giữ nguyên.</div>}
      <div className="px-3 py-2 border-bottom fw-semibold">Kết quả: {displayedRows.length} dòng</div><div className="table-responsive"><table className="table table-bordered table-hover align-middle mb-0">
      <thead className="table-secondary text-center"><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
      <tbody>{displayedRows.map((row, index) => <tr key={row.id}><td>{row.sequenceNumber ?? index + 1}</td><td>{row.patientId}</td><td className="fw-semibold">{row.fullName}</td><td>{formatDate(row.dateOfBirth)}</td><td>{row.gender}</td><td>{row.phoneNumber}</td><td>{row.citizenId}</td><td>{row.healthInsuranceNumber}</td><td>{row.address}</td><td>{row.note}</td></tr>)}{!displayedRows.length && <tr><td colSpan="10" className="text-center text-muted py-4">Không có dữ liệu phù hợp</td></tr>}</tbody>
    </table></div></div>
  </div>;
}

export default MedicalRecordListPage;
