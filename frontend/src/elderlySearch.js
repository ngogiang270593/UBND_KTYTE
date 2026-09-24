const normalize = value => String(value ?? "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().trim().replace(/\s+/g, " ");
const year = value => String(value ?? "").match(/\b\d{4}\b/)?.[0] || "";

export function matchesElderlySearch(row, query) {
  const terms = normalize(query).split(" ").filter(Boolean);
  if (!terms.length) return true;
  const people = [
    [row.cccd, row.hoTen, year(row.ngaySinh) || year(row.namSinh)],
    ...(row.matches || []).map(match => [match.code, match.name, year(match.birthDate) || year(match.taxCode)]),
  ];
  return people.some(fields => {
    const text = fields.map(normalize).join(" ");
    return terms.every(term => text.includes(term));
  });
}