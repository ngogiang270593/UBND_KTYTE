export const aquacultureCategories = [
  { id: "farming", code: "1", label: "Nuôi trồng thủy sản", repeated: true, initial: ["Cá", "Tôm"], fields: ["sold", "retained", "seedCost", "materialCost", "otherCost"] },
  { id: "fishing", code: "2", label: "Đánh bắt thủy sản", repeated: true, initial: ["Cá", "Tôm"], fields: ["sold", "retained", "otherCost"] },
  { id: "breeding", code: "3", label: "Sản xuất giống", repeated: true, initial: ["Cá giống các loại", "Tôm giống các loại"], fields: ["sold", "retained", "seedCost", "materialCost", "otherCost"] },
  { id: "services", code: "4", label: "Dịch vụ thủy sản", fields: ["serviceRevenue"] },
  { id: "compensation", code: "5", label: "Tiền được đền bù/hỗ trợ thiệt hại về thủy sản do dịch bệnh, thiên tai, môi trường", fields: ["compensation"] },
];

export const aquacultureFields = ["sold", "retained", "seedCost", "materialCost", "otherCost", "serviceRevenue", "compensation"];
export const aquacultureRow = (category = "farming", description = "") => ({
  key: crypto.randomUUID(), category, description,
  ...Object.fromEntries(aquacultureFields.map((field) => [field, ""])),
});
const categoryOf = (category) => aquacultureCategories.find((item) => item.id === category);
const repeated = (category) => Boolean(categoryOf(category)?.repeated);
const standard = (category) => ["farming", "breeding"].includes(category);
export const aquacultureHasData = (row) => Boolean(row.description?.trim() || aquacultureFields.some((field) => Number(row[field])));

export function loadAquaculture(value) {
  const source = value?.rows || [];
  return {
    hasIncome: value?.hasIncome ?? null,
    rows: aquacultureCategories.flatMap((category) => {
      const saved = source.filter((row) => row.category === category.id);
      if (saved.length) return saved.map((row) => ({ ...aquacultureRow(category.id), ...row, key: crypto.randomUUID() }));
      if (category.repeated) return category.initial.map((name) => aquacultureRow(category.id, name));
      return [aquacultureRow(category.id)];
    }),
  };
}

export function aquaculturePayload(value) {
  return {
    hasIncome: value.hasIncome,
    rows: value.hasIncome === true ? value.rows.filter((row) => !repeated(row.category) || aquacultureHasData(row)).map((row) => ({
      category: row.category, description: row.description.trim(),
      ...Object.fromEntries(aquacultureFields.map((field) => [field, Number(row[field] || 0)])),
    })) : [],
  };
}

const units = (value) => Math.round(Number(value || 0) * 1000);
export function aquacultureRowTotals(row) {
  if (row.category === "compensation") return { sold: 0, retained: 0, revenue: 0, seedCost: 0, materialCost: 0, otherCost: 0, totalCost: 0, income: units(row.compensation) / 1000 };
  if (row.category === "services") {
    const revenue = units(row.serviceRevenue) / 1000;
    return { sold: 0, retained: 0, revenue, seedCost: 0, materialCost: 0, otherCost: 0, totalCost: 0, income: revenue };
  }
  const sold = units(row.sold), retained = units(row.retained), revenue = sold + retained;
  const seedCost = standard(row.category) ? units(row.seedCost) : 0;
  const materialCost = standard(row.category) ? units(row.materialCost) : 0;
  const otherCost = units(row.otherCost), totalCost = seedCost + materialCost + otherCost;
  return Object.fromEntries(Object.entries({ sold, retained, revenue, seedCost, materialCost, otherCost, totalCost, income: revenue - totalCost }).map(([key, amount]) => [key, amount / 1000]));
}

export function aquacultureTotals(value) {
  const totals = { sold: 0, retained: 0, revenue: 0, seedCost: 0, materialCost: 0, otherCost: 0, totalCost: 0, income: 0 };
  if (value.hasIncome === true) for (const row of value.rows) for (const [key, amount] of Object.entries(aquacultureRowTotals(row))) totals[key] += units(amount);
  return Object.fromEntries(Object.entries(totals).map(([key, amount]) => [key, amount / 1000]));
}
