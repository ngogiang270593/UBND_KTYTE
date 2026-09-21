import { useEffect, useMemo, useState } from "react";
import api from "./api";
import "./TnbqSurveyStatisticsPage.css";

const currentYear = new Date().getFullYear();
const normalize = (value) => String(value ?? "").normalize("NFC").trim().replace(/\s+/gu, " ");
const compare = (left, right) => normalize(left).localeCompare(normalize(right), "vi", { numeric: true });

const groupByHamlet = (rows) => {
  const groups = new Map();
  for (const row of rows) {
    const hamlet = normalize(row.hamlet) || "Chưa xác định";
    const current = groups.get(hamlet) || { hamlet, valid: 0, invalid: 0 };
    if (row.isInvalid) current.invalid += 1;
    else current.valid += 1;
    groups.set(hamlet, current);
  }
  return [...groups.values()].sort((left, right) => compare(left.hamlet, right.hamlet))
    .map((row, index) => ({ ...row, stt: index + 1, total: row.valid + row.invalid }));
};

export default function TnbqSurveyStatisticsPage() {
  const [year, setYear] = useState(currentYear);
  const [result, setResult] = useState(null);
  const [retry, setRetry] = useState(0);
  const key = year + ":" + retry;
  const loading = result?.key !== key;
  const rows = useMemo(() => groupByHamlet(result?.rows || []), [result]);
  const totals = useMemo(() => rows.reduce((sum, row) => ({
    valid: sum.valid + row.valid, invalid: sum.invalid + row.invalid, total: sum.total + row.total,
  }), { valid: 0, invalid: 0, total: 0 }), [rows]);
  const years = Array.from({ length: currentYear - 2000 + 1 }, (_, index) => currentYear - index);

  useEffect(() => {
    const controller = new AbortController();
    api.get("/TnbqSurveys", { params: { year }, signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) setResult({ key, rows: data, error: "" }); })
      .catch((error) => {
        if (!controller.signal.aborted) setResult({ key, rows: [], error: error.response?.data?.message || "Không thể tải thống kê phiếu. Vui lòng thử lại." });
      });
    return () => controller.abort();
  }, [key, year]);

  return <section className="tnbq-survey-statistics">
    <header className="tnbq-statistics-heading">
      <div><span className="tnbq-statistics-eyebrow">THỐNG KÊ TNBQ</span><h2>Thống kê phiếu thu thập</h2>
        <p>Theo dõi số lượng phiếu đúng và phiếu sai theo khu phố/ấp.</p></div>
      <label htmlFor="tnbq-statistics-year">Năm điều tra
        <select id="tnbq-statistics-year" className="form-select" value={year} onChange={(event) => setYear(Number(event.target.value))}>
          {years.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
    </header>

    {loading ? <div className="tnbq-statistics-loading" role="status">Đang tổng hợp phiếu…</div>
      : result?.error ? <div className="alert alert-danger" role="alert">{result.error}
        <button className="btn btn-sm btn-outline-danger ms-3" type="button" onClick={() => setRetry((value) => value + 1)}>Tải lại</button>
      </div> : <>
        <div className="tnbq-statistics-cards">
          <article><span>Tổng phiếu</span><strong>{totals.total.toLocaleString("vi-VN")}</strong><small>Phiếu đã lập trong năm {year}</small></article>
          <article className="valid"><span>Phiếu đúng</span><strong>{totals.valid.toLocaleString("vi-VN")}</strong><small>Đủ điều kiện sử dụng</small></article>
          <article className="invalid"><span>Phiếu sai</span><strong>{totals.invalid.toLocaleString("vi-VN")}</strong><small>Cần rà soát hoặc điều chỉnh</small></article>
        </div>
        <section className="tnbq-statistics-table-card">
          <div className="tnbq-statistics-table-heading"><div><h3>Chi tiết theo khu phố/ấp</h3><p>{rows.length} địa bàn có phiếu trong năm {year}</p></div><span>Tổng: <strong>{totals.total.toLocaleString("vi-VN")}</strong> phiếu</span></div>
          <div className="table-responsive"><table className="table align-middle mb-0">
            <thead><tr><th>STT</th><th>Khu phố / ấp</th><th className="text-end">Phiếu đúng</th><th className="text-end">Phiếu sai</th><th className="text-end">Tổng phiếu</th></tr></thead>
            <tbody>{rows.length ? rows.map((row) => <tr key={row.hamlet}><td className="tnbq-statistics-stt">{row.stt}</td><td className="fw-semibold">{row.hamlet}</td><td className="text-end"><span className="tnbq-statistics-number valid">{row.valid.toLocaleString("vi-VN")}</span></td><td className="text-end"><span className="tnbq-statistics-number invalid">{row.invalid.toLocaleString("vi-VN")}</span></td><td className="text-end fw-bold">{row.total.toLocaleString("vi-VN")}</td></tr>) : <tr><td colSpan={5} className="text-center text-muted py-5">Chưa có phiếu thu thập trong năm {year}.</td></tr>}</tbody>
            {rows.length > 0 && <tfoot><tr><td colSpan={2}>TỔNG CỘNG</td><td className="text-end">{totals.valid.toLocaleString("vi-VN")}</td><td className="text-end">{totals.invalid.toLocaleString("vi-VN")}</td><td className="text-end">{totals.total.toLocaleString("vi-VN")}</td></tr></tfoot>}
          </table></div>
        </section>
      </>}
  </section>;
}
