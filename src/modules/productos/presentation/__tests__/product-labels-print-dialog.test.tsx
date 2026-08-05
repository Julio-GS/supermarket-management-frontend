import { describe, expect, it, vi, beforeEach } from "vitest"
import { screen } from "@testing-library/react"
import { render } from "@/test/render"
import { ProductLabelsPrintDialog } from "../product-labels-print-dialog"
import type { LabelItem } from "../use-label-queue"
import type { Product } from "../../domain/product"

// jsbarcode uses DOM manipulation on <svg> elements; mock it out
vi.mock("jsbarcode", () => ({
  default: vi.fn(),
}))

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "P001",
    name: "Test Product",
    sku: "TST-0001",
    price: 100,
    cost: 60,
    manejaStock: true,
    stock: 10,
    stockMinimum: 20,
    unit: "u",
    supplier: "Test",
    promotions: null,
    storePromotions: null,
    ...overrides,
  }
}

function makeLabelItem(overrides: Partial<Product> = {}, changedAt?: Date): LabelItem {
  return {
    product: makeProduct(overrides),
    changedAt: changedAt ?? new Date("2025-01-15"),
  }
}

function makeQueue(count: number): LabelItem[] {
  return Array.from({ length: count }, (_, i) =>
    makeLabelItem(
      {
        id: `P${String(i + 1).padStart(3, "0")}`,
        name: `Product ${i + 1}`,
        sku: `SKU-${i + 1}`,
        price: 100 + i,
      },
      new Date("2025-01-15")
    )
  )
}

