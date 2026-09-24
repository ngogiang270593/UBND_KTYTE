export const columns = [
  ["hoTen", "Họ và tên"], ["namSinh", "Năm sinh"], ["gioiTinh", "Giới tính"],
  ["cccd", "CCCD"], ["diaChi", "Địa chỉ"], ["ngayKham", "NGÀY KHÁM"],
];
const normalize = (value) => String(value ?? "").trim().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/[^a-z0-9]/g, "");
const aliases = [
  ["hovaten", "hoten"], ["namsinh"], ["gioitinh"],
  ["cccd", "cancuoc", "socancuoc", "socccd", "cmndcccd"], ["diachi"], ["ngaykham"],
];

export function parseElderly(matrix) {
  const headerIndex = matrix.findIndex((row) => aliases.every((names) => row.some((cell) => names.includes(normalize(cell)))));
  if (headerIndex < 0) throw new Error("File phải có đủ cột: Họ và tên, Năm sinh, Giới tính, CCCD, Địa chỉ, NGÀY KHÁM.");
  const indexes = aliases.map((names) => matrix[headerIndex].findIndex((cell) => names.includes(normalize(cell))));
  const birthIndex = matrix[headerIndex].findIndex((cell) => normalize(cell) === "ngaysinh");
  const rows = [];
  matrix.slice(headerIndex + 1).forEach((cells, offset) => {
    const values = indexes.map((index) => String(cells[index] ?? "").trim());
    if (values.every((value) => !value)) return;
    if (!values[0]) throw new Error(`Dòng Excel ${headerIndex + offset + 2}: thiếu họ và tên.`);
    rows.push({ ...Object.fromEntries(columns.map(([key], index) => [key, values[index]])),
      ngaySinh: birthIndex < 0 ? "" : String(cells[birthIndex] ?? "").trim() });
  });
  if (!rows.length) throw new Error("File không có dữ liệu.");
  return rows;
}