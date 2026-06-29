"use client"

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"

import { Button } from "@/components/ui/button"

export const PRODUCTS_PAGE_SIZE = 100

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function ProductTablePagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-4 pt-4"
    >
      <span data-testid="pagination-info" className="text-sm text-muted-foreground">
        Página {page} de {totalPages}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon-xs"
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          aria-label="Primera página"
        >
          <ChevronsLeft />
        </Button>
        <Button
          variant="outline"
          size="icon-xs"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          aria-label="Página anterior"
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          size="icon-xs"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          aria-label="Página siguiente"
        >
          <ChevronRight />
        </Button>
        <Button
          variant="outline"
          size="icon-xs"
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          aria-label="Última página"
        >
          <ChevronsRight />
        </Button>
      </div>
    </nav>
  )
}
