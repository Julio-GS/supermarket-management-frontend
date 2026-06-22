export type CheckoutErrorCode = "EMPTY_CART"

export interface CheckoutError {
  code: CheckoutErrorCode
  message: string
}
