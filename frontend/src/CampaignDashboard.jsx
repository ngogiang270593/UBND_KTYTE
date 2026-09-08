import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import api from "./api";
import "./CampaignDashboard.css";
import "./CampaignDashboardRefined.css";
import "./CampaignDashboardDecorations.css";
import doctorFamilyHero from "./assets/campaign/doctor-family-hero.png";
import motivationSprites from "./assets/campaign/motivation-sprites.png";
import healthMarkIcon from "./assets/campaign/health-mark-icon.png";

const normalize = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().trim();
const normalizeHamlet = (value) => normalize(value).replace(/^ap\s*/, "").replace(/\s+/g, " ").trim();
const addressBelongsToHamlet = (address, hamletName) => {
  const expected = normalizeHamlet(hamletName);
  return Boolean(expected) && String(address ?? "").split(",").map(normalizeHamlet).some((part) => part === expected);
};
const localDateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const assetToDataUrl = async (url) => {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

function CampaignDashboard() {
  const reportRef = useRef(null);
  const [customers, setCustomers] = useState([]);
  const [hamlets, setHamlets] = useState([]);
  const [campaignStats, setCampaignStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get("/Customers"),
      api.get("/CatalogItems", { params: { category: "hamlet" } }),
      api.get("/CampaignStats"),
    ])
      .then(([customerResponse, hamletResponse, statResponse]) => {
        setCustomers(Array.isArray(customerResponse.data) ? customerResponse.data : []);
        setHamlets(Array.isArray(hamletResponse.data) ? hamletResponse.data : []);
        setCampaignStats(Array.isArray(statResponse.data) ? statResponse.data : []);
      })
      .catch(() => { setCustomers([]); setHamlets([]); setCampaignStats([]); })
      .finally(() => setLoading(false));
  }, []);

  const rows = useMemo(() => {
    const groups = new Map(hamlets.map((item) => [item.id, { id: item.id, area: item.name, examined: 0, today: 0 }]));
    const todayKey = localDateKey();
    customers.forEach((person) => {
      const catalogHamlet = hamlets.find((item) => addressBelongsToHamlet(person.address, item.name))
        || hamlets.find((item) => normalizeHamlet(item.name) === normalizeHamlet(person.hamlet));
      if (!catalogHamlet) return;
      const current = groups.get(catalogHamlet.id);
      current.examined += 1;
      if (String(person.examinationDate || "").slice(0, 10) === todayKey) current.today += 1;
    });
    return [...groups.values()]
      .map((row) => {
        const stat = campaignStats.find((item) => item.hamletId === row.id);
        const target = stat?.targetCount || 0;
        return { ...row, target, issued: stat?.informationIssuedCount || 0, rate: target ? Math.min(100, row.examined / target * 100) : 0 };
      })
      .sort((a, b) => b.rate - a.rate || b.examined - a.examined);
  }, [customers, hamlets, campaignStats]);

  const totalTarget = rows.reduce((sum, row) => sum + row.target, 0);
  const totalExamined = rows.reduce((sum, row) => sum + row.examined, 0);
  const totalToday = rows.reduce((sum, row) => sum + row.today, 0);
  const totalInvited = rows.reduce((sum, row) => sum + row.issued, 0);
  const rate = totalTarget ? totalExamined / totalTarget * 100 : 0;

  const exportPng = async () => {
    const source = reportRef.current;
    if (!source || exporting) return;
    setExporting(true);
    let exportPage = null;
    try {
      await document.fonts?.ready;
      const pageWidth = 1240;
      const pageHeight = 1754;
      const pagePadding = 30;
      exportPage = document.createElement("div");
      exportPage.style.cssText = `position:fixed;left:0;top:0;z-index:-99999;width:${pageWidth}px;height:${pageHeight}px;background:#fff;overflow:hidden;pointer-events:none;`;

      const clone = source.cloneNode(true);
      clone.classList.add("export-a4-report");
      clone.style.position = "absolute";
      clone.style.width = `${source.scrollWidth}px`;
      clone.style.maxWidth = "none";
      clone.style.margin = "0";
      clone.style.borderRadius = "0";
      clone.style.boxShadow = "none";
      const [doctorDataUrl, stickerDataUrl, healthMarkDataUrl] = await Promise.all([
        assetToDataUrl(doctorFamilyHero),
        assetToDataUrl(motivationSprites),
        assetToDataUrl(healthMarkIcon),
      ]);
      const clonedDoctorImage = clone.querySelector(".hero-art img");
      if (clonedDoctorImage) clonedDoctorImage.src = doctorDataUrl;
      const clonedStickerStage = clone.querySelector(".campaign-table-stage");
      if (clonedStickerStage) clonedStickerStage.style.setProperty("--motivation-sprites", `url(${stickerDataUrl})`);
      const clonedHealthMark = clone.querySelector(".health-mark img");
      if (clonedHealthMark) clonedHealthMark.src = healthMarkDataUrl;
      exportPage.appendChild(clone);
      document.body.appendChild(exportPage);

      await Promise.all([...clone.querySelectorAll("img")].map((image) => image.complete
        ? Promise.resolve()
        : new Promise((resolve) => { image.onload = resolve; image.onerror = resolve; })));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const availableWidth = pageWidth - pagePadding * 2;
      const availableHeight = pageHeight - pagePadding * 2;
      const contentWidth = clone.scrollWidth;
      const contentHeight = clone.scrollHeight;
      const fitScale = Math.min(availableWidth / contentWidth, availableHeight / contentHeight, 1);
      clone.style.left = `${pagePadding + (availableWidth - contentWidth * fitScale) / 2}px`;
      clone.style.top = `${pagePadding}px`;
      clone.style.transformOrigin = "top left";
      clone.style.transform = `scale(${fitScale})`;

      const canvas = await html2canvas(exportPage, {
        backgroundColor: "#ffffff",
        scale: 3,
        useCORS: true,
        allowTaint: false,
        logging: false,
        imageTimeout: 20000,
        width: pageWidth,
        height: pageHeight,
        windowWidth: pageWidth,
        windowHeight: pageHeight,
        scrollX: 0,
        scrollY: 0,
      });
      const context = canvas.getContext("2d");
      if (context) context.imageSmoothingQuality = "high";
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 1));
      if (!blob) throw new Error("Không thể tạo dữ liệu ảnh PNG.");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `bao-cao-chien-dich-${localDateKey()}.png`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error("Không thể xuất ảnh:", error);
      window.alert("Không thể xuất ảnh. Vui lòng thử lại.");
    } finally {
      exportPage?.remove();
      setExporting(false);
    }
  };

  return (
    <div className="campaign-page">
      <div className="campaign-toolbar">
        <div><h5>Báo cáo tiến độ</h5><span>Dữ liệu cập nhật theo danh sách khám sức khỏe</span></div>
        <button onClick={exportPng} disabled={exporting}>{exporting ? "Đang tạo ảnh..." : "↧ Xuất ảnh PNG"}</button>
      </div>

      <section className="campaign-report" ref={reportRef}>
        <header className="campaign-hero">
          <div className="health-mark" aria-label="Biểu tượng y tế"><img src={healthMarkIcon} alt="" /></div>
          <div className="hero-copy">
            <div className="eyebrow">TRẠM Y TẾ XÃ TÂN HÒA</div>
            <h1>CHIẾN DỊCH <strong>90</strong> NGÀY ĐÊM</h1>
            <h2>KHÁM SỨC KHỎE ĐỊNH KỲ &amp; SÀNG LỌC MIỄN PHÍ</h2>
            <div className="result-date">Kết quả cập nhật ngày {new Date().toLocaleDateString("vi-VN")}</div>
          </div>
          <div className="hero-art" aria-hidden="true"><img src={doctorFamilyHero} alt="" /></div>
        </header>

        <div className="metric-grid">
          <article className="metric-red"><i>♣</i><span>Tổng số người<br/>trong chiến dịch</span><strong>{totalTarget.toLocaleString("vi-VN")}</strong></article>
          <article className="metric-blue"><i>♟</i><span>Số người khám<br/>trong ngày</span><strong>{totalToday.toLocaleString("vi-VN")}</strong><em>Đang đua top!</em></article>
          <article className="metric-green"><i>✓</i><span>Lũy kế<br/>đã khám</span><strong>{totalExamined.toLocaleString("vi-VN")}</strong><em>Tăng tốc thôi!</em></article>
          <article className="metric-purple"><i>▤</i><span>Số người đã được<br/>phát giấy thông tin</span><strong>{totalInvited.toLocaleString("vi-VN")}</strong></article>
          <article className="metric-orange"><i>↗</i><span>Tỷ lệ<br/>hoàn thành</span><strong>{rate.toFixed(2).replace(".", ",")}%</strong></article>
        </div>

        <div className="campaign-content">
          <div className="section-heading"><div><span>TIẾN ĐỘ THEO ĐỊA BÀN</span><small>Xếp hạng theo tỷ lệ hoàn thành</small></div><b>{rows.length} khu vực</b></div>
          <div className="campaign-table-stage campaign-table-with-rails" style={{ "--motivation-sprites": `url(${motivationSprites})` }}>
            <div className="campaign-table-wrap">
            <table className="campaign-table">
              <thead><tr><th>STT</th><th>Tên khu phố / ấp</th><th>Tổng số<br/><small>(chỉ tiêu chiến dịch)</small></th><th>Số người khám<br/>trong ngày</th><th>Lũy kế<br/>đã khám</th><th>Số người đã được<br/>phát giấy thông tin</th><th>Tỷ lệ (%)</th></tr></thead>
              <tbody>
                {!!rows.length && <tr className="total-row"><td colSpan="2">TỔNG CỘNG</td><td>{totalTarget.toLocaleString("vi-VN")}</td><td>{totalToday.toLocaleString("vi-VN")}</td><td>{totalExamined.toLocaleString("vi-VN")}</td><td>{totalInvited.toLocaleString("vi-VN")}</td><td>{rate.toFixed(2).replace(".", ",")}%</td></tr>}
                {rows.length ? rows.map((row, index) => (
                  <tr key={row.area}>
                    <td>{index < 3 ? <span className={`medal medal-${index + 1}`} aria-label={`Hạng ${index + 1}`}>{["🥇", "🥈", "🥉"][index]}</span> : <span className="rank">{index + 1}</span>}</td>
                    <td><b>{row.area}</b></td><td>{row.target.toLocaleString("vi-VN")}</td><td>{row.today || "—"}</td><td><b className="examined-value">{row.examined.toLocaleString("vi-VN")}</b></td><td>{row.issued.toLocaleString("vi-VN")}</td>
                    <td><div className="progress-cell"><div><span style={{ width: `${row.rate}%` }} /></div><b>{row.rate.toFixed(2).replace(".", ",")}%</b></div></td>
                  </tr>
                )) : <tr><td colSpan="7" className="empty-row">{loading ? "Đang tổng hợp dữ liệu..." : "Chưa có dữ liệu danh mục ấp"}</td></tr>}
              </tbody>
            </table>
            </div>
            <div className="table-stickers-footer" aria-label="Thông điệp cổ động">
              <div className="table-overlay-badge overlay-badge-1"><i/><b>Đồng lòng<br/>tăng tốc!</b></div>
              <div className="table-overlay-badge overlay-badge-2"><i/><b>Giữ vững<br/>phong độ!</b></div>
              <div className="table-overlay-badge overlay-badge-3"><i/><b>Bứt phá<br/>nữa đi!</b></div>
              <div className="table-overlay-badge overlay-badge-4"><i/><b>Tăng tốc<br/>về đích!</b></div>
              <div className="table-overlay-badge overlay-badge-5"><i/><b>Vì sức khỏe<br/>cộng đồng!</b></div>
            </div>
          </div>
        </div>

        <footer className="campaign-footer"><div><b>“Sức khỏe là vốn quý”</b><span>Chủ động thăm khám hôm nay, an tâm ngày mai.</span></div><div className="footer-badge">♥ CÙNG NHAU VỀ ĐÍCH</div></footer>
      </section>
    </div>
  );
}

export default CampaignDashboard;
