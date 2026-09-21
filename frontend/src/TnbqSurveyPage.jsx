import { useEffect, useState } from "react";
import api from "./api";
import TnbqSalaryTab from "./TnbqSalaryTab";
import TnbqCropsTab from "./TnbqCropsTab";
import TnbqLivestockTab from "./TnbqLivestockTab";
import TnbqForestryTab from "./TnbqForestryTab";
import TnbqAquacultureTab from "./TnbqAquacultureTab";
import TnbqBusinessTab from "./TnbqBusinessTab";
import TnbqOtherIncomeTab from "./TnbqOtherIncomeTab";
import TnbqSummaryTab from "./TnbqSummaryTab";
import TnbqHouseholdPicker from "./TnbqHouseholdPicker";
import { householdCandidates, getHouseholdHamlets, householdSelection, normalizeCommune, normalizeHamlet } from "./tnbqHouseholdSelection";
import { loadSalary, salaryPayload } from "./tnbqSalary";
import { loadCrops, cropsPayload } from "./tnbqCrops";
import { loadLivestock, livestockPayload } from "./tnbqLivestock";
import { loadForestry, forestryPayload } from "./tnbqForestry";
import { loadAquaculture, aquaculturePayload } from "./tnbqAquaculture";
import { loadBusiness, businessPayload } from "./tnbqBusiness";
import { loadOtherIncome, otherIncomePayload } from "./tnbqOtherIncome";
import "./TnbqSurveyPage.css";

const tabs = [
  "Thông tin hộ", "Mục 1: Tiền lương, tiền công", "Mục 2: Trồng trọt",
  "Mục 3: Chăn nuôi", "Mục 4: Lâm nghiệp", "Mục 5: Thủy sản",
  "Mục 6: Sản xuất kinh doanh", "Mục 7: Thu nhập khác", "Biểu tổng hợp",
];
const currentYear = new Date().getFullYear();
const emptyForm = (year = currentYear) => ({
  year, commune: "", communeCode: "", hamlet: "", hamletCode: "",
  householdNumber: "", headName: "", address: "", phone: "", members: "",
});
const messageOf = (error) => error.response?.data?.message
  || Object.values(error.response?.data?.errors || {}).flat().join(" ")
  || "Không thể kết nối máy chủ. Vui lòng thử lại.";
