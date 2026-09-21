// Run after: dotnet build backend/backend.csproj -o .tools/access-build
// Uses a fresh, isolated SQLite database and an ephemeral HTTP port.
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const net = require("node:net");
const root = path.resolve(__dirname, "..");
const dll = path.join(root, ".tools/survey-build/backend.dll");
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
 const directory=fs.mkdtempSync(path.join(root,'.tools/survey-test-'));
 if(process.argv[2])fs.copyFileSync(path.resolve(process.argv[2]),path.join(directory,'app2026.db'));
 try {
  await start(directory);
  await call('/TnbqSurveys?year=2026',null,'GET',undefined,401);
  const admin=(await login('quantrihethong')).token;
  await call('/Users',admin,'POST',{username:'surveytester',fullName:'Survey Tester',password:'123456',modules:['tnbq']});
  await call('/Users',admin,'POST',{username:'othersurvey',fullName:'Other Module',password:'123456',modules:['health']});
  const token=(await login('surveytester')).token,other=(await login('othersurvey')).token;
  const commune=await call('/TnbqCatalog/communes',token,'POST',{name:'Tân Hòa',code:'25525',province:'An Giang',isDefault:true});
  check(commune.isDefault===true,'Default commune created');
  const hamlet=await call('/TnbqCatalog/hamlets',token,'POST',{communeId:commune.id,name:'Ấp Tân Bình',code:'006',isDefault:true});
  check(hamlet.isDefault===true,'Default hamlet created');
  const defaults=await call('/TnbqCatalog/defaults',token);
  check(defaults.commune.code==='25525'&&defaults.hamlet.code==='006','Catalog defaults returned');
  const commune2=await call('/TnbqCatalog/communes',token,'POST',{name:'Xã thử',code:'25526',province:'An Giang',isDefault:true});
  check((await call('/TnbqCatalog/communes',token)).find(item=>item.id===commune.id).isDefault===false,'Only one default commune');
  await call('/TnbqCatalog/communes/'+commune2.id,token,'DELETE',undefined,204);
  await call('/TnbqCatalog/communes/'+commune.id,token,'DELETE',undefined,204);
  await call('/TnbqCatalog/hamlets?communeId='+commune.id,token,'GET',undefined,404);
  const data={year:2026,commune:'Tân Hòa',communeCode:'00123',hamlet:'Ấp thử',hamletCode:'006',householdNumber:'003',headName:'Hộ kiểm thử',address:'Địa chỉ thử',phone:'0900000000',members:2};
  await call('/TnbqSurveys?year=2026',other,'GET',undefined,403);
  await call('/TnbqSurveys',other,'POST',data,403);
  const saved=await call('/TnbqSurveys',token,'POST',data);
  check(saved.communeCode==='00123'&&saved.hamletCode==='006'&&saved.householdNumber==='003','Leading zeros preserved');
  check(saved.updatedBy==='surveytester','Audit username set by server');
  check((await call('/TnbqSurveys?year=2026',token)).length===1,'List by year');
  check((await call('/TnbqSurveys/'+saved.id,token)).address===data.address,'Read saved details');
  await call('/TnbqSurveys',token,'POST',{...data,commune:' tân hòa ',hamlet:' ấp thử '},409);
  await call('/TnbqSurveys',token,'POST',{...data,members:0},400);
  await call('/TnbqSurveys',token,'POST',{...data,members:1.5},400);
  await call('/TnbqSurveys',token,'POST',{...data,headName:' '},400);
  await call('/TnbqSurveys',token,'POST',{...data,hamletCode:'6'},400);
  await call('/TnbqSurveys',token,'POST',{...data,communeCode:'abcde'},400);
  await call('/TnbqSurveys',token,'POST',{...data,year:0},400);
  await call('/TnbqSurveys',token,'POST',{...data,year:2025});
  check((await call('/TnbqSurveys?year=2025',token)).length===1,'Independent survey year');
  const changed=await call('/TnbqSurveys/'+saved.id,token,'PUT',{...data,headName:'Đã cập nhật',revision:saved.revision});
  check(changed.revision===2,'Revision incremented');
  await call('/TnbqSurveys/'+saved.id,token,'PUT',{...data,revision:saved.revision},409);
  await call('/TnbqSurveys/'+saved.id,other,'PUT',{...data,revision:2},403);
  await call('/TnbqSurveys/999999',token,'GET',undefined,404);
  const salary={hasIncome:true,rows:[{code:'01',name:'Thành viên 1',wage:0,pension:0},{code:'02',name:'Thành viên 2',wage:0,pension:68200}]};
  let revised=await call('/TnbqSurveys/'+saved.id,token,'PUT',{...data,headName:'Đã cập nhật',revision:changed.revision,salary});
  check(revised.salary.wageTotal===0&&revised.salary.pensionTotal===68200&&revised.salary.total===68200,'Photo example salary totals');
  check(revised.salary.rows[0].code==='01','Member leading zero preserved');
  for(const bad of [
    {hasIncome:true,rows:[]},
    {hasIncome:false,rows:salary.rows},
    {hasIncome:true,rows:[{code:'1',name:'',wage:10,pension:0}]},
    {hasIncome:true,rows:[{code:'1',name:'A',wage:-1,pension:0}]},
    {hasIncome:true,rows:[{code:'1',name:'A',wage:0.0001,pension:0}]},
    {hasIncome:true,rows:[{code:'1',name:'A',wage:1000000001,pension:0}]},
    {hasIncome:true,rows:[{code:'1',name:'A',wage:0,pension:0},{code:'1',name:'B',wage:0,pension:0}]},
    {hasIncome:true,rows:null},
    {hasIncome:true,rows:[null]}
  ])await call('/TnbqSurveys/'+saved.id,token,'PUT',{...data,revision:revised.revision,salary:bad},400);
  await call('/TnbqSurveys/'+saved.id,token,'PUT',{...data,members:1,revision:revised.revision,salary},400);
  revised=await call('/TnbqSurveys/'+saved.id,token,'PUT',{...data,headName:'Đã cập nhật',revision:revised.revision});
  check(revised.salary.total===68200,'Tab 1-only saves preserve salary');
  revised=await call('/TnbqSurveys/'+saved.id,token,'PUT',{...data,headName:'Đã cập nhật',revision:revised.revision,salary:{hasIncome:false,rows:[]}});
  check(revised.salary.total===0&&revised.salary.rows.length===0,'No income clears rows and totals');
  revised=await call('/TnbqSurveys/'+saved.id,token,'PUT',{...data,headName:'Đã cập nhật',revision:revised.revision,salary:{hasIncome:true,rows:[{code:'01',name:'Decimal',wage:0.1,pension:0.2}]}});
  check(revised.salary.total===0.3,'Decimal money calculated precisely');
  const cropSample={hasIncome:true,rows:[
    {category:'plants',description:'Cây ăn trái',sold:0,retained:3000,seedCost:0,materialCost:130,otherCost:200},
    {category:'byproducts',description:'',sold:0,retained:2000,otherCost:300}
  ]};
  revised=await call('/TnbqSurveys/'+saved.id,token,'PUT',{...data,headName:'Đã cập nhật',revision:revised.revision,crops:cropSample});
  check(revised.crops.total===4370&&revised.crops.totals.revenue===5000&&revised.crops.totals.totalCost===630,'Crop photo example: 5000 - 630 = 4370');
  const cropMath=await import('../frontend/src/tnbqCrops.js');
  check(cropMath.cropsTotals(cropMath.loadCrops(revised.crops)).income===4370,'Frontend crop total agrees with backend');
  const extras={hasIncome:true,rows:[...cropSample.rows,{category:'services',serviceRevenue:600,otherCost:100},{category:'compensation',compensation:250}]};
  revised=await call('/TnbqSurveys/'+saved.id,token,'PUT',{...data,headName:'Đã cập nhật',revision:revised.revision,crops:extras});
  check(revised.crops.total===5120,'Services and compensation counted once');
  check(cropMath.cropsTotals(cropMath.loadCrops(revised.crops)).income===5120,'Frontend service and compensation totals');
  for(const bad of [
    {hasIncome:false,rows:cropSample.rows},
    {hasIncome:true,rows:[{category:'unknown'}]},
    {hasIncome:true,rows:[{category:'plants',retained:1,description:' '}]},
    {hasIncome:true,rows:[{category:'plants',description:'Test',retained:-1}]},
    {hasIncome:true,rows:[{category:'nursery',seedCost:0.0001}]},
    {hasIncome:true,rows:[{category:'nursery',sold:1000000001}]},
    {hasIncome:true,rows:[{category:'byproducts',seedCost:1}]},
    {hasIncome:true,rows:[{category:'services',sold:1}]},
    {hasIncome:true,rows:[{category:'compensation',serviceRevenue:1}]},
    {hasIncome:true,rows:[{category:'nursery'},{category:'nursery'}]},
    {hasIncome:true,rows:null}, {hasIncome:true,rows:[null]}
  ])await call('/TnbqSurveys/'+saved.id,token,'PUT',{...data,revision:revised.revision,crops:bad},400);
  revised=await call('/TnbqSurveys/'+saved.id,token,'PUT',{...data,headName:'Đã cập nhật',revision:revised.revision});
  check(revised.crops.total===5120&&revised.salary.total===0.3,'Older tab-only save preserves crops and salary');
  revised=await call('/TnbqSurveys/'+saved.id,token,'PUT',{...data,headName:'Đã cập nhật',revision:revised.revision,crops:{hasIncome:true,rows:[{category:'nursery',sold:0.1,retained:0.2,otherCost:1}]}});
  check(revised.crops.total===-0.7,'Crop loss and decimal money preserved');
  check(cropMath.cropsTotals(cropMath.loadCrops(revised.crops)).income===-0.7,'Frontend decimal crop loss');
  revised=await call('/TnbqSurveys/'+saved.id,token,'PUT',{...data,headName:'Đã cập nhật',revision:revised.revision,crops:{hasIncome:false,rows:[]}});
  check(revised.crops.total===0&&revised.crops.rows.length===0,'No crops clears rows and totals');
  revised=await call('/TnbqSurveys/'+saved.id,token,'PUT',{...data,headName:'Đã cập nhật',revision:revised.revision,crops:cropSample});
  const flagged=await call('/TnbqSurveys/'+saved.id+'/invalid',token,'PATCH',{isInvalid:true,revision:revised.revision});
  check(flagged.isInvalid===true&&flagged.revision===revised.revision+1,'Mark invalid persists and increments revision');
  const flaggedList=await call('/TnbqSurveys?year=2026',token);
  check(flaggedList.find(item=>item.id===saved.id).isInvalid===true,'Invalid status appears in survey list');
  await call('/TnbqSurveys/'+saved.id+'/invalid',token,'PATCH',{isInvalid:false,revision:revised.revision},409);
  const unflagged=await call('/TnbqSurveys/'+saved.id+'/invalid',token,'PATCH',{isInvalid:false,revision:flagged.revision});
  check(unflagged.isInvalid===false,'Unmark invalid succeeds');
  const disposable=await call('/TnbqSurveys',token,'POST',{...data,householdNumber:'004',headName:'Phiếu xóa thử'});
  await call('/TnbqSurveys/'+disposable.id+'?revision='+disposable.revision,token,'DELETE',undefined,204);
  check(!(await call('/TnbqSurveys?year=2026',token)).some(item=>item.id===disposable.id),'Deleted survey is removed from list');
  await stop();await start(directory);
  const restarted=(await login('surveytester')).token;
  const persisted=await call('/TnbqSurveys/'+saved.id,restarted);
  check(persisted.headName==='Đã cập nhật'&&persisted.householdNumber==='003','Changes persist after restart');
  check(persisted.salary.total===0.3&&persisted.salary.rows[0].name==='Decimal','Salary persists after restart');
  check(persisted.crops.total===4370&&persisted.crops.rows[0].description==='Cây ăn trái','Crops persist after restart');
  console.log('PASS: '+checks+' survey validation, permissions, save/edit, conflict and persistence checks.');
 } finally {await stop();}
})().catch(error=>{console.error(error);process.exitCode=1;});
