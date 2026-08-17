import { describe, it, expect, vi } from "vitest"
import { screen, fireEvent } from "@testing-library/react"
import { render } from "@/test/render"
import { BootstrapPendingPrompt } from "../presentation/bootstrap-pending-prompt"
import { BootstrapProgress } from "../presentation/bootstrap-progress"
import { BootstrapFailedPrompt } from "../presentation/bootstrap-failed-prompt"

describe("BootstrapPendingPrompt", () => {
  it("renders role=status with accessible name 'Bootstrap required'", () => {
    render(<BootstrapPendingPrompt canStart={false} onStart={() => {}} />)
    expect(screen.getByRole("status", { name: /bootstrap required/i })).toBeDefined()
  })

  it("renders the Spanish prompt copy", () => {
    render(<BootstrapPendingPrompt canStart={false} onStart={() => {}} />)
    expect(screen.getByText(/se requiere la descarga inicial/i)).toBeDefined()
    expect(screen.getByText(/asegurate de tener conexion/i)).toBeDefined()
  })

  it("renders an Iniciar descarga button", () => {
    render(<BootstrapPendingPrompt canStart={true} onStart={() => {}} />)
    expect(screen.getByRole("button", { name: /iniciar descarga/i })).toBeDefined()
  })

  it("disables the button when canStart is false", () => {
    render(<BootstrapPendingPrompt canStart={false} onStart={() => {}} />)
    expect(screen.getByRole("button", { name: /iniciar descarga/i })).toBeDisabled()
  })

  it("enables the button when canStart is true", () => {
    render(<BootstrapPendingPrompt canStart={true} onStart={() => {}} />)
    expect(screen.getByRole("button", { name: /iniciar descarga/i })).not.toBeDisabled()
  })

  it("calls onStart when button is clicked and canStart is true", () => {
    const onStart = vi.fn()
    render(<BootstrapPendingPrompt canStart={true} onStart={onStart} />)
    fireEvent.click(screen.getByRole("button", { name: /iniciar descarga/i }))
    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it("does not call onStart when button is clicked and canStart is false", () => {
    const onStart = vi.fn()
    render(<BootstrapPendingPrompt canStart={false} onStart={onStart} />)
    fireEvent.click(screen.getByRole("button", { name: /iniciar descarga/i }))
    expect(onStart).not.toHaveBeenCalled()
  })
})

describe("BootstrapProgress", () => {
  it("renders role=status with accessible name 'Bootstrap in progress'", () => {
    render(<BootstrapProgress />)
    expect(screen.getByRole("status", { name: /bootstrap in progress/i })).toBeDefined()
  })

  it("renders the Spanish progress copy", () => {
    render(<BootstrapProgress />)
    expect(screen.getByText(/descargando datos operativos/i)).toBeDefined()
    expect(screen.getByText(/aguarda un momento/i)).toBeDefined()
  })
})

describe("BootstrapFailedPrompt", () => {
  it("renders role=alert with accessible name 'Bootstrap failed'", () => {
    render(<BootstrapFailedPrompt canRetry={false} error={undefined} onRetry={() => {}} />)
    expect(screen.getByRole("alert", { name: /bootstrap failed/i })).toBeDefined()
  })

  it("renders the Spanish failure copy with error", () => {
    render(<BootstrapFailedPrompt canRetry={false} error="Timeout" onRetry={() => {}} />)
    expect(screen.getByText(/la descarga de datos fallo/i)).toBeDefined()
    expect(screen.getByText(/timeout/i)).toBeDefined()
  })

  it("renders the Spanish failure copy without error", () => {
    render(<BootstrapFailedPrompt canRetry={false} error={undefined} onRetry={() => {}} />)
    expect(screen.getByText(/la descarga de datos fallo/i)).toBeDefined()
  })

  it("renders a Reintentar button", () => {
    render(<BootstrapFailedPrompt canRetry={true} error={undefined} onRetry={() => {}} />)
    expect(screen.getByRole("button", { name: /reintentar/i })).toBeDefined()
  })

  it("disables the retry button when canRetry is false", () => {
    render(<BootstrapFailedPrompt canRetry={false} error={undefined} onRetry={() => {}} />)
    expect(screen.getByRole("button", { name: /reintentar/i })).toBeDisabled()
  })

  it("enables the retry button when canRetry is true", () => {
    render(<BootstrapFailedPrompt canRetry={true} error={undefined} onRetry={() => {}} />)
    expect(screen.getByRole("button", { name: /reintentar/i })).not.toBeDisabled()
  })

  it("calls onRetry when retry button is clicked and canRetry is true", () => {
    const onRetry = vi.fn()
    render(<BootstrapFailedPrompt canRetry={true} error={undefined} onRetry={onRetry} />)
    fireEvent.click(screen.getByRole("button", { name: /reintentar/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it("does not call onRetry when retry button is clicked and canRetry is false", () => {
    const onRetry = vi.fn()
    render(<BootstrapFailedPrompt canRetry={false} error={undefined} onRetry={onRetry} />)
    fireEvent.click(screen.getByRole("button", { name: /reintentar/i }))
    expect(onRetry).not.toHaveBeenCalled()
  })

  it("renders the verify connection help text", () => {
    render(<BootstrapFailedPrompt canRetry={false} error={undefined} onRetry={() => {}} />)
    expect(screen.getByText(/verifica tu conexion/i)).toBeDefined()
  })
})