const normalize = (value) => String(value ?? "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

function SectionHeading({ number, title, dirty, record }) {
  return <div className="survey-form-heading">
    <div><span className="survey-eyebrow">TAB {number} / 9</span><h3>{title}</h3></div>
    <span className={"badge " + (dirty ? "text-bg-warning" : record ? "text-bg-success" : "text-bg-light")}>
      {dirty ? "Chưa lưu thay đổi" : record ? "Đã lưu" : "Phiếu mới"}
    </span>
  </div>;
}

export default function TnbqSurveyPage() {
  const [form, setForm] = useState(() => emptyForm());
  const [record, setRecord] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [salary, setSalary] = useState(() => loadSalary());
  const [crops, setCrops] = useState(() => loadCrops());
  const [livestock, setLivestock] = useState(() => loadLivestock());
  const [forestry, setForestry] = useState(() => loadForestry());
  const [aquaculture, setAquaculture] = useState(() => loadAquaculture());
  const [business, setBusiness] = useState(() => loadBusiness());
  const [otherIncome, setOtherIncome] = useState(() => loadOtherIncome());
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [rows, setRows] = useState([]);
  const [listYear, setListYear] = useState(currentYear);
  const [query, setQuery] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [listResult, setListResult] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [catalogDefaults, setCatalogDefaults] = useState(null);
  const [householdResult, setHouseholdResult] = useState(null);
  const [householdRefresh, setHouseholdRefresh] = useState(0);

  const loadingHouseholds = householdResult?.key !== householdRefresh;
  const householdRows = loadingHouseholds ? [] : householdResult?.rows || [];
  const candidates = householdCandidates(householdRows, form);
  const householdHamlets = getHouseholdHamlets(householdRows, form);

  const newForm = () => ({ ...emptyForm(),
    commune: catalogDefaults?.commune?.name || "", communeCode: catalogDefaults?.commune?.code || "",
    hamlet: catalogDefaults?.hamlet?.name || "", hamletCode: catalogDefaults?.hamlet?.code || "",
  });

  const listKey = listYear + ":" + refresh;
  const loadingList = listResult?.key !== listKey;

  useEffect(() => {
    let cancelled = false;
    api.get("/TnbqCatalog/defaults").then(({ data }) => {
      if (cancelled) return;
      setCatalogDefaults(data);
      setForm((current) => record || dirty ? current : { ...current,
        commune: current.commune || data.commune?.name || "", communeCode: current.communeCode || data.commune?.code || "",
        hamlet: current.hamlet || data.hamlet?.name || "", hamletCode: current.hamletCode || data.hamlet?.code || "",
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    api.get("/TnbqSurveys", { params: { year: listYear }, signal: controller.signal })
      .then(({ data }) => { setRows(data); setListResult({ key: listKey, error: "" }); })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setRows([]);
          setListResult({ key: listKey, error: messageOf(error) });
        }
      });
    return () => controller.abort();
  }, [listYear, listKey]);

  useEffect(() => {
    const controller = new AbortController();
    api.get("/TnbqHouseholds", { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) setHouseholdResult({ key: householdRefresh, rows: data, error: "" });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setHouseholdResult({ key: householdRefresh, rows: [], error: messageOf(error) });
      });
    return () => controller.abort();
  }, [householdRefresh]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = (key, value) => {
    setForm((current) => {
      const changedArea = (key === "year" && Number(current.year) !== Number(value))
        || (key === "commune" && normalizeCommune(current.commune) !== normalizeCommune(value))
        || (key === "hamlet" && normalizeHamlet(current.hamlet) !== normalizeHamlet(value));
      const next = { ...current, [key]: value };
      return changedArea ? householdSelection(next, null) : next;
    });
    setDirty(true); setMessage(null);
  };
  const selectHousehold = (row) => {
    setForm((current) => ({ ...householdSelection(current, row), address: row?.address?.trim() || "" }));
    setDirty(true); setMessage(null);
  };
  const sectionChange = (setter) => (value) => { setter(value); setDirty(true); setMessage(null); };
  const discardAllowed = () => !dirty || window.confirm("Thông tin đang nhập chưa được lưu. Bạn có muốn bỏ thay đổi này?");
  const resetSections = () => {
    setSalary(loadSalary()); setCrops(loadCrops()); setLivestock(loadLivestock()); setForestry(loadForestry()); setAquaculture(loadAquaculture()); setBusiness(loadBusiness()); setOtherIncome(loadOtherIncome());
  };
  const newSurvey = () => {
    if (!discardAllowed()) return;
    setActiveTab(0); resetSections(); setForm(newForm()); setRecord(null); setDirty(false); setMessage(null);
  };
  const openSurvey = async (id) => {
    if (!discardAllowed()) return;
    setBusy(true); setMessage(null);
    try {
      const { data } = await api.get("/TnbqSurveys/" + id);
      setForm(Object.fromEntries(Object.keys(emptyForm()).map((key) => [key, data[key] ?? ""])));
      setSalary(loadSalary(data.salary)); setCrops(loadCrops(data.crops));
      setLivestock(loadLivestock(data.livestock)); setForestry(loadForestry(data.forestry)); setAquaculture(loadAquaculture(data.aquaculture)); setBusiness(loadBusiness(data.business)); setOtherIncome(loadOtherIncome(data.otherIncome));
      setRecord(data); setDirty(false); setActiveTab(0);
      document.getElementById("survey-household")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) { setMessage({ type: "danger", text: messageOf(error) }); }
    finally { setBusy(false); }
  };
  const save = async (event) => {
    event.preventDefault();
    const invalid = document.querySelector("#survey-household :invalid, #survey-salary :invalid, #survey-crops :invalid, #survey-livestock :invalid, #survey-forestry :invalid, #survey-aquaculture :invalid, #survey-business :invalid");
    if (invalid) {
      const ids = ["survey-household", "survey-salary", "survey-crops", "survey-livestock", "survey-forestry", "survey-aquaculture", "survey-business"];
      setActiveTab(ids.findIndex((id) => invalid.closest("#" + id)));
      requestAnimationFrame(() => invalid.reportValidity());
      return;
    }
    const salaryData = salaryPayload(salary);
    if (salaryData.hasIncome === true && salaryData.rows.length === 0) {
      setActiveTab(1); setMessage({ type: "danger", text: "Nhập ít nhất một thành viên khi chọn Có ở Mục 1." }); return;
    }
    if (salaryData.rows.length > Number(form.members)) {
      setActiveTab(1); setMessage({ type: "danger", text: "Số thành viên Mục 1 vượt tổng số thành viên của hộ ở Tab 1." }); return;
    }
    const payload = {
      ...form, year: Number(form.year), members: Number(form.members), revision: record?.revision || 0,
      salary: salaryData, crops: cropsPayload(crops), livestock: livestockPayload(livestock), forestry: forestryPayload(forestry), aquaculture: aquaculturePayload(aquaculture), business: businessPayload(business), otherIncome: otherIncomePayload(otherIncome),
    };
    for (const key of ["commune", "hamlet", "householdNumber", "headName"]) {
      if (!String(payload[key]).trim()) {
        setActiveTab(0); setMessage({ type: "danger", text: "Vui lòng nhập đầy đủ các trường có dấu *." }); return;
      }
    }
    setBusy(true); setMessage(null);
    try {
      const { data } = record ? await api.put("/TnbqSurveys/" + record.id, payload) : await api.post("/TnbqSurveys", payload);
      setRecord(data); setForm(Object.fromEntries(Object.keys(emptyForm()).map((key) => [key, data[key] ?? ""])));
      setSalary(loadSalary(data.salary)); setCrops(loadCrops(data.crops));
      setLivestock(loadLivestock(data.livestock)); setForestry(loadForestry(data.forestry)); setAquaculture(loadAquaculture(data.aquaculture)); setBusiness(loadBusiness(data.business)); setOtherIncome(loadOtherIncome(data.otherIncome));
      setDirty(false); setListYear(data.year); setRefresh((value) => value + 1);
      setMessage({ type: "success", text: "Đã lưu phiếu đến Mục 7. Bạn có thể mở lại trong danh sách bên dưới." });
    } catch (error) { setMessage({ type: "danger", text: messageOf(error) }); }
    finally { setBusy(false); }
  };


  const requestSurveyAction = (type, row) => {
    if (!busy) setPendingAction({ type, row });
  };
  const completeSurveyAction = async () => {
    if (!pendingAction) return;
    const { type, row } = pendingAction;
    setBusy(true); setMessage(null);
    try {
      if (type === "invalid") {
        const { data } = await api.patch("/TnbqSurveys/" + row.id + "/invalid", {
          isInvalid: !row.isInvalid, revision: row.revision,
        });
        setRows((current) => current.map((item) => item.id === row.id
          ? { ...item, isInvalid: data.isInvalid, revision: data.revision, updatedAt: data.updatedAt } : item));
        setRecord((current) => current?.id === row.id
          ? { ...current, isInvalid: data.isInvalid, revision: data.revision, updatedAt: data.updatedAt } : current);
        setMessage({ type: data.isInvalid ? "warning" : "success", text: data.isInvalid ? "Đã đánh dấu phiếu sai." : "Đã bỏ đánh dấu phiếu sai." });
      } else {
        await api.delete("/TnbqSurveys/" + row.id, { params: { revision: row.revision } });
        setRows((current) => current.filter((item) => item.id !== row.id));
        if (record?.id === row.id) {
          resetSections(); setForm(newForm()); setRecord(null); setDirty(false); setActiveTab(0);
        }
        setMessage({ type: "success", text: "Đã xóa phiếu thu thập." });
      }
      setPendingAction(null);
    } catch (error) {
      setMessage({ type: "danger", text: messageOf(error) });
      setPendingAction(null);
    } finally { setBusy(false); }
  };

  const field = (key, label, options = {}) => <label className={"survey-field " + (options.wide ? "survey-wide" : "")} htmlFor={"survey-" + key}>
    <span>{label}{options.required && <span className="text-danger"> *</span>}</span>
    <input id={"survey-" + key} name={key} className="form-control" value={form[key]}
      onChange={(event) => update(key, event.target.value)} type={options.type || "text"} required={options.required}
      maxLength={options.maxLength} min={options.min} max={options.max} step={options.type === "number" ? "1" : undefined}
      readOnly={options.readOnly} list={options.list}
      inputMode={options.inputMode} pattern={options.pattern} title={options.title} placeholder={options.placeholder} autoComplete="off" />
    {options.hint && <small>{options.hint}</small>}
  </label>;

  const shownRows = rows.filter((row) => normalize([row.headName, row.hamlet, row.householdNumber].join(" ")).includes(normalize(query)));
  const years = [...new Set([currentYear, Number(form.year) || currentYear, listYear,
    ...Array.from({ length: currentYear - 2000 + 1 }, (_, index) => currentYear - index)])].sort((a, b) => b - a);
  const context = <>Hộ số {form.householdNumber || "—"} · {form.headName || "Chưa nhập chủ hộ"} · Năm {form.year}</>;

  return <section className="tnbq-survey">
    <header className="survey-page-heading">
      <div><span className="survey-eyebrow">THỐNG KÊ TNBQ · PHIẾU 01/TN-HO</span>
        <h2>Nhập phiếu thu thập</h2><p>Phiếu thu thập thông tin thu nhập hộ gia đình.</p></div>
      <button type="button" className="btn btn-outline-primary" disabled={busy} onClick={newSurvey}>+ Phiếu mới</button>
    </header>

    <div className="survey-tabs" role="tablist" aria-label="Các phần của phiếu thu thập">
      {tabs.map((tab, index) => <button key={tab} type="button" role="tab" id={"survey-tab-" + index}
        aria-selected={index === activeTab} aria-controls={index < 9 ? ["survey-household", "survey-salary", "survey-crops", "survey-livestock", "survey-forestry", "survey-aquaculture", "survey-business", "survey-other-income", "survey-summary"][index] : undefined}
        disabled={busy} className={index === activeTab ? "active" : ""} onClick={() => setActiveTab(index)}
        title={tab}><span>{index + 1}</span>{tab}</button>)}
    </div>

    {message && <div className={"alert alert-" + message.type} role="alert">{message.text}</div>}

    <section hidden={activeTab !== 0} id="survey-household" role="tabpanel" aria-labelledby="survey-tab-0" className="survey-card">
      <SectionHeading number="1" title="Thông tin hộ" dirty={dirty} record={record} />
      <p className="text-muted small">Nhập thông tin theo trang đầu của phiếu. Các trường có dấu * là bắt buộc.</p>
      <form onSubmit={save} noValidate><fieldset disabled={busy}>
        <div className="survey-form-grid">
          {field("year", "Năm điều tra", { type: "number", required: true, min: 2000, max: 2100 })}
          <div className="survey-field survey-reference"><span>Mẫu phiếu</span><strong>01/TN-HO</strong></div>
          {field("commune", "Xã/phường", { required: true, maxLength: 150 })}
          {field("communeCode", "Mã xã/phường", { inputMode: "numeric", maxLength: 5, pattern: "[0-9]{5}", title: "Nhập đủ 5 chữ số hoặc để trống.", hint: "5 chữ số; giữ nguyên số 0 ở đầu." })}
          {field("hamlet", "Địa bàn điều tra (ấp/khu phố)", { required: true, maxLength: 150, list: "survey-household-hamlets" })}
          {field("hamletCode", "Mã địa bàn", { inputMode: "numeric", maxLength: 3, pattern: "[0-9]{3}", title: "Nhập đủ 3 chữ số hoặc để trống.", hint: "3 chữ số; ví dụ: 006." })}
          <TnbqHouseholdPicker key={JSON.stringify([record?.id, form.year, normalizeCommune(form.commune), normalizeHamlet(form.hamlet)])}
            form={form} candidates={candidates} loading={loadingHouseholds} error={loadingHouseholds ? "" : householdResult?.error}
            onRetry={() => setHouseholdRefresh((value) => value + 1)} onSelect={selectHousehold} />
          {field("householdNumber", "Hộ số", { required: true, readOnly: true, hint: "Tự điền theo chủ hộ được chọn từ Bảng kê hộ." })}
          {field("address", "Địa chỉ", { wide: true, maxLength: 500, placeholder: "Tổ, số nhà, đường…" })}
          {field("phone", "Số điện thoại", { type: "tel", maxLength: 30 })}
          {field("members", "Tổng số thành viên của hộ (người)", { type: "number", required: true, min: 1, max: 200 })}
        </div>
        <datalist id="survey-household-hamlets">{householdHamlets.map((hamlet) => <option key={hamlet} value={hamlet} />)}</datalist>
        <div className="survey-form-actions"><span>{record ? "Lần lưu gần nhất: " + new Date(record.updatedAt).toLocaleString("vi-VN") : "Lưu thông tin hộ để tiếp tục nhập phiếu."}</span>
          <div className="d-flex gap-2"><button className="btn btn-primary" type="submit">Lưu phiếu</button><button className="btn btn-outline-primary" type="button" onClick={() => setActiveTab(1)}>Tiếp: Mục 1 →</button></div>
        </div>
      </fieldset></form>
    </section>

    <section hidden={activeTab !== 1} id="survey-salary" role="tabpanel" aria-labelledby="survey-tab-1" className="survey-card">
      <SectionHeading number="2" title="Mục 1: Thu nhập từ tiền lương, tiền công" dirty={dirty} record={record} /><p className="small text-muted">{context} · {form.members || "—"} thành viên</p>
      <form onSubmit={save} noValidate><fieldset disabled={busy}><TnbqSalaryTab value={salary} onChange={sectionChange(setSalary)} />
        <div className="survey-form-actions"><button type="button" className="btn btn-outline-secondary" onClick={() => setActiveTab(0)}>← Thông tin hộ</button><div className="d-flex gap-2"><button type="submit" className="btn btn-primary">Lưu phiếu</button><button type="button" className="btn btn-outline-primary" onClick={() => setActiveTab(2)}>Tiếp: Mục 2 →</button></div></div>
      </fieldset></form>
    </section>

    <section hidden={activeTab !== 2} id="survey-crops" role="tabpanel" aria-labelledby="survey-tab-2" className="survey-card">
      <SectionHeading number="3" title="Mục 2: Thu nhập từ trồng trọt" dirty={dirty} record={record} /><p className="small text-muted">{context}</p>
      <form onSubmit={save} noValidate><fieldset disabled={busy}><TnbqCropsTab value={crops} onChange={sectionChange(setCrops)} />
        <div className="survey-form-actions"><button type="button" className="btn btn-outline-secondary" onClick={() => setActiveTab(1)}>← Mục 1: Tiền lương, tiền công</button><div className="d-flex gap-2"><button type="submit" className="btn btn-primary">Lưu phiếu</button><button type="button" className="btn btn-outline-primary" onClick={() => setActiveTab(3)}>Tiếp: Mục 3 →</button></div></div>
      </fieldset></form>
    </section>

    <section hidden={activeTab !== 3} id="survey-livestock" role="tabpanel" aria-labelledby="survey-tab-3" className="survey-card">
      <SectionHeading number="4" title="Mục 3: Thu nhập từ chăn nuôi" dirty={dirty} record={record} /><p className="small text-muted">{context}</p>
      <form onSubmit={save} noValidate><fieldset disabled={busy}><TnbqLivestockTab value={livestock} onChange={sectionChange(setLivestock)} />
        <div className="survey-form-actions"><button type="button" className="btn btn-outline-secondary" onClick={() => setActiveTab(2)}>← Mục 2: Trồng trọt</button><div className="d-flex gap-2"><button type="submit" className="btn btn-primary">Lưu phiếu</button><button type="button" className="btn btn-outline-primary" onClick={() => setActiveTab(4)}>Tiếp: Mục 4 →</button></div></div>
      </fieldset></form>
    </section>

    <section hidden={activeTab !== 4} id="survey-forestry" role="tabpanel" aria-labelledby="survey-tab-4" className="survey-card">
      <SectionHeading number="5" title="Mục 4: Thu nhập từ lâm nghiệp" dirty={dirty} record={record} /><p className="small text-muted">{context}</p>
      <form onSubmit={save} noValidate><fieldset disabled={busy}><TnbqForestryTab value={forestry} onChange={sectionChange(setForestry)} />
        <div className="survey-form-actions"><button type="button" className="btn btn-outline-secondary" onClick={() => setActiveTab(3)}>← Mục 3: Chăn nuôi</button><div className="d-flex gap-2"><button type="submit" className="btn btn-primary">Lưu phiếu</button><button type="button" className="btn btn-outline-primary" onClick={() => setActiveTab(5)}>Tiếp: Mục 5 →</button></div></div>
      </fieldset></form>
    </section>

    <section hidden={activeTab !== 5} id="survey-aquaculture" role="tabpanel" aria-labelledby="survey-tab-5" className="survey-card">
      <SectionHeading number="6" title="Mục 5: Thu nhập từ thủy sản" dirty={dirty} record={record} /><p className="small text-muted">{context}</p>
      <form onSubmit={save} noValidate><fieldset disabled={busy}><TnbqAquacultureTab value={aquaculture} onChange={sectionChange(setAquaculture)} />
        <div className="survey-form-actions"><button type="button" className="btn btn-outline-secondary" onClick={() => setActiveTab(4)}>← Mục 4: Lâm nghiệp</button><div className="d-flex gap-2"><button type="submit" className="btn btn-primary">Lưu phiếu</button><button type="button" className="btn btn-outline-primary" onClick={() => setActiveTab(6)}>Tiếp: Mục 6 →</button></div></div>
      </fieldset></form>
    </section>

    <section hidden={activeTab !== 6} id="survey-business" role="tabpanel" aria-labelledby="survey-tab-6" className="survey-card">
      <SectionHeading number="7" title="Mục 6: Thu nhập từ hoạt động sản xuất kinh doanh" dirty={dirty} record={record} /><p className="small text-muted">{context}</p>
      <form onSubmit={save} noValidate><fieldset disabled={busy}><TnbqBusinessTab value={business} onChange={sectionChange(setBusiness)} />
        <div className="survey-form-actions"><button type="button" className="btn btn-outline-secondary" onClick={() => setActiveTab(5)}>← Mục 5: Thủy sản</button><div className="d-flex gap-2"><button type="submit" className="btn btn-primary">Lưu phiếu</button><button type="button" className="btn btn-outline-primary" onClick={() => setActiveTab(7)}>Tiếp: Mục 7 →</button></div></div>
      </fieldset></form>
    </section>

    <section hidden={activeTab !== 7} id="survey-other-income" role="tabpanel" aria-labelledby="survey-tab-7" className="survey-card">
      <SectionHeading number="8" title="Mục 7: Thu nhập khác" dirty={dirty} record={record} /><p className="small text-muted">{context}</p>
      <form onSubmit={save} noValidate><fieldset disabled={busy}><TnbqOtherIncomeTab value={otherIncome} onChange={sectionChange(setOtherIncome)} />
        <div className="survey-form-actions"><button type="button" className="btn btn-outline-secondary" onClick={() => setActiveTab(6)}>← Mục 6: Sản xuất kinh doanh</button><div className="d-flex gap-2"><button type="submit" className="btn btn-primary">Lưu phiếu</button><button type="button" className="btn btn-outline-primary" onClick={() => setActiveTab(8)}>Xem biểu tổng hợp →</button></div></div>
      </fieldset></form>
    </section>

    <section hidden={activeTab !== 8} id="survey-summary" role="tabpanel" aria-labelledby="survey-tab-8" className="survey-card">
      <SectionHeading number="9" title="Biểu tổng hợp thu nhập hộ" dirty={dirty} record={record} /><p className="small text-muted">{context}</p>
      <form onSubmit={save} noValidate><fieldset disabled={busy}>
        <TnbqSummaryTab salary={salary} crops={crops} livestock={livestock} forestry={forestry} aquaculture={aquaculture} business={business} otherIncome={otherIncome} />
        <div className="survey-form-actions"><button type="button" className="btn btn-outline-secondary" onClick={() => setActiveTab(7)}>← Mục 7: Thu nhập khác</button><button type="submit" className="btn btn-primary">Lưu phiếu</button></div>
      </fieldset></form>
    </section>

    <section className="survey-card">
      <h3>Phiếu đã lưu</h3>
      <div className="survey-list-tools">
        <label htmlFor="survey-list-year">Năm điều tra<select id="survey-list-year" className="form-select" value={listYear} onChange={(event) => setListYear(Number(event.target.value))}>{years.filter((year) => year >= 2000 && year <= 2100).map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
        <label htmlFor="survey-query" className="flex-grow-1">Tìm phiếu<input id="survey-query" className="form-control" placeholder="Tên chủ hộ, địa bàn, số hộ…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <button type="button" className="btn btn-outline-secondary" disabled={loadingList || busy} onClick={() => setRefresh((value) => value + 1)}>Tải lại</button>
      </div>
      {loadingList ? <p role="status">Đang tải phiếu…</p> : listResult?.error ? <div className="alert alert-danger" role="alert">{listResult.error}</div> :
        <div className="table-responsive"><table className="table align-middle"><thead><tr><th>Hộ số</th><th>Chủ hộ</th><th>Xã/phường</th><th>Địa bàn</th><th>Thành viên</th><th>Thao tác</th></tr></thead>
          <tbody>{shownRows.length === 0 ? <tr><td colSpan={6} className="text-center text-muted py-4">Chưa có phiếu phù hợp.</td></tr> : shownRows.map((row) => <tr key={row.id} className={row.isInvalid ? "survey-invalid-row" : ""}><td>{row.householdNumber}</td><td className={"fw-semibold " + (row.isInvalid ? "survey-invalid-name" : "")}>{row.headName}{row.isInvalid && <span className="badge text-bg-danger ms-2">Phiếu sai</span>}</td><td>{row.commune}</td><td>{row.hamlet}</td><td>{row.members}</td><td><div className="survey-list-actions"><button type="button" className="btn btn-sm btn-outline-primary" disabled={busy} onClick={() => openSurvey(row.id)}>Mở</button><button type="button" className={"btn btn-sm " + (row.isInvalid ? "btn-outline-success" : "btn-outline-warning")} disabled={busy} onClick={() => requestSurveyAction("invalid", row)}>{row.isInvalid ? "Bỏ sai" : "Phiếu sai"}</button><button type="button" className="btn btn-sm btn-outline-danger" disabled={busy} onClick={() => requestSurveyAction("delete", row)}>Xóa</button></div></td></tr>)}</tbody>
        </table></div>}
    </section>

    {pendingAction && <div className="survey-dialog-backdrop" role="presentation">
      <div className="survey-action-dialog" role="dialog" aria-modal="true" aria-labelledby="survey-action-title">
        <div className={"survey-action-icon " + (pendingAction.type === "delete" ? "danger" : "warning")}>
          {pendingAction.type === "delete" ? "!" : "?"}
        </div>
        <h4 id="survey-action-title">{pendingAction.type === "delete" ? "Xóa phiếu thu thập?" : pendingAction.row.isInvalid ? "Bỏ đánh dấu phiếu sai?" : "Đánh dấu phiếu sai?"}</h4>
        <p>Hộ số <strong>{pendingAction.row.householdNumber}</strong> · <strong>{pendingAction.row.headName}</strong></p>
        <p className="text-muted mb-4">{pendingAction.type === "delete"
          ? "Phiếu và toàn bộ dữ liệu các mục sẽ bị xóa vĩnh viễn."
          : pendingAction.row.isInvalid ? "Tên chủ hộ sẽ trở lại trạng thái bình thường trong danh sách phiếu."
          : "Tên chủ hộ sẽ hiển thị màu đỏ trong danh sách để dễ nhận biết."}</p>
        <div className="d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-light border" disabled={busy} onClick={() => setPendingAction(null)}>Hủy</button>
          <button type="button" className={"btn " + (pendingAction.type === "delete" ? "btn-danger" : pendingAction.row.isInvalid ? "btn-success" : "btn-warning")} disabled={busy} onClick={completeSurveyAction}>
            {pendingAction.type === "delete" ? "Xóa phiếu" : pendingAction.row.isInvalid ? "Bỏ đánh dấu" : "Đánh dấu sai"}
          </button>
        </div>
      </div>
    </div>}

  </section>;
}
