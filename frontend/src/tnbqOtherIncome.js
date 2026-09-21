export const otherIncomeFields = ["gifts", "socialSupport", "scholarship", "rental", "investment", "other"];

export function loadOtherIncome(value) {
  return Object.fromEntries(otherIncomeFields.map((field) => [field, value?.[field] ?? ""]));
}

export function otherIncomePayload(value) {
  return Object.fromEntries(otherIncomeFields.map((field) => [field, Number(value[field] || 0)]));
}

const units = (value) => Math.round(Number(value || 0) * 1000);
export function otherIncomeTotals(value) {
  const gifts = units(value.gifts), socialSupport = units(value.socialSupport), scholarship = units(value.scholarship);
  const rental = units(value.rental), investment = units(value.investment), other = units(value.other);
  const transfer = gifts + socialSupport + scholarship, assets = rental + investment;
  return { gifts: gifts / 1000, socialSupport: socialSupport / 1000, scholarship: scholarship / 1000, rental: rental / 1000,
    investment: investment / 1000, transfer: transfer / 1000, assets: assets / 1000, other: other / 1000, total: (transfer + assets + other) / 1000 };
}
