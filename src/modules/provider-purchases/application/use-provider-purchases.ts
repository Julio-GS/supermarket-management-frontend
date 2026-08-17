import { useCallback } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { PROVIDER_PURCHASES_LIST_KEY } from "@/shared/infrastructure/query-keys"
import { invalidateProviderPurchaseQueries } from "@/shared/infrastructure/query-cache-policy"
import { triggerDesktopSync } from "@/modules/sync-status/trigger"
import type {
  ProviderPurchase,
  ProviderPurchaseInput,
  ProviderPurchasePatch,
} from "../domain/provider-purchase"
import { providerPurchaseRepository } from "../infrastructure/provider-purchase-repository-instance"

export function useProviderPurchases(
  repository: typeof providerPurchaseRepository = providerPurchaseRepository
) {
  const queryClient = useQueryClient()

  const {
    data: purchases = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: PROVIDER_PURCHASES_LIST_KEY,
    queryFn: () => repository.list(),
  })

  const createMutation = useMutation({
    mutationFn: (input: ProviderPurchaseInput) => repository.create(input),
    onSuccess: async (created) => {
      queryClient.setQueryData<ProviderPurchase[]>(
        PROVIDER_PURCHASES_LIST_KEY,
        (old) => [...(old ?? []), created]
      )
      await invalidateProviderPurchaseQueries(queryClient)
      void triggerDesktopSync({ reason: "provider-purchase-create" })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ProviderPurchasePatch }) =>
      repository.update(id, patch),
    onSuccess: async (updated) => {
      queryClient.setQueryData<ProviderPurchase[]>(
        PROVIDER_PURCHASES_LIST_KEY,
        (old) =>
          (old ?? []).map((p) => (p.id === updated.id ? updated : p))
      )
      await invalidateProviderPurchaseQueries(queryClient)
      void triggerDesktopSync({ reason: "provider-purchase-update" })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => repository.delete(id),
    onSuccess: async (_data, id) => {
      queryClient.setQueryData<ProviderPurchase[]>(
        PROVIDER_PURCHASES_LIST_KEY,
        (old) => (old ?? []).filter((p) => p.id !== id)
      )
      await invalidateProviderPurchaseQueries(queryClient)
      void triggerDesktopSync({ reason: "provider-purchase-delete" })
    },
  })

  const createPurchase = useCallback(
    async (input: ProviderPurchaseInput) => {
      return await createMutation.mutateAsync(input)
    },
    [createMutation]
  )

  const updatePurchase = useCallback(
    async (id: string, patch: ProviderPurchasePatch) => {
      return await updateMutation.mutateAsync({ id, patch })
    },
    [updateMutation]
  )

  const deletePurchase = useCallback(
    async (id: string) => {
      await deleteMutation.mutateAsync(id)
    },
    [deleteMutation]
  )

  return {
    purchases,
    isLoading,
    error: error ?? null,
    createPurchase,
    updatePurchase,
    deletePurchase,
  }
}
