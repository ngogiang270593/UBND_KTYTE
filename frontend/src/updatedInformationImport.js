export const columns = [
  ["stt", "STT"], ["cccd", "Căn cước"], ["hoTen", "Họ và tên"], ["diaChi", "Địa chỉ"],
];
const normalize = (value) => String(value ?? "").trim().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/[^a-z0-9]/g, "");
const aliases = [["stt", "sothutu"], ["cancuoc", "cccd", "socancuoc", "socccd", "cmndcccd"], ["hovaten", "hoten"], ["diachi"]];

export function parseUpdatedInformation(matrix) {
  const headerIndex = matrix.findIndex((row) => aliases.every((names) => row.some((cell) => names.includes(normalize(cell)))));
  if (headerIndex < 0) throw new Error("File phải có đủ cột: STT, Căn cước, Họ và tên, Địa chỉ.");
  const indexes = aliases.map((names) => matrix[headerIndex].findIndex((cell) => names.includes(normalize(cell))));
  const rows = [];
  matrix.slice(headerIndex + 1).forEach((cells, offset) => {
    const values = indexes.map((index) => String(cells[index] ?? "").trim());
    if (values.every((value) => !value)) return;
    if (!values[2]) throw new Error(`Dòng Excel ${headerIndex + offset + 2}: thiếu họ và tên.`);
    rows.push(Object.fromEntries(columns.map(([key], index) => [key, values[index] || (index === 0 ? String(rows.length + 1) : "")])));
  });
  if (!rows.length) throw new Error("File không có dữ liệu.");
  return rows;
}
