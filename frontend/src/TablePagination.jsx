import { paginationRange } from "./paginationRange";
import "./TablePagination.css";

function PageIcon({ direction, edge = false }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
    {direction === "left" ? <path d="m14 5-7 7 7 7" /> : <path d="m10 5 7 7-7 7" />}
    {edge && <path d={direction === "left" ? "M5 4v16" : "M19 4v16"} />}
  </svg>;
}

export default function TablePagination({ total, page, pageSize, onPageChange, onPageSizeChange, disabled = false }) {
  const { totalPages, currentPage, pages, firstRow, lastRow } = paginationRange(total, pageSize, page);
  const number = (value) => value.toLocaleString("vi-VN");
  return <div className="table-pagination">
    <div className="table-pagination-summary" role="status">Hiện <strong>{number(firstRow)} - {number(lastRow)}</strong> trong số <strong>{number(total)}</strong> dòng</div>
    <select className="table-pagination-size" aria-label="Số dòng mỗi trang" value={pageSize} disabled={disabled} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
      {[10, 20, 50, 100].map((size) => <option key={size} value={size}>Hiện {size} dòng</option>)}
    </select>
    <nav className="table-pagination-pages" aria-label="Phân trang danh sách khám">
      <button type="button" aria-label="Trang đầu" title="Trang đầu" disabled={disabled || currentPage === 1} onClick={() => onPageChange(1)}><PageIcon direction="left" edge /></button>
      <button type="button" aria-label="Trang trước" title="Trang trước" disabled={disabled || currentPage === 1} onClick={() => onPageChange(currentPage - 1)}><PageIcon direction="left" /></button>
      {pages[0] > 1 && <span className="table-pagination-ellipsis" aria-hidden="true">…</span>}
      {pages.map((value) => <button type="button" key={value} className={value === currentPage ? "is-current" : ""} aria-label={`Trang ${value}`} aria-current={value === currentPage ? "page" : undefined} disabled={disabled} onClick={() => onPageChange(value)}>{value}</button>)}
      {pages[pages.length - 1] < totalPages && <span className="table-pagination-ellipsis" aria-hidden="true">…</span>}
      <button type="button" aria-label="Trang sau" title="Trang sau" disabled={disabled || currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)}><PageIcon direction="right" /></button>
      <button type="button" aria-label="Trang cuối" title="Trang cuối" disabled={disabled || currentPage === totalPages} onClick={() => onPageChange(totalPages)}><PageIcon direction="right" edge /></button>
    </nav>
  </div>;
}
