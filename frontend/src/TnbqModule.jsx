import { useEffect, useState } from "react";
import api from "./api";
import TnbqPage from "./TnbqPage";
import ImportTnbqPage from "./ImportTnbqPage";
import "./TnbqModule.css";

export default function TnbqModule({ mode, onImported }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api.get("/TnbqHouseholds").then(({ data }) => {
      if (!cancelled) setRows(data);
    }).catch((error) => {
      if (!cancelled) setError(error.response?.data?.message || "Không thể tải dữ liệu TNBQ. Vui lòng thử lại.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [retry]);

  const importHouseholds = async (items) => {
    const { data } = await api.post("/TnbqHouseholds/import", items);
    setRows((current) => [...current, ...data.items]);
    onImported();
  };

  const deleteHouseholds = async (selectedYear, hamlet) => {
    const { data } = await api.delete("/TnbqHouseholds", {
      params: { year: selectedYear, ...(hamlet ? { hamlet } : {}) },
    });
    setRows((current) => current.filter((row) => row.year !== Number(selectedYear) || (hamlet && row.hamlet !== hamlet)));
    return data.deleted;
  };

  return <div className="tnbq-module">
    {loading ? <p role="status">Đang tải dữ liệu TNBQ...</p> : error ?
      <div className="alert alert-danger" role="alert">{error} <button type="button" className="btn btn-outline-danger ms-2" onClick={() => { setError(""); setLoading(true); setRetry((value) => value + 1); }}>Thử lại</button></div> :
      mode === "import" ? <ImportTnbqPage year={year} onYearChange={setYear} onImport={importHouseholds} /> :
        <TnbqPage rows={rows} year={year} setYear={setYear} onDelete={deleteHouseholds} />}
  </div>;
}
