export function paginationRange(total, pageSize, page) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.max(1, Math.min(page, totalPages));
  const startPage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, index) => startPage + index);
  return { totalPages, currentPage, pages, firstRow: total ? (currentPage - 1) * pageSize + 1 : 0, lastRow: Math.min(currentPage * pageSize, total) };
}
