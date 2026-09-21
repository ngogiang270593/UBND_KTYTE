// Run after: dotnet build backend/backend.csproj -o .tools/access-build
// Uses a fresh, isolated SQLite database and an ephemeral HTTP port.
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const net = require("node:net");
const root = path.resolve(__dirname, "..");
const dll = path.join(root, ".tools/access-build/backend.dll");
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
  fs.mkdirSync(path.join(root, ".tools"), { recursive: true });
  const directory = fs.mkdtempSync(path.join(root, ".tools/access-test-"));
  if (process.argv[2]) fs.copyFileSync(path.resolve(process.argv[2]), path.join(directory, "app2026.db"));
  try {
    await start(directory);
    await call("/Users", null, "GET", undefined, 401);
    await call("/Setup/reset-admin", null, "POST", {}, 401);
    const system = await login("quantrihethong");
    check(system.isSystemAdmin && system.modules.length === 9, "System admin has all business modules");
    const adminToken = system.token;
    const legacy = await login("admin");
    await call("/TnbqHouseholds", legacy.token);
    await call("/Users", legacy.token, "GET", undefined, 403);
    const payload = { username: "limited", fullName: "Test User", password: "123456", modules: ["tnbq"], role: "SystemAdmin" };
    const user = await call("/Users", adminToken, "POST", payload);
    check(!user.isSystemAdmin && user.role === "User", "Cannot inject administrator role");
    await call("/Users", adminToken, "POST", { ...payload, username: "LIMITED" }, 409);
    await call("/Users", adminToken, "POST", { ...payload, username: "invalid", modules: ["system"] }, 400);
    await call("/Users", adminToken, "POST", { ...payload, username: "shortpass", password: "1" }, 400);
    const concurrent = await Promise.all([0, 1].map(() => fetch(base + "/Users", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + adminToken },
      body: JSON.stringify({ ...payload, username: "concurrent" }),
    }).then(response => response.status)));
    check(concurrent.sort().join(",") === "200,409", "Concurrent creation cannot duplicate usernames");
    const session = await login(" LIMITED ");
    const token = session.token;
    await call("/TnbqHouseholds", token);
    await call("/Customers", token, "GET", undefined, 403);
    await call("/Users", token, "GET", undefined, 403);
    await call("/Users", token, "POST", payload, 403);
    await call("/Users/" + user.id + "/access", token, "PUT", { modules: ["health"] }, 403);
    await call("/Setup/reset-admin", token, "POST", {}, 403);
    await call("/Users/" + user.id + "/access", adminToken, "PUT", { modules: [], isActive: true });
    await call("/TnbqHouseholds", token, "GET", undefined, 403);
    check((await call("/Auth/me", token)).modules.length === 0, "Current session sees revoked modules");
    await call("/Users/" + user.id + "/access", adminToken, "PUT", { modules: ["tnbq"], isActive: false });
    await call("/TnbqHouseholds", token, "GET", undefined, 403);
    await call("/Auth/me", token, "GET", undefined, 403);
    await login("limited", "123456", 403);

    const matrix = [
      ["tnbq", ["/TnbqHouseholds"], "/CampaignStats"],
      ["health", ["/Customers", "/CatalogItems?category=hamlet", "/PrintVoucher/customers"], "/CampaignStats"],
      ["campaign", ["/CampaignStats", "/Customers", "/CatalogItems?category=hamlet"], "/TnbqHouseholds"],
      ["data-processing", ["/PrintVoucher/customers", "/PrintVoucher/customers/object-type-mismatches", "/CatalogItems?category=hamlet"], "/MedicalRecords"],
      ["stats", ["/ImportData/customer-rows", "/TanChauInpatient", "/TanChauOutpatient", "/MedicalRecords", "/TanHoa", "/TanHoaNk", "/TanHoaPaidKsk", "/TanHoaAdmissionTc"], "/TnbqHouseholds"],
      ["hospital", ["/TanChauInpatient", "/TanChauOutpatient"], "/MedicalRecords"],
      ["record", ["/MedicalRecords"], "/TanHoa"],
      ["people", ["/CommuneSubjects", "/CatalogItems?category=objectType"], "/Customers"],
      ["tan-hoa", ["/TanHoa", "/TanHoaNk", "/TanHoaPaidKsk", "/TanHoaAdmissionTc"], "/MedicalRecords"],
    ];
    for (const [module, allowed, denied] of matrix) {
      await call("/Users/" + user.id + "/access", adminToken, "PUT", { modules: [module], isActive: true });
      for (const route of allowed) await call(route, token);
      await call(denied, token, "GET", undefined, 403);
      await call("/Users", token, "GET", undefined, 403);
      if (module === "stats") await call("/MedicalRecords/import", token, "POST", [], 403);
      if (module === "campaign") await call("/Customers", token, "POST", {}, 403);
      if (module === "people") await call("/CatalogItems", token, "POST", {}, 403);
      if (module === "health") await call("/PrintVoucher/customers/update-object-types", token, "POST", {}, 403);
    }
    const users = await call("/Users", adminToken);
    check(users.every(user => !("password" in user)), "Passwords and hashes are never returned");
    const systemId = users.find(user => user.username === "quantrihethong").id;
    await call("/Users/" + systemId + "/access", adminToken, "PUT", { modules: [], isActive: false }, 400);
    await call("/Auth/change-password", adminToken, "POST", { oldPassword: "123456", newPassword: "Changed123!" });
    await stop();
    await start(directory);
    await login("quantrihethong", "123456", 401);
    const restarted = await login("quantrihethong", "Changed123!");
    check(restarted.isSystemAdmin, "Restart preserves changed administrator credentials");
    check((await call("/Auth/me", (await login("limited")).token)).modules[0] === "tan-hoa", "Module permissions persist after restart");
    console.log("PASS: " + checks + " authentication, authorization, persistence and validation checks.");
    console.log("Test database: " + directory);
  } finally { await stop(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

