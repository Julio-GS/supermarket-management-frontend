"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"
import { getErrorMessage } from "@/shared/infrastructure/get-error-message"

export interface ReactQueryProviderProps {
  children: React.ReactNode
}

export function ReactQueryProvider({ children }: ReactQueryProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: true,
            retry: 1,
          },
          mutations: {
            onError: (error) => {
              toast.error(getErrorMessage(error))
            },
          },
        },
        queryCache: undefined,
      })
  )

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

