import { useEffect, useMemo, useState } from "react";
import api from "./api";
import { useNotification } from "./NotificationProvider";

const normalize = (value) => String(value ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase();
const normalizeHamlet = (value) => normalize(value).replace(/\([^)]*\)/g, " ").replace(/^[\s.:;-]*ap\s+/, "").replace(/[\s.:;-]+$/g, "").replace(/\s+/g, " ").trim();
const belongsToHamlet = (address, name) => String(address ?? "").split(/[,;]/).map(normalizeHamlet).some((part) => part === normalizeHamlet(name) || part.startsWith(`${normalizeHamlet(name)} `) || part.endsWith(` ${normalizeHamlet(name)}`));
const customerHamletId = (customer, hamlets) => hamlets.find((hamlet) => belongsToHamlet(customer.address, hamlet.name))?.id ?? null;

const PAGE_SIZE = 20;

function formatDate(value) {
  if (!value) return "—";
  const parts = String(value).slice(0, 10).split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : "—";
}

export default function HealthDataProcessingPage() {
  const { confirm } = useNotification();
  const [customers, setCustomers] = useState([]);
  const [hamlets, setHamlets] = useState([]);
  const [activeTab, setActiveTab] = useState("missing-address");
  const [source, setSource] = useState("all");
  const [matchType, setMatchType] = useState("all");
  const [previews, setPreviews] = useState({});
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [updatingAll, setUpdatingAll] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [message, setMessage] = useState("");
  const [objectTypeRows, setObjectTypeRows] = useState([]);
  const [loadingObjectTypes, setLoadingObjectTypes] = useState(false);
  const [pages, setPages] = useState({ all: 1, address: 1, birth: 1, objectType: 1 });

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await api.get("/PrintVoucher/customers");
      setCustomers(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      setMessage(error.response?.data?.message || "Không tải được data khám sức khỏe.");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    loadData();
    api.get("/CatalogItems", { params: { category: "hamlet" } })
      .then((response) => setHamlets(Array.isArray(response.data) ? response.data : []))
      .catch(() => setMessage("Không tải được danh mục ấp."));
  }, []);

  const loadObjectTypeMismatches = async () => {
    setLoadingObjectTypes(true);
    try {
      const response = await api.get("/PrintVoucher/customers/object-type-mismatches");
      setObjectTypeRows(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      setMessage(error.response?.data?.message || "Không tải được danh sách kiểm tra đối tượng.");
    } finally { setLoadingObjectTypes(false); }
  };

  useEffect(() => {
    if (activeTab === "object-type") loadObjectTypeMismatches();
  }, [activeTab]);

  const missingAddress = useMemo(
    () => customers.filter((customer) => customerHamletId(customer, hamlets) === null),
    [customers, hamlets]
  );
  const missingBirthDate = useMemo(
    () => customers.filter((customer) => !customer.birthDate),
    [customers]
  );
  const processingRows = activeTab === "missing-address" ? missingAddress : missingBirthDate;
  const isProcessingTab = activeTab === "missing-address" || activeTab === "missing-birth-date";
  const visibleRows = isProcessingTab ? processingRows : customers;
  const pageKey = activeTab === 'missing-address' ? 'address' : activeTab === 'missing-birth-date' ? 'birth' : activeTab === 'object-type' ? 'objectType' : 'all';
  const sortedMissingBirthDate = useMemo(
    () =>
      missingBirthDate
        .map((customer, index) => ({
          customer,
          index,
          matched: Boolean(previews[customer.id]?.matched),
        }))
        .sort((first, second) => {
          if (first.matched !== second.matched) {
            return Number(second.matched) - Number(first.matched);
          }

          return first.index - second.index;
        })
        .map(({ customer }) => customer),
    [missingBirthDate, previews]
  );
  const activeRows = activeTab === 'object-type'
    ? objectTypeRows
    : activeTab === 'missing-birth-date'
    ? sortedMissingBirthDate
    : visibleRows;
  const totalPages = Math.max(1, Math.ceil(activeRows.length / PAGE_SIZE));
  const currentPage = Math.min(pages[pageKey], totalPages);
  const pageRows = activeRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const changePage = (page) => setPages((current) => ({ ...current, [pageKey]: Math.max(1, Math.min(totalPages, page)) }));

  useEffect(() => {
    if (pages[pageKey] > totalPages) {
      setPages((current) => ({ ...current, [pageKey]: totalPages }));
    }
  }, [pageKey, pages, totalPages]);

  useEffect(() => {
    if (!isProcessingTab || !processingRows.length) { setPreviews({}); return; }
    let current = true;
    setPreviews({});
    setChecking(true);
    api.post("/PrintVoucher/customers/update-addresses-from-commune-subjects", {
      customerIds: processingRows.map((item) => item.id), previewOnly: true, source, matchType,
    }).then((response) => {
      if (current) setPreviews(Object.fromEntries((response.data.details || []).map((item) => [item.customerId, item])));
    }).catch(() => { if (current) setPreviews({}); })
      .finally(() => { if (current) setChecking(false); });
    return () => { current = false; };
  }, [activeTab, isProcessingTab, processingRows, source, matchType]);

  const updateCustomers = async (customerIds) => {
    const updateMode = activeTab === "missing-birth-date" ? "birth-date" : "address";
    const response = await api.post("/PrintVoucher/customers/update-addresses-from-commune-subjects", {
      customerIds,
      source,
      matchType,
      updateMode,
    });
    setMessage(response.data.message);
    await loadData();
  };

  const updateAll = async () => {
    setUpdatingAll(true); setMessage("");
    try { await updateCustomers(processingRows.map((item) => item.id)); }
    catch (error) { setMessage(error.response?.data?.message || "Cập nhật dữ liệu thất bại."); }
    finally { setUpdatingAll(false); }
  };

  const updateOne = async (customer) => {
    setUpdatingId(customer.id); setMessage("");
    try { await updateCustomers([customer.id]); }
    catch (error) { setMessage(error.response?.data?.message || "Cập nhật dòng dữ liệu thất bại."); }
    finally { setUpdatingId(null); }
  };

  const updateObjectType = async (row) => {
    setUpdatingId(row.customerId); setMessage("");
    try {
      const response = await api.post("/PrintVoucher/customers/update-object-type", {
        customerId: row.customerId,
        communeSubjectId: row.communeSubjectId,
      });
      setMessage(response.data.message);
      setObjectTypeRows((current) => current.filter((item) => item.customerId !== row.customerId));
      await loadData();
    } catch (error) {
      setMessage(error.response?.data?.message || "Cập nhật đối tượng thất bại.");
    } finally { setUpdatingId(null); }
  };

  const updateAllObjectTypes = async () => {
    const confirmed = await confirm({
      title: "Cập nhật tất cả đối tượng?",
      message: `Hệ thống sẽ cập nhật ${objectTypeRows.length} hồ sơ theo Họ tên + Ngày sinh.`,
      confirmText: "Cập nhật tất cả",
    });
    if (!confirmed) return;

    setUpdatingAll(true);
    setMessage("");
    try {
      const response = await api.post("/PrintVoucher/customers/update-object-types", {
        customerIds: objectTypeRows.map((row) => row.customerId),
      });
      setMessage(response.data.message);
      await loadObjectTypeMismatches();
      await loadData();
    } catch (error) {
      setMessage(error.response?.data?.message || "Cập nhật tất cả đối tượng thất bại.");
    } finally {
      setUpdatingAll(false);
    }
  };

  return <div className="container-fluid py-4">
    <div className="card border-0 shadow-sm">
      <div className="card-header bg-white p-4"><h4 className="fw-bold text-primary mb-1">DATA KHÁM SỨC KHỎE</h4><div className="text-muted">Kiểm tra, đối chiếu và hoàn thiện dữ liệu hồ sơ khám sức khỏe.</div></div>
      <div className="card-body p-4">
        {message && <div className="alert alert-info">{message}</div>}
        <ul className="nav nav-tabs mb-4">
          <li className="nav-item"><button className={`nav-link ${activeTab === "all" ? "active" : ""}`} onClick={() => setActiveTab("all")}>Tất cả dữ liệu <span className="badge bg-secondary ms-1">{customers.length}</span></button></li>
          <li className="nav-item"><button className={`nav-link ${activeTab === "missing-address" ? "active" : ""}`} onClick={() => setActiveTab("missing-address")}>Chưa có thông tin <span className="badge bg-warning text-dark ms-1">{missingAddress.length}</span></button></li>
          <li className="nav-item"><button className={`nav-link ${activeTab === "missing-birth-date" ? "active" : ""}`} onClick={() => { setActiveTab("missing-birth-date"); if (matchType === "name-date") setMatchType("all"); }}>Chưa có ngày sinh <span className="badge bg-danger ms-1">{missingBirthDate.length}</span></button></li>
          <li className="nav-item"><button className={`nav-link ${activeTab === "object-type" ? "active" : ""}`} onClick={() => setActiveTab("object-type")}>Kiểm tra đối tượng <span className="badge bg-primary ms-1">{objectTypeRows.length}</span></button></li>
        </ul>

        {isProcessingTab && <div className="rounded border bg-light p-3 mb-4"><div className="row g-3 align-items-end">
          <div className="col-lg-4"><label className="form-label fw-semibold">Loại khớp</label><select className="form-select" value={matchType} onChange={(event) => { setMatchType(event.target.value); setPages((current) => ({ ...current, birth: 1 })); }} disabled={updatingAll || updatingId !== null}><option value="all">{activeTab === "missing-birth-date" ? "Tự động: CCCD → Tên + Năm sinh" : "Tự động: CCCD → Tên + Ngày sinh → Tên + Năm sinh"}</option><option value="cccd">Chỉ khớp CCCD</option>{activeTab !== "missing-birth-date" && <option value="name-date">Chỉ khớp Họ tên + Ngày sinh</option>}<option value="name-year">Chỉ khớp Họ tên + Năm sinh</option></select></div>
          <div className="col-lg-4"><label className="form-label fw-semibold">Nguồn đối chiếu</label><select className="form-select" value={source} onChange={(event) => { setSource(event.target.value); setPages((current) => ({ ...current, birth: 1 })); }} disabled={updatingAll || updatingId !== null}><option value="all">Tất cả 4 danh sách</option><option value="commune">Đối tượng xã</option><option value="inpatient">Nội trú Tân Châu</option><option value="outpatient">Ngoại trú Tân Châu</option><option value="medical">Y bạ</option></select></div>
          <div className="col-lg-4"><button className="btn btn-warning fw-bold w-100" onClick={updateAll} disabled={updatingAll || checking || !processingRows.length}>{updatingAll ? "Đang cập nhật..." : activeTab === "missing-birth-date" ? "Cập nhật tất cả ngày sinh" : "Cập nhật tất cả địa chỉ"}</button></div>
        </div><div className="small text-muted mt-2">{activeTab === "missing-birth-date" ? "Chế độ này chỉ cập nhật ngày sinh, không thay đổi địa chỉ." : "Chế độ này cập nhật địa chỉ và ngày sinh theo thông tin đối chiếu."}</div></div>}

        {activeTab === "object-type" ? <>
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 rounded border bg-light p-3 mb-3">
            <div><div className="fw-bold text-primary">Đối chiếu đối tượng</div><div className="small text-muted">Khớp theo họ tên và ngày sinh, sau đó cập nhật đối tượng mới.</div></div>
            <button className="btn btn-primary fw-bold" onClick={updateAllObjectTypes} disabled={updatingAll || updatingId !== null || loadingObjectTypes || !objectTypeRows.length}>{updatingAll ? "Đang cập nhật..." : "Cập nhật tất cả đối tượng"}</button>
          </div>
          <div className="table-responsive"><table className="table table-bordered table-hover align-middle"><thead className="table-light"><tr><th rowSpan="2" style={{ width: "55px" }}>STT</th><th rowSpan="2" style={{ width: "150px" }}>Thao tác</th><th colSpan="4" className="text-center text-primary">Data khám sức khỏe</th><th colSpan="4" className="text-center text-success">Danh sách đối tượng xã</th></tr><tr><th>Họ tên</th><th>Ngày sinh</th><th>Địa chỉ</th><th>Đối tượng hiện tại</th><th>Họ tên</th><th>Ngày sinh</th><th>Địa chỉ</th><th>Đối tượng mới</th></tr></thead><tbody>
          {pageRows.map((row, index) => <tr key={row.customerId}><td className="text-center fw-semibold">{(currentPage - 1) * PAGE_SIZE + index + 1}</td><td><button className="btn btn-sm btn-primary w-100 text-nowrap" disabled={updatingAll || updatingId !== null} onClick={() => updateObjectType(row)}>{updatingId === row.customerId ? "Đang cập nhật..." : "Cập nhật dòng"}</button></td><td><strong>{row.customerName}</strong><div className="small text-muted">CCCD: {row.code || "—"}</div></td><td>{formatDate(row.customerBirthDate)}</td><td>{row.customerAddress || "—"}</td><td><span className="badge bg-secondary-subtle text-secondary">{row.currentObjectType || "Chưa có"}</span></td><td><strong>{row.subjectName}</strong></td><td>{row.subjectBirthDate || "—"}</td><td>{row.subjectAddress || "—"}</td><td><span className="badge bg-success-subtle text-success-emphasis">{row.newObjectType}</span></td></tr>)}
          {!loadingObjectTypes && !objectTypeRows.length && <tr><td colSpan="10" className="text-center text-muted py-5">Không có hồ sơ khớp Họ tên + Ngày sinh nhưng khác đối tượng.</td></tr>}
          {loadingObjectTypes && <tr><td colSpan="10" className="text-center text-muted py-5">Đang kiểm tra dữ liệu đối tượng...</td></tr>}
        </tbody></table></div></> : <div className="table-responsive"><table className="table table-hover align-middle"><thead className="table-light"><tr><th>STT</th><th>Người khám</th><th>Ngày sinh</th><th>Địa chỉ hiện tại</th>{isProcessingTab && <><th>Thông tin đối chiếu</th><th>Thao tác</th></>}</tr></thead><tbody>
          {pageRows.map((customer, index) => { const preview = previews[customer.id]; const canUpdate = activeTab === "missing-birth-date" ? preview?.birthDateChanged : preview?.addressChanged || preview?.birthDateChanged; return <tr key={customer.id}><td>{(currentPage - 1) * PAGE_SIZE + index + 1}</td><td><strong>{customer.name || "Chưa có họ tên"}</strong><div className="small text-muted">CCCD: {customer.code || "—"}</div></td><td>{formatDate(customer.birthDate)}</td><td>{customer.address || <span className="badge bg-warning-subtle text-warning-emphasis">Chưa có địa chỉ</span>}</td>{isProcessingTab && <><td>{checking && !preview ? <span className="text-muted">Đang kiểm tra...</span> : preview?.matched ? <div className={`alert py-2 mb-0 small ${canUpdate ? "alert-success" : "alert-secondary"}`}><strong>{activeTab === "missing-birth-date" ? preview.newBirthDate || "Không có ngày sinh mới" : preview.newAddress || "Không có địa chỉ mới"}</strong><div>Nguồn: {preview.sourceLabel} · Khớp: {preview.method}</div>{activeTab !== "missing-birth-date" && preview.newBirthDate && <div>Ngày sinh: {preview.newBirthDate}</div>}</div> : <span className="small text-danger">Không tìm thấy thông tin khớp</span>}</td><td><button className="btn btn-sm btn-primary text-nowrap" onClick={() => updateOne(customer)} disabled={!canUpdate || checking || updatingAll || updatingId !== null}>{updatingId === customer.id ? "Đang cập nhật..." : "Cập nhật dòng"}</button></td></>}</tr>; })}
          {!loading && !activeRows.length && <tr><td colSpan={isProcessingTab ? 6 : 4} className="text-center text-muted py-5">Không có dữ liệu phù hợp.</td></tr>}
          {loading && <tr><td colSpan={6} className="text-center text-muted py-5">Đang tải dữ liệu...</td></tr>}
        </tbody></table></div>}
        {totalPages > 1 && <div className="d-flex justify-content-between align-items-center mt-3"><span className="small text-muted">Trang {currentPage}/{totalPages} · {activeRows.length} hồ sơ</span><div className="btn-group"><button className="btn btn-sm btn-outline-secondary" onClick={() => changePage(currentPage - 1)} disabled={currentPage === 1}>Trước</button><button className="btn btn-sm btn-outline-secondary" onClick={() => changePage(currentPage + 1)} disabled={currentPage === totalPages}>Sau</button></div></div>}
      </div>
    </div>
  </div>;
}
