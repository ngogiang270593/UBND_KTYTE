import { useEffect, useRef, useState } from "react";
import api from "./api";
import { matchesElderlySearch } from "./elderlySearch";
import TablePagination from "./TablePagination";

const dateText = (value) => value ? String(value).slice(0, 10).split("-").reverse().join("/") : "—";

export default function ElderlyProcessingTab({ onRowsLoaded }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState({});
  const lock = useRef(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const load = async () => {
    setLoading(true); setError("");
    try { const { data } = await api.get("/Elderly/review"); setRows(data); onRowsLoaded?.(data); }
    catch (err) { setRows([]); setError(err.response?.data?.message || "Không tải được dữ liệu đối chiếu."); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    let active = true;
    api.get("/Elderly/review")
      .then(({ data }) => { if (active) { setRows(data); onRowsLoaded?.(data); } })
      .catch(() => { if (active) setError("Không tải được dữ liệu đối chiếu."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [onRowsLoaded]);
  const suggestionFor = row => (row.suggestions || []).find(item => `${item.source}:${item.id}` === selected[row.id])
    || (row.suggestions?.length === 1 ? row.suggestions[0] : null);
  const update = async row => {
    const suggestion = suggestionFor(row);
    if (lock.current || !suggestion?.canUpdate) return;
    lock.current = true; setBusy(row.id); setError(""); setMessage("");
    try {
      const { data } = await api.post(`/Elderly/${row.id}/update-information`, {
        source: suggestion.source, sourceId: suggestion.id,
        currentCode: row.cccd, currentAddress: row.diaChi,
        newCode: suggestion.newCode, newAddress: suggestion.newAddress,
      });
      setMessage(data.message);
      await load();
    } catch (err) { setError(err.response?.data?.message || "Cập nhật thất bại. Vui lòng tải lại đối chiếu."); }
    finally { lock.current = false; setBusy(null); }
  };
  const visible = rows.filter(row => matchesElderlySearch(row, search) && (filter === "all"
    || (filter === "matched" && row.matches.length > 0) || (filter === "unmatched" && !row.matches.length)
    || (filter === "multiple" && row.matches.length > 1)));
  const currentPage = Math.min(page, Math.max(1, Math.ceil(visible.length / pageSize)));
  const disabled = loading || busy !== null;
  return <div>
    <div className="rounded border bg-light p-3 mb-3">
      <h5>Xử lí người cao tuổi</h5>
      <p className="text-muted mb-2">Đối chiếu từng dòng import theo thứ tự: Căn cước → Họ tên + Ngày sinh → Họ tên + Năm sinh. Chuyển bước khi không tìm thấy kết quả. Dòng chỉ có năm sinh sẽ bỏ qua bước ngày sinh.</p>
      <div className="d-flex flex-wrap gap-3 mb-3" role="status">
        <strong>Tổng import: {rows.length}</strong>
        <span>Khớp: {rows.filter(row => row.matches.length > 0).length}</span>
        <span>Không khớp: {rows.filter(row => !row.matches.length).length}</span>
      </div>
      <p className="small text-muted">Dòng không khớp được đối chiếu với Đối tượng xã, Nội trú Tân Châu, Ngoại trú Tân Châu, Y bạ và Danh sách NK để cập nhật căn cước, địa chỉ của dòng import.</p>
      <div className="mb-3">
        <label htmlFor="elderly-search" className="form-label">Tìm kiếm theo căn cước, họ và tên, năm sinh</label>
        <input id="elderly-search" type="search" className="form-control" value={search}
          placeholder="Nhập căn cước, họ tên hoặc năm sinh..."
          onChange={event => { setSearch(event.target.value); setPage(1); }} />
        <div className="form-text">Tìm trong danh sách import và hồ sơ khám khớp; hỗ trợ họ tên không dấu.</div>
      </div>
      <div className="mb-2" role="status">Kết quả: {visible.length} / {rows.length} dòng import</div>
      <div className="d-flex flex-wrap gap-2">
        <button className="btn btn-outline-secondary" onClick={load} disabled={disabled}>Tải lại đối chiếu</button>
        <select className="form-select w-auto" aria-label="Lọc kết quả người cao tuổi" value={filter} disabled={disabled} onChange={event => { setFilter(event.target.value); setPage(1); }}>
          <option value="all">Tất cả dòng import</option>
          <option value="matched">Có hồ sơ khớp</option><option value="unmatched">Không khớp</option><option value="multiple">Khớp nhiều hồ sơ</option>
        </select>
      </div>
    </div>
    {message && <div className="alert alert-success" role="status">{message}</div>}
    {error && <div className="alert alert-danger" role="alert">{error}</div>}
    <div className="table-responsive"><table className="table table-bordered table-hover align-middle">
      <thead className="table-light"><tr><th>STT</th><th>Người cao tuổi import</th><th>Ngày sinh / Năm sinh</th><th>Giới tính</th><th>Căn cước</th><th>Địa chỉ</th><th>Ngày khám import</th><th>Hồ sơ khám khớp</th><th>Kết quả đối chiếu</th><th>Cập nhật thông tin từ 5 danh sách</th></tr></thead>
      <tbody>{loading ? <tr><td colSpan={10} className="text-center py-4">Đang đối chiếu...</td></tr> :
        visible.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((row, index) => <tr key={row.id}>
          <td>{(currentPage - 1) * pageSize + index + 1}</td><td>{row.hoTen}</td><td>{row.ngaySinh || row.namSinh || "—"}</td>
          <td>{row.gioiTinh || "—"}</td><td>{row.cccd || "—"}</td><td>{row.diaChi || "—"}</td><td>{row.ngayKham || "—"}</td>
          <td>{row.matches.length ? row.matches.map(match => <div key={match.id} className="border-bottom pb-2 mb-2">
            <strong>{match.name}</strong><div className="small">Hồ sơ #{match.id} · CCCD: {match.code || "—"}</div>
            <div className="small">Sinh: {match.birthDate ? dateText(match.birthDate) : match.taxCode || "—"}</div>
            <div>{match.address || "—"}</div><div className="small">Ngày khám: {dateText(match.examinationDate)}</div>
          </div>) : "—"}</td>
          <td>{row.method || <span className="text-danger">Không tìm thấy hồ sơ khớp</span>}
            {row.matches.length > 1 && <div className="text-warning-emphasis">Khớp {row.matches.length} hồ sơ — cần kiểm tra</div>}</td>
          <td>{row.matches.length ? "—" : row.suggestions?.length ? <>
            <div className="small mb-2">Khớp nguồn theo: {row.sourceMethod}</div>
            <select className="form-select form-select-sm mb-2" aria-label={`Chọn nguồn cập nhật cho ${row.hoTen}`}
              disabled={disabled} value={suggestionFor(row) ? `${suggestionFor(row).source}:${suggestionFor(row).id}` : ""}
              onChange={event => setSelected(current => ({ ...current, [row.id]: event.target.value }))}>
              <option value="">Chọn hồ sơ nguồn ({row.suggestions.length} kết quả)</option>
              {row.suggestions.map(item => <option key={`${item.source}:${item.id}`} value={`${item.source}:${item.id}`}>{item.label} #{item.id} — {item.name} — {item.newCode || "Thiếu căn cước"} — {item.newAddress || "Thiếu địa chỉ"}</option>)}
            </select>
            {suggestionFor(row) && <div className="small mb-2">
              <div>Căn cước: {row.cccd || "Chưa có"} → <strong>{suggestionFor(row).newCode || "Chưa có"}</strong></div>
              <div>Địa chỉ: {row.diaChi || "Chưa có"} → <strong>{suggestionFor(row).newAddress || "Chưa có"}</strong></div>
              {!suggestionFor(row).canUpdate && <div>Thông tin đã trùng với nguồn.</div>}
            </div>}
            <button className="btn btn-sm btn-primary text-nowrap" disabled={disabled || !suggestionFor(row)?.canUpdate} onClick={() => update(row)}>
              {busy === row.id ? "Đang cập nhật..." : "Cập nhật dòng"}
            </button>
          </> : <span className="text-muted">Không tìm thấy thông tin trong 5 danh sách.</span>}</td>
        </tr>)}
        {!loading && !visible.length && <tr><td colSpan={10} className="text-center text-muted py-4">{rows.length ? "Không có dòng phù hợp từ khóa hoặc bộ lọc." : "Chưa có dữ liệu trong menu Import Người Cao Tuổi."}</td></tr>}
      </tbody>
    </table></div>
    <TablePagination total={visible.length} page={currentPage} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={size => { setPageSize(size); setPage(1); }} disabled={disabled} />
  </div>;
}