import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import api from "./api";

const columns = [
  ["stt","STT"], ["hoTen","HO_TEN"], ["soCccd","SO_CCCD"], ["ngaySinh","NGAY_SINH"],
  ["gioiTinh","GIOI_TINH"], ["maQuocTich","MA_QUOCTICH"], ["maDanToc","MA_DANTOC"], ["diaChi","DIA_CHI"],
  ["maHuyenCuTru","MAHUYEN_CU_TRU"], ["maXaCuTru","MAXA_CU_TRU"], ["dienThoai","DIEN_THOAI"],
  ["maTheBhyt","MA_THE_BHYT"], ["maDkbd","MA_DKBD"], ["gtTheTu","GT_THE_TU"], ["gtTheDen","GT_THE_DEN"],
  ["ngayMienCct","NGAY_MIEN_CCT"], ["lyDoVv","LY_DO_VV"], ["lyDoVnt","LY_DO_VNT"],
  ["maLyDoVnt","MA_LY_DO_VNT"], ["chanDoanVao","CHAN_DOAN_VAO"], ["chanDoanRv","CHAN_DOAN_RV"],
  ["maBenhChinh","MA_BENH_CHINH"], ["maBenhKt","MA_BENH_KT"], ["maBenhYhct","MA_BENH_YHCT"],
  ["maPtttQt","MA_PTTT_QT"], ["maNoiDi","MA_NOI_DI"], ["maNoiDen","MA_NOI_DEN"], ["soNgayDtri","SO_NGAY_DTRI"],
];

const normalize = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().trim();

function TanChauInpatientListPage() {
  const [rows, setRows] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true); setMessage("");
    try { const res = await api.get("/TanChauInpatient"); setRows(res.data || []); }
    catch { setMessage("Không tải được danh sách nội trú Tân Châu."); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filteredRows = useMemo(() => {
    const searchText = normalize(appliedKeyword);
    if (!searchText) return rows;
    return rows.filter((row) => columns.some(([key]) => normalize(row[key]).includes(searchText)));
  }, [rows, appliedKeyword]);

  const search = () => setAppliedKeyword(keyword);
  const reset = () => { setKeyword(""); setAppliedKeyword(""); setMessage(""); };
  const exportExcel = () => {
    if (!filteredRows.length) return setMessage("Không có dữ liệu để xuất Excel.");
    const report = filteredRows.map((row) => Object.fromEntries(columns.map(([key, label]) => [label, row[key] ?? ""])));
    const sheet = XLSX.utils.json_to_sheet(report, { header: columns.map(([, label]) => label) });
    sheet["!cols"] = columns.map(([, label]) => ({ wch: Math.max(14, label.length + 2) }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Noi tru Tan Chau");
    XLSX.writeFile(workbook, `Danh_sach_noi_tru_Tan_Chau_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return <div className="container-fluid px-0">
    <div className="card shadow-sm mb-4"><div className="card-body">
      <h5 className="fw-bold text-primary mb-3">Danh sách nội trú Tân Châu</h5>
      <div className="row g-2 align-items-end">
        <div className="col-lg-8"><label className="form-label fw-semibold">Tìm kiếm</label><input className="form-control" value={keyword} onChange={(event) => setKeyword(event.target.value)} onKeyDown={(event) => event.key === "Enter" && search()} placeholder="Nhập họ tên, CCCD, BHYT, địa chỉ, chẩn đoán hoặc dữ liệu bất kỳ..."/></div>
        <div className="col-lg-4 d-flex gap-2"><button className="btn btn-primary" onClick={search}>Tìm kiếm</button><button className="btn btn-outline-secondary" onClick={reset}>Làm mới</button><button className="btn btn-success" onClick={exportExcel}>Xuất Excel</button></div>
      </div>
      {message && <div className="alert alert-info mt-3 mb-0">{message}</div>}
    </div></div>
    <div className="card shadow-sm"><div className="card-header bg-white fw-bold">Kết quả: {filteredRows.length}/{rows.length} dòng</div><div className="table-responsive"><table className="table table-bordered table-hover table-sm align-middle mb-0">
      <thead className="table-secondary text-center"><tr>{columns.map(([,label]) => <th key={label} style={{whiteSpace:"nowrap"}}>{label}</th>)}</tr></thead>
      <tbody>{filteredRows.map((row,index) => <tr key={row.id || index}>{columns.map(([key]) => <td key={key} style={{whiteSpace:"nowrap"}}>{row[key]}</td>)}</tr>)}{!filteredRows.length && <tr><td colSpan={columns.length} className="text-center text-muted py-4">{loading ? "Đang tải dữ liệu..." : "Không có dữ liệu phù hợp"}</td></tr>}</tbody>
    </table></div></div>
  </div>;
}

export default TanChauInpatientListPage;
