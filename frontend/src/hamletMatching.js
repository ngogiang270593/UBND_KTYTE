const HAMLET_ALIASES = new Map([
  ["tbc", "trang ba chan"],
]);

export function normalizeHamletName(value) {
  const normalized = String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/^[\s.:;-]*ap\s+/, "")
    .replace(/[\s.:;-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return HAMLET_ALIASES.get(normalized) ?? normalized;
}

function addressContainsHamlet(addressPart, hamletName) {
  const aliases = [...HAMLET_ALIASES]
    .filter(([, canonicalName]) => canonicalName === hamletName)
    .map(([alias]) => alias);
  return [hamletName, ...aliases].some((name) =>
    addressPart === name
      || addressPart.startsWith(`${name} `)
      || addressPart.endsWith(` ${name}`),
  );
}

export function findCustomerHamlet(customer, hamlets) {
  const parts = String(customer.address ?? "")
    .split(/[,;]/)
    .map(normalizeHamletName)
    .filter(Boolean);
  const normalizedHamlets = hamlets
    .map((hamlet) => ({ ...hamlet, normalizedName: normalizeHamletName(hamlet.name) }))
    .filter((hamlet) => hamlet.normalizedName);

  const exactMatch = normalizedHamlets.find((hamlet) =>
    parts.some((part) => part === hamlet.normalizedName),
  );
  if (exactMatch) return exactMatch;

  return normalizedHamlets
    .filter((hamlet) =>
      parts.some((part) => addressContainsHamlet(part, hamlet.normalizedName)),
    )
    .sort((first, second) => second.normalizedName.length - first.normalizedName.length)[0] ?? null;
}
