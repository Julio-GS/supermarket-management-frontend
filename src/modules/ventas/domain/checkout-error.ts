export type CheckoutErrorCode =
  | "EMPTY_CART"
  | "SERVER_ERROR"
  | "SPLIT_INVALID"
  | "INVOICE_FAILED"
  | "INVOICE_REQUESTED_FAILED"

export interface CheckoutError {
  code: CheckoutErrorCode
  message: string
}
