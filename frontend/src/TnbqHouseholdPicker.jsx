import { useState } from "react";
import { normalizeHamlet } from "./tnbqHouseholdSelection";

const searchable = (value) => normalizeHamlet(value).normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
const labelOf = (row) => `${row.headName} — Hộ số ${row.householdNumber}`;
const searchText = (row) => [row.headName, row.householdNumber, row.address].map(searchable).join(" ");

export default function TnbqHouseholdPicker({ form, candidates, loading, error, onRetry, onSelect }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ready = Boolean(form.year && form.commune.trim() && form.hamlet.trim());
  const selected = candidates.find((row) => normalizeHamlet(row.headName) === normalizeHamlet(form.headName)
    && String(row.householdNumber).trim() === String(form.householdNumber).trim());
  const retained = !selected && Boolean(form.headName && form.householdNumber);
  const matches = candidates.filter((row) => searchText(row).includes(searchable(query)));
  const unavailable = !ready || loading || Boolean(error) || !candidates.length;
  const display = selected ? labelOf(selected) : retained ? `${labelOf(form)} (phiếu hiện tại)` : "";

  const choose = (row) => {
    onSelect(row);
    setQuery("");
    setOpen(false);
  };

  return <div className="survey-field survey-household-picker">
    <label htmlFor="survey-headName">Họ và tên chủ hộ<span className="text-danger"> *</span></label>
    <div className="survey-combobox">
      <input id="survey-headName" name="headName" type="search" className="form-control"
        role="combobox" aria-autocomplete="list" aria-expanded={open && !unavailable}
        aria-controls="survey-household-options" aria-describedby="survey-household-help"
        placeholder={unavailable ? "Chọn năm, xã/phường và ấp trước" : "Gõ tên, hộ số hoặc địa chỉ để tìm…"}
        disabled={unavailable} autoComplete="off" value={open ? query : display}
        onFocus={() => { setOpen(true); setQuery(""); }}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
        onKeyDown={(event) => {
          if (event.key === "Escape") { setOpen(false); setQuery(""); }
          if (event.key === "Enter" && matches.length === 1) { event.preventDefault(); choose(matches[0]); }
        }} />
      {!unavailable && (form.headName || form.householdNumber) && <button className="survey-combobox-clear" type="button"
        aria-label="Xóa chủ hộ đã chọn" onClick={() => choose(null)}>×</button>}
      {open && !unavailable && <div id="survey-household-options" role="listbox" className="survey-combobox-options">
        {matches.length ? matches.map((row) => <button type="button" role="option" key={row.id}
          aria-selected={row === selected} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(row)}>
          <strong>{row.headName}</strong><span>Hộ số {row.householdNumber}</span>
          {row.address && <small>{row.address}</small>}
        </button>) : <p>Không tìm thấy chủ hộ phù hợp.</p>}
      </div>}
    </div>
    <small id="survey-household-help" role="status">
      {!ready ? "Nhập năm, xã/phường và ấp để chọn chủ hộ."
        : loading ? "Đang tải danh sách chủ hộ từ Bảng kê hộ…"
          : error ? "Không tải được Bảng kê hộ. " + error
            : !candidates.length ? "Chưa có chủ hộ trong Bảng kê hộ của ấp, xã và năm đang chọn."
              : `${matches.length} hộ phù hợp · Chọn một hộ để tự điền Hộ số và Địa chỉ.`}
      {retained && !loading && !error && " Chủ hộ trên phiếu đang được giữ nguyên; chưa tìm thấy trong Bảng kê hộ hiện tại."}
    </small>
    {error && <button type="button" className="btn btn-sm btn-outline-secondary align-self-start" onClick={onRetry}>Tải lại Bảng kê hộ</button>}
  </div>;
}
