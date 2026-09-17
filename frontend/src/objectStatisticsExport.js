import * as XLSX from "xlsx";

const dateText = (value) => {
  const date = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.split("-").reverse().join("/") : date;
};

export function createObjectExport({ records, label, keyword, fromDate, toDate, exportedAt = new Date() }) {
  const headers = ["STT", "Mã hồ sơ", "Họ tên", "Ngày sinh", "Địa chỉ", "Đối tượng", "Ngày khám"];
  const rows = records.map((customer, index) => [
    index + 1, String(customer.code ?? ""), String(customer.name ?? ""), dateText(customer.birthDate),
    String(customer.address ?? ""), String(customer.objectType || "").trim() || "Chưa xác định", dateText(customer.examinationDate),
  ]);
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  sheet["!cols"] = [8, 22, 30, 16, 55, 30, 16].map((wch) => ({ wch }));
  sheet["!autofilter"] = { ref: `A1:G${rows.length + 1}` };
  const info = XLSX.utils.aoa_to_sheet([
    ["THỐNG KÊ ĐỐI TƯỢNG", ""],
    ["Tab xuất", label],
    ["Số hồ sơ", records.length],
    ["Từ khóa", keyword.trim() || "Tất cả"],
    ["Khám từ ngày", dateText(fromDate) || "Không giới hạn"],
    ["Khám đến ngày", dateText(toDate) || "Không giới hạn"],
    ["Thời điểm xuất", exportedAt.toLocaleString("vi-VN")],
    ["Phạm vi", "Toàn bộ hồ sơ thuộc tab và bộ lọc đã chọn"],
  ]);
  info["!cols"] = [{ wch: 24 }, { wch: 65 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Danh sach");
  XLSX.utils.book_append_sheet(workbook, info, "Thong tin bao cao");
  const safeLabel = Array.from(String(label), (character) => character.charCodeAt(0) < 32 ? "_" : character).join("").replace(/[<>:"/\\|?*]/g, "_").replace(/[. ]+$/g, "").slice(0, 80) || "Tong";
  const stamp = `${exportedAt.getFullYear()}-${String(exportedAt.getMonth() + 1).padStart(2, "0")}-${String(exportedAt.getDate()).padStart(2, "0")}_${String(exportedAt.getHours()).padStart(2, "0")}${String(exportedAt.getMinutes()).padStart(2, "0")}${String(exportedAt.getSeconds()).padStart(2, "0")}`;
  return { workbook, fileName: `TK_Doi_tuong_${safeLabel}_${stamp}.xlsx` };
}
