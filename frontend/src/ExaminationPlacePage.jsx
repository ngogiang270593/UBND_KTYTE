import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import api from "./api";
import TablePagination from "./TablePagination";
import { groupHealthRecords } from "./healthObjectStatistics";

const normalize = (value) => String(value ?? "").trim().toLocaleLowerCase("vi-VN");

const formatDate = (value) => {
  if (!value) return "";
  const [year, month, day] = String(value).substring(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : String(value);
};

function ExaminationPlacePage({ initialPlace = null }) {
  const [customers, setCustomers] = useState([]);
  const [places, setPlaces] = useState([]);
  const [activeTab, setActiveTab] = useState(initialPlace);
  const [keyword, setKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadData = async () => {
    setLoading(true);
    setMessage("");
    try {
      const [customerResponse, placeResponse] = await Promise.all([
        api.get("/Customers"),
        api.get("/CatalogItems", { params: { category: "examinationPlace" } }),
      ]);
      setCustomers(Array.isArray(customerResponse.data) ? customerResponse.data : []);
      setPlaces(Array.isArray(placeResponse.data) ? placeResponse.data : []);
    } catch (error) {
      setMessage(error.response?.data?.message || "Không tải được danh sách nơi khám.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(loadData);
  }, []);

  const groups = useMemo(() => groupHealthRecords(customers, places, "examinationPlace", true), [customers, places]);
  const tabs = [{ key: null, label: "Tổng", records: customers }, ...groups];
  const activePlace = groups.find((place) => place.key === activeTab);
  const selectedTab = activePlace ? activePlace.key : null;
  const filteredRows = useMemo(() => {
    const search = normalize(appliedKeyword);
    const records = activePlace ? activePlace.records : customers;
    return records.filter((customer) => !search || normalize([
      customer.code,
      customer.name,
      customer.examinationPlace,
      customer.objectType,
      customer.address,
      customer.occupation,
    ].join(" ")).includes(search));
  }, [activePlace, appliedKeyword, customers]);
  const searchRows = () => {
    setAppliedKeyword(keyword.trim());
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const rows = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  const exportExcel = () => {
    if (!filteredRows.length) {
      setMessage("Không có dữ liệu phù hợp để xuất Excel.");
      return;
    }

    setExporting(true);
    setMessage("");
    try {
      const report = filteredRows.map((customer, index) => ({
        STT: index + 1,
        "Căn cước": customer.code,
        "Ngày cấp CCCD": formatDate(customer.citizenIdIssueDate),
        "Họ và tên": customer.name,
        "Năm sinh": customer.taxCode,
        "Ngày khám": formatDate(customer.examinationDate),
        "Nơi khám": customer.examinationPlace || "Chưa xác định",
        "Đối tượng": customer.objectType,
        "Số điện thoại": customer.phoneNumber,
        "Địa chỉ": customer.address,
        "Nghề nghiệp": customer.occupation,
      }));
      const sheet = XLSX.utils.json_to_sheet(report);
      sheet["!cols"] = [
        { wch: 8 }, { wch: 18 }, { wch: 16 }, { wch: 28 }, { wch: 12 },
        { wch: 16 }, { wch: 26 }, { wch: 20 }, { wch: 16 }, { wch: 42 }, { wch: 24 },
      ];
      sheet["!autofilter"] = { ref: `A1:K${report.length + 1}` };
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, "Noi kham");
      const tabName = selectedTab === null ? "Tong" : (activePlace?.label || "Noi_kham");
      XLSX.writeFile(workbook, `Danh_sach_noi_kham_${tabName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="container-fluid py-4">
      <div className="card border-0 shadow-sm">
        <div className="card-header bg-primary text-white p-4">
          <h4 className="fw-bold mb-1">TK Nơi khám</h4>
          <div className="opacity-75">Tìm kiếm và xuất danh sách theo từng nơi khám.</div>
        </div>
        <div className="card-body p-4">
          <div className="d-flex flex-wrap gap-2 mb-4" role="group" aria-label="TK Nơi khám">
            {tabs.map((tab) => (
              <button
                key={tab.key === null ? "total" : `place:${tab.key}`}
                type="button"
                className={`btn ${selectedTab === tab.key ? "btn-primary" : "btn-outline-primary"}`}
                aria-pressed={selectedTab === tab.key}
                onClick={() => { setActiveTab(tab.key); setPage(1); }}
              >
                {tab.label}
                <span className="badge bg-light text-primary ms-2">
                  {tab.records.length.toLocaleString("vi-VN")}
                </span>
              </button>
            ))}
          </div>

          <div className="row g-2 align-items-end mb-3">
            <div className="col-lg-8">
              <label className="form-label fw-semibold">Tìm kiếm trong tab hiện tại</label>
              <input
                type="search"
                className="form-control"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && searchRows()}
                placeholder="Căn cước, họ tên, nơi khám, đối tượng, địa chỉ..."
              />
            </div>
            <div className="col-lg-4 d-flex gap-2">
              <button type="button" className="btn btn-primary flex-fill" onClick={searchRows} disabled={loading}>Tìm kiếm</button>
              <button type="button" className="btn btn-outline-secondary flex-fill" onClick={() => { setKeyword(""); setAppliedKeyword(""); }} disabled={loading}>Làm mới</button>
              <button type="button" className="btn btn-success flex-fill" onClick={exportExcel} disabled={loading || exporting || !filteredRows.length}>{exporting ? "Đang xuất..." : "Xuất Excel"}</button>
            </div>
          </div>

          {message && <div className="alert alert-info">{message}</div>}
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="text-muted">{loading ? "Đang tải..." : `${filteredRows.length} hồ sơ`}</span>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={loadData} disabled={loading}>Tải lại</button>
          </div>
          <div className="table-responsive">
            <table className="table table-bordered table-hover align-middle mb-0">
              <thead className="table-light text-center">
                <tr><th>STT</th><th>Căn cước</th><th>Ngày cấp CCCD</th><th>Họ và tên</th><th>Năm sinh</th><th>Ngày khám</th><th>Nơi khám</th><th>Đối tượng</th><th>Địa chỉ</th></tr>
              </thead>
              <tbody>
                {rows.map((customer, index) => (
                  <tr key={customer.id}>
                    <td className="text-center">{(safePage - 1) * pageSize + index + 1}</td>
                    <td className="text-center fw-semibold">{customer.code}</td>
                    <td className="text-center">{formatDate(customer.citizenIdIssueDate)}</td>
                    <td className="fw-semibold">{customer.name}</td>
                    <td className="text-center">{customer.taxCode}</td>
                    <td className="text-center">{formatDate(customer.examinationDate)}</td>
                    <td>{customer.examinationPlace || "Chưa xác định"}</td>
                    <td>{customer.objectType}</td>
                    <td>{customer.address}</td>
                  </tr>
                ))}
                {!loading && filteredRows.length === 0 && <tr><td colSpan="9" className="text-center text-muted py-4">Không có dữ liệu</td></tr>}
              </tbody>
            </table>
          </div>
          <TablePagination total={filteredRows.length} page={safePage} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} disabled={loading} />
        </div>
      </div>
    </div>
  );
}

export default ExaminationPlacePage;
