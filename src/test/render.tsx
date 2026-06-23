import { render as rtlRender, renderHook as rtlRenderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactElement, ReactNode } from "react"

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        refetchOnWindowFocus: false,
      },
    },
  })
}

function AllTheProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>
  )
}

export function render(ui: ReactElement) {
  return rtlRender(ui, { wrapper: AllTheProviders })
}

export function renderHook<TProps, TResult>(hook: (props: TProps) => TResult) {
  return rtlRenderHook(hook, { wrapper: AllTheProviders })
}
