import { useEffect, useState } from "react";
import api from "./api";
import { useNotification } from "./NotificationProvider";
import "./TnbqCatalogPage.css";

const blankCommune = { name: "", code: "", province: "", isDefault: false };
const blankHamlet = { name: "", code: "", isDefault: false };

export default function TnbqCatalogPage() {
  const { confirm, notify } = useNotification();
  const [communes, setCommunes] = useState([]);
  const [hamlets, setHamlets] = useState([]);
  const [communeId, setCommuneId] = useState("");
  const [communeForm, setCommuneForm] = useState(blankCommune);
  const [hamletForm, setHamletForm] = useState(blankHamlet);
  const [editingCommune, setEditingCommune] = useState(null);
  const [editingHamlet, setEditingHamlet] = useState(null);
  const [loading, setLoading] = useState(false);
  const [catalogTab, setCatalogTab] = useState("commune");
  const selectedCommune = communes.find((item) => item.id === Number(communeId));

  const loadCommunes = async () => {
    const { data } = await api.get("/TnbqCatalog/communes");
    setCommunes(data);
    setCommuneId((current) => current || String(data.find((item) => item.isDefault)?.id || data[0]?.id || ""));
  };
  const loadHamlets = async (id) => {
    if (!id) return setHamlets([]);
    const { data } = await api.get("/TnbqCatalog/hamlets", { params: { communeId: id } });
    setHamlets(data);
  };
  const reload = async () => {
    setLoading(true);
    try { await loadCommunes(); } catch (error) { notify(error.response?.data?.message || "Không thể tải danh mục xã.", "error"); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    let cancelled = false;
    api.get("/TnbqCatalog/communes").then(({ data }) => {
      if (cancelled) return;
      setCommunes(data);
      setCommuneId((current) => current || String(data.find((item) => item.isDefault)?.id || data[0]?.id || ""));
    }).catch((error) => {
      if (!cancelled) notify(error.response?.data?.message || "Không thể tải danh mục xã.", "error");
    });
    return () => { cancelled = true; };
  // Danh mục được tải một lần khi mở trang.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    const request = communeId ? api.get("/TnbqCatalog/hamlets", { params: { communeId } }) : Promise.resolve({ data: [] });
    request.then(({ data }) => {
      if (!cancelled) setHamlets(data);
    }).catch((error) => {
      if (!cancelled) notify(error.response?.data?.message || "Không thể tải danh mục ấp.", "error");
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communeId]);

  const saveCommune = async (event) => {
    event.preventDefault();
    try {
      const { data } = editingCommune ? await api.put("/TnbqCatalog/communes/" + editingCommune.id, communeForm) : await api.post("/TnbqCatalog/communes", communeForm);
      notify(editingCommune ? "Đã cập nhật xã." : "Đã thêm xã.", "success");
      setCommuneForm(blankCommune); setEditingCommune(null); await loadCommunes(); setCommuneId(String(data.id));
    } catch (error) { notify(error.response?.data?.message || "Không thể lưu xã.", "error"); }
  };
  const saveHamlet = async (event) => {
    event.preventDefault(); if (!communeId) return;
    try {
      const payload = { ...hamletForm, communeId: Number(communeId) };
      await (editingHamlet ? api.put("/TnbqCatalog/hamlets/" + editingHamlet.id, payload) : api.post("/TnbqCatalog/hamlets", payload));
      notify(editingHamlet ? "Đã cập nhật ấp." : "Đã thêm ấp.", "success");
      setHamletForm(blankHamlet); setEditingHamlet(null); await loadHamlets(communeId);
    } catch (error) { notify(error.response?.data?.message || "Không thể lưu ấp.", "error"); }
  };
  const removeCommune = async (item) => {
    if (!(await confirm({ title: "Xóa xã?", message: "Xóa xã “" + item.name + "” và toàn bộ ấp thuộc xã này?", confirmText: "Xóa" }))) return;
    try { await api.delete("/TnbqCatalog/communes/" + item.id); notify("Đã xóa xã.", "success"); setHamlets([]); setCommuneId(""); await loadCommunes(); }
    catch (error) { notify(error.response?.data?.message || "Không thể xóa xã.", "error"); }
  };
  const removeHamlet = async (item) => {
    if (!(await confirm({ title: "Xóa ấp?", message: "Xóa ấp “" + item.name + "”?", confirmText: "Xóa" }))) return;
    try { await api.delete("/TnbqCatalog/hamlets/" + item.id); notify("Đã xóa ấp.", "success"); await loadHamlets(communeId); }
    catch (error) { notify(error.response?.data?.message || "Không thể xóa ấp.", "error"); }
  };
  const cancelCommune = () => { setEditingCommune(null); setCommuneForm(blankCommune); };
  const cancelHamlet = () => { setEditingHamlet(null); setHamletForm(blankHamlet); };

  return <section className="tnbq-catalog">
    <header className="tnbq-catalog-heading">
      <div><span>THỐNG KÊ TNBQ</span><h2>Danh mục địa bàn</h2><p>Khai báo xã và ấp dùng khi lập phiếu thu thập.</p></div>
      <button className="btn btn-outline-secondary" type="button" onClick={reload} disabled={loading}>Tải lại</button>
    </header>

    <div className="tnbq-catalog-tabs" role="tablist" aria-label="Danh mục địa bàn">
      <button type="button" role="tab" id="tnbq-catalog-tab-commune" aria-controls="tnbq-catalog-panel-commune" aria-selected={catalogTab === "commune"} className={catalogTab === "commune" ? "active" : ""} onClick={() => setCatalogTab("commune")}>
        <span>1</span>Danh mục xã <strong>{communes.length}</strong>
      </button>
      <button type="button" role="tab" id="tnbq-catalog-tab-hamlet" aria-controls="tnbq-catalog-panel-hamlet" aria-selected={catalogTab === "hamlet"} className={catalogTab === "hamlet" ? "active" : ""} onClick={() => setCatalogTab("hamlet")}>
        <span>2</span>Danh mục ấp <strong>{hamlets.length}</strong>
      </button>
    </div>

    <section hidden={catalogTab !== "commune"} id="tnbq-catalog-panel-commune" role="tabpanel" aria-labelledby="tnbq-catalog-tab-commune" className="tnbq-catalog-card">
      <div className="tnbq-catalog-title"><div><h3>Danh mục xã</h3><p>Tên xã, mã xã, tỉnh và lựa chọn mặc định.</p></div><span className="badge text-bg-primary">{communes.length}</span></div>
      <form onSubmit={saveCommune} className="tnbq-catalog-form">
        <label>Tên xã<input className="form-control" required maxLength={150} value={communeForm.name} onChange={(event) => setCommuneForm({ ...communeForm, name: event.target.value })} /></label>
        <label>Mã xã<input className="form-control" required maxLength={20} value={communeForm.code} onChange={(event) => setCommuneForm({ ...communeForm, code: event.target.value })} /></label>
        <label>Tỉnh/thành phố<input className="form-control" required maxLength={150} value={communeForm.province} onChange={(event) => setCommuneForm({ ...communeForm, province: event.target.value })} /></label>
        <label className="form-check tnbq-catalog-default"><input className="form-check-input" type="checkbox" checked={communeForm.isDefault} onChange={(event) => setCommuneForm({ ...communeForm, isDefault: event.target.checked })} />Đặt làm xã mặc định</label>
        <div className="d-flex gap-2"><button className="btn btn-primary" type="submit">{editingCommune ? "Lưu xã" : "Thêm xã"}</button>{editingCommune && <button className="btn btn-light border" type="button" onClick={cancelCommune}>Hủy</button>}</div>
      </form>
      <CatalogTable columns={["Xã", "Mã", "Tỉnh"]} count={4} empty="Chưa có xã." loading={loading}>
        {communes.map((item) => <tr key={item.id} className={item.isDefault ? "tnbq-default-row" : ""}><td className="fw-semibold">{item.name}{item.isDefault && <span className="badge text-bg-success ms-2">Mặc định</span>}</td><td>{item.code}</td><td>{item.province}</td><td className="text-end text-nowrap"><button className="btn btn-sm btn-outline-primary me-1" type="button" onClick={() => { setEditingCommune(item); setCommuneForm(item); }}>Sửa</button><button className="btn btn-sm btn-outline-danger" type="button" onClick={() => removeCommune(item)}>Xóa</button></td></tr>)}
      </CatalogTable>
    </section>

    <section hidden={catalogTab !== "hamlet"} id="tnbq-catalog-panel-hamlet" role="tabpanel" aria-labelledby="tnbq-catalog-tab-hamlet" className="tnbq-catalog-card">
      <div className="tnbq-catalog-title"><div><h3>Danh mục ấp</h3><p>Chọn xã, khai báo tên ấp, mã ấp và mặc định.</p></div><span className="badge text-bg-primary">{hamlets.length}</span></div>
      <label className="tnbq-commune-picker">Chọn xã<select className="form-select" value={communeId} onChange={(event) => { setCommuneId(event.target.value); cancelHamlet(); }}><option value="">-- Chọn xã --</option>{communes.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.code}</option>)}</select></label>
      {selectedCommune ? <><form onSubmit={saveHamlet} className="tnbq-catalog-form">
        <label>Tên ấp<input className="form-control" required maxLength={150} value={hamletForm.name} onChange={(event) => setHamletForm({ ...hamletForm, name: event.target.value })} /></label>
        <label>Mã ấp<input className="form-control" required maxLength={20} value={hamletForm.code} onChange={(event) => setHamletForm({ ...hamletForm, code: event.target.value })} /></label>
        <label className="form-check tnbq-catalog-default"><input className="form-check-input" type="checkbox" checked={hamletForm.isDefault} onChange={(event) => setHamletForm({ ...hamletForm, isDefault: event.target.checked })} />Đặt làm ấp mặc định cho {selectedCommune.name}</label>
        <div className="d-flex gap-2"><button className="btn btn-primary" type="submit">{editingHamlet ? "Lưu ấp" : "Thêm ấp"}</button>{editingHamlet && <button className="btn btn-light border" type="button" onClick={cancelHamlet}>Hủy</button>}</div>
      </form><CatalogTable columns={["Ấp", "Mã"]} count={3} empty="Chưa có ấp." loading={loading}>
        {hamlets.map((item) => <tr key={item.id} className={item.isDefault ? "tnbq-default-row" : ""}><td className="fw-semibold">{item.name}{item.isDefault && <span className="badge text-bg-success ms-2">Mặc định</span>}</td><td>{item.code}</td><td className="text-end text-nowrap"><button className="btn btn-sm btn-outline-primary me-1" type="button" onClick={() => { setEditingHamlet(item); setHamletForm(item); }}>Sửa</button><button className="btn btn-sm btn-outline-danger" type="button" onClick={() => removeHamlet(item)}>Xóa</button></td></tr>)}
      </CatalogTable></> : <div className="tnbq-empty-state">Thêm hoặc chọn một xã để quản lý danh mục ấp.</div>}
    </section>
  </section>;
}

function CatalogTable({ columns, count, empty, loading, children }) {
  const hasRows = Array.isArray(children) && children.length > 0;
  return <div className="table-responsive"><table className="table table-hover align-middle mb-0"><thead><tr>{columns.map((name) => <th key={name}>{name}</th>)}<th></th></tr></thead><tbody>{children}{!loading && !hasRows && <tr><td colSpan={count} className="text-center text-muted py-4">{empty}</td></tr>}</tbody></table></div>;
}
