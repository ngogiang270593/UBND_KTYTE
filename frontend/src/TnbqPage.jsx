import { useMemo, useState } from "react";
import * as XLSX from "xlsx-js-style";

const integer = new Intl.NumberFormat("vi-VN");

export function StatisticsIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>;
}

function TnbqPage({ rows, year, setYear, onDelete }) {
  const currentYear = new Date().getFullYear();
  const [query, setQuery] = useState("");
  const [selectedHamlet, setSelectedHamlet] = useState("all");
  const [duplicateFilter, setDuplicateFilter] = useState("");
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [deleting, setDeleting] = useState(false);

  const yearRows = useMemo(() => rows.filter((row) => row.year === Number(year)
    && String(row.headName || "").trim().toLocaleLowerCase("vi") !== "tổng cộng"), [rows, year]);
  const duplicateInfo = useMemo(() => {
    const houseCounts = new Map();
    const householdCounts = new Map();
    const locationKey = (row) => [row.province, row.commune, row.hamlet]
      .map((value) => String(value || "").trim().toLocaleLowerCase("vi")).join("|");
    const add = (map, key) => { if (key) map.set(key, (map.get(key) || 0) + 1); };
    yearRows.forEach((row) => {
      const location = locationKey(row);
      const houseNumber = String(row.houseNumber || "").trim().toLocaleLowerCase("vi");
      const householdNumber = String(row.householdNumber || "").trim().toLocaleLowerCase("vi");
      if (houseNumber) add(houseCounts, `${location}|${houseNumber}`);
      if (householdNumber) add(householdCounts, `${location}|${householdNumber}`);
    });
    return new Map(yearRows.map((row) => {
      const location = locationKey(row);
      const houseNumber = String(row.houseNumber || "").trim().toLocaleLowerCase("vi");
      const householdNumber = String(row.householdNumber || "").trim().toLocaleLowerCase("vi");
      return [row.id, {
        house: Boolean(houseNumber && houseCounts.get(`${location}|${houseNumber}`) > 1),
        household: Boolean(householdNumber && householdCounts.get(`${location}|${householdNumber}`) > 1),
      }];
    }));
  }, [yearRows]);
  const hamlets = useMemo(() => [...new Set(yearRows.map((row) => row.hamlet || "Chưa phân ấp"))]
    .sort((a, b) => a.localeCompare(b, "vi")), [yearRows]);
  const visibleRows = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("vi");
    return yearRows.filter((row) => {
      const hamlet = row.hamlet || "Chưa phân ấp";
      const matchesHamlet = selectedHamlet === "all" || hamlet === selectedHamlet;
      const matchesQuery = [row.headName, row.address, row.houseNumber, row.householdNumber, row.note, hamlet]
        .some((value) => String(value ?? "").toLocaleLowerCase("vi").includes(keyword));
      const duplicate = duplicateInfo.get(row.id);
      const matchesDuplicate = !duplicateFilter || duplicate?.[duplicateFilter];
      return matchesHamlet && matchesQuery && matchesDuplicate;
    });
  }, [yearRows, selectedHamlet, query, duplicateFilter, duplicateInfo]);
  const groups = useMemo(() => hamlets.map((hamlet) => ({
    hamlet,
    rows: visibleRows.filter((row) => (row.hamlet || "Chưa phân ấp") === hamlet),
  })).filter((group) => group.rows.length > 0), [hamlets, visibleRows]);
  const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const page = Math.min(currentPage, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return visibleRows.slice(start, start + pageSize);
  }, [visibleRows, page, pageSize]);
  const paginatedGroups = useMemo(() => hamlets.map((hamlet) => ({
    hamlet,
    rows: paginatedRows.filter((row) => (row.hamlet || "Chưa phân ấp") === hamlet),
  })).filter((group) => group.rows.length > 0), [hamlets, paginatedRows]);

  const totalMembers = visibleRows.reduce((total, row) => total + Number(row.members || 0), 0);
  const displayedHouseholds = visibleRows.filter((row) => String(row.householdNumber || "").trim()).length;
  const controlRows = yearRows.filter((row) => selectedHamlet === "all" || (row.hamlet || "Chưa phân ấp") === selectedHamlet);
  const excelHouseholdTotal = [...controlRows.reduce((groups, row) => {
    const key = [row.province, row.commune, row.hamlet].map((value) => String(value || "").trim().toLocaleLowerCase("vi")).join("|");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
    return groups;
  }, new Map()).values()].reduce((total, groupRows) => {
    const lastNumber = [...groupRows].sort((a, b) => Number(a.id) - Number(b.id)).reverse()
      .map((row) => { const value = String(row.householdNumber || "").trim(); return /^\d+$/.test(value) ? Number(value) : Number.NaN; })
      .find(Number.isFinite);
    return total + (lastNumber || 0);
  }, 0);
  const duplicateHouseRows = controlRows.filter((row) => duplicateInfo.get(row.id)?.house).length;
  const duplicateHouseholdRows = controlRows.filter((row) => duplicateInfo.get(row.id)?.household).length;
  const duplicateRows = duplicateHouseholdRows;
  const deleteCurrentScope = async () => {
    const hamlet = selectedHamlet === "all" ? "" : selectedHamlet;
    const scope = hamlet ? `ấp/khu phố “${hamlet}” năm ${year}` : `toàn bộ dữ liệu năm ${year}`;
    if (!window.confirm(`Bạn có chắc muốn xóa ${scope}? Thao tác này không thể hoàn tác.`)) return;
    setDeleting(true);
    try {
      await onDelete(Number(year), hamlet);
      setCurrentPage(1);
    } catch (error) {
      window.alert(error.response?.data?.message || error.message || "Không thể xóa dữ liệu.");
    } finally {
      setDeleting(false);
    }
  };
  const exportExcel = () => {
    if (!groups.length) return;
    const workbook = XLSX.utils.book_new();
    const usedNames = new Set();
    groups.forEach((group, groupIndex) => {
      const meta = group.rows[0];
      const areaLabel = meta.areaType === "1" ? "Thành thị (1)" : meta.areaType === "2" ? "Nông thôn (2)" : "";
      const data = [
        ["Biểu số 01: BK-TNBQ", "", "", "", "", ""],
        ["BẢNG KÊ HỘ", "", "", "", "", ""],
        [`ĐIỀU TRA THU NHẬP BÌNH QUÂN NĂM ${year}`, "", "", "", "", ""],
        [],
        ["Tỉnh/thành phố", meta.province || "", "", "Xã/phường", meta.commune || "", ""],
        ["Ấp/Khu phố", group.hamlet, "", "Thành thị/Nông thôn", areaLabel, ""],
        ["Người lập bảng kê", meta.preparer || "", "", "Số điện thoại", meta.phone || "", ""],
        [],
        ["STT nhà", "STT hộ", "Họ và tên chủ hộ", "Địa chỉ của hộ", "Số nhân khẩu của hộ khi lập bảng kê", "Ghi chú"],
        ["A", "B", "C", "D", "1", "2"],
        ...group.rows.map((row) => [row.houseNumber || "", row.householdNumber || "", row.headName || "", row.address || "", Number(row.members || 0), row.note || ""]),
        ["", "", "TỔNG CỘNG", "", group.rows.reduce((total, row) => total + Number(row.members || 0), 0), ""],
      ];
      const sheet = XLSX.utils.aoa_to_sheet(data);
      const thinBorder = { style: "thin", color: { rgb: "4B5563" } };
      const allBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
      const setStyle = (range, style) => {
        const decoded = XLSX.utils.decode_range(range);
        for (let r = decoded.s.r; r <= decoded.e.r; r += 1) for (let c = decoded.s.c; c <= decoded.e.c; c += 1) {
          const address = XLSX.utils.encode_cell({ r, c });
          if (!sheet[address]) sheet[address] = { t: "s", v: "" };
          sheet[address].s = style;
        }
      };
      sheet["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } }, { s: { r: 4, c: 1 }, e: { r: 4, c: 2 } },
        { s: { r: 4, c: 4 }, e: { r: 4, c: 5 } }, { s: { r: 5, c: 1 }, e: { r: 5, c: 2 } },
        { s: { r: 5, c: 4 }, e: { r: 5, c: 5 } }, { s: { r: 6, c: 1 }, e: { r: 6, c: 2 } },
        { s: { r: 6, c: 4 }, e: { r: 6, c: 5 } },
      ];
      sheet["!cols"] = [{ wch: 12 }, { wch: 12 }, { wch: 30 }, { wch: 38 }, { wch: 22 }, { wch: 26 }];
      sheet["!rows"] = [{ hpt: 22 }, { hpt: 30 }, { hpt: 29 }, { hpt: 12 }, { hpt: 23 }, { hpt: 23 }, { hpt: 23 }, { hpt: 12 }, { hpt: 58 }, { hpt: 22 }, ...group.rows.map(() => ({ hpt: 25 })), { hpt: 27 }];
      sheet["!autofilter"] = { ref: `A9:F${10 + group.rows.length}` };
      sheet["!freeze"] = { xSplit: 0, ySplit: 10 };
      sheet["!margins"] = { left: 0.3, right: 0.3, top: 0.45, bottom: 0.45, header: 0.15, footer: 0.15 };
      sheet["!pageSetup"] = { orientation: "landscape", paperSize: 9, fitToWidth: 1, fitToHeight: 0 };
      setStyle("A1:F1", { font: { name: "Times New Roman", sz: 13, bold: true, color: { rgb: "3F4B5A" } }, alignment: { horizontal: "center", vertical: "center" } });
      setStyle("A2:F2", { font: { name: "Times New Roman", sz: 20, bold: true, color: { rgb: "172B4D" } }, alignment: { horizontal: "center", vertical: "center" } });
      setStyle("A3:F3", { font: { name: "Times New Roman", sz: 16, bold: true, color: { rgb: "172B4D" } }, alignment: { horizontal: "center", vertical: "center" } });
      ["A5", "D5", "A6", "D6", "A7", "D7"].forEach((cell) => { sheet[cell].s = { font: { name: "Times New Roman", sz: 11, bold: true, color: { rgb: "334155" } }, fill: { fgColor: { rgb: "EAF2FB" } }, alignment: { vertical: "center" }, border: allBorders }; });
      ["B5:C5", "E5:F5", "B6:C6", "E6:F6", "B7:C7", "E7:F7"].forEach((range) => setStyle(range, { font: { name: "Times New Roman", sz: 12, bold: true, color: { rgb: "162D4B" } }, fill: { fgColor: { rgb: "F8FBFF" } }, alignment: { vertical: "center", horizontal: "left" }, border: allBorders }));
      setStyle("A9:F9", { font: { name: "Times New Roman", sz: 12, bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "1F4E78" } }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: allBorders });
      setStyle("A10:F10", { font: { name: "Times New Roman", sz: 11, bold: true, color: { rgb: "1F2937" } }, fill: { fgColor: { rgb: "DCE6F1" } }, alignment: { horizontal: "center", vertical: "center" }, border: allBorders });
      const dataEnd = 10 + group.rows.length;
      if (group.rows.length) {
        setStyle(`A11:F${dataEnd}`, { font: { name: "Times New Roman", sz: 11, color: { rgb: "1F2937" } }, alignment: { vertical: "center", wrapText: true }, border: allBorders });
        setStyle(`A11:B${dataEnd}`, { font: { name: "Times New Roman", sz: 11, color: { rgb: "1F2937" } }, alignment: { horizontal: "center", vertical: "center" }, border: allBorders });
        setStyle(`E11:E${dataEnd}`, { font: { name: "Times New Roman", sz: 11, bold: true, color: { rgb: "1F2937" } }, alignment: { horizontal: "center", vertical: "center" }, border: allBorders, numFmt: "#,##0" });
      }
      const totalRow = 11 + group.rows.length;
      setStyle(`A${totalRow}:F${totalRow}`, { font: { name: "Times New Roman", sz: 11, bold: true, color: { rgb: "163A5F" } }, fill: { fgColor: { rgb: "E8F1F8" } }, alignment: { horizontal: "center", vertical: "center" }, border: allBorders });
      sheet[`E${totalRow}`].z = "#,##0";
      const baseName = String(group.hamlet || `Ấp ${groupIndex + 1}`).replaceAll(/[\\/?*[\]:]/g, " ").trim().slice(0, 31) || `Ấp ${groupIndex + 1}`;
      let sheetName = baseName;
      let suffix = 2;
      while (usedNames.has(sheetName)) sheetName = `${baseName.slice(0, 27)} (${suffix++})`;
      usedNames.add(sheetName);
      XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
    });
    const scope = selectedHamlet === "all" ? "tat-ca-ap" : selectedHamlet.toLocaleLowerCase("vi").normalize("NFD").replaceAll(/[\u0300-\u036f]/g, "").replaceAll(/đ/g, "d").replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-|-$/g, "");
    XLSX.writeFile(workbook, `Bang-ke-ho-${scope}-${year}.xlsx`);
  };

  return <div className="tnbq-page"><section className="panel tnbq-panel">
    <div className="panel-heading tnbq-heading"><div className="panel-icon"><StatisticsIcon /></div><div><span className="status-badge">TNBQ</span><h2>Danh sách bảng kê hộ theo ấp</h2><p>Tra cứu dữ liệu hộ điều tra thu nhập bình quân được phân nhóm theo ấp/khu phố.</p></div><button className="primary-button heading-action export-excel-button" type="button" disabled={!groups.length} onClick={exportExcel}><span>↓</span> Xuất Excel</button></div>
    <div className="tnbq-list-filters">
      <div className="field"><label htmlFor="tnbq-year">Năm điều tra</label><select id="tnbq-year" value={year} onChange={(event) => { setYear(Number(event.target.value)); setCurrentPage(1); }}>{[currentYear, currentYear - 1, currentYear - 2, currentYear - 3].map((item) => <option key={item}>{item}</option>)}</select></div>
      <div className="field"><label htmlFor="tnbq-hamlet">Ấp/Khu phố</label><select id="tnbq-hamlet" value={selectedHamlet} onChange={(event) => { setSelectedHamlet(event.target.value); setCurrentPage(1); }}><option value="all">Tất cả ấp/khu phố</option>{hamlets.map((hamlet) => <option key={hamlet} value={hamlet}>{hamlet}</option>)}</select></div>
      <div className="field tnbq-search"><label htmlFor="tnbq-query">Tìm kiếm</label><input id="tnbq-query" value={query} onChange={(event) => { setQuery(event.target.value); setCurrentPage(1); }} placeholder="Tên chủ hộ, địa chỉ, STT nhà, STT hộ..." /></div>
      <div className="field delete-data-field"><label>Xóa dữ liệu</label><button className="delete-data-button" type="button" disabled={deleting || controlRows.length === 0} onClick={deleteCurrentScope}>{deleting ? "Đang xóa..." : selectedHamlet === "all" ? `Xóa dữ liệu năm ${year}` : `Xóa dữ liệu ${selectedHamlet}`}</button></div>
    </div>
    <div className="tnbq-household-summary"><div><span>Số ấp/khu phố</span><strong>{integer.format(groups.length)}</strong></div><div><span>Tổng số hộ hiển thị</span><strong>{integer.format(displayedHouseholds)}</strong></div><div><span>Tổng số hộ dòng cuối Excel</span><strong>{integer.format(excelHouseholdTotal)}</strong></div><div><span>Tổng số nhân khẩu</span><strong>{integer.format(totalMembers)}</strong></div><div className={duplicateRows ? "duplicate-summary" : ""}><span>Dòng cần kiểm tra</span><strong>{integer.format(duplicateRows)}</strong></div></div>
    {displayedHouseholds !== excelHouseholdTotal && <p className="household-total-note">Số hộ hiển thị là số dòng có STT hộ; tổng cuối Excel lấy theo STT hộ cuối cùng của từng ấp. Hai số có thể lệch khi STT hộ bị trùng, để trống hoặc không liên tục.</p>}
    <div className="duplicate-tabs" aria-label="Kiểm soát dữ liệu trùng">
      <button className={`duplicate-tab all-tab ${duplicateFilter === "" ? "active" : ""}`} type="button" onClick={() => { setDuplicateFilter(""); setCurrentPage(1); }}>Tổng <strong>{integer.format(controlRows.length)}</strong></button>
      <button className={`duplicate-tab house-tab ${duplicateFilter === "house" ? "active" : ""}`} type="button" onClick={() => { setDuplicateFilter((current) => current === "house" ? "" : "house"); setCurrentPage(1); }}>Trùng STT nhà <strong>{integer.format(duplicateHouseRows)}</strong></button>
      <button className={`duplicate-tab household-tab ${duplicateFilter === "household" ? "active" : ""}`} type="button" onClick={() => { setDuplicateFilter((current) => current === "household" ? "" : "household"); setCurrentPage(1); }}>Trùng STT hộ <strong>{integer.format(duplicateHouseholdRows)}</strong></button>
    </div>

    {groups.length === 0 ? <div className="tnbq-empty">Không tìm thấy dữ liệu bảng kê phù hợp.</div> : <>
      <div className="tnbq-pagination tnbq-pagination-top">
        <label htmlFor="tnbq-page-size">Số dòng/trang</label>
        <select id="tnbq-page-size" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setCurrentPage(1); }}><option value={50}>50</option><option value={100}>100</option></select>
        <div className="tnbq-page-controls">
          <button type="button" onClick={() => setCurrentPage(1)} disabled={page === 1} aria-label="Trang đầu">«</button>
          <button type="button" onClick={() => setCurrentPage(page - 1)} disabled={page === 1} aria-label="Trang trước">‹</button>
          <strong>{page}/{totalPages}</strong>
          <button type="button" onClick={() => setCurrentPage(page + 1)} disabled={page === totalPages} aria-label="Trang sau">›</button>
          <button type="button" onClick={() => setCurrentPage(totalPages)} disabled={page === totalPages} aria-label="Trang cuối">»</button>
        </div>
      </div>
      {paginatedGroups.map((group) => {
      const meta = group.rows[0];
      const members = group.rows.reduce((total, row) => total + Number(row.members || 0), 0);
      return <section className="hamlet-section" key={group.hamlet}>
        <div className="hamlet-heading"><div><span>ẤP/KHU PHỐ</span><h3>{group.hamlet}</h3><p>{[meta.commune, meta.province].filter(Boolean).join(" · ") || "Chưa có thông tin địa bàn"}</p></div><div className="hamlet-stats"><span><strong>{group.rows.length}</strong> hộ</span><span><strong>{members}</strong> nhân khẩu</span></div></div>
        <div className="hamlet-metadata">
          <div><span>Tỉnh/thành phố</span><strong>{meta.province || "—"}</strong></div>
          <div><span>Xã/phường</span><strong>{meta.commune || "—"}</strong></div>
          <div><span>Ấp/Khu phố</span><strong>{meta.hamlet || "—"}</strong></div>
          <div><span>Khu vực</span><strong>{meta.areaType === "1" ? "Thành thị (1)" : meta.areaType === "2" ? "Nông thôn (2)" : "—"}</strong></div>
          <div><span>Người lập bảng kê</span><strong>{meta.preparer || "—"}</strong></div>
          <div><span>Số điện thoại</span><strong>{meta.phone || "—"}</strong></div>
        </div>
        <div className="config-table-wrap tnbq-table-wrap"><table className="config-table tnbq-table">
          <thead><tr><th>STT nhà</th><th>STT hộ</th><th>Họ và tên chủ hộ</th><th>Địa chỉ của hộ</th><th>Số nhân khẩu của hộ khi lập bảng kê</th><th>Ghi chú</th><th>Kiểm tra</th></tr><tr className="tnbq-column-codes"><th>A</th><th>B</th><th>C</th><th>D</th><th>1</th><th>2</th><th>!</th></tr></thead>
          <tbody>{group.rows.map((row) => { const duplicate = duplicateInfo.get(row.id); const duplicateClass = duplicate?.household ? "duplicate-household-row" : duplicate?.house ? "duplicate-house-row" : ""; return <tr className={duplicateClass} key={row.id}><td>{row.houseNumber || "—"}</td><td>{row.householdNumber || "—"}</td><td><strong>{row.headName || "—"}</strong></td><td>{row.address || "—"}</td><td className="number-cell">{integer.format(Number(row.members || 0))}</td><td>{row.note || ""}</td><td><div className="duplicate-badges">{duplicate?.house && <span className="house-badge">Trùng STT nhà</span>}{duplicate?.household && <span className="household-badge">Trùng STT hộ</span>}{!duplicate?.house && !duplicate?.household && "—"}</div></td></tr>; })}</tbody>
        </table></div>
      </section>;
      })}
      <div className="tnbq-pagination">
        <span>Hiển thị {integer.format((page - 1) * pageSize + 1)}–{integer.format(Math.min(page * pageSize, visibleRows.length))} / {integer.format(visibleRows.length)} hộ</span>
        <div className="tnbq-page-controls">
          <button type="button" onClick={() => setCurrentPage(page - 1)} disabled={page === 1}>Trang trước</button>
          <strong>{page}/{totalPages}</strong>
          <button type="button" onClick={() => setCurrentPage(page + 1)} disabled={page === totalPages}>Trang sau</button>
        </div>
      </div>
    </>}
  </section></div>;
}

export default TnbqPage;
