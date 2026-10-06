export function paginationRange(total, pageSize, page) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.max(1, Math.min(page, totalPages));
  const pages = totalPages <= 7
    ? Array.from({ length: totalPages }, (_, index) => index + 1)
    : [...new Set([1, 2, 3, currentPage - 1, currentPage, currentPage + 1, totalPages - 2, totalPages - 1, totalPages])]
      .filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b);
  return { totalPages, currentPage, pages, firstRow: total ? (currentPage - 1) * pageSize + 1 : 0, lastRow: Math.min(currentPage * pageSize, total) };
}
