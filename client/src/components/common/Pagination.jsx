import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export const Pagination = ({
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  pageSize = 10,
  onPageChange,
  className = '',
}) => {
  if (totalItems === 0 || totalPages <= 1) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers with ellipsis window
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  const handlePageClick = (page) => {
    if (page === '...' || page === currentPage || page < 1 || page > totalPages) return;
    if (onPageChange) onPageChange(page);
  };

  return (
    <div
      role="navigation"
      aria-label="Pagination Navigation"
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-[#171014]/90 border border-[#49202C] rounded-2xl text-xs select-none ${className}`}
    >
      {/* Item Range Summary */}
      <div className="text-[#C7A5A8] font-mono text-center sm:text-left">
        Showing <span className="text-[#FFF4E8] font-bold">{startItem}</span> to{' '}
        <span className="text-[#FFF4E8] font-bold">{endItem}</span> of{' '}
        <span className="text-[#D7FF00] font-bold">{totalItems}</span> entries
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center gap-1">
        {/* First Page */}
        <button
          type="button"
          onClick={() => handlePageClick(1)}
          disabled={currentPage === 1}
          className="p-1.5 rounded-lg bg-[#260D17] border border-[#49202C] text-[#C7A5A8] hover:text-[#FFF4E8] hover:bg-[#851B2B]/30 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="First Page"
          aria-label="First Page"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        {/* Previous Page */}
        <button
          type="button"
          onClick={() => handlePageClick(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-1.5 rounded-lg bg-[#260D17] border border-[#49202C] text-[#C7A5A8] hover:text-[#FFF4E8] hover:bg-[#851B2B]/30 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="Previous Page"
          aria-label="Previous Page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Numbered Page Buttons */}
        <div className="flex items-center gap-1 mx-1">
          {getPageNumbers().map((page, idx) => {
            if (page === '...') {
              return (
                <span key={`ellipsis-${idx}`} className="px-2 py-1 text-[#6E6259] font-mono">
                  …
                </span>
              );
            }
            const isActive = page === currentPage;
            return (
              <button
                key={`page-${page}`}
                type="button"
                onClick={() => handlePageClick(page)}
                className={`min-w-[32px] h-8 px-2 rounded-lg font-bold font-mono transition-all text-xs flex items-center justify-center ${
                  isActive
                    ? 'bg-[#851B2B] text-[#FFF4E8] border border-[#851B2B] shadow-sm shadow-[#851B2B]/50'
                    : 'bg-[#260D17] text-[#C7A5A8] border border-[#49202C] hover:text-[#FFF4E8] hover:bg-[#851B2B]/20'
                }`}
              >
                {page}
              </button>
            );
          })}
        </div>

        {/* Next Page */}
        <button
          type="button"
          onClick={() => handlePageClick(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded-lg bg-[#260D17] border border-[#49202C] text-[#C7A5A8] hover:text-[#FFF4E8] hover:bg-[#851B2B]/30 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="Next Page"
          aria-label="Next Page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Last Page */}
        <button
          type="button"
          onClick={() => handlePageClick(totalPages)}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded-lg bg-[#260D17] border border-[#49202C] text-[#C7A5A8] hover:text-[#FFF4E8] hover:bg-[#851B2B]/30 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="Last Page"
          aria-label="Last Page"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
