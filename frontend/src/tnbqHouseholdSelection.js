const cleanText = (value) => String(value ?? "").normalize("NFC").trim().replace(/\s+/gu, " ");
const compareText = (left, right) => cleanText(left).localeCompare(cleanText(right), "vi", { numeric: true });

export const normalizeCommune = (value) => cleanText(value).toLocaleLowerCase("vi")
  .replace(/^(?:xã|phường|thị trấn)\s+/u, "");

export const normalizeHamlet = (value) => cleanText(value).toLocaleLowerCase("vi");

const inCommuneAndYear = (row, form) => {
  const year = Number(form?.year);
  const commune = normalizeCommune(form?.commune);
  return Boolean(row && commune && year > 0 && Number.isFinite(year)
    && Number(row.year) === year && normalizeCommune(row.commune) === commune);
};

export function householdCandidates(rows, form) {
  const hamlet = normalizeHamlet(form?.hamlet);
  if (!hamlet) return [];
  return (Array.isArray(rows) ? rows : []).filter((row) => inCommuneAndYear(row, form)
    && normalizeHamlet(row.hamlet) === hamlet
    && cleanText(row.headName) && cleanText(row.householdNumber))
    .sort((left, right) => compareText(left.headName, right.headName)
      || compareText(left.householdNumber, right.householdNumber)
      || compareText(left.id, right.id));
}

export function getHouseholdHamlets(rows, form) {
  const hamlets = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!inCommuneAndYear(row, form)) continue;
    const hamlet = cleanText(row.hamlet);
    const key = normalizeHamlet(hamlet);
    if (key && !hamlets.has(key)) hamlets.set(key, hamlet);
  }
  return [...hamlets.values()].sort(compareText);
}

export const householdSelection = (form, row) => ({
  ...form,
  headName: cleanText(row?.headName),
  householdNumber: cleanText(row?.householdNumber),
});