describe("ProductLabelsPrintDialog", () => {
  beforeEach(() => {
    // jsbarcode mock is already set up via vi.mock above
  })

  it("renders the preview area with all queued labels", () => {
    const queue = makeQueue(3)
    render(
      <ProductLabelsPrintDialog
        open={true}
        onClose={vi.fn()}
        queue={queue}
        onClearQueue={vi.fn()}
      />
    )

    // Preview area shows all three labels — scope to the preview panel only
    // The portal also renders labels, so query within the dialog preview area
    const previewArea = document.querySelector(".flex-1.overflow-y-auto")
    expect(previewArea).not.toBeNull()
    expect(previewArea!.textContent).toContain("Product 1")
    expect(previewArea!.textContent).toContain("Product 2")
    expect(previewArea!.textContent).toContain("Product 3")
  })

  it("shows an empty state message when the queue is empty", () => {
    render(
      <ProductLabelsPrintDialog
        open={true}
        onClose={vi.fn()}
        queue={[]}
        onClearQueue={vi.fn()}
      />
    )

    expect(screen.getByText("No hay etiquetas en cola.")).toBeInTheDocument()
  })

  it("disables print and clear buttons when queue is empty", () => {
    render(
      <ProductLabelsPrintDialog
        open={true}
        onClose={vi.fn()}
        queue={[]}
        onClearQueue={vi.fn()}
      />
    )

    expect(screen.getByRole("button", { name: /imprimir/i })).toBeDisabled()
    expect(screen.getByRole("button", { name: /limpiar cola/i })).toBeDisabled()
  })


      it("hides Limpiar cola button in remote mode (isRemote=true)", () => {
        const queue = makeQueue(3)
        render(
          <ProductLabelsPrintDialog
            open={true}
            onClose={vi.fn()}
            queue={queue}
            onClearQueue={vi.fn()}
            isRemote
          />
        )

        expect(screen.queryByRole("button", { name: /limpiar cola/i })).toBeNull()
        expect(screen.getByRole("button", { name: /imprimir/i })).toBeInTheDocument()
      })

      it("shows Limpiar cola button in local mode (default)", () => {
        const queue = makeQueue(3)
        render(
          <ProductLabelsPrintDialog
            open={true}
            onClose={vi.fn()}
            queue={queue}
            onClearQueue={vi.fn()}
          />
        )

        expect(screen.getByRole("button", { name: /limpiar cola/i })).toBeInTheDocument()
      })

    describe("print CSS invariants", () => {
        function getPrintCss(): string {
          const styleTags = document.querySelectorAll("style")
          for (const tag of styleTags) {
            if (tag.textContent?.includes("@media print")) {
              return tag.textContent
            }
          }
          return ""
        }

        it("uses position:static (NOT fixed) in @media print to allow Chromium page fragmentation", () => {
          const queue = makeQueue(45)
          render(
            <ProductLabelsPrintDialog
              open={true}
              onClose={vi.fn()}
              queue={queue}
              onClearQueue={vi.fn()}
            />
          )

          const printCss = getPrintCss()
          expect(printCss).not.toBe("")

          // Extract the #label-print-area block within @media print
          const areaBlockMatch = printCss.match(/#label-print-area\s*\{[^}]+\}/)
          expect(areaBlockMatch).not.toBeNull()
          const areaBlock = areaBlockMatch![0]

          // Must use position: static for Chromium to fragment across physical pages
          expect(areaBlock).toContain("position: static")
          // Must NOT use position: fixed (the root cause of the clipping defect)
          expect(areaBlock).not.toContain("position: fixed")
        })

        it("print area uses overflow:visible to prevent content clipping", () => {
          const queue = makeQueue(45)
          render(
            <ProductLabelsPrintDialog
              open={true}
              onClose={vi.fn()}
              queue={queue}
              onClearQueue={vi.fn()}
            />
          )

          const printCss = getPrintCss()
          const areaBlockMatch = printCss.match(/#label-print-area\s*\{[^}]+\}/)
          expect(areaBlockMatch).not.toBeNull()
          expect(areaBlockMatch![0]).toContain("overflow: visible")
        })

        it("@media print overrides [data-print-grid] gap to 1mm from screen default 2mm", () => {
          const queue = makeQueue(3)
          render(
            <ProductLabelsPrintDialog
              open={true}
              onClose={vi.fn()}
              queue={queue}
              onClearQueue={vi.fn()}
            />
          )

          const printCss = getPrintCss()
          expect(printCss).not.toBe("")

          // The @media print must contain a [data-print-grid] rule with gap: 1mm
          const gridBlockMatch = printCss.match(/\[data-print-grid\]\s*\{[^}]+\}/)
          expect(gridBlockMatch).not.toBeNull()
          expect(gridBlockMatch![0]).toContain("gap: 1mm")
        })

        it("@media print overrides [data-print-grid] padding to 2mm from screen default 5mm", () => {
          const queue = makeQueue(3)
          render(
            <ProductLabelsPrintDialog
              open={true}
              onClose={vi.fn()}
              queue={queue}
              onClearQueue={vi.fn()}
            />
          )

          const printCss = getPrintCss()
          expect(printCss).not.toBe("")

          const gridBlockMatch = printCss.match(/\[data-print-grid\]\s*\{[^}]+\}/)
          expect(gridBlockMatch).not.toBeNull()
          expect(gridBlockMatch![0]).toContain("padding: 2mm")
        })
      })

  describe("A4 geometry", () => {
    // A4 printable width = 210mm - 2×4mm margins = 202mm
    // Required: 3 columns × 65mm labels + 2 column gaps + 2 side padding ≤ 202mm
    const LABEL_WIDTH_MM = 65
    const COLUMNS = 3
    const A4_PRINTABLE_WIDTH_MM = 202 // 210mm - 4mm each side

    function getPrintCss(): string {
      const styleTags = document.querySelectorAll("style")
      for (const tag of styleTags) {
        if (tag.textContent?.includes("@media print")) {
          return tag.textContent
        }
      }
      return ""
    }

    it("total print width formula fits within A4 printable area (202mm)", () => {
      const queue = makeQueue(3)
      render(
        <ProductLabelsPrintDialog
          open={true}
          onClose={vi.fn()}
          queue={queue}
          onClearQueue={vi.fn()}
        />
      )

      const printCss = getPrintCss()
      expect(printCss).not.toBe("")

      // Parse gap and padding from @media print [data-print-grid] rule
      const gridBlockMatch = printCss.match(/\[data-print-grid\]\s*\{[^}]+\}/)
      expect(gridBlockMatch).not.toBeNull()
      const gridBlock = gridBlockMatch![0]

      const gapMatch = gridBlock.match(/gap:\s*(\d+)mm/)
      const paddingMatch = gridBlock.match(/padding:\s*(\d+)mm/)
      expect(gapMatch).not.toBeNull()
      expect(paddingMatch).not.toBeNull()

      const gapMm = Number(gapMatch![1])
      const paddingMm = Number(paddingMatch![1])

      // Formula: columns × labelWidth + (columns − 1) × gap + 2 × padding
      const totalWidth =
        COLUMNS * LABEL_WIDTH_MM +
        (COLUMNS - 1) * gapMm +
        2 * paddingMm

      expect(totalWidth).toBeLessThanOrEqual(A4_PRINTABLE_WIDTH_MM)
    })

    it("[data-print-grid] uses exactly 3 columns of 65mm labels in @media print", () => {
      const queue = makeQueue(3)
      render(
        <ProductLabelsPrintDialog
          open={true}
          onClose={vi.fn()}
          queue={queue}
          onClearQueue={vi.fn()}
        />
      )

      // Verify the inline grid on the print portal still has 3×65mm columns
      const printArea = document.body.querySelector("#label-print-area")
      expect(printArea).not.toBeNull()

      const grid = printArea!.querySelector("[data-print-grid]")
      expect(grid).not.toBeNull()

      const inlineStyle = grid!.getAttribute("style") || ""
      // Should declare 3 columns of 65mm each
      expect(inlineStyle).toContain("repeat(3, 65mm)")
    })

    it("screen preview styles remain unchanged (gap 2mm, padding 5mm) for visual comfort", () => {
      const queue = makeQueue(3)
      render(
        <ProductLabelsPrintDialog
          open={true}
          onClose={vi.fn()}
          queue={queue}
          onClearQueue={vi.fn()}
        />
      )

      // The print portal grid inline style keeps its screen-friendly defaults
      const printArea = document.body.querySelector("#label-print-area")
      const grid = printArea!.querySelector("[data-print-grid]")
      const inlineStyle = grid!.getAttribute("style") || ""

      // Screen defaults are on the inline style of the portal grid element
      expect(inlineStyle).toContain("gap: 2mm")
      expect(inlineStyle).toContain("padding: 5mm")
    })

    it("@media print [data-print-grid] uses !important to beat inline styles", () => {
      const queue = makeQueue(3)
      render(
        <ProductLabelsPrintDialog
          open={true}
          onClose={vi.fn()}
          queue={queue}
          onClearQueue={vi.fn()}
        />
      )

      const printCss = getPrintCss()
      expect(printCss).not.toBe("")

      const gridBlockMatch = printCss.match(/\[data-print-grid\]\s*\{[^}]+\}/)
      expect(gridBlockMatch).not.toBeNull()
      const gridBlock = gridBlockMatch![0]

      // Both gap and padding must carry !important to beat React inline styles
      expect(gridBlock).toContain("gap: 1mm !important")
      expect(gridBlock).toContain("padding: 2mm !important")
    })

    it("@media print [data-print-grid] does not override gridTemplateColumns (uses inline 3×65mm)", () => {
      const queue = makeQueue(3)
      render(
        <ProductLabelsPrintDialog
          open={true}
          onClose={vi.fn()}
          queue={queue}
          onClearQueue={vi.fn()}
        />
      )

      const printCss = getPrintCss()
      expect(printCss).not.toBe("")

      const gridBlockMatch = printCss.match(/\[data-print-grid\]\s*\{[^}]+\}/)
      expect(gridBlockMatch).not.toBeNull()

      // Must NOT override gridTemplateColumns — the inline repeat(3, 65mm) is correct
      expect(gridBlockMatch![0]).not.toContain("grid-template-columns")
    })
  })

  describe("A4 pagination", () => {
    // A4 portrait = 297mm tall, 4mm margins → 289mm printable.
    // Print grid: 2mm padding top+bottom = 4mm total, 1mm row gap, 30mm rows.
        // 9 rows = 9×30 + 8×1 + 4 = 282mm ≤ 289mm ✓
        // 10 rows = 10×30 + 9×1 + 4 = 313mm > 289mm ✗
    const LABELS_PER_PAGE = 27 // 9 rows × 3 columns

    it("renders 27 labels (exactly 9 rows) in a single page container", () => {
      const queue = makeQueue(LABELS_PER_PAGE)
      render(
        <ProductLabelsPrintDialog
          open={true}
          onClose={vi.fn()}
          queue={queue}
          onClearQueue={vi.fn()}
        />
      )

      // The print area (#label-print-area) should have exactly one page group
      const printArea = document.body.querySelector("#label-print-area")
      expect(printArea).not.toBeNull()

      const pageGroups = printArea!.querySelectorAll('[data-page-group]')
      expect(pageGroups.length).toBe(1)
    })

    it("splits 28 labels into two page containers (27 + 1)", () => {
      const queue = makeQueue(28)
      render(
        <ProductLabelsPrintDialog
          open={true}
          onClose={vi.fn()}
          queue={queue}
          onClearQueue={vi.fn()}
        />
      )

      const printArea = document.body.querySelector("#label-print-area")
      expect(printArea).not.toBeNull()

      const pageGroups = printArea!.querySelectorAll('[data-page-group]')
      expect(pageGroups.length).toBe(2)
    })

    it("splits 45 labels into two page containers (27 + 18)", () => {
      const queue = makeQueue(45)
      render(
        <ProductLabelsPrintDialog
          open={true}
          onClose={vi.fn()}
          queue={queue}
          onClearQueue={vi.fn()}
        />
      )

      const printArea = document.body.querySelector("#label-print-area")
      expect(printArea).not.toBeNull()

      const pageGroups = printArea!.querySelectorAll('[data-page-group]')
      expect(pageGroups.length).toBe(2)

      // First page should have 27 labels, second 18
      const firstPageGrid = pageGroups[0].querySelector('[data-print-grid]')
      const secondPageGrid = pageGroups[1].querySelector('[data-print-grid]')

      expect(firstPageGrid?.children.length).toBe(27)
      expect(secondPageGrid?.children.length).toBe(18)
    })

    it("splits 55 labels into three page containers (27 + 27 + 1)", () => {
      const queue = makeQueue(55)
      render(
        <ProductLabelsPrintDialog
          open={true}
          onClose={vi.fn()}
          queue={queue}
          onClearQueue={vi.fn()}
        />
      )

      const printArea = document.body.querySelector("#label-print-area")
      const pageGroups = printArea!.querySelectorAll('[data-page-group]')
      expect(pageGroups.length).toBe(3)

      const firstGrid = pageGroups[0].querySelector('[data-print-grid]')
      const secondGrid = pageGroups[1].querySelector('[data-print-grid]')
      const thirdGrid = pageGroups[2].querySelector('[data-print-grid]')

      expect(firstGrid?.children.length).toBe(27)
      expect(secondGrid?.children.length).toBe(27)
      expect(thirdGrid?.children.length).toBe(1)
    })

    it("renders page-break-after style on all page containers except the last", () => {
      const queue = makeQueue(55) // 3 pages
      render(
        <ProductLabelsPrintDialog
          open={true}
          onClose={vi.fn()}
          queue={queue}
          onClearQueue={vi.fn()}
        />
      )

      const printArea = document.body.querySelector("#label-print-area")
      const pageGroups = printArea!.querySelectorAll('[data-page-group]')

      // First two pages should have page-break-after
      for (let i = 0; i < pageGroups.length - 1; i++) {
        const style = pageGroups[i].getAttribute("style") || ""
        // Check for page-break-after in either inline style or the computed approach
        const hasBreak =
          style.includes("page-break-after") ||
          pageGroups[i].classList.contains("print-page-break")
        expect(hasBreak).toBe(true)
      }

      // Last page should NOT have page-break-after
      const lastStyle = pageGroups[pageGroups.length - 1].getAttribute("style") || ""
      const lastHasBreak =
        lastStyle.includes("page-break-after") ||
        pageGroups[pageGroups.length - 1].classList.contains("print-page-break")
      expect(lastHasBreak).toBe(false)
    })

    it("each label has page-break-inside: avoid to prevent splitting", () => {
      const queue = makeQueue(5)
      render(
        <ProductLabelsPrintDialog
          open={true}
          onClose={vi.fn()}
          queue={queue}
          onClearQueue={vi.fn()}
        />
      )

      const printArea = document.body.querySelector("#label-print-area")
      const labels = printArea!.querySelectorAll(".product-label-compact")

      for (const label of labels) {
        const style = (label as HTMLElement).getAttribute("style") || ""
        expect(style).toContain("page-break-inside")
      }
    })

    it("renders 1 label in a single page container", () => {
      const queue = makeQueue(1)
      render(
        <ProductLabelsPrintDialog
          open={true}
          onClose={vi.fn()}
          queue={queue}
          onClearQueue={vi.fn()}
        />
      )

      const printArea = document.body.querySelector("#label-print-area")
      const pageGroups = printArea!.querySelectorAll('[data-page-group]')
      expect(pageGroups.length).toBe(1)

      const grid = pageGroups[0].querySelector('[data-print-grid]')
      expect(grid?.children.length).toBe(1)
    })

    it("renders 54 labels (exactly 2 full pages) in two page containers", () => {
      const queue = makeQueue(54)
      render(
        <ProductLabelsPrintDialog
          open={true}
          onClose={vi.fn()}
          queue={queue}
          onClearQueue={vi.fn()}
        />
      )

      const printArea = document.body.querySelector("#label-print-area")
      const pageGroups = printArea!.querySelectorAll('[data-page-group]')
      expect(pageGroups.length).toBe(2)

      const firstGrid = pageGroups[0].querySelector('[data-print-grid]')
      const secondGrid = pageGroups[1].querySelector('[data-print-grid]')
      expect(firstGrid?.children.length).toBe(27)
      expect(secondGrid?.children.length).toBe(27)
    })

    it("pages container has no page-break-after on the last page even when multiple pages", () => {
      const queue = makeQueue(28) // 2 pages
      render(
        <ProductLabelsPrintDialog
          open={true}
          onClose={vi.fn()}
          queue={queue}
          onClearQueue={vi.fn()}
        />
      )

      const printArea = document.body.querySelector("#label-print-area")
      const pageGroups = printArea!.querySelectorAll('[data-page-group]')

      // First page has break
      expect(pageGroups[0].getAttribute("style") || "").toContain("page-break-after")
      // Last page does NOT have break
      expect(pageGroups[1].getAttribute("style") || "").not.toContain("page-break-after")
        })

        it("exactly 27 labels fill one page (9 rows boundary proof)", () => {
          const queue = makeQueue(27)
          render(
            <ProductLabelsPrintDialog
              open={true}
              onClose={vi.fn()}
              queue={queue}
              onClearQueue={vi.fn()}
            />
          )

          const printArea = document.body.querySelector("#label-print-area")
          const pageGroups = printArea!.querySelectorAll('[data-page-group]')
          expect(pageGroups.length).toBe(1)

          const grid = pageGroups[0].querySelector('[data-print-grid]')
          expect(grid?.children.length).toBe(27)
        })

        it("28 labels overflow to second page (10 rows would not fit: 313mm > 289mm)", () => {
          const queue = makeQueue(28)
          render(
            <ProductLabelsPrintDialog
              open={true}
              onClose={vi.fn()}
              queue={queue}
              onClearQueue={vi.fn()}
            />
          )

          const printArea = document.body.querySelector("#label-print-area")
          const pageGroups = printArea!.querySelectorAll('[data-page-group]')
          expect(pageGroups.length).toBe(2)

          const firstGrid = pageGroups[0].querySelector('[data-print-grid]')
          const secondGrid = pageGroups[1].querySelector('[data-print-grid]')
          expect(firstGrid?.children.length).toBe(27)
          expect(secondGrid?.children.length).toBe(1)
        })

        it("print grid preserves 30mm row height for exact A4 height budget", () => {
          const queue = makeQueue(27)
          render(
            <ProductLabelsPrintDialog
              open={true}
              onClose={vi.fn()}
              queue={queue}
              onClearQueue={vi.fn()}
            />
          )

          const printArea = document.body.querySelector("#label-print-area")
          const grid = printArea!.querySelector('[data-print-grid]')
          const inlineStyle = grid!.getAttribute("style") || ""

          expect(inlineStyle).toContain("grid-auto-rows: 30mm")
        })
      })


      describe("React key uniqueness", () => {
        it("renders distinct remote jobs sharing product_id without React duplicate-key warnings", () => {
          const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

          const queue: LabelItem[] = [
            {
              product: makeProduct({ id: "P001", name: "Product A", price: 100 }),
              changedAt: new Date("2025-01-15"),
              queueKey: "job-1",
            },
            {
              product: makeProduct({ id: "P001", name: "Product A", price: 150 }),
              changedAt: new Date("2025-01-15"),
              queueKey: "job-2",
            },
          ]

          render(
            <ProductLabelsPrintDialog
              open={true}
              onClose={vi.fn()}
              queue={queue}
              onClearQueue={vi.fn()}
              isRemote
            />
          )

          const printArea = document.body.querySelector("#label-print-area")
          expect(printArea).not.toBeNull()
          const labels = printArea!.querySelectorAll('[data-print-grid] > *')
          expect(labels.length).toBe(2)

          const keyWarnings = consoleError.mock.calls.filter(
            (call) =>
              typeof call[0] === "string" &&
              call[0].includes("Encountered two children with the same key")
          )
          expect(keyWarnings).toHaveLength(0)

          consoleError.mockRestore()
        })

        it("does not emit React key warnings during dialog render (regression guard)", () => {
          const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

          const queue: LabelItem[] = [
            {
              product: makeProduct({ id: "P001", name: "A", price: 100 }),
              changedAt: new Date("2025-01-15"),
            },
            {
              product: makeProduct({ id: "P002", name: "B", price: 200 }),
              changedAt: new Date("2025-01-15"),
            },
            {
              product: makeProduct({ id: "P003", name: "C", price: 300 }),
              changedAt: new Date("2025-01-15"),
            },
          ]

          render(
            <ProductLabelsPrintDialog
              open={true}
              onClose={vi.fn()}
              queue={queue}
              onClearQueue={vi.fn()}
            />
          )

          const keyWarnings = consoleError.mock.calls.filter(
            (call) =>
              typeof call[0] === "string" &&
              call[0].includes("Encountered two children with the same key")
          )
          expect(keyWarnings).toHaveLength(0)

          consoleError.mockRestore()
        })

        it("local queue items fall back to product.id when queueKey is absent", () => {
          const queue: LabelItem[] = [
            {
              product: makeProduct({ id: "P001", name: "Local A" }),
              changedAt: new Date("2025-01-15"),
            },
            {
              product: makeProduct({ id: "P002", name: "Local B" }),
              changedAt: new Date("2025-01-15"),
            },
          ]

          render(
            <ProductLabelsPrintDialog
              open={true}
              onClose={vi.fn()}
              queue={queue}
              onClearQueue={vi.fn()}
            />
          )

          const previewArea = document.querySelector(".flex-1.overflow-y-auto")
          expect(previewArea!.textContent).toContain("Local A")
          expect(previewArea!.textContent).toContain("Local B")
        })

        it("45 unique remote jobs render across two pages (27 + 18) with unique keys", () => {
          const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

          const queue: LabelItem[] = Array.from({ length: 45 }, (_, i) => ({
            product: makeProduct({
              id: `P${String(i + 1).padStart(3, '0')}`,
              name: `Product ${i + 1}`,
              sku: `SKU-${i + 1}`,
              price: 100 + i,
            }),
            changedAt: new Date("2025-01-15"),
            queueKey: `job-${i + 1}`,
          }))

          render(
            <ProductLabelsPrintDialog
              open={true}
              onClose={vi.fn()}
              queue={queue}
              onClearQueue={vi.fn()}
              isRemote
            />
          )

          const printArea = document.body.querySelector("#label-print-area")
          expect(printArea).not.toBeNull()

          const pageGroups = printArea!.querySelectorAll('[data-page-group]')
          expect(pageGroups.length).toBe(2)

          const firstPageGrid = pageGroups[0].querySelector('[data-print-grid]')
          const secondPageGrid = pageGroups[1].querySelector('[data-print-grid]')
          expect(firstPageGrid?.children.length).toBe(27)
          expect(secondPageGrid?.children.length).toBe(18)

          const keyWarnings = consoleError.mock.calls.filter(
            (call) =>
              typeof call[0] === "string" &&
              call[0].includes("Encountered two children with the same key")
          )
          expect(keyWarnings).toHaveLength(0)

          consoleError.mockRestore()
        })
      })
    })
