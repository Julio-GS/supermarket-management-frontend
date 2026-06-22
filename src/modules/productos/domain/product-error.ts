export type ProductErrorCode = "INVALID_NAME" | "INVALID_PRICE" | "INVALID_STOCK"

export interface ProductError {
  code: ProductErrorCode
  message: string
}
