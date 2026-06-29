"use client"

import { memo, useId } from "react"
import { Minus, PackageSearch } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency } from "@/shared/presentation/currency"
import type { CatalogProduct } from "../application/catalog-query-port"
import type { ScannerRow } from "./use-pos-terminal"

interface ScannerRowItemProps {
  row: ScannerRow
  rowIndex: number
  onQueryChange: (rowId: string, value: string) => void
  onQueryKeyDown: (e: React.KeyboardEvent, rowId: string) => void
  onQuantityChange: (rowId: string, value: string) => void
  onQuantityKeyDown: (e: React.KeyboardEvent, rowId: string) => void
  onSelectCandidate: (rowId: string, product: CatalogProduct) => void
  onClearRow: (rowId: string) => void
  registerProductRef: (rowId: string, el: HTMLInputElement | null) => void
  registerQuantityRef: (rowId: string, el: HTMLInputElement | null) => void
}

const ScannerRowItem = memo(function ScannerRowItem({
  row,
  rowIndex,
  onQueryChange,
  onQueryKeyDown,
  onQuantityChange,
  onQuantityKeyDown,
  onSelectCandidate,
  onClearRow,
  registerProductRef,
  registerQuantityRef,
}: ScannerRowItemProps) {
  const dropdownId = useId()
  const isEmpty = !row.query && !row.resolvedProduct

  const rowBg = row.committed
    ? "bg-[#F0F4F2]"
    : isEmpty && rowIndex > 0
      ? "bg-background/50"
      : "bg-background"

  return (
    <div
      className={`relative grid grid-cols-[1fr_140px_100px_36px] items-center gap-3 px-4 py-2 transition-colors ${rowBg}`}
    >
      <span
        className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground/40 select-none"
        aria-hidden
      >
        {rowIndex + 1}
      </span>

      {/* Product field */}
      <div className="relative pl-4">
        <Input
          ref={(el) => registerProductRef(row.id, el)}
          value={row.resolvedProduct ? row.resolvedProduct.name : row.query}
          onChange={(e) => {
            if (!row.resolvedProduct) onQueryChange(row.id, e.target.value)
          }}
          onKeyDown={(e) => onQueryKeyDown(e, row.id)}
          placeholder={rowIndex === 0 ? "Escaneá o escribí un producto..." : ""}
          readOnly={!!row.resolvedProduct}
          aria-label={`Producto fila ${rowIndex + 1}`}
          aria-autocomplete="list"
          aria-expanded={row.showDropdown}
          aria-controls={row.showDropdown ? dropdownId : undefined}
          className={[
            "h-8 text-sm",
            row.resolvedProduct
              ? "cursor-default border-[#006c3a]/30 bg-[#F0F4F2] text-[#006c3a] font-medium focus-visible:ring-[#006c3a]/20"
              : "",
            row.isSearching ? "opacity-60" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        />

        {row.showDropdown && row.candidates.length > 0 && (
          <div className="absolute left-4 top-full z-50 mt-1 w-full min-w-[260px] overflow-hidden rounded-xl border border-border bg-card shadow-xl">
            <div className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
              {row.candidates.length} resultado{row.candidates.length !== 1 ? "s" : ""} — elegí uno
            </div>
            <div
              id={dropdownId}
              role="listbox"
              className="max-h-52 overflow-y-auto py-1"
            >
              {row.candidates.map((c) => (
                <div
                  key={c.id}
                  role="option"
                  aria-selected={false}
                  tabIndex={0}
                  onClick={() => onSelectCandidate(row.id, c)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      onSelectCandidate(row.id, c)
                    }
                  }}
                  className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-[#F0F4F2] hover:text-[#006c3a]"
                >
                  <span className="truncate font-medium">{c.name}</span>
                  <span className="shrink-0 font-semibold text-[#006c3a]">
                    {formatCurrency(c.price)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Price */}
      <span
        className={[
          "text-right text-sm font-semibold tabular-nums",
          row.resolvedProduct ? "text-foreground" : "text-muted-foreground/40",
        ].join(" ")}
      >
        {row.resolvedProduct ? formatCurrency(row.resolvedProduct.price) : "—"}
      </span>

      {/* Quantity */}
      <Input
        ref={(el) => registerQuantityRef(row.id, el)}
        type="number"
        min="1"
        step="1"
        value={row.quantity}
        onChange={(e) => onQuantityChange(row.id, e.target.value)}
        onKeyDown={(e) => onQuantityKeyDown(e, row.id)}
        disabled={!row.resolvedProduct}
        className="h-8 text-right text-sm font-semibold tabular-nums disabled:opacity-30"
        aria-label={`Cantidad fila ${rowIndex + 1}`}
      />

      {/* Clear */}
      <Button
        size="icon"
        variant="ghost"
        className="size-8 shrink-0 rounded-lg text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive disabled:opacity-0"
        disabled={isEmpty}
        onClick={() => onClearRow(row.id)}
        tabIndex={-1}
        aria-label={`Limpiar fila ${rowIndex + 1}`}
      >
        <Minus />
      </Button>
    </div>
  )
})

export interface PosScannerPanelProps {
  rows: ScannerRow[]
  catalogError: string | null
  onQueryChange: (rowId: string, value: string) => void
  onQueryKeyDown: (e: React.KeyboardEvent, rowId: string) => void
  onSelectCandidate: (rowId: string, product: CatalogProduct) => void
  onQuantityChange: (rowId: string, value: string) => void
  onQuantityKeyDown: (e: React.KeyboardEvent, rowId: string) => void
  onClearRow: (rowId: string) => void
  registerProductRef: (rowId: string, el: HTMLInputElement | null) => void
  registerQuantityRef: (rowId: string, el: HTMLInputElement | null) => void
}

export function PosScannerPanel({
  rows,
  catalogError,
  onQueryChange,
  onQueryKeyDown,
  onSelectCandidate,
  onQuantityChange,
  onQuantityKeyDown,
  onClearRow,
  registerProductRef,
  registerQuantityRef,
}: PosScannerPanelProps) {
  return (
    <Card className="flex flex-col gap-0 overflow-hidden rounded-xl border-border bg-card">
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex items-center gap-2">
          <PackageSearch className="size-5 text-[#006c3a]" />
          <h2 className="text-base font-semibold text-foreground">Carga de productos</h2>
          <span className="ml-auto text-xs text-muted-foreground">
            Presioná{" "}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
              Enter
            </kbd>{" "}
            para confirmar cada campo
          </span>
        </div>

        {catalogError && (
          <p className="text-sm text-destructive" role="alert">
            {catalogError}
          </p>
        )}

        {/* Grid header */}
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="grid grid-cols-[1fr_140px_100px_36px] gap-3 border-b border-border bg-muted/40 px-4 py-2.5">
            <span className="pl-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Producto / Código de barras
            </span>
            <span className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Precio unit.
            </span>
            <span className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Cantidad
            </span>
            <span />
          </div>

          <div className="flex flex-col divide-y divide-border">
            {rows.map((row, idx) => (
              <ScannerRowItem
                key={row.id}
                row={row}
                rowIndex={idx}
                onQueryChange={onQueryChange}
                onQueryKeyDown={onQueryKeyDown}
                onQuantityChange={onQuantityChange}
                onQuantityKeyDown={onQuantityKeyDown}
                onSelectCandidate={onSelectCandidate}
                onClearRow={onClearRow}
                registerProductRef={registerProductRef}
                registerQuantityRef={registerQuantityRef}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
