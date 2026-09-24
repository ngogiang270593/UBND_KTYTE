import { useCallback, useEffect, useRef, useState } from "react";
import api from "./api";
import TablePagination from "./TablePagination";
import { useNotification } from "./NotificationProvider";

const updateTargets = (rows) => [...new Map(rows.flatMap((row) => row.matches)
  .filter((match) => match.canUpdate).map((match) => [match.customerId, match])).values()];

export default function UpdatedAddressTab({ onUpdated }) {
  const { confirm } = useNotification();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const lock = useRef(false);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data } = await api.get("/UpdatedInformation/address-preview");
      setRows(data);
    } catch (err) {
      setRows([]);
      setError(err.response?.data?.message || "Không tải được dữ liệu đối chiếu. Vui lòng tải lại.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => {
    let active = true;
    api.get("/UpdatedInformation/address-preview")
      .then(({ data }) => { if (active) setRows(data); })
      .catch((err) => { if (active) setError(err.response?.data?.message || "Không tải được dữ liệu đối chiếu. Vui lòng tải lại."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const eligible = updateTargets(rows);
  const matchedCount = rows.filter((row) => row.matches.length > 0).length;
  const uniqueMatchedCount = new Set(rows.flatMap((row) => row.matches.map((match) => match.customerId))).size;
  const visibleRows = rows.filter((row) => filter === "all"
    || (filter === "unmatched" && !row.matches.length)
    || (filter === "matched" && row.matches.length > 0)
    || (filter === "eligible" && row.canUpdate)
    || (filter === "duplicate" && row.duplicateCount > 1));
  const update = async (row) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(row ? row.importId : "all");
    try {
      const selected = row ? updateTargets([row]) : eligible;
      if (!selected.length) return;
      if (!row && !await confirm({
        title: "Cập nhật tất cả địa chỉ?",
        message: `Cập nhật địa chỉ cho ${selected.length} hồ sơ khớp căn cước từ toàn bộ danh sách import, bao gồm các trang và bộ lọc khác.`,
        confirmText: "Cập nhật tất cả", danger: false,
      })) return;
      setMessage(""); setError("");
      const { data } = await api.post("/UpdatedInformation/update-addresses", {
        items: selected.map(({ customerId, code, currentAddress, newAddress }) => ({ customerId, code, currentAddress, newAddress })),
      });
      setMessage(data.message);
      await load();
      await onUpdated();
    } catch (err) {
      setError(err.response?.data?.message || "Cập nhật thất bại. Vui lòng tải lại để kiểm tra kết quả.");
    } finally { lock.current = false; setBusy(null); }
  };
  const disabled = loading || busy !== null;
  const currentPage = Math.min(page, Math.max(1, Math.ceil(visibleRows.length / pageSize)));
  return <div>
    <div className="rounded border bg-light p-3 mb-3">
      <h5>Cập nhật địa chỉ qua danh sách cập nhật</h5>
      <p className="text-muted mb-2">Hiển thị từng dòng trong menu Import thông tin cập nhật, gồm cả dòng không khớp và trùng căn cước. Đối chiếu địa chỉ theo căn cước.</p>
      <div className="d-flex flex-wrap gap-3 mb-3" role="status">
        <strong>Tổng import: {rows.length} dòng</strong>
        <span className="text-success">Khớp hồ sơ: {matchedCount} dòng</span>
        <span className="text-danger">Không khớp / thiếu căn cước: {rows.length - matchedCount} dòng</span>
        <span>Hồ sơ khám khớp (không đếm trùng): {uniqueMatchedCount}</span>
      </div>
      <div className="d-flex flex-wrap gap-2 align-items-center">
        <button className="btn btn-primary" disabled={disabled || !eligible.length} onClick={() => update(null)}>{busy === "all" ? "Đang cập nhật..." : `Cập nhật tất cả (${eligible.length} hồ sơ)`}</button>
        <button className="btn btn-outline-secondary" disabled={disabled} onClick={load}>Tải lại đối chiếu</button>
        <select aria-label="Lọc trạng thái đối chiếu" className="form-select w-auto" value={filter} disabled={disabled} onChange={(event) => { setFilter(event.target.value); setPage(1); }}>
          <option value="all">Tất cả dòng import</option><option value="unmatched">Không khớp / thiếu căn cước</option>
          <option value="matched">Khớp hồ sơ</option><option value="eligible">Có thể cập nhật</option><option value="duplicate">Trùng căn cước trong import</option>
        </select>
      </div>
    </div>
    {message && <div className="alert alert-success" role="status">{message}</div>}
    {error && <div className="alert alert-danger" role="alert">{error}</div>}
    <div className="table-responsive"><table className="table table-bordered table-hover align-middle">
      <thead className="table-light"><tr><th>STT import</th><th>Căn cước import</th><th>Họ và tên import</th><th>Địa chỉ import</th><th>Hồ sơ khám / Địa chỉ hiện tại</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
      <tbody>
        {loading ? <tr><td colSpan={7} className="text-center py-4">Đang đối chiếu...</td></tr> :
          visibleRows.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((row) => <tr key={row.importId}>
            <td>{row.stt}</td><td>{row.code || "—"}</td><td>{row.sourceName}</td><td className={row.canUpdate ? "text-success fw-semibold" : ""}>{row.newAddress || "—"}</td>
            <td>{row.matches.length ? row.matches.map((match) => <div key={match.customerId} className="mb-2">
              <strong>{match.name}</strong><div>{match.currentAddress || "Chưa có địa chỉ"}</div>
              {row.matches.length > 1 && <small className="text-muted">Hồ sơ #{match.customerId}: {match.status}</small>}
            </div>) : "—"}</td>
            <td><span className={row.matches.length ? "" : "text-danger"}>{row.status}</span>
              {row.duplicateCount > 1 && <div className="small text-warning-emphasis">Căn cước xuất hiện {row.duplicateCount} dòng import</div>}
              {row.matches.length > 1 && <div className="small text-muted">Khớp {row.matches.length} hồ sơ khám</div>}
            </td>
            <td><button className="btn btn-sm btn-primary text-nowrap" disabled={disabled || !row.canUpdate} onClick={() => update(row)}>{busy === row.importId ? "Đang cập nhật..." : "Cập nhật dòng"}</button></td>
          </tr>)}
        {!loading && !visibleRows.length && <tr><td colSpan={7} className="text-center text-muted py-4">{rows.length ? "Không có dòng import phù hợp bộ lọc." : "Chưa có dữ liệu trong menu Import thông tin cập nhật."}</td></tr>}
      </tbody>
    </table></div>
    <TablePagination total={visibleRows.length} page={currentPage} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} disabled={disabled} />
  </div>;
}
