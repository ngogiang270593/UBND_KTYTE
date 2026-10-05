import { useCallback, useEffect, useMemo, useState } from "react";
import api from "./api";
import { useNotification } from "./NotificationProvider";

const currentYear = new Date().getFullYear();
const getErrorMessage = (error) => error.response?.data?.message
  || "Không thể hoàn tất thao tác danh mục năm. Vui lòng thử lại.";

export default function OfficeMeetingCatalogPage() {
  const { confirm, notify } = useNotification();
  const [items, setItems] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [year, setYear] = useState("");
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/OfficeMeetingYears");
      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      notify(getErrorMessage(error), "error");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    let cancelled = false;
    api.get("/OfficeMeetingYears")
      .then(({ data }) => { if (!cancelled) setItems(Array.isArray(data) ? data : []); })
      .catch((error) => { if (!cancelled) notify(getErrorMessage(error), "error"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [notify]);

  const visibleItems = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase("vi-VN");
    return [...items]
      .filter((item) => !normalizedKeyword || String(item.name).toLocaleLowerCase("vi-VN").includes(normalizedKeyword))
      .sort((first, second) => Number(second.name) - Number(first.name));
  }, [items, keyword]);

  const resetForm = () => {
    setYear("");
    setEditing(null);
  };

  const save = async (event) => {
    event.preventDefault();
    const numericYear = Number(year);
    if (!/^\d{4}$/.test(year) || !Number.isInteger(numericYear) || numericYear < 1 || numericYear > 9999) {
      notify("Vui lòng nhập năm hợp lệ gồm 4 chữ số.", "warning");
      return;
    }

    setSaving(true);
    try {
      const payload = { name: year };
      if (editing) {
        await api.put(`/OfficeMeetingYears/${editing.id}`, payload);
        notify("Đã cập nhật năm.", "success");
      } else {
        await api.post("/OfficeMeetingYears", payload);
        notify("Đã thêm năm.", "success");
      }
      resetForm();
      await load();
    } catch (error) {
      notify(getErrorMessage(error), "error");
    } finally {
      setSaving(false);
    }
  };

  const edit = (item) => {
    setEditing(item);
    setYear(String(item.name));
  };

  const remove = async (item) => {
    if (!(await confirm({
      title: "Xóa năm?",
      message: `Xóa năm ${item.name} khỏi danh mục? Năm này sẽ không còn là lựa chọn trong bộ lọc cuộc họp.`,
      confirmText: "Xóa năm",
    }))) return;

    try {
      await api.delete(`/OfficeMeetingYears/${item.id}`);
      if (editing?.id === item.id) resetForm();
      notify(`Đã xóa năm ${item.name}.`, "success");
      await load();
    } catch (error) {
      notify(getErrorMessage(error), "error");
    }
  };

  return (
    <section className="container-fluid py-2">
      <div className="d-flex align-items-start gap-3 mb-4">
        <span className="d-inline-flex align-items-center justify-content-center rounded-3 text-primary bg-primary-subtle"
          style={{ width: 48, height: 48, fontSize: 24 }} aria-hidden="true">📚</span>
        <div>
          <div className="badge rounded-pill text-bg-primary mb-2">VĂN PHÒNG</div>
          <h2 className="h3 fw-bold mb-1">Danh mục năm</h2>
          <p className="text-muted mb-0">Quản lý năm sử dụng trong điều kiện tìm kiếm cuộc họp. Quý 1–4 là danh mục cố định.</p>
        </div>
      </div>

      <div className="card border-0 shadow-sm overflow-hidden">
        <div className="card-header bg-white border-0 p-4 pb-3">
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
            <div>
              <h3 className="h5 fw-bold mb-1">Danh sách năm</h3>
              <div className="small text-muted">{items.length.toLocaleString("vi-VN")} năm trong danh mục</div>
            </div>
            <button type="button" className="btn btn-outline-primary btn-sm" onClick={load} disabled={loading || saving}>
              {loading ? "Đang tải..." : "Tải lại"}
            </button>
          </div>
        </div>

        <div className="card-body border-top p-4">
          <div className="row g-4">
            <div className="col-lg-4">
              <div className="rounded-3 border bg-light p-3 p-lg-4">
                <h4 className="h6 fw-bold mb-3">{editing ? `Sửa năm ${editing.name}` : "Thêm năm"}</h4>
                <form onSubmit={save}>
                  <label htmlFor="office-meeting-catalog-year" className="form-label fw-semibold">Năm</label>
                  <input id="office-meeting-catalog-year" className="form-control" type="number" required
                    min="1000" max="9999" step="1" inputMode="numeric" placeholder={`Ví dụ: ${currentYear}`}
                    value={year} onChange={(event) => setYear(event.target.value)} disabled={saving} />
                  <div className="form-text">Năm hiện tại được chọn mặc định khi tìm kiếm cuộc họp.</div>
                  <div className="d-flex gap-2 mt-3">
                    <button className="btn btn-primary flex-grow-1" type="submit" disabled={saving || loading}>
                      {saving ? "Đang lưu..." : editing ? "Lưu thay đổi" : "Thêm năm"}
                    </button>
                    {editing && <button type="button" className="btn btn-outline-secondary" onClick={resetForm} disabled={saving}>Hủy</button>}
                  </div>
                </form>
              </div>
            </div>

            <div className="col-lg-8">
              <label htmlFor="office-meeting-catalog-search" className="form-label fw-semibold">Tìm kiếm năm</label>
              <div className="input-group mb-3">
                <span className="input-group-text bg-white" aria-hidden="true">⌕</span>
                <input id="office-meeting-catalog-search" type="search" className="form-control"
                  placeholder="Nhập năm cần tìm" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
                {keyword && <button type="button" className="btn btn-outline-secondary" onClick={() => setKeyword("")}>Xóa</button>}
              </div>
              {loading ? <div className="text-center text-muted py-5" role="status">
                <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />Đang tải danh mục năm...
              </div> : <div className="table-responsive border rounded-3">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th scope="col" className="ps-3">Năm</th>
                      <th scope="col">Trạng thái</th>
                      <th scope="col" className="text-end pe-3">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleItems.map((item) => (
                      <tr key={item.id}>
                        <th scope="row" className="ps-3">{item.name}</th>
                        <td>{Number(item.name) === currentYear
                          ? <span className="badge text-bg-primary-subtle text-primary">Năm hiện tại</span>
                          : <span className="text-muted small">Năm trong danh mục</span>}</td>
                        <td className="text-end pe-3 text-nowrap">
                          <button type="button" className="btn btn-outline-primary btn-sm me-2"
                            onClick={() => edit(item)} disabled={saving}>Sửa</button>
                          <button type="button" className="btn btn-outline-danger btn-sm"
                            onClick={() => remove(item)} disabled={saving}>Xóa</button>
                        </td>
                      </tr>
                    ))}
                    {!visibleItems.length && <tr><td colSpan="3" className="text-center text-muted py-5">
                      {items.length ? "Không tìm thấy năm phù hợp." : "Chưa có năm trong danh mục. Thêm năm để dùng trong bộ lọc."}
                    </td></tr>}
                  </tbody>
                </table>
              </div>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
