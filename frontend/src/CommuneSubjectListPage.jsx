import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import api from "./api";

const PAGE_SIZE = 50;
export default function CommuneSubjectListPage() {
  const [summary, setSummary] = useState({ total: 0, groups: [] });
  const [activeTab, setActiveTab] = useState("");
  const [keyword, setKeyword] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => { const timer = setTimeout(() => setSearch(keyword.trim()), 300); return () => clearTimeout(timer); }, [keyword]);
  useEffect(() => { api.get("/CommuneSubjects/summary").then((res) => setSummary(res.data || { total: 0, groups: [] })).catch(() => setMessage("Không tải được thống kê đối tượng xã.")); }, []);
  useEffect(() => { setPage(1); }, [activeTab, search]);
  useEffect(() => {
    let current = true; setLoading(true); setMessage("");
    api.get("/CommuneSubjects/search", { params: { objectType: activeTab || undefined, keyword: search || undefined, page, pageSize: PAGE_SIZE } })
      .then((res) => { if (current) { setRows(res.data.rows || []); setTotal(res.data.total || 0); setTotalPages(res.data.totalPages || 1); } })
      .catch((error) => current && setMessage(error.response?.data?.message || "Không tải được danh sách đối tượng xã."))
      .finally(() => current && setLoading(false));
    return () => { current = false; };
  }, [activeTab, search, page]);

  const exportExcel = async () => {
    if (!total) return setMessage("Không có dữ liệu phù hợp để xuất Excel.");
    setExporting(true); setMessage("");
    try {
      const res = await api.get("/CommuneSubjects/search", { params: { objectType: activeTab || undefined, keyword: search || undefined, page: 1, pageSize: 100000 } });
      const exportRows = res.data.rows || [], today = new Intl.DateTimeFormat("vi-VN").format(new Date());
      const data = [["DANH SÁCH ĐỐI TƯỢNG XÃ", "", "", "", "", ""], [`Phân loại: ${activeTab || "Tất cả"} | Ngày xuất: ${today}`, "", "", "", "", ""], ["STT", "HỌ VÀ TÊN", "NGÀY SINH", "CCCD", "ĐỊA CHỈ", "ĐỐI TƯỢNG"], ...exportRows.map((row, i) => [row.stt || i + 1, row.hoTen, row.ngaySinh, row.cccd, row.diaChi, row.doiTuong])];
      const sheet = XLSX.utils.aoa_to_sheet(data);
      sheet["!merges"] = [XLSX.utils.decode_range("A1:F1"), XLSX.utils.decode_range("A2:F2")]; sheet["!cols"] = [{ wch: 8 }, { wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 48 }, { wch: 26 }]; sheet["!rows"] = [{ hpt: 28 }, { hpt: 20 }, { hpt: 24 }]; sheet["!autofilter"] = { ref: `A3:F${data.length}` };
      const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, "Đối tượng xã");
      XLSX.writeFile(workbook, `Danh_sach_doi_tuong_xa_${activeTab || "Tong"}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (error) { setMessage(error.response?.data?.message || "Xuất Excel thất bại."); } finally { setExporting(false); }
  };

  const tabs = [{ value: "", label: "Tổng", count: summary.total }, ...summary.groups.map((g) => ({ value: g.objectType, label: g.objectType, count: g.count }))];
  return <div className="container-fluid px-0"><div className="card border-0 shadow-sm overflow-hidden" style={{borderRadius:16}}>
    <div className="text-white p-4 d-flex justify-content-between align-items-center flex-wrap gap-3" style={{background:"linear-gradient(135deg,#1d4ed8,#2563eb)"}}><div><h4 className="fw-bold mb-1">Danh sách đối tượng xã</h4><div className="opacity-75">Tra cứu nhanh theo từng nhóm đối tượng</div></div><div className="rounded-3 px-4 py-2 text-center" style={{background:"rgba(255,255,255,.16)"}}><small className="opacity-75">Tổng dữ liệu</small><div className="fs-4 fw-bold">{summary.total.toLocaleString("vi-VN")}</div></div></div>
    <div className="bg-white border-bottom"><div className="nav nav-tabs flex-nowrap overflow-auto px-3 pt-3" style={{scrollbarWidth:"thin"}}>{tabs.map((tab) => <button key={tab.value || "total"} className={`nav-link text-nowrap fw-semibold ${activeTab === tab.value ? "active" : ""}`} onClick={() => setActiveTab(tab.value)}>{tab.label} <span className={`badge rounded-pill ms-1 ${activeTab === tab.value ? "bg-primary" : "bg-secondary"}`}>{tab.count.toLocaleString("vi-VN")}</span></button>)}</div></div>
    <div className="card-body p-4"><div className="row g-3 mb-3"><div className="col-lg-9"><div className="input-group"><span className="input-group-text bg-white">🔎</span><input className="form-control" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Tìm theo họ tên, ngày sinh, CCCD, địa chỉ..." />{keyword && <button className="btn btn-outline-secondary" onClick={() => setKeyword("")}>Xóa tìm kiếm</button>}</div></div><div className="col-lg-3"><button className="btn btn-success w-100" onClick={exportExcel} disabled={!total || exporting}>{exporting ? "Đang xuất..." : "Xuất Excel"}</button></div></div>
      {message && <div className="alert alert-warning">{message}</div>}<div className="d-flex justify-content-between mb-2 text-muted"><span>Có <strong className="text-dark">{total.toLocaleString("vi-VN")}</strong> kết quả</span><span>Trang {page}/{totalPages}</span></div>
      <div className="table-responsive border rounded-3"><table className="table table-hover align-middle mb-0"><thead className="table-light"><tr className="text-center"><th>STT</th><th className="text-start">Họ và tên</th><th>Ngày sinh</th><th>CCCD</th><th className="text-start">Địa chỉ</th><th>Đối tượng</th></tr></thead><tbody>{rows.map((row, i) => <tr key={row.id}><td className="text-center text-muted">{row.stt || (page-1)*PAGE_SIZE+i+1}</td><td className="fw-semibold text-primary">{row.hoTen}</td><td className="text-center">{row.ngaySinh}</td><td className="text-center font-monospace">{row.cccd}</td><td>{row.diaChi}</td><td className="text-center"><span className="badge rounded-pill bg-primary-subtle text-primary border px-3 py-2">{row.doiTuong}</span></td></tr>)}{!loading && !rows.length && <tr><td colSpan="6" className="text-center text-muted py-5">Không có dữ liệu phù hợp</td></tr>}{loading && <tr><td colSpan="6" className="text-center text-muted py-5">Đang tải dữ liệu...</td></tr>}</tbody></table></div>
      {totalPages > 1 && <div className="d-flex justify-content-center align-items-center gap-2 mt-3"><button className="btn btn-outline-primary" disabled={page<=1||loading} onClick={() => setPage(page-1)}>‹ Trang trước</button><span className="px-3 fw-semibold">{page} / {totalPages}</span><button className="btn btn-outline-primary" disabled={page>=totalPages||loading} onClick={() => setPage(page+1)}>Trang sau ›</button></div>}
    </div></div></div>;
}
