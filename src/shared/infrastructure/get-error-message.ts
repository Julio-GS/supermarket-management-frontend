import { BackendRequestError } from "./api-client"

/**
 * Converts any thrown value into a user-friendly Spanish string.
 *
 * Priority:
 *   1. Known BackendRequestError — maps HTTP status to a friendly message.
 *   2. Network failure (TypeError "Failed to fetch") — connectivity message.
 *   3. Generic Error — returns err.message as-is (domain errors are already friendly).
 *   4. Unknown thrown value — generic fallback.
 */
export function getErrorMessage(err: unknown): string {
  // 1. BackendRequestError — map HTTP status codes to friendly messages
  if (err instanceof BackendRequestError) {
    const { status } = err

    if (status === 401) {
      return "Tu sesión expiró. Por favor, iniciá sesión de nuevo."
    }
    if (status === 403) {
      return "No tenés permisos para realizar esta acción."
    }
    if (status === 404) {
      return "No se encontró el recurso solicitado."
    }
    if (status === 409) {
      return "Ya existe un registro con esos datos."
    }
    if (status === 422) {
      return "Los datos enviados no son válidos. Revisá los campos e intentá de nuevo."
    }
    if (status >= 500) {
      return "El servidor tuvo un problema. Intentá de nuevo en un momento."
    }
    if (status === 0) {
      return "Sin conexión al servidor. Verificá tu red e intentá de nuevo."
    }

    // Any other 4xx — surface the backend message if it exists
    return err.message || "Ocurrió un error al procesar la solicitud."
  }

  // 2. Network failure — fetch throws TypeError when there's no connection
  if (
    err instanceof TypeError &&
    (err.message.toLowerCase().includes("failed to fetch") ||
      err.message.toLowerCase().includes("network request failed") ||
      err.message.toLowerCase().includes("load failed"))
  ) {
    return "Sin conexión al servidor. Verificá tu red e intentá de nuevo."
  }

  // 3. Generic Error — already user-readable (domain validation errors, etc.)
  if (err instanceof Error && err.message) {
    return err.message
  }

  // 4. Unknown thrown value (string, object, etc.)
  return "Ocurrió un error inesperado. Intentá de nuevo."
}
