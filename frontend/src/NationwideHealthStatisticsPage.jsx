import { useEffect, useMemo, useState } from "react";
import XLSX from "xlsx-js-style";
import api from "./api";
import {
  countHealthRecordsByHamlet,
  filterSecondRoundHealthRecords,
  findNationwideHealthWorksheet,
  isGeneratedNationwideHealthWorkbook,
  KSK_SECOND_ROUND_START_DATE,
  localDateKey,
  NATIONWIDE_HAMLETS,
  populateNationwideHealthWorkbook,
} from "./nationwideHealthStatistics";

const formatDate = (value) => {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
};

function createPopulatedWorkbook(fileBuffer, counts) {
  const workbook = XLSX.read(fileBuffer, { type: "array", cellStyles: true, cellDates: false });
  const worksheet = findNationwideHealthWorksheet(workbook);
  const worksheetName = workbook.SheetNames.find((name) => workbook.Sheets[name] === worksheet);
  return populateNationwideHealthWorkbook(fileBuffer, worksheetName, counts);
}

function getErrorMessage(error) {
  if (error.response?.data?.message) return error.response.data.message;
  if (error.response?.data instanceof Blob) return "Không thể tải dữ liệu khám sức khỏe.";
  return error.message || "Đã xảy ra lỗi khi xử lý file Excel.";
}

export default function NationwideHealthStatisticsPage() {
  const [rangeEndDate] = useState(() => localDateKey());
  const [records, setRecords] = useState([]);
  const [hamlets, setHamlets] = useState([]);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get("/PrintVoucher/customers", {
        params: {
          fromDate: KSK_SECOND_ROUND_START_DATE,
          toDate: rangeEndDate,
        },
      }),
      api.get("/CatalogItems", { params: { category: "hamlet" } }),
    ])
      .then(([customerResponse, hamletResponse]) => {
        if (!active) return;
        setRecords(Array.isArray(customerResponse.data) ? customerResponse.data : []);
        setHamlets(Array.isArray(hamletResponse.data) ? hamletResponse.data : []);
      })
      .catch((error) => {
        if (active) {
          setMessage(getErrorMessage(error));
          setMessageType("danger");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [rangeEndDate]);

  const secondRoundRecords = useMemo(
    () => filterSecondRoundHealthRecords(records, rangeEndDate),
    [records, rangeEndDate],
  );
  const { counts, unmatchedCount } = useMemo(
    () => countHealthRecordsByHamlet(secondRoundRecords, hamlets),
    [secondRoundRecords, hamlets],
  );
  const selectedGeneratedFile = isGeneratedNationwideHealthWorkbook(file?.name);

  const chooseFile = (event) => {
    const selectedFile = event.target.files?.[0] || null;
    setFile(selectedFile);
    if (selectedFile && isGeneratedNationwideHealthWorkbook(selectedFile.name)) {
      setMessage("Đây là file đã xuất từ lần trước. Vui lòng chọn file mẫu gốc để tránh làm sai định dạng Excel.");
      setMessageType("warning");
    } else {
      setMessage("");
      setMessageType("info");
    }
  };

  const exportWorkbook = async () => {
    if (selectedGeneratedFile) {
      setMessage("Không thể dùng file đã xuất làm mẫu. Vui lòng chọn file mẫu gốc chưa có hậu tố “_da_dien_so_lieu”.");
      setMessageType("warning");
      return;
    }
    if (!file) {
      setMessage("Vui lòng chọn file Excel mẫu trước khi xuất.");
      setMessageType("warning");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setMessage("Chỉ hỗ trợ file Excel .xlsx.");
      setMessageType("warning");
      return;
    }

    setExporting(true);
    setMessage("");
    try {
      const workbook = createPopulatedWorkbook(await file.arrayBuffer(), counts);
      const outputName = `${file.name.replace(/\.xlsx$/i, "")}_da_dien_so_lieu.xlsx`;
      const url = URL.createObjectURL(new Blob([workbook], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }));
      const link = document.createElement("a");
      link.href = url;
      link.download = outputName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(`Đã xuất file Excel với ${secondRoundRecords.length.toLocaleString("vi-VN")} hồ sơ KSK đợt 2.`);
      setMessageType("success");
    } catch (error) {
      setMessage(getErrorMessage(error));
      setMessageType("danger");
    } finally {
      setExporting(false);
    }
  };

  return <div className="container-fluid py-4">
    <div className="card border-0 shadow-sm">
      <div className="card-header bg-white p-4">
        <h4 className="fw-bold text-primary mb-1">SỐ LIỆU KHÁM SỨC KHỎE TOÀN DÂN</h4>
        <div className="text-muted">Điền số hồ sơ KSK đợt 2 từ ngày {formatDate(KSK_SECOND_ROUND_START_DATE)} đến {formatDate(rangeEndDate) === formatDate(localDateKey()) ? "nay" : formatDate(rangeEndDate)} theo ấp vào cột Y6–Y17.</div>
      </div>
      <div className="card-body p-4">
        {message && <div className={`alert alert-${messageType}`} role="alert">{message}</div>}
        <div className="row g-3 align-items-end mb-4">
          <div className="col-lg-8">
            <label className="form-label fw-semibold" htmlFor="nationwide-health-template">File thống kê Excel (.xlsx)</label>
            <input id="nationwide-health-template" className="form-control" type="file" accept=".xlsx" onChange={chooseFile} />
            <div className="form-text">Chọn file mẫu có danh sách 12 ấp tại các ô C6:C17. File được xử lý trên trình duyệt và không tải lên máy chủ.</div>
          </div>
          <div className="col-lg-4">
            <button type="button" className="btn btn-primary w-100" onClick={exportWorkbook} disabled={loading || exporting || !file || selectedGeneratedFile}>
              {exporting ? "Đang xuất file..." : loading ? "Đang tải dữ liệu..." : "Xuất Excel đã điền số liệu"}
            </button>
          </div>
        </div>
        <div className="d-flex flex-wrap gap-3 mb-3">
          <span className="badge text-bg-primary fs-6">KSK đợt 2 (08/09/2026–{formatDate(rangeEndDate)}): {loading ? "…" : secondRoundRecords.length.toLocaleString("vi-VN")}</span>
          <span className="badge text-bg-warning fs-6">Chưa ghép được ấp: {loading ? "…" : unmatchedCount.toLocaleString("vi-VN")}</span>
        </div>
        <div className="table-responsive">
          <table className="table table-bordered table-hover align-middle mb-0">
            <thead className="table-light"><tr><th>Ấp</th><th className="text-end">KSK đợt 2</th><th className="text-center">Cột Excel</th></tr></thead>
            <tbody>
              {NATIONWIDE_HAMLETS.map((hamlet, index) => <tr key={hamlet}>
                <td>{hamlet}</td>
                <td className="text-end">{loading ? "…" : counts[index].toLocaleString("vi-VN")}</td>
                <td className="text-center">Y{index + 6}</td>
              </tr>)}
              {!loading && <tr className="table-primary fw-bold">
                <td>Tổng số</td>
                <td className="text-end">{counts.reduce((total, count) => total + count, 0).toLocaleString("vi-VN")}</td>
                <td className="text-center">Y18</td>
              </tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>;
}
