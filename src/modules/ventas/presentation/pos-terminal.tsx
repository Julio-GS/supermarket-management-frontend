"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { Camera, Receipt, ScanLine, ShoppingCart } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePosTerminal } from "./use-pos-terminal"
import { toCents } from "../domain/money"
import { PosCameraScanner } from "./pos-camera-scanner"
import { PosScannerPanel } from "./pos-scanner-panel"
import { PosCartPanel } from "./pos-cart-panel"
import { PosPaymentPanel } from "./pos-payment-panel"
import { PosCheckoutSuccessDialog } from "./pos-checkout-success-dialog"
import type { CatalogProduct, CatalogQueryPort } from "../application/catalog-query-port"
import type { CheckoutPort } from "../application/checkout-port"
import type { TicketPrinterPort } from "../application/ticket-printer-port"

export interface PosTerminalProps {
  initialProducts?: CatalogProduct[]
  catalogQueryPort: CatalogQueryPort
  checkoutPort: CheckoutPort
  ticketPrinterPort: TicketPrinterPort
}

export function PosTerminal({
  initialProducts,
  catalogQueryPort,
  checkoutPort,
  ticketPrinterPort,
}: PosTerminalProps) {
  // Declare tab/responsive state before usePosTerminal so handleExitToPayment
  // can capture them in a stable closure passed into the hook.
  const [activeTab, setActiveTab] = useState<"scanner" | "cart">("scanner")
  const [showScanner, setShowScanner] = useState(false)

  // ── Responsive: only render camera UI on mobile/tablet (< lg) ──
  const isMobile = useSyncExternalStore(
    useCallback((onStoreChange: () => void) => {
      const mq = window.matchMedia("(max-width: 1023px)")
      mq.addEventListener("change", onStoreChange)
      return () => mq.removeEventListener("change", onStoreChange)
    }, []),
    useCallback(() => window.matchMedia("(max-width: 1023px)").matches, [])
  )

  /**
   * Called by the hook just before focus moves to the payment panel.
   * On mobile, we switch to the cart tab first so the payment buttons
   * are rendered and focusable when focus arrives (after the 60 ms delay).
   */
  const handleExitToPayment = useCallback(() => {
    if (isMobile) setActiveTab("cart")
  }, [isMobile])

  const {
    rows,
    cartItems,
    totals,
    cartProductIds,
    allocations,
    toggleAllocation,
    changeAllocationAmount,
    allocationErrors,
    removeAllocationMethod,
    splitPreview,
    splitEnabled,
    splitAnchorIndex,
    toggleSplit,
    splitErrors,
    isCheckingOut,
    catalogError,
    checkoutError,
    lastSale,
    checkoutSuccess,
    handleDismissSuccess,
    handlePrintTickets,
    printError,
    isPrinting,
    registerProductRef,
    registerQuantityRef,
    registerManualTotalRef,
    handleQueryChange,
    handleRowKeyDown,
    handleSelectCandidate,
    handleQuantityChange,
    handleClearRow,
    handleRemoveFromResultsGrid,
    handleManualTotalChange,
    handleToggleAdHocMode,
    handleAddOccasionalProduct,
    handleAdHocNameChange,
    handleAdHocUnitPriceChange,
    handleAdHocDescriptionChange,
    handleCommitAdHocRow,
    handleCheckout,
    handleCameraCode,
    focusFirstAvailableRow,
    focusFirstPaymentMethod,
    registerPaymentMethodRef,
    activeStorePromotions,
    checkoutPricing,
    selectedManualDiscount,
    toggleManualDiscount,
  } = usePosTerminal(catalogQueryPort, checkoutPort, ticketPrinterPort, {
    initialProducts,
    onExitToPayment: handleExitToPayment,
  })

  // ── Focus restoration: return to scanner row when camera closes ──
  const scannerWasOpen = useRef(false)

  useEffect(() => {
    if (showScanner) {
      scannerWasOpen.current = true
    } else if (scannerWasOpen.current) {
      scannerWasOpen.current = false
      const timer = setTimeout(() => {
        focusFirstAvailableRow()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [showScanner, focusFirstAvailableRow])

  const subtotal = cartItems.reduce((sum, i) => {
    if (i.kind === "ad-hoc") return sum + i.unitPrice * i.quantity
    if (i.manualLineTotal) return sum + toCents(i.manualLineTotal) / 100
    return sum + i.product.price * i.quantity
  }, 0)
  const cartCount = cartItems.length

  const handleExitToScanner = useCallback(() => {
    if (isMobile) {
      setActiveTab("scanner")
      setTimeout(() => {
        focusFirstAvailableRow()
      }, 60)
    } else {
      focusFirstAvailableRow()
    }
  }, [isMobile, focusFirstAvailableRow])

  const scannerPanel = (
    <PosScannerPanel
      rows={rows}
      catalogError={catalogError}
      cartProductIds={cartProductIds}
      splitEnabled={splitEnabled}
      splitAnchorIndex={splitAnchorIndex}
      splitItemGroups={splitPreview?.itemGroups}
      onQueryChange={handleQueryChange}
      onRowKeyDown={handleRowKeyDown}
      onSelectCandidate={handleSelectCandidate}
      onQuantityChange={handleQuantityChange}
      onClearRow={handleClearRow}
      onRemoveFromGrid={handleRemoveFromResultsGrid}
      onManualTotalChange={handleManualTotalChange}
      registerProductRef={registerProductRef}
      registerQuantityRef={registerQuantityRef}
      registerManualTotalRef={registerManualTotalRef}
      onToggleAdHocMode={handleToggleAdHocMode}
      onAddOccasionalProduct={handleAddOccasionalProduct}
      onAdHocNameChange={handleAdHocNameChange}
      onAdHocUnitPriceChange={handleAdHocUnitPriceChange}
      onAdHocDescriptionChange={handleAdHocDescriptionChange}
      onCommitAdHocRow={handleCommitAdHocRow}
    />
  )

  const renderCartPanel = () => (
    <>
      <PosCartPanel
        cartItems={cartItems}
        onRemove={handleRemoveFromResultsGrid}
        itemGroups={splitPreview?.itemGroups}
        splitEnabled={splitEnabled}
        splitGroups={splitPreview?.groups}
      />
      <PosPaymentPanel
        subtotal={subtotal}
        cartItems={cartItems}
        allocations={allocations}
        onToggleAllocation={toggleAllocation}
        onRemoveAllocation={removeAllocationMethod}
        onAmountChange={changeAllocationAmount}
        allocationErrors={allocationErrors}
        splitEnabled={splitEnabled}
        onToggleSplit={toggleSplit}
        splitErrors={splitErrors}
        isCartEmpty={cartItems.length === 0}
        isCheckingOut={isCheckingOut}
        checkoutError={checkoutError}
        onCheckout={handleCheckout}
        registerPaymentMethodRef={registerPaymentMethodRef}
        onExitToScanner={handleExitToScanner}
        activeStorePromotions={activeStorePromotions}
        selectedManualDiscount={selectedManualDiscount}
        onToggleManualDiscount={toggleManualDiscount}
        payableTotalCents={checkoutPricing.payableTotalCents}
      />
      {checkoutError && !isCheckingOut && (
        <p className="px-6 pb-4 text-sm text-destructive" role="alert">
          {checkoutError.message}
        </p>
      )}
    </>
  )


  return (
    // Outer wrapper: fills available height without causing external scroll
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Punto de venta"
        description="Escaneá productos y cobralos al cliente"
        actions={
          <Badge
            variant="outline"
            className="gap-1.5 rounded-full border-border bg-card px-3 py-1.5 text-sm text-muted-foreground"
          >
            <Receipt className="size-3.5" />
            Ticket {lastSale ? lastSale.id : "V-10429"}
          </Badge>
        }
      />

      {/* ── Mobile: Tabs (Scanner / Cart) ─────────────────────── */}
      {/*
        min-h-0 is critical: without it, flex children won't shrink below
        their natural content height, causing overflow.
      */}
      <div className="flex min-h-0 flex-1 flex-col lg:hidden">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "scanner" | "cart")}
          className="flex min-h-0 flex-1 flex-col"
        >
          {/* Tab bar — shrink-0 so it never compresses */}
          <TabsList className="mx-4 mt-4 grid w-[calc(100%-2rem)] shrink-0 grid-cols-2 rounded-xl">
            <TabsTrigger value="scanner" className="flex items-center gap-2 rounded-lg">
              <ScanLine className="size-4" />
              Escáner
            </TabsTrigger>
            <TabsTrigger value="cart" className="flex items-center gap-2 rounded-lg">
              <ShoppingCart className="size-4" />
              Carrito
              {cartCount > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 h-5 min-w-5 rounded-full px-1.5 text-[10px] font-bold leading-none"
                >
                  {cartCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Scanner tab: items can scroll */}
          <TabsContent
            value="scanner"
            className="mt-0 min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-4"
          >
            {/* Camera scan action — mobile/tablet only (JS guard, not just CSS) */}
            {isMobile && !showScanner && (
              <Button
                variant="outline"
                onClick={() => setShowScanner(true)}
                className="mb-4 w-full min-h-[44px] gap-2"
              >
                <Camera className="size-5" />
                Escanear código de barras
              </Button>
            )}

            {isMobile && showScanner && (
              <div className="mb-4">
                <PosCameraScanner
                  open={showScanner}
                  onOpenChange={(open) => setShowScanner(open)}
                  onDecode={handleCameraCode}
                />
              </div>
            )}

            {scannerPanel}
          </TabsContent>

          {/*
            Cart tab: flex column so the card fills the tab height.
            The card itself splits into:
              - PosCartPanel (flex-1, items scroll via ScrollArea internally)
              - PosPaymentPanel (shrink-0, always visible)
          */}
          <TabsContent
            value="cart"
            className="mt-0 flex min-h-0 flex-1 flex-col px-4 pb-4 pt-3"
          >
            <Card className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden rounded-xl border-border bg-card shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
              <CardContent className="flex min-h-0 flex-1 flex-col gap-0 p-0">
                {renderCartPanel()}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Desktop: side-by-side grid ────────────────────────── */}
      <div className="hidden min-h-0 flex-1 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(340px,clamp(360px,34vw,420px))] lg:gap-6 lg:bg-background lg:p-6">
        <div className="min-h-0 overflow-y-auto">
          {scannerPanel}
        </div>

        {/* Cart / Ticket — sticky on desktop */}
        <Card className="flex min-h-0 flex-col gap-0 overflow-hidden rounded-xl border-border bg-card shadow-[0_4px_20px_rgba(0,0,0,0.05)] lg:max-h-[calc(100dvh-3rem)]">
          <CardContent className="flex min-h-0 flex-1 flex-col gap-0 p-0">
            {renderCartPanel()}
          </CardContent>
        </Card>
      </div>

      {/* Success dialog */}
      {checkoutSuccess && (
        <PosCheckoutSuccessDialog
          success={checkoutSuccess}
          onClose={handleDismissSuccess}
          onPrint={handlePrintTickets}
          printError={printError}
          isPrinting={isPrinting}
        />
      )}
    </div>
  )
}
