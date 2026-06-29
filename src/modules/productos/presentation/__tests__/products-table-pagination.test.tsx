import { describe, expect, it, vi } from "vitest"
import { screen, fireEvent } from "@testing-library/react"
import { render } from "@/test/render"
import { ProductTablePagination } from "../products-table-pagination"

describe("ProductTablePagination", () => {
  it("renders page info and navigates in both directions", () => {
    const onPageChange = vi.fn()
    render(<ProductTablePagination page={2} totalPages={5} onPageChange={onPageChange} />)

    expect(screen.getByTestId("pagination-info")).toHaveTextContent("Página 2 de 5")

    fireEvent.click(screen.getByLabelText("Página anterior"))
    expect(onPageChange).toHaveBeenCalledWith(1)

    fireEvent.click(screen.getByLabelText("Página siguiente"))
    expect(onPageChange).toHaveBeenCalledWith(3)

    fireEvent.click(screen.getByLabelText("Primera página"))
    expect(onPageChange).toHaveBeenCalledWith(1)

    fireEvent.click(screen.getByLabelText("Última página"))
    expect(onPageChange).toHaveBeenCalledWith(5)
  })

  it("hides when there is only one page", () => {
    const { container } = render(
      <ProductTablePagination page={1} totalPages={1} onPageChange={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })
})
