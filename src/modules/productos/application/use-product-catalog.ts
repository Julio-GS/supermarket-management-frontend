"use client"

import { useCallback, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { CreateProductInput, Product, UpdateProductInput } from "../domain/product"
import { matchesProductSearch } from "../domain/product-search"
import type { ProductFilters, ProductListQuery, ProductPageMeta, ProductRepository } from "./product-repository"

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
  pageMeta: ProductPageMeta
  setPage: (page: number) => void
  isLoading: boolean
  error: string | null
  createProduct: (input: CreateProductInput) => Promise<void>
  updateProduct: (input: UpdateProductInput) => Promise<void>
  refresh: () => Promise<void>
}

const PRODUCTS_QUERY_KEY = "products"
const DEFAULT_PRODUCT_QUERY = {
  page: 1,
  limit: 100,
  sort: "created_at:desc",
} satisfies Required<ProductListQuery>

function createPage(products: Product[], query: ProductListQuery = DEFAULT_PRODUCT_QUERY) {
  const page = query.page ?? DEFAULT_PRODUCT_QUERY.page
  const limit = query.limit ?? DEFAULT_PRODUCT_QUERY.limit
  const total = products.length
  const totalPages = Math.max(1, Math.ceil(total / limit))

  return {
    products,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
    },
  }
}

export function useProductCatalog(
  repository: ProductRepository,
  options: UseProductCatalogOptions = {}
): UseProductCatalogResult {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<ProductFilters>({})
  const [query, setQuery] = useState<ProductListQuery>(DEFAULT_PRODUCT_QUERY)
  const [filtersApplied, setFiltersApplied] = useState(() => !options.initialProducts)

  const {
    data: productPage = createPage(options.initialProducts ?? [], query),
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [PRODUCTS_QUERY_KEY, query],
    queryFn: () => repository.list(query),
    initialData: options.initialProducts ? createPage(options.initialProducts, query) : undefined,
    enabled: filtersApplied,
  })

  const products = useMemo(() => {
    const search = filters.search
    if (!search) return productPage.products
    return productPage.products.filter((product) => matchesProductSearch(product, search))
  }, [productPage.products, filters.search])

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

  const setPage = useCallback(
    (page: number) => {
      setQuery((current) => ({ ...current, page }))
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
    pageMeta: productPage.meta,
    setPage,
    isLoading,
    error: error ? (error instanceof Error ? error.message : "Failed to load products") : null,
    createProduct,
    updateProduct,
    refresh,
  }
}
