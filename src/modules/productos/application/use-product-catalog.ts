"use client"

import { useCallback, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { CreateProductInput, Product, UpdateProductInput } from "../domain/product"
import { matchesProductSearch } from "../domain/product-search"
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
  updateProduct: (input: UpdateProductInput) => Promise<void>
  refresh: () => Promise<void>
}

const PRODUCTS_QUERY_KEY = "products"

export function useProductCatalog(
  repository: ProductRepository,
  options: UseProductCatalogOptions = {}
): UseProductCatalogResult {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<ProductFilters>({})
  const [filtersApplied, setFiltersApplied] = useState(() => !options.initialProducts)

  const {
    data: rawProducts = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [PRODUCTS_QUERY_KEY, filters],
    queryFn: () => repository.list(filters),
    initialData: options.initialProducts,
    enabled: filtersApplied,
  })

  const products = useMemo(() => {
    const search = filters.search
    if (!search) return rawProducts
    return rawProducts.filter((product) => matchesProductSearch(product, search))
  }, [rawProducts, filters.search])

  const createMutation = useMutation({
    mutationFn: (input: CreateProductInput) => repository.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [PRODUCTS_QUERY_KEY] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: (input: UpdateProductInput) => repository.update(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [PRODUCTS_QUERY_KEY] })
    },
  })

  const applyFilters = useCallback(
    (nextFilters: ProductFilters) => {
      setFilters(nextFilters)
      if (!filtersApplied) {
        setFiltersApplied(true)
      }
    },
    [filtersApplied]
  )

  const refresh = useCallback(async () => {
    if (!filtersApplied) {
      setFiltersApplied(true)
    }
    await refetch()
  }, [filtersApplied, refetch])

  const createProduct = useCallback(
    async (input: CreateProductInput) => {
      await createMutation.mutateAsync(input)
      await refresh()
    },
    [createMutation, refresh]
  )

  const updateProduct = useCallback(
    async (input: UpdateProductInput) => {
      await updateMutation.mutateAsync(input)
      await refresh()
    },
    [updateMutation, refresh]
  )

  return {
    products,
    filters,
    applyFilters,
    isLoading,
    error: error ? (error instanceof Error ? error.message : "Failed to load products") : null,
    createProduct,
    updateProduct,
    refresh,
  }
}
