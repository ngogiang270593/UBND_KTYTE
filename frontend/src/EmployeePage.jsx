import { useEffect, useState } from "react";
import api from "./api";
import { useNotification } from "./NotificationProvider";

function EmployeePage() {
  const { confirm } = useNotification();
  const [employees, setEmployees] = useState([]);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    code: "",
    name: "",
    phone: "",
    address: "",
  });

  const loadEmployees = async () => {
    const res = await api.get("/Employees");
    setEmployees(res.data);
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({ code: "", name: "", phone: "", address: "" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (editingId) {
      await api.put(`/Employees/${editingId}`, form);
    } else {
      await api.post("/Employees", form);
    }

    resetForm();
    loadEmployees();
  };

  const editEmployee = (emp) => {
    setEditingId(emp.id);
    setForm({
      code: emp.code,
      name: emp.name,
      phone: emp.phone,
      address: emp.address,
    });
  };

  const deleteEmployee = async (id) => {
    if (!(await confirm({ title: "Xóa nhân viên?", message: "Dữ liệu đã xóa sẽ không thể khôi phục.", confirmText: "Xóa nhân viên" }))) return;
    await api.delete(`/Employees/${id}`);
    loadEmployees();
  };

  return (
    <div
      className="container-fluid py-4"
      style={{
        background: "#e8eef7",
        minHeight: "100vh",
      }}
    >
      <div
        className="card border-0 shadow"
        style={{
          borderRadius: "16px",
          background: "#f3f6fb",
        }}
      >
        <div
          className="card-header text-center border-0"
          style={{
            background: "#1d4ed8",
            color: "white",
            borderTopLeftRadius: "16px",
            borderTopRightRadius: "16px",
            padding: "18px",
          }}
        >
          <h4 className="fw-bold mb-1 text-uppercase">DANH SÁCH NHÂN VIÊN</h4>
          <div>Quản lý thông tin nhân viên</div>
        </div>

        <div className="card-body p-4">
          <form onSubmit={handleSubmit} className="mb-4">
            <div className="row g-3">
              {[
                ["code", "Mã nhân viên"],
                ["name", "Họ và tên"],
                ["phone", "Số điện thoại"],
                ["address", "Địa chỉ"],
              ].map(([name, label]) => (
                <div className="col-md-3" key={name}>
                  <label className="form-label fw-semibold">{label}</label>
                  <input
                    name={name}
                    className="form-control"
                    value={form[name]}
                    onChange={handleChange}
                    required={name === "code" || name === "name"}
                    style={{
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      height: "42px",
                    }}
                  />
                </div>
              ))}
            </div>

            <div className="mt-4 text-end">
              {editingId && (
                <button
                  type="button"
                  className="btn btn-outline-secondary me-2 px-4"
                  onClick={resetForm}
                >
                  Hủy
                </button>
              )}

              <button type="submit" className="btn btn-primary px-4">
                {editingId ? "Cập nhật" : "Thêm mới"}
              </button>
            </div>
          </form>

          <div
            className="table-responsive"
            style={{
              background: "#edf2f7",
              padding: "14px",
              borderRadius: "14px",
            }}
          >
            <table
              className="table table-bordered align-middle mb-0"
              style={{
                fontSize: "14px",
                background: "#f8fafc",
              }}
            >
              <thead>
                <tr
                  className="text-center"
                  style={{
                    background: "#dbeafe",
                    color: "#1e3a8a",
                    fontWeight: "bold",
                  }}
                >
                  <th style={{ width: "70px" }}>STT</th>
                  <th style={{ width: "150px" }}>Mã NV</th>
                  <th>Họ và tên</th>
                  <th style={{ width: "150px" }}>Số điện thoại</th>
                  <th>Địa chỉ</th>
                  <th style={{ width: "150px" }}>Thao tác</th>
                </tr>
              </thead>

              <tbody>
                {employees.length === 0 && (
                  <tr>
                    <td colSpan="6" className="text-center text-muted py-4">
                      Không có dữ liệu
                    </td>
                  </tr>
                )}

                {employees.map((e, index) => (
                  <tr key={e.id} style={{ background: "#ffffff" }}>
                    <td className="text-center">{index + 1}</td>
                    <td className="text-center fw-semibold">{e.code}</td>
                    <td>{e.name}</td>
                    <td className="text-center">{e.phone}</td>
                    <td>{e.address}</td>

                    <td className="text-center">
                      <button
                        className="btn btn-outline-primary btn-sm me-2"
                        onClick={() => editEmployee(e)}
                        title="Sửa"
                      >
                        ✏️
                      </button>

                      <button
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => deleteEmployee(e.id)}
                        title="Xóa"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmployeePage;
