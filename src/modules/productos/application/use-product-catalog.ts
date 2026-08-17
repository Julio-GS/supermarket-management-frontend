"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { PRODUCTS_QUERY_KEY } from "@/shared/infrastructure/query-keys"
import { invalidateProductCatalogQueries } from "@/shared/infrastructure/query-cache-policy"
import { triggerDesktopSync } from "@/modules/sync-status/trigger"
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
  toggleStockControl: (input: { id: string; manejaStock: boolean }) => Promise<void>
  refresh: () => Promise<void>
  isCreating: boolean
}

// Re-export for backward compatibility
export { PRODUCTS_QUERY_KEY }
const DEFAULT_PRODUCT_QUERY = {
  page: 1,
  limit: 100,
  sort: "created_at:desc",
} satisfies Required<Pick<ProductListQuery, "page" | "limit" | "sort">>

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

  const {
    data: productPage = createPage(options.initialProducts ?? [], query),
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [PRODUCTS_QUERY_KEY, query],
    queryFn: () => repository.list(query),
    initialData: options.initialProducts ? createPage(options.initialProducts, query) : undefined,
    // NOTE: 'enabled' is intentionally not used here.
    // Previously, when initialProducts were provided, enabled=false prevented the query from
    // re-running after a promotions invalidation, causing stale promotion badges in the product
    // table. By always keeping the query enabled, React Query can refetch on invalidation
    // (e.g., when a promotion is activated/deactivated). initialData still seeds the first
    // render without a network round-trip.
  })

  const products = useMemo(() => {
    const search = query.search?.trim() ?? filters.search?.trim() ?? ""
    if (!search) return productPage.products
    return productPage.products.filter((product) => matchesProductSearch(product, search))
  }, [productPage.products, filters.search, query.search])

  const createInFlightRef = useRef(false)

  const createMutation = useMutation({
    mutationFn: (input: CreateProductInput) => repository.create(input),
    onSuccess: (newProduct) => {
      // Update cache directly so the product appears immediately offline.
      // Also invalidate so a background refetch happens once connectivity returns.
      queryClient.setQueryData<ReturnType<typeof createPage>>(
        [PRODUCTS_QUERY_KEY, query],
        (old) => {
          if (!old) return old
          const updated = [newProduct, ...old.products]
          return { ...old, products: updated, meta: { ...old.meta, total: old.meta.total + 1 } }
        }
      )
      void invalidateProductCatalogQueries(queryClient)
      void triggerDesktopSync({ reason: "product-create" })
    },
  })

  const updateMutation = useMutation({
    mutationFn: (input: UpdateProductInput) => repository.update(input),
    onSuccess: (updatedProduct) => {
      // Update cache in-place so the change is visible immediately offline.
      queryClient.setQueryData<ReturnType<typeof createPage>>(
        [PRODUCTS_QUERY_KEY, query],
        (old) => {
          if (!old) return old
          const products = old.products.map((p) =>
            p.id === updatedProduct.id ? updatedProduct : p
          )
          return { ...old, products }
        }
      )
      void invalidateProductCatalogQueries(queryClient)
      void triggerDesktopSync({ reason: "product-update" })
    },
  })

  const toggleMutation = useMutation({
    mutationFn: (input: { id: string; manejaStock: boolean }) => repository.updateStockControl(input),
    onSuccess: (updatedProduct) => {
      queryClient.setQueryData<ReturnType<typeof createPage>>(
        [PRODUCTS_QUERY_KEY, query],
        (old) => {
          if (!old) return old
          const products = old.products.map((p) =>
            p.id === updatedProduct.id ? updatedProduct : p
          )
          return { ...old, products }
        }
      )
      void invalidateProductCatalogQueries(queryClient)
      void triggerDesktopSync({ reason: "product-update" })
    },
  })

  const applyFilters = useCallback(
    (nextFilters: ProductFilters) => {
      setFilters(nextFilters)
      const search = nextFilters.search?.trim()
      setQuery((current) => {
        const nextQuery = { ...current, page: 1 } as ProductListQuery
        if (search) {
          nextQuery.search = search
        } else {
          delete nextQuery.search
        }
        return nextQuery
      })
    },
    []
  )

  const setPage = useCallback(
    (page: number) => {
      setQuery((current) => ({ ...current, page }))
    },
    []
  )

  const refresh = useCallback(async () => {
    await refetch()
  }, [refetch])

  // Recover a persisted pending product creation once on mount (browser/API only).
  // Survives reload and dialog/screen reopen without waiting for a new submission.
  const recoveryRanRef = useRef(false)
  useEffect(() => {
    if (recoveryRanRef.current) return
    recoveryRanRef.current = true
    if (typeof repository.recoverPendingCreation !== "function") return

    void (async () => {
      try {
        const product = await repository.recoverPendingCreation!()
        if (product) {
          queryClient.setQueryData<ReturnType<typeof createPage>>(
            [PRODUCTS_QUERY_KEY, query],
            (old) => {
              const base = old ?? createPage([], query)
              const updated = [product, ...base.products]
              return { ...base, products: updated, meta: { ...base.meta, total: base.meta.total + 1 } }
            }
          )
          void invalidateProductCatalogQueries(queryClient)
        }
      } catch {
        // Indeterminate recovery failure — the persisted operation remains for a later retry.
      }
    })()
  }, [repository, queryClient, query])

  const createProduct = useCallback(
    async (input: CreateProductInput) => {
      if (createInFlightRef.current) {
        return
      }

      createInFlightRef.current = true
      try {
        // mutateAsync triggers onSuccess which updates the cache directly — no extra refetch needed.
        await createMutation.mutateAsync(input)
      } finally {
        createInFlightRef.current = false
      }
    },
    [createMutation]
  )

  const updateProduct = useCallback(
    async (input: UpdateProductInput) => {
      // mutateAsync triggers onSuccess which updates the cache directly — no extra refetch needed.
      await updateMutation.mutateAsync(input)
    },
    [updateMutation]
  )

  const toggleStockControl = useCallback(
    async (input: { id: string; manejaStock: boolean }) => {
      await toggleMutation.mutateAsync(input)
    },
    [toggleMutation]
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
    toggleStockControl,
    refresh,
    isCreating: createMutation.isPending,
  }
}
