"use client"

import { useEffect, useRef } from "react"
import JsBarcode from "jsbarcode"
import { formatCurrency } from "@/shared/presentation/currency"
import type { LabelItem } from "./use-label-queue"

function formatDate(date: Date): string {
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

interface ProductLabelProps {
  item: LabelItem
  /** When true renders a compact version sized for A4 print grid */
  compact?: boolean
}

export function ProductLabel({ item, compact = false }: ProductLabelProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const { product, changedAt } = item

  useEffect(() => {
    if (!svgRef.current) return
    try {
      JsBarcode(svgRef.current, product.sku || product.id, {
        format: "CODE128",
        displayValue: false,
        margin: 0,
        background: "#ffffff",
        lineColor: "#000000",
        width: compact ? 1.2 : 1.5,
        height: compact ? 24 : 48,
      })
    } catch {
      // Invalid barcode value — render fallback text only
    }
  }, [product.sku, product.id, compact])

  if (compact) {
    return (
      <div
        className="product-label-compact"
        style={{
          width: "48mm",
          height: "46mm",
          border: "0.3mm solid #000",
          padding: "2mm",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          boxSizing: "border-box",
          backgroundColor: "#fff",
          fontFamily: "Arial, sans-serif",
          overflow: "hidden",
          pageBreakInside: "avoid",
        }}
      >
        {/* Name */}
        <div
          style={{
            fontSize: "7pt",
            fontWeight: "bold",
            textAlign: "center",
            textTransform: "uppercase",
            lineHeight: 1.2,
            wordBreak: "break-word",
            maxHeight: "10mm",
            overflow: "hidden",
          }}
        >
          {product.name}
        </div>

        {/* Price */}
        <div
          style={{
            fontSize: "14pt",
            fontWeight: "900",
            textAlign: "center",
            letterSpacing: "-0.5px",
            lineHeight: 1,
          }}
        >
          {formatCurrency(product.price)}
        </div>

        {/* Barcode */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5mm" }}>
          <svg ref={svgRef} />
          <div style={{ fontSize: "5.5pt", letterSpacing: "0.5px", color: "#333" }}>
            {product.sku || product.id}
          </div>
        </div>

        {/* Date */}
        <div style={{ fontSize: "6pt", color: "#555", textAlign: "center" }}>
          {formatDate(changedAt)}
        </div>
      </div>
    )
  }

  // Preview (screen) version — larger
  return (
    <div
      style={{
        width: "220px",
        border: "1px solid #d1d5db",
        borderRadius: "8px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "10px",
        backgroundColor: "#fff",
        fontFamily: "Arial, sans-serif",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      }}
    >
      <div
        style={{
          fontSize: "11px",
          fontWeight: "bold",
          textAlign: "center",
          textTransform: "uppercase",
          lineHeight: 1.3,
          color: "#111",
          wordBreak: "break-word",
        }}
      >
        {product.name}
      </div>
      <div
        style={{
          fontSize: "26px",
          fontWeight: "900",
          color: "#111",
          letterSpacing: "-1px",
        }}
      >
        {formatCurrency(product.price)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
        <svg ref={svgRef} />
        <div style={{ fontSize: "9px", color: "#666", letterSpacing: "0.5px" }}>
          {product.sku || product.id}
        </div>
      </div>
      <div style={{ fontSize: "9px", color: "#888" }}>{formatDate(changedAt)}</div>
    </div>
  )
}
