"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ADMIN_PAGE_SIZE } from "@/lib/mock-admin";

export interface DataTableColumn<T> {
  key: string;
  label: string;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  /** Extra classes for the header and body cells of this column. */
  className?: string;
  /** Sort value when the rendered cell isn't plain sortable text. */
  sortValue?: (row: T) => string | number;
  render: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  rows: readonly T[];
  columns: readonly DataTableColumn<T>[];
  rowKey: (row: T) => string;
  pageSize?: number;
  initialSort?: { key: string; direction: "asc" | "desc" };
  selectable?: boolean;
  selected?: readonly string[];
  onSelectedChange?: (ids: string[]) => void;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  className?: string;
}

type SortState = { key: string; direction: "asc" | "desc" } | null;

const ALIGN: Readonly<Record<"left" | "center" | "right", string>> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

/**
 * Sortable, paginated table with optional row selection.
 *
 * Sorting and paging are client-side — the console has no backend — and the
 * wrapper scrolls horizontally so dense tables stay usable on a laptop.
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  pageSize = ADMIN_PAGE_SIZE,
  initialSort = undefined,
  selectable = false,
  selected = [],
  onSelectedChange,
  onRowClick,
  emptyMessage = "Nothing to show yet.",
  className,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState>(initialSort ?? null);
  const [page, setPage] = useState(1);
  const headCheckbox = useRef<HTMLInputElement>(null);

  // A new row set (filter, search, delete) always starts back at page 1.
  useEffect(() => {
    setPage(1);
  }, [rows]);

  const sorted = useMemo(() => {
    if (!sort) return [...rows];
    const column = columns.find((entry) => entry.key === sort.key);
    if (!column?.sortValue) return [...rows];

    const direction = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const left = column.sortValue!(a);
      const right = column.sortValue!(b);

      if (typeof left === "number" && typeof right === "number") {
        return (left - right) * direction;
      }
      return String(left).localeCompare(String(right)) * direction;
    });
  }, [rows, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * pageSize;
  const pageRows = sorted.slice(start, start + pageSize);

  const pageIds = pageRows.map(rowKey);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));
  const someOnPageSelected = pageIds.some((id) => selected.includes(id));

  useEffect(() => {
    if (headCheckbox.current) {
      headCheckbox.current.indeterminate = someOnPageSelected && !allOnPageSelected;
    }
  }, [someOnPageSelected, allOnPageSelected]);

  const toggleSort = (column: DataTableColumn<T>) => {
    if (!column.sortable) return;
    setSort((current) =>
      current?.key === column.key
        ? { key: column.key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key: column.key, direction: "asc" },
    );
  };

  const toggleAllOnPage = () => {
    if (!onSelectedChange) return;
    const next = allOnPageSelected
      ? selected.filter((id) => !pageIds.includes(id))
      : Array.from(new Set([...selected, ...pageIds]));
    onSelectedChange(next);
  };

  const toggleRow = (id: string) => {
    if (!onSelectedChange) return;
    onSelectedChange(
      selected.includes(id) ? selected.filter((entry) => entry !== id) : [...selected, id],
    );
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="overflow-x-auto rounded-xl border border-[#242424] bg-[#141414]">
        <table className="w-full min-w-[46rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[#242424] text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
              {selectable && (
                <th scope="col" className="w-10 px-3 py-2.5">
                  <input
                    ref={headCheckbox}
                    type="checkbox"
                    aria-label="Select all rows on this page"
                    checked={allOnPageSelected}
                    onChange={toggleAllOnPage}
                    className="size-4 cursor-pointer rounded border-[#333] bg-[#151515] accent-blue-500"
                  />
                </th>
              )}

              {columns.map((column) => {
                const active = sort?.key === column.key;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={
                      active ? (sort?.direction === "asc" ? "ascending" : "descending") : undefined
                    }
                    className={cn(
                      "px-3 py-2.5 font-medium whitespace-nowrap",
                      ALIGN[column.align ?? "left"],
                      column.className,
                    )}
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded transition-colors duration-200 hover:text-foreground focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none",
                          active && "text-foreground",
                        )}
                      >
                        {column.label}
                        {active ? (
                          sort?.direction === "asc" ? (
                            <ChevronUp aria-hidden className="size-3" />
                          ) : (
                            <ChevronDown aria-hidden className="size-3" />
                          )
                        ) : (
                          <ChevronDown aria-hidden className="size-3 opacity-30" />
                        )}
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {pageRows.map((row, index) => {
              const id = rowKey(row);
              const isSelected = selected.includes(id);

              return (
                <tr
                  key={id}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    "border-b border-[#1F1F1F] transition-colors duration-150 last:border-b-0",
                    index % 2 === 1 && "bg-white/[0.015]",
                    "hover:bg-blue-500/6",
                    onRowClick && "cursor-pointer",
                    isSelected && "bg-blue-500/8",
                  )}
                >
                  {selectable && (
                    <td className="px-3 py-2.5" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select row ${id}`}
                        checked={isSelected}
                        onChange={() => toggleRow(id)}
                        className="size-4 cursor-pointer rounded border-[#333] bg-[#151515] accent-blue-500"
                      />
                    </td>
                  )}

                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        "px-3 py-2.5 align-middle",
                        ALIGN[column.align ?? "left"],
                        column.className,
                      )}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}

            {pageRows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="px-3 py-14 text-center"
                >
                  <span className="inline-flex flex-col items-center gap-2 text-muted-foreground">
                    <Inbox aria-hidden className="size-6 opacity-50" />
                    <span className="text-sm">{emptyMessage}</span>
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ---------- Pagination ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="tabular-nums">
          Showing {sorted.length === 0 ? 0 : start + 1}–{Math.min(start + pageSize, sorted.length)}{" "}
          of {sorted.length}
        </span>

        <div className="flex items-center gap-2">
          <span className="tabular-nums">
            Page {safePage} / {pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPage(Math.max(1, safePage - 1))}
            disabled={safePage <= 1}
            aria-label="Previous page"
            className="inline-flex size-8 items-center justify-center rounded-md border border-[#2A2A2A] text-muted-foreground transition-colors duration-200 hover:border-[#3A3A3A] hover:text-foreground focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none disabled:opacity-35"
          >
            <ChevronLeft aria-hidden className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setPage(Math.min(pageCount, safePage + 1))}
            disabled={safePage >= pageCount}
            aria-label="Next page"
            className="inline-flex size-8 items-center justify-center rounded-md border border-[#2A2A2A] text-muted-foreground transition-colors duration-200 hover:border-[#3A3A3A] hover:text-foreground focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none disabled:opacity-35"
          >
            <ChevronRight aria-hidden className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
