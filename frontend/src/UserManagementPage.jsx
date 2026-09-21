import { useEffect, useState } from "react";
import api from "./api";
import { appModules } from "./navigationConfig";

const businessModules = appModules.filter((module) => module.id !== "system");
const emptyForm = { username: "", fullName: "", password: "", modules: [] };
const errorMessage = (error) => error.response?.data?.message
  || Object.values(error.response?.data?.errors || {}).flat().join(" ")
  || "Không thể lưu thay đổi. Vui lòng thử lại.";

function ModulePicker({ selected, onChange, disabled = false }) {
  return <div className="row g-2">
    {businessModules.map((module) => <label key={module.id} className="col-md-6">
      <span className="d-flex gap-2 align-items-center border rounded p-3 h-100">
        <input className="form-check-input m-0" type="checkbox" checked={selected.includes(module.id)} disabled={disabled}
          onChange={(event) => onChange(event.target.checked ? [...selected, module.id] : selected.filter((id) => id !== module.id))} />
        <span>{module.icon} {module.title}</span>
      </span>
    </label>)}
  </div>;
}

export default function UserManagementPage() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api.get("/Users").then(({ data }) => {
      if (!cancelled) setUsers(data);
    }).catch((error) => {
      if (!cancelled) setMessage({ type: "danger", text: errorMessage(error) });
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refresh]);

  const createUser = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const { data } = await api.post("/Users", form);
      setUsers((current) => [...current, data]);
      setForm(emptyForm);
      setMessage({ type: "success", text: "Đã tạo tài khoản " + data.username + "." });
    } catch (error) { setMessage({ type: "danger", text: errorMessage(error) }); }
    finally { setBusy(false); }
  };

  const saveAccess = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const { data } = await api.put("/Users/" + editing.id + "/access", {
        modules: editing.modules, isActive: editing.isActive,
      });
      setUsers((current) => current.map((user) => user.id === data.id ? data : user));
      setEditing(null);
      setMessage({ type: "success", text: "Đã cập nhật quyền. Thay đổi có hiệu lực ngay." });
    } catch (error) { setMessage({ type: "danger", text: errorMessage(error) }); }
    finally { setBusy(false); }
  };

  return <section>
    <h2 className="h4 fw-bold">Tài khoản và phân quyền module</h2>
    <p className="text-muted">Chọn các module người dùng được phép sử dụng. Tài khoản chưa được cấp module sẽ chỉ có thể đăng nhập và đổi mật khẩu.</p>
    <p className="small text-muted">Module Thống kê được đọc các nguồn dữ liệu để tổng hợp; Chiến dịch được đọc dữ liệu khám sức khỏe; Xử lý data được đọc và cập nhật dữ liệu khám theo các chức năng của module.</p>
    {message && <div role="alert" className={"alert alert-" + message.type}>{message.text}</div>}
    <div className="card border-0 shadow-sm mb-4"><div className="card-body">
      <h3 className="h5 mb-3">Tạo tài khoản</h3>
      <form onSubmit={createUser}>
        <fieldset disabled={busy || loading}>
          <div className="row g-3 mb-3">
            <label className="col-md-4">Tên đăng nhập
              <input className="form-control mt-1" autoComplete="off" required pattern="[a-zA-Z0-9_.-]{3,50}" title="3–50 ký tự: chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang."
                value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
            </label>
            <label className="col-md-4">Họ và tên
              <input className="form-control mt-1" required maxLength={150} value={form.fullName}
                onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
            </label>
            <label className="col-md-4">Mật khẩu
              <input className="form-control mt-1" type="password" autoComplete="new-password" required minLength={6} maxLength={72}
                value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
            </label>
          </div>
          <div className="fw-semibold mb-2">Module được phép sử dụng</div>
          <ModulePicker selected={form.modules} onChange={(modules) => setForm({ ...form, modules })} />
          <button className="btn btn-primary mt-3" type="submit">{busy ? "Đang lưu..." : "Tạo tài khoản"}</button>
        </fieldset>
      </form>
    </div></div>

    {editing && <div className="card border-primary mb-4"><div className="card-body">
      <h3 className="h5">Phân quyền: {editing.username} — {editing.fullName}</h3>
      <form onSubmit={saveAccess}><fieldset disabled={busy}>
        <label className="d-flex align-items-center gap-2 my-3">
          <input type="checkbox" className="form-check-input m-0" checked={editing.isActive}
            onChange={(event) => setEditing({ ...editing, isActive: event.target.checked })} />
          Tài khoản đang hoạt động
        </label>
        <ModulePicker selected={editing.modules} onChange={(modules) => setEditing({ ...editing, modules })} />
        <div className="d-flex gap-2 mt-3">
          <button type="submit" className="btn btn-primary">Lưu phân quyền</button>
          <button type="button" className="btn btn-outline-secondary" onClick={() => setEditing(null)}>Hủy</button>
        </div>
      </fieldset></form>
    </div></div>}

    <div className="card border-0 shadow-sm"><div className="card-body">
      <div className="d-flex justify-content-between mb-3"><h3 className="h5">Danh sách tài khoản</h3>
        <button className="btn btn-outline-secondary btn-sm" disabled={busy || loading} onClick={() => { setLoading(true); setRefresh((value) => value + 1); }}>Tải lại</button>
      </div>
      {loading ? <p role="status">Đang tải tài khoản...</p> : <div className="table-responsive">
        <table className="table align-middle"><thead><tr><th>Tên đăng nhập</th><th>Họ và tên</th><th>Trạng thái</th><th>Module</th><th>Thao tác</th></tr></thead>
          <tbody>{users.map((user) => <tr key={user.id}>
            <td className="fw-semibold">{user.username}</td><td>{user.fullName}</td>
            <td><span className={"badge " + (user.isActive ? "text-bg-success" : "text-bg-secondary")}>{user.isActive ? "Hoạt động" : "Đã khóa"}</span></td>
            <td>{user.isSystemAdmin ? "Quản trị hệ thống · Toàn quyền" : businessModules.filter((module) => user.modules.includes(module.id)).map((module) => module.title).join(", ") || "Chưa cấp module"}</td>
            <td>{!user.isSystemAdmin && <button className="btn btn-outline-primary btn-sm" disabled={busy}
              onClick={() => { setEditing({ ...user, modules: [...user.modules] }); setMessage(null); }}>Phân quyền</button>}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </div></div>
  </section>;
}

