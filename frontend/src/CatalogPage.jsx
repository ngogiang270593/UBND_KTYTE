import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import api from "./api";
import { useNotification } from "./NotificationProvider";

const catalogs = [
  { key: "objectType", label: "Đối tượng" },
  { key: "occupation", label: "Nghề nghiệp" },
  { key: "hamlet", label: "Ấp" },
  { key: "group", label: "Tổ" },
  { key: "examinationPlace", label: "Nơi khám" },
];

const categoriesWithDefault = ["objectType", "hamlet", "group"];

function CatalogPage() {
  const { confirm, notify } = useNotification();
  const importInputRef = useRef(null);
  const [category, setCategory] = useState("objectType");
  const [items, setItems] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const current = catalogs.find((item) => item.key === category);

  const load = async (nextCategory = category, nextKeyword = keyword) => {
    setLoading(true);
    try {
      const response = await api.get("/CatalogItems", { params: { category: nextCategory, keyword: nextKeyword.trim() || undefined } });
      setItems(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      notify(error.response?.data?.message || "Không tải được danh mục.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [category]);

  const switchCategory = (nextCategory) => {
    setCategory(nextCategory);
    setKeyword("");
    setName("");
    setIsDefault(false);
    setEditing(null);
  };

  const save = async (event) => {
    event.preventDefault();
    if (!name.trim()) return;
    try {
      if (editing) {
        await api.put(`/CatalogItems/${editing.id}`, { category, name: name.trim(), isDefault });
        notify("Đã cập nhật danh mục.", "success");
      } else {
        await api.post("/CatalogItems", { category, name: name.trim(), isDefault });
        notify("Đã thêm danh mục.", "success");
      }
      setName("");
      setIsDefault(false);
      setEditing(null);
      load();
    } catch (error) {
      notify(error.response?.data?.message || "Không thể lưu danh mục.", "error");
    }
  };

  const remove = async (item) => {
    if (!(await confirm({ title: "Xóa danh mục?", message: `Xóa “${item.name}”? Thao tác này không thể hoàn tác.`, confirmText: "Xóa" }))) return;
    try {
      await api.delete(`/CatalogItems/${item.id}`);
      notify("Đã xóa danh mục.", "success");
      load();
    } catch (error) {
      notify(error.response?.data?.message || "Không thể xóa danh mục.", "error");
    }
  };

  const exportAll = async () => {
    setExporting(true);
    try {
      const responses = await Promise.all(catalogs.map((item) => api.get("/CatalogItems", { params: { category: item.key } })));
      const workbook = XLSX.utils.book_new();
      catalogs.forEach((catalog, index) => {
        const rows = Array.isArray(responses[index].data) ? responses[index].data : [];
        const sheet = XLSX.utils.json_to_sheet(rows.map((item, rowIndex) => ({
          "STT": rowIndex + 1,
          "Tên danh mục": item.name,
          "Mặc định": item.isDefault ? "Có" : "Không",
        })));
        sheet["!cols"] = [{ wch: 8 }, { wch: 35 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(workbook, sheet, catalog.label.slice(0, 31));
      });
      XLSX.writeFile(workbook, `Danh_muc_kham_suc_khoe_${new Date().toISOString().slice(0, 10)}.xlsx`);
      notify("Đã xuất toàn bộ danh mục ra Excel.", "success");
    } catch (error) {
      notify(error.response?.data?.message || "Không thể xuất toàn bộ danh mục.", "error");
    } finally {
      setExporting(false);
    }
  };

  const normalizeImportValue = (value) => String(value ?? "").trim();

  const importAll = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImporting(true);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
      const rowsByCategory = new Map();
      catalogs.forEach((catalog) => {
        const sheet = workbook.Sheets[catalog.label] || workbook.Sheets[catalog.key];
        if (!sheet) return;
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
        rowsByCategory.set(catalog.key, rows.slice(1).map((row) => ({
          name: normalizeImportValue(row[1]),
          isDefault: normalizeImportValue(row[2]).toLowerCase() === "có",
        })).filter((row) => row.name));
      });

      if (!rowsByCategory.size) throw new Error("File không có sheet danh mục hợp lệ.");

      const existingResponses = await Promise.all(catalogs.map((item) => api.get("/CatalogItems", { params: { category: item.key } })));
      const existingByCategory = new Map(catalogs.map((item, index) => [item.key, new Set((existingResponses[index].data || []).map((row) => row.name.trim().toLocaleLowerCase()))]));
      let added = 0;
      let skipped = 0;
      for (const catalog of catalogs) {
        const existing = existingByCategory.get(catalog.key);
        for (const row of rowsByCategory.get(catalog.key) || []) {
          const normalizedName = row.name.toLocaleLowerCase();
          if (existing.has(normalizedName)) {
            skipped += 1;
            continue;
          }
          await api.post("/CatalogItems", { category: catalog.key, name: row.name, isDefault: row.isDefault });
          existing.add(normalizedName);
          added += 1;
        }
      }
      await load();
      notify(`Đã nhập ${added} mục danh mục; bỏ qua ${skipped} mục đã tồn tại.`, "success");
    } catch (error) {
      notify(error.response?.data?.message || error.message || "Không thể nhập toàn bộ danh mục.", "error");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="container-fluid py-2">
      <div className="card border-0 shadow-sm" style={{ borderRadius: "16px" }}>
        <div className="card-header text-white" style={{ background: "#1d4ed8", padding: "18px 22px" }}>
          <h4 className="mb-1 fw-bold">QUẢN LÝ DANH MỤC</h4>
          <small>Thêm, tìm kiếm, sửa và xóa danh mục dùng cho khám sức khỏe</small>
        </div>
        <div className="card-body p-4">
          <div className="d-flex flex-wrap gap-2 mb-4">
            <button className="btn btn-success" type="button" onClick={exportAll} disabled={exporting || importing}>
              {exporting ? "Đang xuất..." : "Xuất all danh mục"}
            </button>
            <button className="btn btn-outline-success" type="button" onClick={() => importInputRef.current?.click()} disabled={exporting || importing}>
              {importing ? "Đang nhập..." : "Import all danh mục"}
            </button>
            <input ref={importInputRef} type="file" accept=".xlsx,.xls" className="d-none" onChange={importAll} />
          </div>
          <div className="btn-group mb-4" role="group">
            {catalogs.map((item) => <button key={item.key} type="button" className={`btn ${category === item.key ? "btn-primary" : "btn-outline-primary"}`} onClick={() => switchCategory(item.key)}>{item.label}</button>)}
          </div>

          <div className="row g-4">
            <div className="col-lg-4">
              <div className="card border-0 bg-light h-100">
                <div className="card-body">
                  <h5 className="fw-bold mb-3">{editing ? `Sửa ${current.label}` : `Thêm ${current.label}`}</h5>
                  <form onSubmit={save}>
                    <label className="form-label fw-semibold">Tên {current.label.toLowerCase()}</label>
                    <input className="form-control" value={name} onChange={(event) => setName(event.target.value)} placeholder={`Nhập ${current.label.toLowerCase()}`} autoFocus />
                    {categoriesWithDefault.includes(category) && <div className="form-check mt-3"><input id="catalog-default" className="form-check-input" type="checkbox" checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} /><label className="form-check-label" htmlFor="catalog-default">Đặt làm {current.label.toLowerCase()} mặc định</label></div>}
                    <div className="d-flex gap-2 mt-3">
                      <button className="btn btn-primary" type="submit">{editing ? "Lưu thay đổi" : "Thêm mới"}</button>
                      {editing && <button className="btn btn-outline-secondary" type="button" onClick={() => { setEditing(null); setName(""); setIsDefault(false); }}>Hủy</button>}
                    </div>
                  </form>
                </div>
              </div>
            </div>
            <div className="col-lg-8">
              <div className="d-flex gap-2 mb-3">
                <input className="form-control" value={keyword} onChange={(event) => setKeyword(event.target.value)} onKeyDown={(event) => event.key === "Enter" && load()} placeholder={`Tìm kiếm ${current.label.toLowerCase()}`} />
                <button className="btn btn-primary text-nowrap" type="button" onClick={() => load()}>Tìm kiếm</button>
                <button className="btn btn-outline-secondary text-nowrap" type="button" onClick={() => { setKeyword(""); load(category, ""); }}>Làm mới</button>
              </div>
              <div className="table-responsive border rounded">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light"><tr><th style={{ width: 70 }}>STT</th><th>{current.label}</th>{categoriesWithDefault.includes(category) && <th className="text-center" style={{ width: 110 }}>Mặc định</th>}<th className="text-center" style={{ width: 150 }}>Thao tác</th></tr></thead>
                  <tbody>
                    {items.map((item, index) => <tr key={item.id}><td>{index + 1}</td><td className="fw-semibold">{item.name}</td>{categoriesWithDefault.includes(category) && <td className="text-center">{item.isDefault ? "✓" : ""}</td>}<td className="text-center"><button className="btn btn-sm btn-outline-primary me-2" onClick={() => { setEditing(item); setName(item.name); setIsDefault(Boolean(item.isDefault)); }}>Sửa</button><button className="btn btn-sm btn-outline-danger" onClick={() => remove(item)}>Xóa</button></td></tr>)}
                    {!loading && items.length === 0 && <tr><td colSpan={categoriesWithDefault.includes(category) ? "4" : "3"} className="text-center text-muted py-4">Không có dữ liệu</td></tr>}
                    {loading && <tr><td colSpan={categoriesWithDefault.includes(category) ? "4" : "3"} className="text-center text-muted py-4">Đang tải...</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CatalogPage;
