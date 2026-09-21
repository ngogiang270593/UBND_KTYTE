export const cropCategories = [
  { id: "plants", code: "1", label: "Cây trồng các loại", fields: ["sold", "retained", "seedCost", "materialCost", "otherCost"] },
  { id: "nursery", code: "2", label: "Nhân giống và chăm sóc giống", fields: ["sold", "retained", "seedCost", "materialCost", "otherCost"] },
  { id: "byproducts", code: "3", label: "Sản phẩm phụ và sản phẩm thu nhặt từ trồng trọt", fields: ["sold", "retained", "otherCost"] },
  { id: "services", code: "4", label: "Dịch vụ trồng trọt", fields: ["serviceRevenue", "otherCost"] },
  { id: "compensation", code: "5", label: "Tiền được đền bù/hỗ trợ thiệt hại về trồng trọt do dịch bệnh, thiên tai, môi trường", fields: ["compensation"] },
];
export const cropFields = ["sold", "retained", "seedCost", "materialCost", "otherCost", "serviceRevenue", "compensation"];
export const cropRow = (category = "plants") => ({ key: crypto.randomUUID(), category, description: "", ...Object.fromEntries(cropFields.map((field) => [field, ""])) });
export const cropHasData = (row) => Boolean(row.description?.trim() || cropFields.some((field) => Number(row[field])));
export function loadCrops(value) {
  const source = value?.rows || [];
  const plants = source.filter((row) => row.category === "plants");
  return { hasIncome: value?.hasIncome ?? null, rows: [
    ...(plants.length ? plants.map((row) => ({ ...cropRow(), ...row, key: crypto.randomUUID() })) : [cropRow(), cropRow()]),
    ...cropCategories.slice(1).map(({ id }) => ({ ...cropRow(id), ...source.find((row) => row.category === id), key: crypto.randomUUID() })),
  ] };
}
export function cropsPayload(value) {
  return { hasIncome: value.hasIncome, rows: value.hasIncome === true
    ? value.rows.filter((row) => row.category !== "plants" || cropHasData(row)).map((row) => ({
      category: row.category, description: row.description.trim(),
      ...Object.fromEntries(cropFields.map((field) => [field, Number(row[field] || 0)])),
    })) : [] };
}
const units = (value) => Math.round(Number(value || 0) * 1000);
export function cropRowTotals(row) {
  if (row.category === "compensation") return { sold: 0, retained: 0, revenue: 0, seedCost: 0, materialCost: 0, otherCost: 0, totalCost: 0, income: units(row.compensation) / 1000 };
  const sold = units(row.sold), retained = units(row.retained);
  const revenue = row.category === "services" ? units(row.serviceRevenue) : sold + retained;
  const regular = ["plants", "nursery"].includes(row.category);
  const seedCost = regular ? units(row.seedCost) : 0, materialCost = regular ? units(row.materialCost) : 0;
  const otherCost = units(row.otherCost), totalCost = seedCost + materialCost + otherCost;
  return Object.fromEntries(Object.entries({ sold, retained, revenue, seedCost, materialCost, otherCost, totalCost, income: revenue - totalCost }).map(([key, value]) => [key, value / 1000]));
}
export function cropsTotals(value) {
  const totals = { sold: 0, retained: 0, revenue: 0, seedCost: 0, materialCost: 0, otherCost: 0, totalCost: 0, income: 0 };
  if (value.hasIncome === true) for (const row of value.rows) for (const [key, amount] of Object.entries(cropRowTotals(row))) totals[key] += units(amount);
  return Object.fromEntries(Object.entries(totals).map(([key, amount]) => [key, amount / 1000]));
}

