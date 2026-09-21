export const forestryCategories = [
  { id: "harvesting", code: "1", label: "Khai thác, thu nhặt lâm sản", repeated: true, fields: ["sold", "retained", "otherCost"] },
  { id: "nursery", code: "2", label: "Ươm giống cây lâm nghiệp", fields: ["sold", "retained", "seedCost", "materialCost", "otherCost"] },
  { id: "forestCare", code: "3", label: "Trồng rừng, chăm sóc, tu bổ, cải tạo rừng, khoanh nuôi tái sinh", fields: ["sold", "retained", "seedCost", "materialCost", "otherCost"] },
  { id: "services", code: "4", label: "Dịch vụ lâm nghiệp", fields: ["sold", "retained", "otherCost"] },
  { id: "compensation", code: "5", label: "Tiền được đền bù/hỗ trợ thiệt hại về lâm nghiệp do dịch bệnh, thiên tai, môi trường", fields: ["compensation"] },
];
export const forestryFields = ["sold", "retained", "seedCost", "materialCost", "otherCost", "compensation"];
export const forestryRow = (category = "harvesting") => ({
  key: crypto.randomUUID(), category, description: "",
  ...Object.fromEntries(forestryFields.map((field) => [field, ""])),
});
export const forestryHasData = (row) => Boolean(row.description?.trim() || forestryFields.some((field) => Number(row[field])));
const repeated = (category) => category === "harvesting";
const standard = (category) => ["nursery", "forestCare"].includes(category);

export function loadForestry(value) {
  const source = value?.rows || [];
  return {
    hasIncome: value?.hasIncome ?? null,
    rows: forestryCategories.flatMap(({ id, repeated: isRepeated }) => {
      const saved = source.filter((row) => row.category === id);
      return saved.length ? saved.map((row) => ({ ...forestryRow(id), ...row, key: crypto.randomUUID() }))
        : Array.from({ length: isRepeated ? 2 : 1 }, () => forestryRow(id));
    }),
  };
}

export function forestryPayload(value) {
  return {
    hasIncome: value.hasIncome,
    rows: value.hasIncome === true ? value.rows
      .filter((row) => !repeated(row.category) || forestryHasData(row))
      .map((row) => ({
        category: row.category, description: row.description.trim(),
        ...Object.fromEntries(forestryFields.map((field) => [field, Number(row[field] || 0)])),
      })) : [],
  };
}

const units = (value) => Math.round(Number(value || 0) * 1000);
export function forestryRowTotals(row) {
  if (row.category === "compensation") {
    return { sold: 0, retained: 0, revenue: 0, seedCost: 0, materialCost: 0, otherCost: 0, totalCost: 0, income: units(row.compensation) / 1000 };
  }
  const sold = units(row.sold), retained = units(row.retained);
  const seedCost = standard(row.category) ? units(row.seedCost) : 0;
  const materialCost = standard(row.category) ? units(row.materialCost) : 0;
  const otherCost = units(row.otherCost), revenue = sold + retained, totalCost = seedCost + materialCost + otherCost;
  return Object.fromEntries(Object.entries({ sold, retained, revenue, seedCost, materialCost, otherCost, totalCost, income: revenue - totalCost })
    .map(([key, amount]) => [key, amount / 1000]));
}

export function forestryTotals(value) {
  const totals = { sold: 0, retained: 0, revenue: 0, seedCost: 0, materialCost: 0, otherCost: 0, totalCost: 0, income: 0 };
  if (value.hasIncome === true) for (const row of value.rows) {
    for (const [key, amount] of Object.entries(forestryRowTotals(row))) totals[key] += units(amount);
  }
  return Object.fromEntries(Object.entries(totals).map(([key, amount]) => [key, amount / 1000]));
}
