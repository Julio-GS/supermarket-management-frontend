"use client"

import type { Product } from "../domain/product"
import { productRepository } from "../infrastructure/product-repository-instance"
import { stockRepository } from "../infrastructure/stock-repository-instance"
import { ProductsTable } from "../presentation/products-table"

export interface ProductsTableShellProps {
  initialProducts?: Product[]
}

export function ProductsTableShell({ initialProducts }: ProductsTableShellProps) {
  return (
    <ProductsTable
      repository={productRepository}
      stockRepository={stockRepository}
      initialProducts={initialProducts}
    />
  )
}
