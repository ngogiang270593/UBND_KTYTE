// Run after: dotnet build backend/backend.csproj -o .tools/address-update-build
// Uses a fresh, isolated SQLite database and an ephemeral HTTP port.
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const net = require("node:net");
const root = path.resolve(__dirname, "..");
const dll = path.join(root, ".tools/address-update-build/backend.dll");
let processHandle;
let base;
let logs = "";
let checks = 0;
const check = (condition, message) => { assert(condition, message); checks++; };

async function start(dataDirectory) {
  const probe = net.createServer();
  probe.listen(0, "127.0.0.1"); await once(probe, "listening");
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  base = "http://127.0.0.1:" + port + "/api";
  processHandle = spawn("dotnet", [dll], {
    cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, DATABASE_URL: "", SUPABASE_CONNECTION_STRING: "", IMPORT_SQLITE_PATH: "",
      UBND_KTYTE_DATA_PROFILE: "test", UBND_KTYTE_DATA_DIR: dataDirectory,
      ASPNETCORE_URLS: "http://127.0.0.1:" + port },
  });
  processHandle.stdout.on("data", chunk => { logs += chunk; });
  processHandle.stderr.on("data", chunk => { logs += chunk; });
  for (let i = 0; i < 100; i++) {
    if (processHandle.exitCode !== null) throw Error("Backend exited: " + logs.slice(-4000));
    try { await fetch(base + "/Auth/me"); return; } catch { await new Promise(r => setTimeout(r, 100)); }
  }
  throw Error("Backend startup timed out: " + logs.slice(-4000));
}
async function stop() {
  if (processHandle && processHandle.exitCode === null) {
    const exit = once(processHandle, "exit"); processHandle.kill(); await exit;
  }
}
async function call(route, token, method = "GET", body, expected = 200) {
  const response = await fetch(base + route, {
    method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  assert.equal(response.status, expected, method + " " + route + ": " + text.slice(0, 500)); checks++;
  return text ? JSON.parse(text) : null;
}
const login = (username, password = "123456", expected = 200) =>
  call("/Auth/login", null, "POST", { username, password }, expected);


(async () => {
  const { parseElderly, columns } = await import("../frontend/src/elderlyImport.js");
  const header = columns.map(([, label]) => label);
  const source = ["Nguyễn Thị An", "1950", "Nữ", "001234567890", "Ấp 1", "24/09/2026"];
  const parsed = parseElderly([["Danh sách"], header, source, []]);
  check(parsed.length === 1 && parsed[0].cccd === source[3], "Preserve leading zero and skip blank rows");
  assert.deepEqual(parseElderly([header.toReversed(), source.toReversed()]), parsed);
  assert.throws(() => parseElderly([header.slice(0, 5), source]), /đủ cột/);
  assert.throws(() => parseElderly([header, ["", "1950"]]), /Dòng Excel 2/);
  assert.throws(() => parseElderly([header]), /không có dữ liệu/);
  const XLSX = require("../frontend/node_modules/xlsx");
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([header, [...source.slice(0, 5), new Date(2026, 8, 24)]]), "Test");
  const restored = XLSX.read(XLSX.write(book, { type: "buffer", bookType: "xlsx" }), { type: "buffer", cellDates: true, dateNF: "dd/mm/yyyy" });
  const matrix = XLSX.utils.sheet_to_json(restored.Sheets.Test, { header: 1, raw: false, defval: "", dateNF: "dd/mm/yyyy" });
  check(parseElderly(matrix)[0].ngayKham === "24/09/2026", "Excel date formatting");
  const directory = fs.mkdtempSync(path.join(root, ".tools/elderly-test-"));
  try {
    await start(directory);
    const admin = (await login("quantrihethong")).token;
    await call("/Users", admin, "POST", { username: "processor", fullName: "Processor", password: "123456", modules: ["data-processing"] });
    await call("/Users", admin, "POST", { username: "healthonly", fullName: "Health", password: "123456", modules: ["health"] });
    const token = (await login("processor")).token;
    const health = (await login("healthonly")).token;
    await call("/Elderly", null, "GET", undefined, 401);
    await call("/Elderly", health, "GET", undefined, 403);
    await call("/Elderly/import", health, "POST", parsed, 403);
    await call("/Elderly/import", token, "POST", [], 400);
    await call("/Elderly/import", token, "POST", [...parsed, { hoTen: "" }], 400);
    check((await call("/Elderly", token)).length === 0, "Invalid batch saves nothing");
    check((await call("/Elderly/import", token, "POST", parsed)).savedCount === 1, "Import count");
    const rows = await call("/Elderly", token);
    for (const [key] of columns) assert.equal(rows[0][key], parsed[0][key]);
    check((await call("/UpdatedInformation", token)).length === 0, "Separate source data");
    const withDate = parseElderly([[...header, "Ngày sinh"], [...source, "02/03/1950"]]);
    check(withDate[0].ngaySinh === "02/03/1950", "Optional date column");
    const makeCustomer = (code, name, birthDate, taxCode = "1950") =>
      call("/Customers", admin, "POST", { code, name, taxCode, birthDate, address: "Địa chỉ khám", examinationDate: "2026-09-24T00:00:00Z" });
    await makeCustomer("001234567890", "Khác tên", "1949-01-01T00:00:00Z");
    await makeCustomer("002", "Nguyễn Thị An", "1950-03-02T00:00:00Z");
    await makeCustomer("003", "Nguyễn Thị An", "1950-04-03T00:00:00Z");
    await makeCustomer("004", "Chỉ năm sinh", null, "1940");
    await call("/Elderly/import", token, "POST", [
      { ...parsed[0], cccd: "999", ngaySinh: "02/03/1950" },
      { ...parsed[0], cccd: "", ngaySinh: "31/02/1950" },
      { ...parsed[0], cccd: "", hoTen: "  nguyen   thi AN  ", namSinh: "1950" },
      { ...parsed[0], cccd: "", hoTen: "Chỉ năm sinh", namSinh: "1940" },
      { ...parsed[0], cccd: "", hoTen: "Không khớp", namSinh: "" },
      { ...parsed[0], cccd: "", hoTen: "Nguyễn Thị An", namSinh: "" }
    ]);
    await call("/Elderly/review", null, "GET", undefined, 401);
    await call("/Elderly/review", health, "GET", undefined, 403);
    let review = (await call("/Elderly/review", token)).sort((a,b) => a.id-b.id);
    check(review.length === 7, "Every imported row is visible");
    check(review[0].method === "Căn cước" && review[0].matches.length === 1 && review[0].matches[0].name === "Khác tên", "CCCD takes priority");
    check(review[1].method === "Họ tên + Ngày sinh" && review[1].matches.length === 1 && review[1].matches[0].code === "002", "Date fallback when CCCD does not match");
    check(review[2].method === "Họ tên + Năm sinh" && review[2].matches.length === 2, "Invalid full date falls back to year and keeps all matches");
    check(review[3].matches.length === 2, "Normalize accents, case and whitespace");
    check(review[4].matches.length === 1, "Use customer birth year when date missing");
    check(!review[5].matches.length && !review[6].matches.length, "No name-only or empty-field matches");
    await stop();
    await start(directory);
    check((await call("/Elderly", (await login("processor")).token)).length === 7, "Persists after restart");
    console.log("PASS: Elderly Excel parsing, six fields, authorization, atomic import and persistence (" + checks + " checks).");
  } finally { await stop(); }
})().catch(error => { console.error(error); process.exitCode = 1; });