import { render as rtlRender, renderHook as rtlRenderHook } from "@testing-library/react"
import type { ReactElement, ReactNode } from "react"

function AllTheProviders({ children }: { children: ReactNode }) {
  return <>{children}</>
}

export function render(ui: ReactElement) {
  return rtlRender(ui, { wrapper: AllTheProviders })
}

export function renderHook<TProps, TResult>(hook: (props: TProps) => TResult) {
  return rtlRenderHook(hook, { wrapper: AllTheProviders })
}
