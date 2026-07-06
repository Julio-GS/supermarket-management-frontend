"use client"

import React, { memo, useId } from "react"
import { Minus, PackageSearch, ShoppingCart, Trash2 } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency } from "@/shared/presentation/currency"
import type { CatalogProduct } from "../application/catalog-query-port"
import type { ScannerRow } from "./use-pos-terminal"
import type { ScannerField } from "./scanner-keyboard"
import type { SplitItemGroup } from "../domain/default-split"

const GROUP_COLORS: Record<SplitItemGroup, string> = {
  A: "border-[#006c3a] bg-[#F0F4F2] text-[#006c3a]",
  B: "border-[#1e40af] bg-[#eff6ff] text-[#1e40af]",
}

interface ScannerRowItemProps {
  row: ScannerRow
  rowIndex: number
  cartProductIds: Set<string>
  splitEnabled: boolean
  splitGroup?: SplitItemGroup
  splitItemGroups?: Map<string, SplitItemGroup>
  onQueryChange: (rowId: string, value: string) => void
  onRowKeyDown: (rowId: string, field: ScannerField, e: React.KeyboardEvent) => void
  onQuantityChange: (rowId: string, value: string) => void
  onSelectCandidate: (rowId: string, product: CatalogProduct) => void
  onClearRow: (rowId: string) => void
  onRemoveFromGrid: (productId: string, rowId?: string) => void
  registerProductRef: (rowId: string, el: HTMLInputElement | null) => void
  registerQuantityRef: (rowId: string, el: HTMLInputElement | null) => void
}

