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
  const directory = fs.mkdtempSync(path.join(root, ".tools/address-test-"));
  try {
    await start(directory);
    const admin = (await login("quantrihethong")).token;
    await call("/Users", admin, "POST", { username: "processor", fullName: "Processor", password: "123456", modules: ["data-processing"] });
    await call("/Users", admin, "POST", { username: "healthonly", fullName: "Health", password: "123456", modules: ["health"] });
    const token = (await login("processor")).token;
    const health = (await login("healthonly")).token;
    await call("/UpdatedInformation/address-preview", null, "GET", undefined, 401);
    await call("/UpdatedInformation/address-preview", health, "GET", undefined, 403);
    await call("/UpdatedInformation/update-addresses", health, "POST", { items: [] }, 403);
    const sources = [];
    for (let i = 0; i < 105; i++) {
      const code = "00123456" + String(i).padStart(4, "0");
      await call("/Customers", admin, "POST", {
        code, name: "Person " + i, address: "Old " + i, taxCode: "1990",
        birthDate: "1990-01-01T00:00:00Z", examinationDate: "2026-09-23T00:00:00Z"
      });
      sources.push({ stt: String(i + 1), cccd: code, hoTen: "Person " + i, diaChi: i === 104 ? "" : "New " + i });
    }
    check((await call("/UpdatedInformation/address-preview", token)).length === 0, "Empty import shows no customers");
    sources.push({ ...sources[0], stt: "106" });
    sources.push({ stt: "107", cccd: "", hoTen: "Missing identity", diaChi: "Address" });
    for (let i = 0; i < 6; i++) sources.push({ stt: String(108 + i), cccd: "00999999999" + i, hoTen: "Unmatched " + i, diaChi: "Unmatched address" });
    await call("/UpdatedInformation/import", token, "POST", sources);
    const original = await call("/Customers", admin);
    let rows = await call("/UpdatedInformation/address-preview", token);
    const targets = (list) => [...new Map(list.flatMap(x => x.matches).filter(x => x.canUpdate).map(x => [x.customerId, x])).values()];
    check(rows.length === 113, "Every imported row is visible");
    check(rows.filter(x => x.matches.length).length === 106, "Matched import count includes duplicate source rows");
    check(rows.filter(x => !x.matches.length).length === 7, "Missing and unmatched identities remain visible");
    check(new Set(rows.flatMap(x => x.matches.map(m => m.customerId))).size === 105, "113 imported rows versus 105 unique matched customers is explained");
    check(new Set(rows.map(x => x.importId)).size === 113, "Each import has unique row key");
    assert.deepEqual(rows.map(x => x.stt), sources.map(x => x.stt));
    check(rows.find(x => x.stt === "107").status === "Thiếu căn cước", "Missing identity reason");
    check(rows.find(x => x.stt === "108").status === "Không tìm thấy hồ sơ khám", "Unmatched reason");
    check(rows.find(x => x.stt === "105").status === "Nguồn chưa có địa chỉ", "Blank address reason");
    check(rows.filter(x => x.duplicateCount === 2).length === 2, "Duplicate source rows both visible");
    check(targets(rows).length === 104, "Only unique eligible customers updated");
    const one = targets(rows)[0];
    let result = await call("/UpdatedInformation/update-addresses", token, "POST", { items: [one] });
    check(result.updated === 1, "Single row update");
    result = await call("/UpdatedInformation/update-addresses", token, "POST", { items: [one] });
    check(result.updated === 0, "Repeat submission idempotent");
    rows = await call("/UpdatedInformation/address-preview", token);
    check(rows.length === 113, "Updated rows remain visible");
    const stale = targets(rows)[0];
    await call("/UpdatedInformation/import", token, "POST", [{ cccd: stale.code, hoTen: "Conflict", diaChi: "Another address" }]);
    result = await call("/UpdatedInformation/update-addresses", token, "POST", { items: [stale] });
    check(result.updated === 0, "Source conflict after preview skipped");
    const other = targets(rows).find(x => x.customerId !== stale.customerId);
    result = await call("/UpdatedInformation/update-addresses", token, "POST", { items: [{ ...other, currentAddress: "Stale address" }] });
    check(result.updated === 0, "Stale current address skipped");
    rows = await call("/UpdatedInformation/address-preview", token);
    check(rows.length === 114 && rows.filter(x => x.code === stale.code).every(x => !x.canUpdate), "Conflicting source rows retained and disabled");
    result = await call("/UpdatedInformation/update-addresses", token, "POST", { items: targets(rows) });
    check(result.updated === 102, "Bulk updates all eligible across pages");
    const final = await call("/Customers", admin);
    for (const customer of final) {
      const before = original.find(x => x.id === customer.id);
      const { address, ...rest } = customer;
      const { address: oldAddress, ...beforeRest } = before;
      assert.deepEqual(rest, beforeRest);
    }
    checks++;
    check((await call("/UpdatedInformation/address-preview", token)).every(x => !x.canUpdate), "No eligible updates remain");
    await call("/UpdatedInformation/update-addresses", token, "POST", { items: [] }, 400);
    await stop();
    await start(directory);
    check((await call("/Customers", (await login("quantrihethong")).token)).filter(x => x.address.startsWith("New ")).length === 103, "Updates persist after restart");
    console.log("PASS: " + checks + " import row visibility, matching, single/bulk, authorization and persistence checks.");
  } finally { await stop(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
