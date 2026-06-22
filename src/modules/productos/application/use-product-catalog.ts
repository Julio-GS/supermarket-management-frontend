"use client"

import { useCallback, useState } from "react"
import type { CreateProductInput, Product } from "../domain/product"
import type { ProductFilters, ProductRepository } from "./product-repository"

export type CatalogState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success" }
  | { status: "error"; error: string }

export interface UseProductCatalogOptions {
  initialProducts?: Product[]
}

export interface UseProductCatalogResult {
  products: Product[]
  filters: ProductFilters
  applyFilters: (filters: ProductFilters) => void
  isLoading: boolean
  error: string | null
  createProduct: (input: CreateProductInput) => Promise<void>
  refresh: () => Promise<void>
}

export function useProductCatalog(
  repository: ProductRepository,
  options: UseProductCatalogOptions = {}
): UseProductCatalogResult {
  const [products, setProducts] = useState<Product[]>(options.initialProducts ?? [])
  const [filters, setFilters] = useState<ProductFilters>({})
  const [state, setState] = useState<CatalogState>({ status: "idle" })

  const load = useCallback(
    async (activeFilters: ProductFilters) => {
      setState({ status: "loading" })
      try {
        const result = await repository.list(activeFilters)
        setProducts(result)
        setState({ status: "success" })
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load products"
        setState({ status: "error", error: message })
      }
    },
    [repository]
  )

  const applyFilters = useCallback(
    (nextFilters: ProductFilters) => {
      setFilters(nextFilters)
      load(nextFilters)
    },
    [load]
  )

  const refresh = useCallback(() => load(filters), [load, filters])

  const createProduct = useCallback(
    async (input: CreateProductInput) => {
      await repository.create(input)
      await load(filters)
    },
    [repository, load, filters]
  )

  return {
    products,
    filters,
    applyFilters,
    isLoading: state.status === "loading",
    error: state.status === "error" ? state.error : null,
    createProduct,
    refresh,
  }
}
