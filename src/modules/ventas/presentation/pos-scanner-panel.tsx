"use client"

import React, { memo, useId } from "react"
import { Minus, PackageSearch, Plus, ShoppingCart, Trash2 } from "lucide-react"

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
  onManualTotalChange: (rowId: string, value: string) => void
  registerProductRef: (rowId: string, el: HTMLInputElement | null) => void
  registerQuantityRef: (rowId: string, el: HTMLInputElement | null) => void
  registerManualTotalRef: (rowId: string, el: HTMLInputElement | null) => void
  // ── Ad-hoc handlers ──
  onToggleAdHocMode: (rowId: string) => void
  onAdHocNameChange: (rowId: string, value: string) => void
  onAdHocUnitPriceChange: (rowId: string, value: string) => void
  onAdHocDescriptionChange: (rowId: string, value: string) => void
  onCommitAdHocRow: (rowId: string) => void
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
  onManualTotalChange,
  registerProductRef,
  registerQuantityRef,
  registerManualTotalRef,
  onToggleAdHocMode,
  onAdHocNameChange,
  onAdHocUnitPriceChange,
  onAdHocDescriptionChange,
  onCommitAdHocRow,
}: ScannerRowItemProps) {
  const dropdownId = useId()
  const isEmpty = !row.query && !row.resolvedProduct
  const isInCart = row.resolvedProduct ? cartProductIds.has(row.resolvedProduct.id) : false
  const isProtected = row.isProtected && row.pricingMode === "manual"
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

  // ── Ad-hoc mode rendering ──
  if (row.kind === "ad-hoc") {
    const isCommitted = row.committed
    const priceVal = row.adHocUnitPrice ? Number.parseFloat(row.adHocUnitPrice) : 0
    const formattedPrice = Number.isFinite(priceVal) ? formatCurrency(priceVal) : "—"

    return (
      <div
        className={`relative flex flex-col gap-2 px-3 py-2.5 transition-colors sm:grid sm:grid-cols-[1fr_140px_100px_36px] sm:items-center sm:gap-3 sm:px-4 sm:py-2 ${
          row.committed ? (splitEnabled && splitGroup_ === "B" ? "bg-[#eff6ff]" : "bg-[#F0F4F2]") : "bg-background"
        }`}
      >
        <span
          className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground/40 select-none"
          aria-hidden
        >
          {rowIndex + 1}
        </span>

        {/* Product field (Ad-hoc Name + Description nested) */}
        <div className="relative pl-4 flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <Input
              ref={(el) => registerProductRef(row.id, el)}
              value={row.adHocName ?? ""}
              onChange={(e) => onAdHocNameChange(row.id, e.target.value)}
              onKeyDown={(e) => onRowKeyDown(row.id, "product", e)}
              placeholder="Nombre del producto ocasional..."
              readOnly={isCommitted}
              aria-label={`Producto ocasional fila ${rowIndex + 1}`}
              className={[
                "h-8 text-sm flex-1",
                isCommitted
                  ? "cursor-default border-[#1e40af]/30 bg-[#eff6ff] text-[#1e40af] font-medium focus-visible:ring-[#1e40af]/20"
                  : "border-dashed border-blue-300 bg-blue-50/30 text-xs placeholder:text-muted-foreground/60",
                row.adHocNameError ? "border-destructive focus-visible:ring-destructive/20" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            />
            {isCommitted && (
              <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 text-[10px] shrink-0 font-medium">
                Ocasional
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
          {/* Description input inside the same column */}
          {!isCommitted && (
            <div className="mt-0.5">
              <Input
                className="h-6 w-full border-dashed border-muted bg-transparent text-[10px] placeholder:text-muted-foreground/50 px-2 py-0.5"
                placeholder="Descripción (opcional)"
                value={row.adHocDescription ?? ""}
                onChange={(e) => onAdHocDescriptionChange(row.id, e.target.value)}
              />
            </div>
          )}
          {isCommitted && row.adHocDescription && (
            <p className="pl-1 mt-0.5 text-[10px] text-muted-foreground italic truncate">
              {row.adHocDescription}
            </p>
          )}
          {row.adHocNameError && (
            <p className="pl-1 mt-0.5 text-[10px] text-destructive leading-tight">{row.adHocNameError}</p>
          )}
        </div>

        {/* Unit price */}
        <div className="flex flex-col gap-0.5">
          {isCommitted ? (
            <span className="text-right text-sm font-semibold tabular-nums text-foreground">
              {formattedPrice}
            </span>
          ) : (
            <>
              <Input
                ref={(el) => registerManualTotalRef(row.id, el)}
                type="text"
                inputMode="decimal"
                value={row.adHocUnitPrice ?? ""}
                onChange={(e) => onAdHocUnitPriceChange(row.id, e.target.value)}
                onKeyDown={(e) => onRowKeyDown(row.id, "manualTotal", e)}
                placeholder="0.00"
                className={[
                  "h-8 text-right text-sm font-semibold tabular-nums min-h-[44px] sm:min-h-0 border-dashed border-blue-300",
                  row.adHocUnitPriceError
                    ? "border-destructive focus-visible:ring-destructive/20"
                    : "",
                ].join(" ")}
                aria-label={`Precio ocasional fila ${rowIndex + 1}`}
              />
              {row.adHocUnitPriceError && (
                <span className="text-right text-[10px] leading-tight text-destructive">
                  {row.adHocUnitPriceError}
                </span>
              )}
            </>
          )}
        </div>

        {/* Mobile sub-row: price | qty | clear — all in one flex row on xs */}
        <div className="flex items-center gap-2 sm:contents">
          {/* Price — visible only on mobile */}
          <div className="flex-1 sm:hidden">
            {isCommitted ? (
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {formattedPrice}
              </span>
            ) : (
              <div className="flex flex-col gap-0.5">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={row.adHocUnitPrice ?? ""}
                  onChange={(e) => onAdHocUnitPriceChange(row.id, e.target.value)}
                  onKeyDown={(e) => onRowKeyDown(row.id, "manualTotal", e)}
                  placeholder="0.00"
                  className={[
                    "h-8 text-right text-sm font-semibold tabular-nums min-h-[44px] border-dashed border-blue-300",
                    row.adHocUnitPriceError
                      ? "border-destructive focus-visible:ring-destructive/20"
                      : "",
                  ].join(" ")}
                  aria-label={`Precio ocasional fila ${rowIndex + 1}`}
                />
                {row.adHocUnitPriceError && (
                  <span className="text-right text-[10px] leading-tight text-destructive">
                    {row.adHocUnitPriceError}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Quantity */}
          <Input
            ref={(el) => registerQuantityRef(row.id, el)}
            type="number"
            min="1"
            step="1"
            value={row.quantity}
            onChange={(e) => onQuantityChange(row.id, e.target.value)}
            onKeyDown={(e) => onRowKeyDown(row.id, "quantity", e)}
            disabled={isCommitted}
            className={[
              "h-8 w-20 text-right text-sm font-semibold tabular-nums sm:w-auto",
              isCommitted ? "disabled:opacity-30" : "",
            ].join(" ")}
            aria-label={`Cantidad fila ${rowIndex + 1}`}
          />

          {/* Clear */}
          <Button
            size="icon"
            variant="ghost"
            className="size-8 shrink-0 rounded-lg text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onClearRow(row.id)}
            tabIndex={-1}
            aria-label={`Limpiar fila ${rowIndex + 1}`}
          >
            <Minus />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`relative flex flex-col gap-2 px-3 py-2.5 transition-colors sm:grid sm:grid-cols-[1fr_140px_100px_36px] sm:items-center sm:gap-3 sm:px-4 sm:py-2 ${rowBg}`}
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

      {/* Price / Manual total */}
      {isProtected ? (
        <div className="flex flex-col gap-0.5">
          <Input
            ref={(el) => registerManualTotalRef(row.id, el)}
            type="text"
            inputMode="decimal"
            value={row.manualLineTotal ?? ""}
            onChange={(e) => onManualTotalChange(row.id, e.target.value)}
            onKeyDown={(e) => onRowKeyDown(row.id, "manualTotal", e)}
            placeholder="0.00"
            className={[
              "h-8 text-right text-sm font-semibold tabular-nums min-h-[44px] sm:min-h-0",
              row.manualTotalError
                ? "border-destructive focus-visible:ring-destructive/20"
                : "",
            ].join(" ")}
            aria-label={`Total manual fila ${rowIndex + 1}`}
          />
          {row.manualTotalError && (
            <span className="text-right text-[10px] leading-tight text-destructive">
              {row.manualTotalError}
            </span>
          )}
        </div>
      ) : (
        <span
          className={[
            "text-right text-sm font-semibold tabular-nums",
            row.resolvedProduct ? "text-foreground" : "text-muted-foreground/40",
          ].join(" ")}
        >
          {row.resolvedProduct ? formatCurrency(row.resolvedProduct.price) : "—"}
        </span>
      )}

      {/* Mobile sub-row: price | qty | clear — all in one flex row on xs */}
      <div className="flex items-center gap-2 sm:contents">
        {/* Price — visible only on mobile (hidden on sm+ because sm:contents exposes the span above) */}
        {isProtected ? (
          <div className="flex flex-1 flex-col gap-0.5 sm:hidden">
            <Input
              type="text"
              inputMode="decimal"
              value={row.manualLineTotal ?? ""}
              onChange={(e) => onManualTotalChange(row.id, e.target.value)}
              onKeyDown={(e) => onRowKeyDown(row.id, "manualTotal", e)}
              placeholder="0.00"
              className={[
                "h-8 text-right text-sm font-semibold tabular-nums min-h-[44px]",
                row.manualTotalError
                  ? "border-destructive focus-visible:ring-destructive/20"
                  : "",
              ].join(" ")}
              aria-label={`Total manual fila ${rowIndex + 1}`}
            />
            {row.manualTotalError && (
              <span className="text-right text-[10px] leading-tight text-destructive">
                {row.manualTotalError}
              </span>
            )}
          </div>
        ) : (
          <span
            className={[
              "flex-1 text-sm font-semibold tabular-nums sm:hidden",
              row.resolvedProduct ? "text-foreground" : "text-muted-foreground/40",
            ].join(" ")}
          >
            {row.resolvedProduct ? formatCurrency(row.resolvedProduct.price) : "—"}
          </span>
        )}

        {/* Quantity */}
        <Input
          ref={(el) => registerQuantityRef(row.id, el)}
          type="number"
          min="1"
          step="1"
          value={row.quantity}
          onChange={(e) => onQuantityChange(row.id, e.target.value)}
          onKeyDown={(e) => onRowKeyDown(row.id, "quantity", e)}
          disabled={!row.resolvedProduct || isProtected}
          readOnly={isProtected}
          className={[
            "h-8 w-20 text-right text-sm font-semibold tabular-nums sm:w-auto",
            !row.resolvedProduct || isProtected ? "disabled:opacity-30" : "",
          ].join(" ")}
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
  onManualTotalChange: (rowId: string, value: string) => void
  registerProductRef: (rowId: string, el: HTMLInputElement | null) => void
  registerQuantityRef: (rowId: string, el: HTMLInputElement | null) => void
  registerManualTotalRef: (rowId: string, el: HTMLInputElement | null) => void
  // ── Ad-hoc handlers ──
  onToggleAdHocMode: (rowId: string) => void
  onAddOccasionalProduct?: () => void
  onAdHocNameChange: (rowId: string, value: string) => void
  onAdHocUnitPriceChange: (rowId: string, value: string) => void
  onAdHocDescriptionChange: (rowId: string, value: string) => void
  onCommitAdHocRow: (rowId: string) => void
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
  onManualTotalChange,
  registerProductRef,
  registerQuantityRef,
  registerManualTotalRef,
  onToggleAdHocMode,
  onAddOccasionalProduct,
  onAdHocNameChange,
  onAdHocUnitPriceChange,
  onAdHocDescriptionChange,
  onCommitAdHocRow,
}: PosScannerPanelProps) {
  return (
    <Card className="flex flex-col gap-0 overflow-hidden rounded-xl border-border bg-card">
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <PackageSearch className="size-5 text-[#006c3a]" />
            <h2 className="text-base font-semibold text-foreground">Carga de productos</h2>
          </div>
          {onAddOccasionalProduct && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onAddOccasionalProduct}
              className="h-7 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 gap-1 px-3 text-xs font-semibold"
            >
              <Plus className="size-3.5" />
              Producto Ocasional
            </Button>
          )}
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
          {/* Grid header — hidden on mobile, visible on sm+ */}
          <div className="hidden sm:grid sm:grid-cols-[1fr_140px_100px_36px] gap-3 border-b border-border bg-muted/40 px-4 py-2.5">
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
                    onManualTotalChange={onManualTotalChange}
                    registerProductRef={registerProductRef}
                    registerQuantityRef={registerQuantityRef}
                    registerManualTotalRef={registerManualTotalRef}
                    onToggleAdHocMode={onToggleAdHocMode}
                    onAdHocNameChange={onAdHocNameChange}
                    onAdHocUnitPriceChange={onAdHocUnitPriceChange}
                    onAdHocDescriptionChange={onAdHocDescriptionChange}
                    onCommitAdHocRow={onCommitAdHocRow}
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
