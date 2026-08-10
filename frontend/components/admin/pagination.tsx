import React from "react";

type StablePaginationOptions = {
  page: number;
  itemCount: number;
};

export function useStablePagination(
  setPage: React.Dispatch<React.SetStateAction<number>>,
  { page, itemCount }: StablePaginationOptions,
) {
  const viewportRef = React.useRef<{ windowY: number; contentY: number } | null>(null);

  const changePage = React.useCallback(
    (nextPage: number) => {
      const content = document.querySelector(".admin-content") as HTMLElement | null;
      viewportRef.current = {
        windowY: window.scrollY,
        contentY: content?.scrollTop ?? 0,
      };

      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      setPage(nextPage);
    },
    [setPage],
  );

  React.useEffect(() => {
    if (!viewportRef.current) return;

    const { windowY, contentY } = viewportRef.current;
    viewportRef.current = null;

    // React commits the new page, then the browser may run scroll anchoring.
    // Restore on the next two frames so the final layout wins deterministically.
    let frame = 0;
    let rafId = 0;
    const restore = () => {
      const content = document.querySelector(".admin-content") as HTMLElement | null;
      if (content) content.scrollTop = contentY;
      if (window.scrollY !== windowY) {
        window.scrollTo({ top: windowY, left: window.scrollX, behavior: "auto" });
      }
      frame += 1;
      if (frame < 3) rafId = requestAnimationFrame(restore);
    };
    rafId = requestAnimationFrame(restore);
    return () => cancelAnimationFrame(rafId);
  }, [page, itemCount]);

  return changePage;
}

type PaginationProps = {
  page: number;
  totalPages: number;
  total: number;
  label: string;
  onPageChange: (page: number) => void;
};

export function PaginationControls({
  page,
  totalPages,
  total,
  label,
  onPageChange,
}: PaginationProps) {
  // Change page on pointer-down, before the browser can focus/auto-scroll the
  // button into view. This is important when the current page has fewer rows.
  const goToPage = React.useCallback(
    (nextPage: number) => (event: React.MouseEvent<HTMLButtonElement> | React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      if (event.currentTarget.disabled) return;
      event.currentTarget.blur();
      onPageChange(nextPage);
    },
    [onPageChange],
  );

  return (
    <div
      data-pagination-root="true"
      style={{
        marginTop: 16,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <span style={{ color: "var(--text-muted)", fontSize: 14 }}>{label.replace("{total}", String(total))}</span>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          type="button"
          className="btn secondary pagination-btn"
          disabled={page <= 1}
          onMouseDown={(event) => event.preventDefault()}
          onPointerDown={goToPage(page - 1)}
          onClick={(event) => event.preventDefault()}
          tabIndex={-1}
        >
          Trước
        </button>
        <span style={{ minWidth: 90, textAlign: "center", fontWeight: 700 }}>
          Trang {page}/{Math.max(totalPages, 1)}
        </span>
        <button
          type="button"
          className="btn secondary pagination-btn"
          disabled={page >= totalPages}
          onMouseDown={(event) => event.preventDefault()}
          onPointerDown={goToPage(page + 1)}
          onClick={(event) => event.preventDefault()}
          tabIndex={-1}
        >
          Sau
        </button>
      </div>
    </div>
  );
}
