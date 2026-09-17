export const normalizeObjectType = (value) => String(value ?? "").normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");

export function groupHealthRecords(customers, catalog, field = "objectType", includeEmpty = false) {
  const groups = new Map();
  catalog.forEach(({ name }) => {
    const key = normalizeObjectType(name);
    if (key && !groups.has(key)) groups.set(key, { key, label: name.trim(), records: [] });
  });
  customers.forEach((customer) => {
    const key = normalizeObjectType(customer[field]);
    if (!groups.has(key)) groups.set(key, { key, label: String(customer[field] || "").trim() || "Chưa xác định", records: [] });
    groups.get(key).records.push(customer);
  });
  return [...groups.values()].filter((group) => includeEmpty || group.records.length);
}

export const groupHealthObjects = (customers, catalog) => groupHealthRecords(customers, catalog);
