import { useEffect, useState } from "react";
import api from "./api";
import { useNotification } from "./NotificationProvider";

function PurchaseSheetPage() {
  const { notify, confirm } = useNotification();
  const [customers, setCustomers] = useState([]);
  const [sheets, setSheets] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState(null);

  const [sheetForm, setSheetForm] = useState({
    customerId: "",
    sheetNo: "",
    fromDate: "",
    toDate: "",
  });

  const [detailForm, setDetailForm] = useState({
    date: "",
    waterKg: 0,
    tcs: 0,
    qkKg: 0,
    waterPrice: 0,
    scrapKg: 0,
    scrapPrice: 0,
  });

  const loadCustomers = async () => {
    const res = await api.get("/Customers");
    setCustomers(res.data);
  };

  const loadSheets = async () => {
    const res = await api.get("/PurchaseSheets");
    setSheets(res.data);
  };

  const loadSheetById = async (id) => {
    const res = await api.get(`/PurchaseSheets/${id}`);
    setSelectedSheet(res.data);
  };

  useEffect(() => {
    loadCustomers();
    loadSheets();
  }, []);

  const createSheet = async (e) => {
    e.preventDefault();

    const res = await api.post("/PurchaseSheets", sheetForm);

    setSelectedSheet(res.data);

    setSheetForm({
      customerId: "",
      sheetNo: "",
      fromDate: "",
      toDate: "",
    });

    loadSheets();
  };

  const addDetail = async (e) => {
    e.preventDefault();

    if (!selectedSheet) {
      notify("Vui lòng chọn bảng kê trước.", "warning");
      return;
    }

    await api.post(`/PurchaseSheets/${selectedSheet.id}/details`, detailForm);

    setDetailForm({
      date: "",
      waterKg: 0,
      tcs: 0,
      qkKg: 0,
      waterPrice: 0,
      scrapKg: 0,
      scrapPrice: 0,
    });

    await loadSheetById(selectedSheet.id);
    await loadSheets();
  };

  const deleteDetail = async (detailId) => {
    if (!(await confirm({ title: "Xóa dòng dữ liệu?", message: "Dòng đã xóa sẽ không thể khôi phục.", confirmText: "Xóa dòng" }))) return;

    await api.delete(`/PurchaseSheets/details/${detailId}`);

    await loadSheetById(selectedSheet.id);
    await loadSheets();
  };

  const selectSheet = async (sheet) => {
    await loadSheetById(sheet.id);
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
          className="card-header border-0"
          style={{
            background: "#0f766e",
            color: "white",
            borderTopLeftRadius: "16px",
            borderTopRightRadius: "16px",
            padding: "18px",
          }}
        >
          <h4 className="fw-bold mb-0">BẢNG KÊ THU MUA</h4>
        </div>

        <div className="card-body p-4">
          {/* FORM TẠO BẢNG KÊ */}
          <form onSubmit={createSheet} className="mb-4">
            <div className="row g-3">
              <div className="col-md-3">
                <label className="form-label fw-semibold">Khám sức khỏe</label>

                <select
                  className="form-select"
                  value={sheetForm.customerId}
                  onChange={(e) =>
                    setSheetForm({
                      ...sheetForm,
                      customerId: e.target.value,
                    })
                  }
                  required
                >
                  <option value="">Chọn hồ sơ khám sức khỏe</option>

                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-2">
                <label className="form-label fw-semibold">Số bảng kê</label>

                <input
                  className="form-control"
                  value={sheetForm.sheetNo}
                  onChange={(e) =>
                    setSheetForm({
                      ...sheetForm,
                      sheetNo: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <div className="col-md-2">
                <label className="form-label fw-semibold">Từ ngày</label>

                <input
                  type="date"
                  className="form-control"
                  value={sheetForm.fromDate}
                  onChange={(e) =>
                    setSheetForm({
                      ...sheetForm,
                      fromDate: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <div className="col-md-2">
                <label className="form-label fw-semibold">Đến ngày</label>

                <input
                  type="date"
                  className="form-control"
                  value={sheetForm.toDate}
                  onChange={(e) =>
                    setSheetForm({
                      ...sheetForm,
                      toDate: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <div className="col-md-3 d-flex align-items-end">
                <button className="btn btn-success w-100">Tạo bảng kê</button>
              </div>
            </div>
          </form>

          <div className="row g-4">
            {/* DANH SÁCH BẢNG KÊ */}
            <div className="col-md-4">
              <div className="card border-0 shadow-sm">
                <div className="card-header bg-primary text-white fw-semibold">
                  Danh sách bảng kê
                </div>

                <div
                  className="list-group list-group-flush"
                  style={{
                    maxHeight: "650px",
                    overflowY: "auto",
                  }}
                >
                  {sheets.length === 0 && (
                    <div className="p-3 text-muted text-center">
                      Chưa có bảng kê
                    </div>
                  )}

                  {sheets.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`list-group-item list-group-item-action ${
                        selectedSheet?.id === s.id ? "active" : ""
                      }`}
                      onClick={() => selectSheet(s)}
                    >
                      <div className="fw-bold">{s.sheetNo}</div>

                      <small>{s.customer?.name}</small>

                      <div>
                        <small>
                          Tổng: {Number(s.totalAmount).toLocaleString()} đ
                        </small>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* CHI TIẾT BẢNG KÊ */}
            <div className="col-md-8">
              {!selectedSheet && (
                <div className="alert alert-info">
                  Vui lòng chọn hoặc tạo một bảng kê để nhập chi tiết.
                </div>
              )}

              {selectedSheet && (
                <>
                  <div className="card border-0 shadow-sm mb-4">
                    <div className="card-header bg-white">
                      <div className="fw-bold">
                        Bảng kê: {selectedSheet.sheetNo}
                      </div>
                      <small className="text-muted">
                        Khám sức khỏe: {selectedSheet.customer?.name || ""}
                      </small>
                    </div>
                  </div>

                  {/* FORM THÊM CHI TIẾT */}
                  <form onSubmit={addDetail} className="mb-4">
                    <div className="card border-0 shadow-sm">
                      <div className="card-header bg-success text-white fw-semibold">
                        Thêm chi tiết
                      </div>

                      <div className="card-body">
                        <div className="row g-2">
                          <div className="col-md-2">
                            <label className="form-label small">Ngày</label>
                            <input
                              type="date"
                              className="form-control"
                              value={detailForm.date}
                              onChange={(e) =>
                                setDetailForm({
                                  ...detailForm,
                                  date: e.target.value,
                                })
                              }
                              required
                            />
                          </div>

                          <div className="col-md-2">
                            <label className="form-label small">Kg nước</label>
                            <input
                              type="number"
                              className="form-control"
                              value={detailForm.waterKg}
                              onChange={(e) =>
                                setDetailForm({
                                  ...detailForm,
                                  waterKg: e.target.value,
                                })
                              }
                            />
                          </div>

                          <div className="col-md-1">
                            <label className="form-label small">TCS</label>
                            <input
                              type="number"
                              className="form-control"
                              value={detailForm.tcs}
                              onChange={(e) =>
                                setDetailForm({
                                  ...detailForm,
                                  tcs: e.target.value,
                                })
                              }
                            />
                          </div>

                          <div className="col-md-2">
                            <label className="form-label small">QK</label>
                            <input
                              type="number"
                              className="form-control"
                              value={detailForm.qkKg}
                              onChange={(e) =>
                                setDetailForm({
                                  ...detailForm,
                                  qkKg: e.target.value,
                                })
                              }
                            />
                          </div>

                          <div className="col-md-2">
                            <label className="form-label small">Giá nước</label>
                            <input
                              type="number"
                              className="form-control"
                              value={detailForm.waterPrice}
                              onChange={(e) =>
                                setDetailForm({
                                  ...detailForm,
                                  waterPrice: e.target.value,
                                })
                              }
                            />
                          </div>

                          <div className="col-md-1">
                            <label className="form-label small">Kg tạp</label>
                            <input
                              type="number"
                              className="form-control"
                              value={detailForm.scrapKg}
                              onChange={(e) =>
                                setDetailForm({
                                  ...detailForm,
                                  scrapKg: e.target.value,
                                })
                              }
                            />
                          </div>

                          <div className="col-md-2">
                            <label className="form-label small">Giá tạp</label>
                            <input
                              type="number"
                              className="form-control"
                              value={detailForm.scrapPrice}
                              onChange={(e) =>
                                setDetailForm({
                                  ...detailForm,
                                  scrapPrice: e.target.value,
                                })
                              }
                            />
                          </div>
                        </div>

                        <div className="mt-3 text-end">
                          <button className="btn btn-success">Thêm dòng</button>
                        </div>
                      </div>
                    </div>
                  </form>

                  {/* TABLE CHI TIẾT */}
                  <div className="card border-0 shadow-sm">
                    <div className="card-header bg-dark text-white fw-semibold">
                      Chi tiết bảng kê
                    </div>

                    <div className="table-responsive">
                      <table className="table table-bordered align-middle mb-0">
                        <thead
                          className="text-center"
                          style={{
                            background: "#dbeafe",
                            color: "#1e3a8a",
                          }}
                        >
                          <tr>
                            <th>Ngày</th>
                            <th>Kg nước</th>
                            <th>TCS</th>
                            <th>QK</th>
                            <th>Giá nước</th>
                            <th>Tiền nước</th>
                            <th>Kg tạp</th>
                            <th>Giá tạp</th>
                            <th>Tiền tạp</th>
                            <th>Tổng</th>
                            <th>Thao tác</th>
                          </tr>
                        </thead>

                        <tbody>
                          {selectedSheet.details?.length === 0 && (
                            <tr>
                              <td
                                colSpan="11"
                                className="text-center text-muted py-4"
                              >
                                Chưa có dòng chi tiết
                              </td>
                            </tr>
                          )}

                          {selectedSheet.details?.map((d) => (
                            <tr key={d.id}>
                              <td className="text-center">
                                {new Date(d.date).toLocaleDateString("vi-VN")}
                              </td>

                              <td className="text-end">{d.waterKg}</td>
                              <td className="text-end">{d.tcs}</td>
                              <td className="text-end">{d.qkKg}</td>

                              <td className="text-end">
                                {Number(d.waterPrice).toLocaleString()}
                              </td>

                              <td className="text-end">
                                {Number(d.waterAmount).toLocaleString()}
                              </td>

                              <td className="text-end">{d.scrapKg}</td>

                              <td className="text-end">
                                {Number(d.scrapPrice).toLocaleString()}
                              </td>

                              <td className="text-end">
                                {Number(d.scrapAmount).toLocaleString()}
                              </td>

                              <td className="text-end fw-bold text-danger">
                                {Number(d.totalAmount).toLocaleString()}
                              </td>

                              <td className="text-center">
                                <button
                                  type="button"
                                  className="btn btn-outline-danger btn-sm"
                                  onClick={() => deleteDetail(d.id)}
                                  title="Xóa dòng"
                                >
                                  🗑️
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>

                        <tfoot>
                          <tr
                            style={{
                              background: "#fef3c7",
                            }}
                          >
                            <th colSpan="10" className="text-end">
                              TỔNG CỘNG
                            </th>

                            <th className="text-end text-danger">
                              {Number(selectedSheet.totalAmount).toLocaleString()}
                            </th>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PurchaseSheetPage;
