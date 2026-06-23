"use client"

import { useQuery } from "@tanstack/react-query"
import type { TopProduct } from "../domain/report-read-models"
import type { TopProductsPort } from "./top-products-port"

export interface UseTopProductsResult {
  products: TopProduct[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const TOP_PRODUCTS_LIMIT = 5
const QUERY_KEY = ["reports", "top-products", TOP_PRODUCTS_LIMIT]

export function useTopProducts(port: TopProductsPort): UseTopProductsResult {
  const { data: products = [], isLoading, error, refetch } = useQuery<TopProduct[]>({
    queryKey: QUERY_KEY,
    queryFn: () => port.getTopProducts(TOP_PRODUCTS_LIMIT),
  })

  const refresh = async () => {
    await refetch()
  }

  return {
    products,
    isLoading,
    error: error
      ? error instanceof Error
        ? error.message
        : "Failed to load top products"
      : null,
    refresh,
  }
}
