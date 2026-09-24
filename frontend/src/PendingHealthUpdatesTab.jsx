import { useState } from "react";
import XLSX from "xlsx-js-style";
import TablePagination from "./TablePagination";
import { dateForImport, searchPendingUpdates, pendingUpdatesWorkbook } from "./pendingHealthUpdates";

export default function PendingHealthUpdatesTab({ rows, loading, error }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [exportError, setExportError] = useState("");
  const filtered = searchPendingUpdates(rows, search);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)));
  const exportExcel = () => {
    setExportError("");
    try { XLSX.writeFile(pendingUpdatesWorkbook(filtered), "DanhSachCanCapNhat_KhamSucKhoe.xlsx"); }
    catch { setExportError("Không xuất được Excel. Vui lòng thử lại."); }
  };
  return <div>
    <h5>Danh sách cần cập nhật</h5>
    <p className="text-muted">Tổng hợp địa chỉ không đúng ấp, chưa có căn cước, chưa có ngày sinh và người cao tuổi không khớp hồ sơ khám. Hồ sơ khám thuộc nhiều nhóm chỉ hiển thị một lần.</p>
    <div className="d-flex flex-wrap gap-2 mb-3">
      <input type="search" className="form-control" style={{maxWidth:520}} aria-label="Tìm danh sách cần cập nhật"
        placeholder="Tìm căn cước, họ tên, năm sinh, địa chỉ..." value={search} onChange={event=>{setSearch(event.target.value);setPage(1);}} />
      <button className="btn btn-success" disabled={loading || !!error || !filtered.length} onClick={exportExcel}>Xuất Excel theo mẫu import ({filtered.length})</button>
    </div>
    <p className="small text-muted">Xuất toàn bộ kết quả tìm kiếm, gồm các trang sau. File gồm 12 cột của mẫu import khám sức khỏe và cột Lý do cần cập nhật ở cuối; thông tin chưa có được để trống.</p>
    {(error || exportError) && <div className="alert alert-danger" role="alert">{error || exportError}</div>}
    <div role="status" className="mb-2">Kết quả: {filtered.length} / {rows.length}</div>
    <div className="table-responsive"><table className="table table-bordered table-hover align-middle">
      <thead className="table-light"><tr><th>STT</th><th>Căn cước</th><th>Họ và tên</th><th>Năm sinh</th><th>Ngày sinh</th><th>Ngày khám</th><th>Địa chỉ</th><th>Nguồn</th><th>Lý do cần cập nhật</th></tr></thead>
      <tbody>{loading ? <tr><td colSpan={9} className="text-center py-4">Đang tổng hợp...</td></tr> :
        filtered.slice((currentPage-1)*pageSize,currentPage*pageSize).map((row,index)=><tr key={row.key}>
          <td>{(currentPage-1)*pageSize+index+1}</td><td>{row.code || "—"}</td><td>{row.name}</td><td>{row.taxCode || "—"}</td>
          <td>{dateForImport(row.birthDate) || "—"}</td><td>{dateForImport(row.examinationDate) || "—"}</td><td>{row.address || "—"}</td><td>{row.source}</td><td>{row.reasons.join("; ")}</td>
        </tr>)}
        {!loading && !filtered.length && <tr><td colSpan={9} className="text-center py-4">Không có hồ sơ phù hợp.</td></tr>}
      </tbody>
    </table></div>
    <TablePagination total={filtered.length} page={currentPage} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={size=>{setPageSize(size);setPage(1);}} disabled={loading} />
  </div>;
}