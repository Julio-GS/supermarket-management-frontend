import type { ProductRepository } from "@/modules/productos/application/product-repository"

export class ProductCodeNotFoundError extends Error {
  constructor(code: string) {
    super(
      `No se encontró ningún producto con el código "${code}". Verificá el código e intentá nuevamente.`
    )
    this.name = "ProductCodeNotFoundError"
  }
}

/**
 * Resolves a user-entered product barcode/code to the backend product UUID.
 *
 * Throws {@link ProductCodeNotFoundError} with a user-friendly message
 * when no product matches the given code.
 */
export async function resolveProductCode(
  productRepository: ProductRepository,
  code: string
): Promise<string> {
  const trimmed = code.trim()
  if (!trimmed) {
    throw new ProductCodeNotFoundError("(vacío)")
  }

  const product = await productRepository.findByCode(trimmed)
  if (!product) {
    throw new ProductCodeNotFoundError(trimmed)
  }

  return product.id
}
