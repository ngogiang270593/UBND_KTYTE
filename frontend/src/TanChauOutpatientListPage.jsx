import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import api from "./api";

const columns = [["hoTen","Họ và tên"], ["namSinh","Năm sinh"], ["gioiTinh","Giới tính"], ["cccd","CCCD"], ["diaChi","Địa chỉ"]];
const normalize = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().trim();

function TanChauOutpatientListPage() {
  const [rows, setRows] = useState([]), [keyword, setKeyword] = useState(""), [appliedKeyword, setAppliedKeyword] = useState(""), [loading, setLoading] = useState(false), [message, setMessage] = useState("");
  useEffect(() => { (async () => { setLoading(true); try { const res = await api.get("/TanChauOutpatient"); setRows(res.data || []); } catch { setMessage("Không tải được danh sách ngoại trú Tân Châu."); } finally { setLoading(false); } })(); }, []);
  const filteredRows = useMemo(() => { const text = normalize(appliedKeyword); return text ? rows.filter((row) => columns.some(([key]) => normalize(row[key]).includes(text))) : rows; }, [rows, appliedKeyword]);
  const exportExcel = () => {
    if (!filteredRows.length) return setMessage("Không có dữ liệu để xuất Excel.");
    const report = filteredRows.map((row) => Object.fromEntries(columns.map(([key, label]) => [label, row[key] ?? ""])));
    const sheet = XLSX.utils.json_to_sheet(report, { header: columns.map(([, label]) => label) }); sheet["!cols"] = [{wch:30}, {wch:12}, {wch:12}, {wch:18}, {wch:45}];
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, "Ngoai tru Tan Chau"); XLSX.writeFile(workbook, `Danh_sach_ngoai_tru_Tan_Chau_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };
  return <div className="container-fluid px-0"><div className="card shadow-sm mb-4"><div className="card-body"><h5 className="fw-bold text-primary mb-3">Danh sách ngoại trú Tân Châu</h5><div className="row g-2 align-items-end"><div className="col-lg-8"><label className="form-label fw-semibold">Tìm kiếm</label><input className="form-control" value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setAppliedKeyword(keyword)} placeholder="Nhập họ tên, năm sinh, giới tính, CCCD hoặc địa chỉ..."/></div><div className="col-lg-4 d-flex gap-2"><button className="btn btn-primary" onClick={() => setAppliedKeyword(keyword)}>Tìm kiếm</button><button className="btn btn-outline-secondary" onClick={() => { setKeyword(""); setAppliedKeyword(""); setMessage(""); }}>Làm mới</button><button className="btn btn-success" onClick={exportExcel}>Xuất Excel</button></div></div>{message && <div className="alert alert-info mt-3 mb-0">{message}</div>}</div></div>
    <div className="card shadow-sm"><div className="card-header bg-white fw-bold">Kết quả: {filteredRows.length}/{rows.length} dòng</div><div className="table-responsive"><table className="table table-bordered table-hover table-sm align-middle mb-0"><thead className="table-secondary text-center"><tr>{columns.map(([,label]) => <th key={label}>{label}</th>)}</tr></thead><tbody>{filteredRows.map((row,index) => <tr key={row.id || index}>{columns.map(([key]) => <td key={key}>{row[key]}</td>)}</tr>)}{!filteredRows.length && <tr><td colSpan={columns.length} className="text-center text-muted py-4">{loading ? "Đang tải dữ liệu..." : "Không có dữ liệu phù hợp"}</td></tr>}</tbody></table></div></div></div>;
}

export default TanChauOutpatientListPage;
