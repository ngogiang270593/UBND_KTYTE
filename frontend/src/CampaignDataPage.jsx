import { useEffect, useState } from "react";
import api from "./api";
import { useNotification } from "./NotificationProvider";

function CampaignDataPage() {
  const { notify } = useNotification();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get("/CatalogItems", { params: { category: "hamlet" } }),
      api.get("/CampaignStats"),
    ]).then(([hamletResponse, statResponse]) => {
      const stats = Array.isArray(statResponse.data) ? statResponse.data : [];
      setRows((Array.isArray(hamletResponse.data) ? hamletResponse.data : []).map((hamlet) => {
        const stat = stats.find((item) => item.hamletId === hamlet.id);
        return { hamletId: hamlet.id, hamletName: hamlet.name, targetCount: stat?.targetCount || 0, informationIssuedCount: stat?.informationIssuedCount || 0 };
      }));
    }).catch(() => notify("Không thể tải số liệu chiến dịch.", "error")).finally(() => setLoading(false));
  }, []);

  const change = (hamletId, field, value) => setRows((current) => current.map((row) => row.hamletId === hamletId ? { ...row, [field]: Math.max(0, Number(value) || 0) } : row));
  const save = async () => {
    setSaving(true);
    try {
      await api.put("/CampaignStats", rows.map(({ hamletId, targetCount, informationIssuedCount }) => ({ hamletId, targetCount, informationIssuedCount })));
      notify("Đã lưu số liệu chiến dịch.", "success");
    } catch { notify("Không thể lưu số liệu chiến dịch.", "error"); }
    finally { setSaving(false); }
  };

  return <div className="card border-0 shadow-sm" style={{ borderRadius: 16, overflow: "hidden" }}>
    <div className="d-flex justify-content-between align-items-center text-white px-4 py-3" style={{ background: "#174e35" }}>
      <div><h4 className="fw-bold mb-1">NHẬP SỐ LIỆU CHIẾN DỊCH</h4><small>Cập nhật chỉ tiêu và số giấy thông tin đã phát cho từng ấp</small></div>
      <button className="btn btn-warning fw-bold px-4" onClick={save} disabled={saving || loading}>{saving ? "Đang lưu..." : "Lưu số liệu"}</button>
    </div>
    <div className="p-4">
      <div className="table-responsive border rounded-3">
        <table className="table table-hover align-middle mb-0">
          <thead className="table-light"><tr><th className="text-center" style={{ width: 80 }}>STT</th><th>Tên khu phố / ấp</th><th className="text-center" style={{ width: 240 }}>Tổng số<br/><small>(chỉ tiêu chiến dịch)</small></th><th className="text-center" style={{ width: 260 }}>Số người đã được<br/>phát giấy thông tin</th></tr></thead>
          <tbody>{rows.map((row, index) => <tr key={row.hamletId}><td className="text-center fw-bold">{index + 1}</td><td className="fw-semibold">{row.hamletName}</td><td><input className="form-control text-center fw-bold" type="number" min="0" value={row.targetCount} onChange={(event) => change(row.hamletId, "targetCount", event.target.value)} /></td><td><input className="form-control text-center fw-bold" type="number" min="0" value={row.informationIssuedCount} onChange={(event) => change(row.hamletId, "informationIssuedCount", event.target.value)} /></td></tr>)}</tbody>
        </table>
        {!loading && !rows.length && <div className="text-center text-muted py-5">Chưa có danh mục ấp. Vui lòng thêm trong phần Danh mục.</div>}
        {loading && <div className="text-center text-muted py-5">Đang tải dữ liệu...</div>}
      </div>
    </div>
  </div>;
}

export default CampaignDataPage;
