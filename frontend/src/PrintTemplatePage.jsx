import { useEffect, useState } from "react";
import api from "./api";
import { useNotification } from "./NotificationProvider";

function PrintTemplatePage() {
  const { confirm } = useNotification();
  const [templates, setTemplates] = useState([]);
  const [templateType, setTemplateType] = useState("PaymentVoucher");
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");

  const loadTemplates = async () => {
    const res = await api.get("/PrintTemplates");
    setTemplates(res.data);
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const uploadTemplate = async (e) => {
    e.preventDefault();

    if (!file) {
      setMessage("Vui lòng chọn file mẫu");
      return;
    }

    const formData = new FormData();
    formData.append("templateType", templateType);
    formData.append("file", file);

    await api.post("/PrintTemplates/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    setFile(null);
    setMessage("Upload mẫu thành công. Mẫu cũ cùng loại đã được thay thế.");

    await loadTemplates();
  };
  const downloadTemplate = async (id, fileName) => {
    const res = await api.get(`/PrintTemplates/download/${id}`, {
      responseType: "blob",
    });

    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement("a");

    link.href = url;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.URL.revokeObjectURL(url);
  };

  const deleteTemplate = async (id) => {
    if (!(await confirm({ title: "Xóa mẫu in?", message: "Mẫu in đã xóa sẽ không thể khôi phục.", confirmText: "Xóa mẫu" }))) return;

    await api.delete(`/PrintTemplates/${id}`);
    await loadTemplates();
  };

  const getTypeName = (type) => {
    if (type === "PaymentVoucher") return "Phiếu chi";
    if (type === "PurchaseSheet") return "Phiếu chi tờ";
    return type;
  };

  return (
    <div className="container-fluid py-4" style={{ background: "#e8eef7", minHeight: "100vh" }}>
      <div className="card border-0 shadow" style={{ borderRadius: "16px" }}>
        <div className="card-header text-white" style={{ background: "#7c3aed" }}>
          <h4 className="mb-0 fw-bold">QUẢN LÝ MẪU IN</h4>
        </div>

        <div className="card-body">
          {message && <div className="alert alert-info">{message}</div>}

          <form onSubmit={uploadTemplate} className="mb-4">
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label fw-semibold">Loại mẫu</label>
                <select
                  className="form-select"
                  value={templateType}
                  onChange={(e) => setTemplateType(e.target.value)}
                >
                  <option value="PaymentVoucher">Phiếu chi</option>
                  <option value="PurchaseSheet">Phiếu chi tờ</option>
                </select>
              </div>

              <div className="col-md-5">
                <label className="form-label fw-semibold">File mẫu Excel</label>
                <input
                  type="file"
                  className="form-control"
                  accept=".xlsx,.xlsm"
                  onChange={(e) => setFile(e.target.files[0])}
                  required
                />
              </div>

              <div className="col-md-3 d-flex align-items-end">
                <button className="btn btn-primary w-100">
                  Upload / Thay mẫu
                </button>
              </div>
            </div>
          </form>

          <h5 className="fw-bold">Danh sách mẫu hiện có</h5>

          <div className="table-responsive">
            <table className="table table-bordered align-middle">
              <thead className="table-secondary text-center">
                <tr>
                  <th>STT</th>
                  <th>Loại mẫu</th>
                  <th>File gốc</th>
                  <th>Ngày upload</th>
                  <th>Thao tác</th>
                </tr>
              </thead>

              <tbody>
                {templates.map((t, i) => (
                  <tr key={t.id}>
                    <td className="text-center">{i + 1}</td>
                    <td>{getTypeName(t.templateType)}</td>
                    <td>{t.fileName}</td>
                    <td>{new Date(t.uploadedAt).toLocaleString("vi-VN")}</td>
                    <td className="text-center">
                      <button className="btn btn-outline-primary btn-sm me-2"onClick={() => downloadTemplate(t.id, t.fileName)}>
                        👁️
                      </button>

                      <button
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => deleteTemplate(t.id)}
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}

                {templates.length === 0 && (
                  <tr>
                    <td colSpan="5" className="text-center text-muted py-4">
                      Chưa có mẫu in
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="alert alert-warning mt-3">
            Mỗi loại mẫu chỉ có 1 file duy nhất. Upload lại sẽ thay mẫu cũ.
          </div>
        </div>
      </div>
    </div>
  );
}

export default PrintTemplatePage;
