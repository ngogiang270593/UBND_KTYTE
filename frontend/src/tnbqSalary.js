export const salaryRow = (code = "") => ({ key: crypto.randomUUID(), code: String(code), name: "", wage: "", pension: "" });
export const salaryHasData = (row) => Boolean(row.name?.trim() || Number(row.wage) || Number(row.pension));
export const loadSalary = (value) => ({
  hasIncome: value?.hasIncome ?? null,
  rows: value?.rows?.length ? value.rows.map((row) => ({ ...row, key: crypto.randomUUID() }))
    : Array.from({ length: 7 }, (_, index) => salaryRow(index + 1)),
});
export const salaryPayload = (value) => ({
  hasIncome: value.hasIncome,
  rows: value.hasIncome === true ? value.rows.filter(salaryHasData)
    .map((row) => ({ code: row.code.trim(), name: row.name.trim(), wage: Number(row.wage || 0), pension: Number(row.pension || 0) })) : [],
});
export const salaryTotals = (value) => {
  const rows = value.hasIncome === true ? value.rows : [];
  const wage = rows.reduce((sum, row) => sum + Math.round(Number(row.wage || 0) * 1000), 0);
  const pension = rows.reduce((sum, row) => sum + Math.round(Number(row.pension || 0) * 1000), 0);
  return { wage: wage / 1000, pension: pension / 1000, total: (wage + pension) / 1000 };
};

