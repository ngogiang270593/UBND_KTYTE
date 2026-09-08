import { useState } from "react";
import api from "./api";

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const res = await api.post("/Auth/login", {
        username,
        password,
      });

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("fullName", res.data.fullName);
      localStorage.setItem("role", res.data.role);

      onLogin(res.data.token);
    } catch {
      setError("Sai tài khoản hoặc mật khẩu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="d-flex justify-content-center align-items-center bg-light"
      style={{ minHeight: "100vh" }}
    >
      <div
        className="card shadow border-0"
        style={{ width: "420px", borderRadius: "15px" }}
      >
        <div className="card-body p-5">

          <div className="text-center mb-4">
            <h2 className="fw-bold text-primary">
              UBND <br/>XÃ TÂN HÒA
            </h2>

            <p className="text-muted mb-0">
              Hệ thống quản lý hồ sơ khám
            </p>
          </div>

          {error && (
            <div className="alert alert-danger">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>

            <div className="mb-3">
              <label className="form-label">
                Tài khoản
              </label>

              <input
                type="text"
                className="form-control"
                placeholder="Nhập tài khoản"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="mb-4">
              <label className="form-label">
                Mật khẩu
              </label>

              <input
                type="password"
                className="form-control"
                placeholder="Nhập mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary w-100"
              disabled={loading}
            >
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>

          </form>

        </div>
      </div>
    </div>
  );
}

export default Login;