export type CheckoutErrorCode = "EMPTY_CART" | "SERVER_ERROR"

export interface CheckoutError {
  code: CheckoutErrorCode
  message: string
}
