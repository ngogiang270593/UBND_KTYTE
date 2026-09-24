import XLSX from "xlsx-js-style";

export const importHeaders = ["STT", "Căn cước", "Họ và tên", "Đối tượng", "Số điện thoại", "Năm sinh", "Ngày khám", "Địa chỉ", "Nghề nghiệp", "Ngày sinh", "Nơi khám", "Ngày cấp CCCD"];
export const normalizeSearch = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().trim().replace(/\s+/g, " ");
export function dateForImport(value) {
  const text = String(value ?? "").trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : text;
}
export function collectPendingUpdates(missingAddress, missingCode, elderly, missingBirthDate = []) {
  const map = new Map();
  for (const [items, reason] of [[missingAddress, "Địa chỉ không đúng ấp"], [missingCode, "Chưa có căn cước"], [missingBirthDate, "Chưa có ngày sinh"]]) {
    for (const customer of items) {
      const key = `customer:${customer.id}`;
      if (!map.has(key)) map.set(key, { ...customer, key, reasons: [], source: "Khám sức khỏe" });
      map.get(key).reasons.push(reason);
    }
  }
  for (const row of elderly.filter(item => !item.matches.length)) {
    const key = `elderly:${row.id}`;
    map.set(key, { key, code: row.cccd, name: row.hoTen, taxCode: String(row.namSinh || row.ngaySinh || "").match(/\b\d{4}\b/)?.[0] || "",
      birthDate: row.ngaySinh || (/[/\-]/.test(row.namSinh || "") ? row.namSinh : ""),
      address: row.diaChi, examinationDate: row.ngayKham, source: "Import Người Cao Tuổi",
      reasons: ["Người cao tuổi không khớp hồ sơ khám"] });
  }
  return [...map.values()];
}
export function searchPendingUpdates(rows, query) {
  const terms = normalizeSearch(query).split(" ").filter(Boolean);
  return rows.filter(row => {
    const text = normalizeSearch([row.code, row.name, row.taxCode, row.birthDate, row.address, row.source, ...row.reasons].join(" "));
    return terms.every(term => text.includes(term));
  });
}
export function pendingUpdatesWorkbook(rows) {
  const data = rows.map((row, index) => [index + 1, String(row.code || ""), row.name || "", row.objectType || "", String(row.phoneNumber || ""),
    row.taxCode || "", dateForImport(row.examinationDate), row.address || "", row.occupation || "", dateForImport(row.birthDate),
    row.examinationPlace || "", dateForImport(row.citizenIdIssueDate), row.reasons.join("; ")]);
  const sheet = XLSX.utils.aoa_to_sheet([
    ["MẪU IMPORT DANH SÁCH KHÁM SỨC KHỎE"],
    ["Danh sách cần cập nhật. Bổ sung thông tin còn thiếu trước khi import khám sức khỏe."],
    [], [...importHeaders, "Lý do cần cập nhật"], ...data,
  ]);
  sheet["!merges"] = [{s:{r:0,c:0},e:{r:0,c:12}}, {s:{r:1,c:0},e:{r:1,c:12}}];
  sheet["!cols"] = [8,20,28,18,16,14,16,34,24,16,24,16,60].map(wch => ({wch}));
  sheet["!autofilter"] = {ref:`A4:M${Math.max(4, rows.length + 4)}`};
  for (let c=0;c<13;c++) {
    sheet[XLSX.utils.encode_cell({r:3,c})].s = {font:{bold:true,color:{rgb:"FFFFFF"}},fill:{fgColor:{rgb:"0F766E"}},alignment:{horizontal:"center"}};
  }
  sheet.A1.s = {font:{bold:true,sz:16,color:{rgb:"FFFFFF"}},fill:{fgColor:{rgb:"1D4ED8"}}};
  for (let r=4;r<rows.length+4;r++) for (const c of [1,4]) sheet[XLSX.utils.encode_cell({r,c})].z = "@";
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "DanhSachKham");
  return book;
}