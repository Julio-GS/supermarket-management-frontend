"use client"

import { useCallback, useState } from "react"
import type { Product } from "../domain/product"

export interface LabelItem {
  product: Product
  changedAt: Date
  /** Stable key for React list rendering. Set to job.id for remote items, product.id for local. */
  queueKey?: string
}

export interface UseLabelQueueResult {
  queue: LabelItem[]
  isOpen: boolean
  enqueue: (product: Product, changedAt: Date) => void
  clearQueue: () => void
  openDialog: () => void
  closeDialog: () => void
}

export function useLabelQueue(): UseLabelQueueResult {
  const [queue, setQueue] = useState<LabelItem[]>([])
  const [isOpen, setIsOpen] = useState(false)

  const enqueue = useCallback((product: Product, changedAt: Date) => {
    setQueue((prev) => {
      // Replace if the same product is already queued (e.g. edited twice)
      const filtered = prev.filter((item) => item.product.id !== product.id)
      return [...filtered, { product, changedAt, queueKey: product.id }]
    })
  }, [])

  const clearQueue = useCallback(() => {
    setQueue([])
    setIsOpen(false)
  }, [])

  const openDialog = useCallback(() => setIsOpen(true), [])
  const closeDialog = useCallback(() => setIsOpen(false), [])

  return { queue, isOpen, enqueue, clearQueue, openDialog, closeDialog }
}