const ScannerRowItem = memo(function ScannerRowItem({
  row,
  rowIndex,
  cartProductIds,
  splitEnabled,
  splitGroup,
  splitItemGroups,
  onQueryChange,
  onRowKeyDown,
  onQuantityChange,
  onSelectCandidate,
  onClearRow,
  onRemoveFromGrid,
  registerProductRef,
  registerQuantityRef,
}: ScannerRowItemProps) {
  const dropdownId = useId()
  const isEmpty = !row.query && !row.resolvedProduct
  const isInCart = row.resolvedProduct ? cartProductIds.has(row.resolvedProduct.id) : false
  const splitGroup_ = splitEnabled && row.resolvedProduct
    ? (splitGroup ?? splitItemGroups?.get(row.id))
    : undefined

  // Background: committed rows get the group color when split is on, green otherwise
  const rowBg = row.committed
    ? splitEnabled
      ? splitGroup_ === "B"
        ? "bg-[#eff6ff]"
        : "bg-[#F0F4F2]"
      : "bg-[#F0F4F2]"
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
        <div className="flex items-center gap-1.5">
          <Input
            ref={(el) => registerProductRef(row.id, el)}
            value={row.resolvedProduct ? row.resolvedProduct.name : row.query}
            onChange={(e) => {
              if (!row.resolvedProduct) onQueryChange(row.id, e.target.value)
            }}
            onKeyDown={(e) => onRowKeyDown(row.id, "product", e)}
            placeholder={rowIndex === 0 ? "Escaneá o escribí un producto..." : ""}
            readOnly={!!row.resolvedProduct}
            aria-label={`Producto fila ${rowIndex + 1}`}
            aria-autocomplete="list"
            aria-expanded={row.showDropdown}
            aria-controls={row.showDropdown ? dropdownId : undefined}
            className={[
              "h-8 text-sm flex-1",
              row.resolvedProduct
                ? "cursor-default border-[#006c3a]/30 bg-[#F0F4F2] text-[#006c3a] font-medium focus-visible:ring-[#006c3a]/20"
                : "",
              row.isSearching ? "opacity-60" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          />
          {isInCart && (
            <Badge
              variant="secondary"
              className="shrink-0 rounded-md px-1.5 py-0 text-[10px] font-medium"
            >
              <ShoppingCart className="mr-0.5 size-2.5" />
              En carrito
            </Badge>
          )}
          {splitGroup_ && (
            <Badge
              variant="outline"
              className={`shrink-0 rounded-md px-1.5 py-0 text-[10px] font-bold ${GROUP_COLORS[splitGroup_]}`}
            >
              {splitGroup_}
            </Badge>
          )}
        </div>

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
              {row.candidates.map((c) => {
                const candidateInCart = cartProductIds.has(c.id)
                const candidateGroup = splitEnabled ? (splitGroup_ ?? splitItemGroups?.get(row.id)) : undefined
                return (
                  <div
                    key={c.id}
                    role="option"
                    aria-selected={false}
                    tabIndex={0}
                    className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-[#F0F4F2] hover:text-[#006c3a]"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span
                        className="truncate font-medium"
                        onClick={() => onSelectCandidate(row.id, c)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            onSelectCandidate(row.id, c)
                          }
                        }}
                      >
                        {c.name}
                      </span>
                      {candidateInCart && (
                        <Badge
                          variant="secondary"
                          className="shrink-0 rounded-md px-1 py-0 text-[10px] font-medium"
                        >
                          <ShoppingCart className="mr-0.5 size-2.5" />
                          En carrito
                        </Badge>
                      )}
                      {candidateGroup && (
                        <Badge
                          variant="outline"
                          className={`shrink-0 rounded-md px-1 py-0 text-[10px] font-bold ${GROUP_COLORS[candidateGroup]}`}
                        >
                          {candidateGroup}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 font-semibold text-[#006c3a]">
                        {formatCurrency(c.price)}
                      </span>
                      {candidateInCart && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-6 shrink-0 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation()
                            onRemoveFromGrid(c.id, row.id)
                          }}
                          aria-label={`Quitar ${c.name} del carrito`}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
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
        onKeyDown={(e) => onRowKeyDown(row.id, "quantity", e)}
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
  cartProductIds: Set<string>
  splitEnabled: boolean
  /** Row index where Group B starts. Rows before this index → A, at/after → B. */
  splitAnchorIndex?: number
  splitItemGroups?: Map<string, SplitItemGroup>
  onQueryChange: (rowId: string, value: string) => void
  onRowKeyDown: (rowId: string, field: ScannerField, e: React.KeyboardEvent) => void
  onSelectCandidate: (rowId: string, product: CatalogProduct) => void
  onQuantityChange: (rowId: string, value: string) => void
  onClearRow: (rowId: string) => void
  onRemoveFromGrid: (productId: string, rowId?: string) => void
  registerProductRef: (rowId: string, el: HTMLInputElement | null) => void
  registerQuantityRef: (rowId: string, el: HTMLInputElement | null) => void
}

export function PosScannerPanel({
  rows,
  catalogError,
  cartProductIds,
  splitEnabled,
  splitAnchorIndex = 0,
  splitItemGroups,
  onQueryChange,
  onRowKeyDown,
  onSelectCandidate,
  onQuantityChange,
  onClearRow,
  onRemoveFromGrid,
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
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">↑↓←→</kbd>{" "}
            navegar ·{" "}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">⌫</kbd>{" "}
            eliminar fila
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
            {/* Ticket A header — only shown when split is active */}
            {splitEnabled && (
              <div className="flex items-center gap-3 border-b border-[#006c3a]/20 bg-[#F0F4F2]/60 px-4 py-1.5">
                <div className="h-px flex-1 bg-[#006c3a]/20" />
                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#006c3a]">
                  <span className="inline-flex size-4 items-center justify-center rounded-sm border border-[#006c3a] bg-[#F0F4F2] text-[9px] font-black leading-none text-[#006c3a]">A</span>
                  Ticket A
                </span>
                <div className="h-px flex-1 bg-[#006c3a]/20" />
              </div>
            )}
            {rows.map((row, idx) => {
              // Determine the group for this row when split is active
              const rowGroup: SplitItemGroup | undefined = splitEnabled && row.committed && row.resolvedProduct
                ? (splitItemGroups?.get(row.id) ?? (idx < splitAnchorIndex ? "A" : "B"))
                : undefined

              // Render ticket B separator BEFORE the anchor row when split is enabled
              const showSeparator = splitEnabled && idx === splitAnchorIndex

              return (
                <React.Fragment key={row.id}>
                  {showSeparator && (
                    <div
                      className="flex items-center gap-3 border-y border-[#1e40af]/20 bg-[#eff6ff]/60 px-4 py-1.5"
                    >
                      <div className="h-px flex-1 bg-[#1e40af]/20" />
                      <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#1e40af]">
                        <span className="inline-flex size-4 items-center justify-center rounded-sm border border-[#1e40af] bg-[#eff6ff] text-[9px] font-black leading-none text-[#1e40af]">B</span>
                        Ticket B
                      </span>
                      <div className="h-px flex-1 bg-[#1e40af]/20" />
                    </div>
                  )}
                  <ScannerRowItem
                    row={row}
                    rowIndex={idx}
                    cartProductIds={cartProductIds}
                    splitEnabled={splitEnabled}
                    splitGroup={rowGroup}
                    splitItemGroups={splitItemGroups}
                    onQueryChange={onQueryChange}
                    onRowKeyDown={onRowKeyDown}
                    onQuantityChange={onQuantityChange}
                    onSelectCandidate={onSelectCandidate}
                    onClearRow={onClearRow}
                    onRemoveFromGrid={onRemoveFromGrid}
                    registerProductRef={registerProductRef}
                    registerQuantityRef={registerQuantityRef}
                  />
                </React.Fragment>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
