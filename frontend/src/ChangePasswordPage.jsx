import { useState } from "react";
import api from "./api";

function ChangePasswordPage() {
  const [form, setForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const changePassword = async (e) => {
    e.preventDefault();

    setMessage("");
    setSuccess(false);

    if (form.newPassword !== form.confirmPassword) {
      setMessage("Mật khẩu mới không khớp");
      return;
    }

    try {
      const res = await api.post("/Auth/change-password", {
        oldPassword: form.oldPassword,
        newPassword: form.newPassword,
      });

      setMessage(res.data.message);
      setSuccess(true);

      setForm({
        oldPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err) {
        const data = err.response?.data;

        if (typeof data === "string") {
            setMessage(data);
        } else if (data?.message) {
            setMessage(data.message);
        } else {
            setMessage("Đổi mật khẩu thất bại");
        }
        }
  };

  return (
    <div
      className="container-fluid py-4"
      style={{
        background: "#e8eef7",
        minHeight: "100vh",
      }}
    >
      <div className="row justify-content-center">
        <div className="col-md-5">
          <div className="card border-0 shadow" style={{ borderRadius: "16px" }}>
            <div
              className="card-header text-white"
              style={{
                background: "#1d4ed8",
                borderTopLeftRadius: "16px",
                borderTopRightRadius: "16px",
              }}
            >
              <h4 className="mb-0 fw-bold">ĐỔI MẬT KHẨU</h4>
            </div>

            <div className="card-body">
              {message && (
                <div className={`alert ${success ? "alert-success" : "alert-warning"}`}>
                  {message}
                </div>
              )}

              <form onSubmit={changePassword}>
                <div className="mb-3">
                  <label className="form-label fw-semibold">
                    Mật khẩu cũ
                  </label>
                  <input
                    type="password"
                    name="oldPassword"
                    className="form-control"
                    value={form.oldPassword}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">
                    Mật khẩu mới
                  </label>
                  <input
                    type="password"
                    name="newPassword"
                    className="form-control"
                    value={form.newPassword}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="form-label fw-semibold">
                    Nhập lại mật khẩu mới
                  </label>
                  <input
                    type="password"
                    name="confirmPassword"
                    className="form-control"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    required
                  />
                </div>

                <button className="btn btn-primary w-100">
                  Đổi mật khẩu
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChangePasswordPage;