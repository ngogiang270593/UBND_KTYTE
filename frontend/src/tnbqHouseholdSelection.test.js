import assert from "node:assert/strict";
import test from "node:test";
import { getHouseholdHamlets, householdCandidates, householdSelection, normalizeCommune, normalizeHamlet } from "./tnbqHouseholdSelection.js";

const form = { year: "2026", commune: "Tân Hòa", hamlet: "Ấp 1" };
const row = (overrides = {}) => ({ id: 1, year: 2026, commune: "Tân Hòa", hamlet: "Ấp 1", headName: "Nguyễn An", householdNumber: "001", ...overrides });

test("normalization accepts commune prefixes, NFC, whitespace and case while preserving diacritics", () => {
  assert.equal(normalizeCommune("  XÃ  TÂN   HÒA  "), "tân hòa");
  assert.equal(normalizeCommune("Phường Tân Hòa"), "tân hòa");
  assert.equal(normalizeCommune("Thị trấn Tân Hòa"), "tân hòa");
  assert.equal(normalizeCommune("Tân Hòa".normalize("NFD")), "tân hòa");
  assert.notEqual(normalizeCommune("Tan Hoa"), normalizeCommune("Tân Hòa"));
  assert.equal(normalizeHamlet("  ẤP   1  "), "ấp 1");
  assert.equal(normalizeHamlet("Ấp 1".normalize("NFD")), "ấp 1");
  assert.notEqual(normalizeHamlet("Ấp 1"), normalizeHamlet("1"));
  assert.notEqual(normalizeHamlet("Ấp 1"), normalizeHamlet("Ap 1"));
  assert.equal(normalizeCommune(null), "");
  assert.equal(normalizeHamlet(undefined), "");
});

test("candidates are scoped by year, commune and hamlet with aliases and normalized spelling", () => {
  const source = [
    row({ id: 1, commune: "  XÃ  TÂN HÒA", hamlet: "  ẤP  1 " }),
    row({ id: 2, year: 2025 }),
    row({ id: 3, commune: "Tân Bình" }),
    row({ id: 4, hamlet: "Ấp 2" }),
    row({ id: 5, commune: "Tan Hoa" }),
    row({ id: 6, hamlet: "Ap 1" }),
    row({ id: 7, commune: "Tân Hòa".normalize("NFD"), hamlet: "Ấp 1".normalize("NFD") }),
  ];
  assert.deepEqual(householdCandidates(source, form).map((item) => item.id), [1, 7]);
});

test("homonyms remain separate and sort by name, numeric household number, then id without mutating rows", () => {
  const source = [row({ id: 10, householdNumber: "2" }), row({ id: 3, householdNumber: "10" }),
    row({ id: 2, householdNumber: "2" }), row({ id: 4, headName: "Anh An", householdNumber: "099" })];
  const original = [...source];
  assert.deepEqual(householdCandidates(source, form).map((item) => item.id), [4, 2, 10, 3]);
  assert.deepEqual(source, original);
  assert.equal(householdCandidates(source, form)[0], source[3]);
});

test("missing scope and empty names or numbers never produce selectable households", () => {
  const source = [null, {}, row({ headName: null }), row({ headName: "  " }),
    row({ householdNumber: undefined }), row({ householdNumber: "  " }), row({ id: 7, householdNumber: 0 })];
  assert.deepEqual(householdCandidates(source, form).map((item) => item.id), [7]);
  for (const scope of [{}, { ...form, year: "" }, { ...form, year: "abc" }, { ...form, commune: "" }, { ...form, hamlet: " " }]) {
    assert.deepEqual(householdCandidates([row()], scope), []);
  }
  assert.deepEqual(householdCandidates(undefined, form), []);
});

test("hamlet options are clean, unique, sorted and confined to current commune and year", () => {
  const source = [row({ hamlet: "  Ấp   10 " }), row({ hamlet: "Ấp 2" }), row({ hamlet: "ẤP 2" }),
    row({ hamlet: "Ấp 1", commune: "Xã Tân Hòa" }), row({ hamlet: "Ap 2" }),
    row({ hamlet: "Ấp 3", year: 2025 }), row({ hamlet: "Ấp 4", commune: "Tân Bình" }),
    row({ hamlet: " " }), row({ hamlet: undefined }), null];
  const hamlets = getHouseholdHamlets(source, form);
  assert.deepEqual(hamlets, ["Ap 2", "Ấp 1", "Ấp 2", "Ấp 10"].sort((left, right) => left.localeCompare(right, "vi", { numeric: true })));
  assert.deepEqual(getHouseholdHamlets(source, { ...form, commune: "" }), []);
  assert.deepEqual(getHouseholdHamlets(undefined, form), []);
});

test("selection sets only name and household number and preserves leading zero and unrelated data", () => {
  const original = { ...form, headName: "Tên cũ", householdNumber: "999", address: "Địa chỉ đang nhập", members: 5,
    communeCode: "25531", hamletCode: "006", phone: "0900000000", notes: "Giữ lại" };
  const selected = householdSelection(original, row({ headName: "  Nguyễn   An ", householdNumber: " 001 ", address: "Khác", members: 2 }));
  assert.deepEqual(selected, { ...original, headName: "Nguyễn An", householdNumber: "001" });
  assert.equal(original.householdNumber, "999");
  assert.equal(householdSelection(original, row({ householdNumber: 0 })).householdNumber, "0");
});
