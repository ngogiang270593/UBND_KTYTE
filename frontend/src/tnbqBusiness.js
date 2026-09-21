export const businessFields = ["sold", "retained", "materialCost", "energyCost", "otherCost"];
export const businessRow = () => ({
  key: crypto.randomUUID(), description: "",
  ...Object.fromEntries(businessFields.map((field) => [field, ""])),
});
export const businessHasData = (row) => Boolean(row.description?.trim() || businessFields.some((field) => Number(row[field])));

export function loadBusiness(value) {
  const source = value?.rows || [];
  return {
    hasIncome: value?.hasIncome ?? null,
    rows: Array.from({ length: Math.max(5, source.length) }, (_, index) => ({ ...businessRow(), ...source[index], key: crypto.randomUUID() })),
  };
}

export function businessPayload(value) {
  return {
    hasIncome: value.hasIncome,
    rows: value.hasIncome === true ? value.rows.filter(businessHasData).map((row) => ({
      description: row.description.trim(),
      ...Object.fromEntries(businessFields.map((field) => [field, Number(row[field] || 0)])),
    })) : [],
  };
}

const units = (value) => Math.round(Number(value || 0) * 1000);
export function businessRowTotals(row) {
  const sold = units(row.sold), retained = units(row.retained), materialCost = units(row.materialCost);
  const energyCost = units(row.energyCost), otherCost = units(row.otherCost), revenue = sold + retained;
  const totalCost = materialCost + energyCost + otherCost;
  return Object.fromEntries(Object.entries({ sold, retained, revenue, materialCost, energyCost, otherCost, totalCost, income: revenue - totalCost }).map(([key, amount]) => [key, amount / 1000]));
}

export function businessTotals(value) {
  const totals = { sold: 0, retained: 0, revenue: 0, materialCost: 0, energyCost: 0, otherCost: 0, totalCost: 0, income: 0 };
  if (value.hasIncome === true) for (const row of value.rows) for (const [key, amount] of Object.entries(businessRowTotals(row))) totals[key] += units(amount);
  return Object.fromEntries(Object.entries(totals).map(([key, amount]) => [key, amount / 1000]));
}
