import * as XLSX from "xlsx";
import { useEffect, useMemo, useState } from "react";
import api from "./api";
import { useNotification } from "./NotificationProvider";

const columns = [
  ["cccd", "CMND/CCCD"], ["ngaySinh", "Ngày sinh"], ["namSinh", "Năm sinh"],
  ["hoTen", "Họ và Tên"], ["diaChi", "Địa chỉ"], ["soTheBhyt", "Số thẻ BHYT"],
];
const normalize = (value) => String(value ?? "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().trim();
const pageSize = 50;

export default function TanHoaNkListPage() {
  const { confirm } = useNotification();
  const [rows, setRows] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    api.get("/TanHoaNk").then(({ data }) => {
      if (active) setRows(data || []);
    }).catch(() => {
      if (active) setMessage("Không tải được danh sách NK Tân Hòa.");
    }).finally(() => {
      if (active) setBusy(false);
    });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const text = normalize(keyword);
    return text ? rows.filter((row) => columns.some(([key]) => normalize(row[key]).includes(text))) : rows;
  }, [rows, keyword]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const reload = async () => {
    setBusy(true);
    setMessage("");
    try {
      const { data } = await api.get("/TanHoaNk");
      setRows(data || []);
    } catch {
      setMessage("Không tải được danh sách. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  };

  const exportExcel = () => {
    try {
      const report = filtered.map((row) => Object.fromEntries(
        columns.map(([key, label]) => [label, String(row[key] ?? "")])
      ));
      const sheet = XLSX.utils.json_to_sheet(report, { header: columns.map(([, label]) => label) });
      sheet["!cols"] = [{ wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 30 }, { wch: 45 }, { wch: 22 }];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, "Danh sach NK");
      XLSX.writeFile(workbook, `Danh_sach_NK_Tan_Hoa_${new Date().toISOString().slice(0, 10)}.xlsx`);
      setMessage(`Đã xuất ${filtered.length} dòng theo kết quả tìm kiếm.`);
    } catch {
      setMessage("Không xuất được Excel. Vui lòng thử lại.");
    }
  };

  const deleteData = async (row) => {
    setBusy(true);
    try {
      const accepted = await confirm({
        title: row ? "Xóa dòng dữ liệu?" : "Xóa toàn bộ dữ liệu import NK Tân Hòa?",
        message: row
          ? `Xóa dòng của “${row.hoTen || row.cccd || "chưa có họ tên"}”? Không thể hoàn tác.`
          : `Xóa toàn bộ ${rows.length} dòng đã import NK của Tân Hòa, bao gồm các dòng ngoài kết quả tìm kiếm. Không thể hoàn tác.`,
        confirmText: row ? "Xóa" : "Xóa toàn bộ",
      });
      if (!accepted) return;
      const { data } = await api.delete(row ? `/TanHoaNk/${row.id}` : "/TanHoaNk/all");
      setRows((previous) => row ? previous.filter((item) => item.id !== row.id) : []);
      setMessage(`Đã xóa ${data.count} dòng dữ liệu import NK Tân Hòa.`);
    } catch (error) {
      setMessage(error.response?.data?.message || "Không xóa được dữ liệu. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  };

  return <div className="container-fluid px-0">
    <div className="card shadow-sm mb-4"><div className="card-body">
      <h5 className="fw-bold text-primary">Danh sách NK Tân Hòa</h5>
      <p className="text-muted">Dữ liệu đã lưu từ menu Import dữ liệu NK của module Tân Hòa.</p>
      <div className="d-flex gap-2 flex-wrap">
        <input aria-label="Tìm kiếm danh sách NK" className="form-control flex-grow-1" style={{ maxWidth: 600 }}
          placeholder="Tìm theo CMND/CCCD, ngày sinh, năm sinh, họ tên, địa chỉ, số thẻ BHYT..."
          value={keyword} onChange={(event) => { setKeyword(event.target.value); setPage(1); }} />
        <button className="btn btn-outline-secondary" disabled={busy} onClick={reload}>Tải lại</button>
        <button className="btn btn-success" disabled={busy || !filtered.length} onClick={exportExcel}>Xuất Excel</button>
        <button className="btn btn-danger" disabled={busy || !rows.length} onClick={() => deleteData(null)}>Xóa toàn bộ dữ liệu import</button>
      </div>
      {message && <div className="alert alert-info mt-3 mb-0" role="status">{message}</div>}
    </div></div>
    <div className="card shadow-sm">
      <div className="card-header bg-white fw-bold">Kết quả: {filtered.length} / {rows.length} dòng</div>
      <div className="table-responsive"><table className="table table-bordered table-hover table-sm align-middle mb-0">
        <thead className="table-secondary"><tr>{columns.map(([key, label]) => <th key={key}>{label}</th>)}<th>Thao tác</th></tr></thead>
        <tbody>{filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((row) => <tr key={row.id}>
          {columns.map(([key]) => <td key={key}>{row[key]}</td>)}
          <td><button className="btn btn-outline-danger btn-sm" disabled={busy} onClick={() => deleteData(row)}>Xóa</button></td>
        </tr>)}
        {!filtered.length && <tr><td colSpan={7} className="text-center text-muted py-4">{busy ? "Đang tải..." : "Không có dữ liệu"}</td></tr>}</tbody>
      </table></div>
      <div className="card-footer d-flex align-items-center justify-content-between">
        <button className="btn btn-outline-secondary btn-sm" disabled={busy || currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Trước</button>
        <span>Trang {currentPage} / {totalPages}</span>
        <button className="btn btn-outline-secondary btn-sm" disabled={busy || currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>Sau</button>
      </div>
    </div>
  </div>;
}