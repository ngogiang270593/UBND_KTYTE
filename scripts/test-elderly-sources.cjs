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
 const directory = fs.mkdtempSync(path.join(root, ".tools/elderly-sources-test-"));
 try {
  await start(directory);
  const admin = (await login("quantrihethong")).token;
  await call("/Users", admin, "POST", { username:"processor",fullName:"Processor",password:"123456",modules:["data-processing"] });
  await call("/Users", admin, "POST", { username:"healthonly",fullName:"Health",password:"123456",modules:["health"] });
  const token = (await login("processor")).token;
  const health = (await login("healthonly")).token;
  const sources = [
    ["/CommuneSubjects/import", {hoTen:"Source 0",ngaySinh:"02/03/1950",cccd:"000000000010",diaChi:"New 0",doiTuong:"NCT"}],
    ["/TanChauInpatient/import", {hoTen:"Source 1",ngaySinh:"02/03/1950",soCccd:"000000000011",diaChi:"New 1"}],
    ["/TanChauOutpatient/import", {hoTen:"Source 2",namSinh:"1950",cccd:"000000000012",diaChi:"New 2"}],
    ["/TanHoaNk/import", {hoTen:"Source 3",ngaySinh:"02/03/1950",namSinh:"1950",cccd:"000000000013",diaChi:"New 3"}],
    ["/MedicalRecords/import", {patientId:"TEST",fullName:"Source 4",dateOfBirth:"1950-03-02T00:00:00Z",citizenId:"000000000014",address:"New 4"}]
  ];
  for (const [route, data] of sources) await call(route,admin,"POST",[data]);
  await call("/Elderly/import",token,"POST",sources.map((_,i)=>({hoTen:"Source "+i,namSinh:"1950",ngaySinh:i===0?"02/03/1950":"",cccd:"bad"+i,diaChi:"Old "+i})));
  let rows=(await call("/Elderly/review",token)).sort((a,b)=>a.id-b.id);
  check(rows.every(row=>row.matches.length===0 && row.suggestions.length===1),"All five sources provide suggestions for unmatched rows");
  check(rows[0].sourceMethod==="Họ tên + Ngày sinh","Full-date priority");
  check(rows.slice(1).every(row=>row.sourceMethod==="Họ tên + Năm sinh"),"Year fallback for four sources");
  const payload=row=>({source:row.suggestions[0].source,sourceId:row.suggestions[0].id,currentCode:row.cccd,currentAddress:row.diaChi,newCode:row.suggestions[0].newCode,newAddress:row.suggestions[0].newAddress});
  const route=row=>"/Elderly/"+row.id+"/update-information";
  await call(route(rows[0]),null,"POST",payload(rows[0]),401);
  await call(route(rows[0]),health,"POST",payload(rows[0]),403);
  await call(route(rows[0]),token,"POST",{...payload(rows[0]),newCode:"forged"},409);
  await call(route(rows[0]),token,"POST",{...payload(rows[0]),currentAddress:"stale"},409);
  await call(route(rows[0]),token,"POST",{...payload(rows[0]),sourceId:999999},409);
  for(const row of rows) await call(route(row),token,"POST",payload(row));
  await call(route(rows[0]),token,"POST",payload(rows[0]),409);
  let saved=(await call("/Elderly",token)).sort((a,b)=>a.id-b.id);
  for(let i=0;i<5;i++) {
    check(saved[i].cccd==="00000000001"+i && saved[i].diaChi==="New "+i,"Updates code and address from source "+i);
    check(saved[i].hoTen===rows[i].hoTen && saved[i].namSinh===rows[i].namSinh && saved[i].ngaySinh===rows[i].ngaySinh,"Other fields preserved "+i);
  }
  await call("/CommuneSubjects/import",admin,"POST",[
    {hoTen:"Blank fields",ngaySinh:"01/01/1940",cccd:"",diaChi:"New address",doiTuong:"NCT"},
    {hoTen:"Blank fields",ngaySinh:"01/01/1940",cccd:"999",diaChi:"",doiTuong:"NCT"}
  ]);
  await call("/Elderly/import",token,"POST",[{hoTen:"Blank fields",namSinh:"1940",cccd:"old-code",diaChi:"Old address"}]);
  const blank=(await call("/Elderly/review",token)).find(row=>row.hoTen==="Blank fields");
  check(blank.suggestions.length===2,"Multiple candidates exposed");
  check(blank.suggestions.some(x=>x.newCode==="old-code"&&x.newAddress==="New address"),"Blank source code preserves current code");
  check(blank.suggestions.some(x=>x.newCode==="999"&&x.newAddress==="Old address"),"Blank source address preserves current address");
  await call("/Customers",admin,"POST",{code:saved[0].cccd,name:"Different name",taxCode:"1940",address:"Health address",examinationDate:"2026-09-24T00:00:00Z"});
  rows=await call("/Elderly/review",token);
  const matched=rows.find(row=>row.id===saved[0].id);
  check(matched.matches.length===1 && matched.suggestions.length===0,"Updated identity rematches health list");
  await call(route(matched),token,"POST",{source:"commune",sourceId:1,currentCode:matched.cccd,currentAddress:matched.diaChi,newCode:matched.cccd,newAddress:"forged"},409);
  await stop(); await start(directory);
  saved=await call("/Elderly",(await login("processor")).token);
  check(saved.filter(row=>row.diaChi.startsWith("New ")).length===5,"Updates persist after restart");
  console.log("PASS: "+checks+" five-source update, authorization, stale data, rematching and persistence checks.");
 } finally {await stop();}
})().catch(error=>{console.error(error);process.exitCode=1;});