export const livestockCategories = [
  { id: "cattle", code: "1", label: "Gia súc", repeated: true },
  { id: "poultry", code: "2", label: "Gia cầm", repeated: true },
  { id: "otherAnimals", code: "3", label: "Chăn nuôi khác", repeated: true },
  { id: "animalProducts", code: "4", label: "Sản phẩm không qua giết mổ", repeated: true },
  { id: "breeding", code: "5", label: "Giống gia súc, gia cầm, vật nuôi" },
  { id: "byproducts", code: "6", label: "Sản phẩm phụ chăn nuôi", fields: ["sold", "retained", "otherCost"] },
  { id: "services", code: "7", label: "Dịch vụ chăn nuôi", fields: ["serviceRevenue", "otherCost"] },
  { id: "hunting", code: "8", label: "Săn bắt, đánh bẫy", fields: ["serviceRevenue", "otherCost"] },
  { id: "compensation", code: "9", label: "Tiền được đền bù/hỗ trợ thiệt hại về chăn nuôi do dịch bệnh, thiên tai, môi trường", fields: ["compensation"] },
].map(category => ({ fields: ["sold", "retained", "seedCost", "materialCost", "otherCost"], ...category }));
const repeated = category => livestockCategories.some(item => item.id === category && item.repeated);
export const livestockFields = ["sold", "retained", "seedCost", "materialCost", "otherCost", "serviceRevenue", "compensation"];
export const livestockRow = (category = "cattle") => ({ key: crypto.randomUUID(), category, description: "", ...Object.fromEntries(livestockFields.map((field) => [field, ""])) });
export const livestockHasData = (row) => Boolean(row.description?.trim() || livestockFields.some((field) => Number(row[field])));
export function loadLivestock(value) {
  const source = value?.rows || [];
  return { hasIncome: value?.hasIncome ?? null, rows: livestockCategories.flatMap(({id, repeated}) => {
    const saved = source.filter(row => row.category === id);
    return saved.length ? saved.map(row => ({ ...livestockRow(id), ...row, key: crypto.randomUUID() }))
      : Array.from({length: repeated ? 2 : 1}, () => livestockRow(id));
  }) };
}

export function livestockPayload(value) {
  return { hasIncome: value.hasIncome, rows: value.hasIncome === true
    ? value.rows.filter((row) => !repeated(row.category) || livestockHasData(row)).map((row) => ({
      category: row.category, description: row.description.trim(),
      ...Object.fromEntries(livestockFields.map((field) => [field, Number(row[field] || 0)])),
    })) : [] };
}
const units = (value) => Math.round(Number(value || 0) * 1000);
export function livestockRowTotals(row) {
  if (row.category === "compensation") return { sold: 0, retained: 0, revenue: 0, seedCost: 0, materialCost: 0, otherCost: 0, totalCost: 0, income: units(row.compensation) / 1000 };
  const sold = units(row.sold), retained = units(row.retained);
  const revenue = ["services", "hunting"].includes(row.category) ? units(row.serviceRevenue) : sold + retained;
  const regular = ["cattle", "poultry", "otherAnimals", "animalProducts", "breeding"].includes(row.category);
  const seedCost = regular ? units(row.seedCost) : 0, materialCost = regular ? units(row.materialCost) : 0;
  const otherCost = units(row.otherCost), totalCost = seedCost + materialCost + otherCost;
  return Object.fromEntries(Object.entries({ sold, retained, revenue, seedCost, materialCost, otherCost, totalCost, income: revenue - totalCost }).map(([key, value]) => [key, value / 1000]));
}
export function livestockTotals(value) {
  const totals = { sold: 0, retained: 0, revenue: 0, seedCost: 0, materialCost: 0, otherCost: 0, totalCost: 0, income: 0 };
  if (value.hasIncome === true) for (const row of value.rows) for (const [key, amount] of Object.entries(livestockRowTotals(row))) totals[key] += units(amount);
  return Object.fromEntries(Object.entries(totals).map(([key, amount]) => [key, amount / 1000]));
}

