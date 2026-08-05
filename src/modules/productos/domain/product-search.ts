export interface ProductSearchable {
  name: string
  sku: string
}

export function matchesProductSearch(item: ProductSearchable, searchTerm: string): boolean {
  const term = searchTerm.trim().toLowerCase()
  if (!term) return true

  return item.name.toLowerCase().includes(term) || item.sku.toLowerCase().includes(term)
}

export function isExactSkuMatch(items: ProductSearchable[], searchTerm: string): boolean {
  const term = searchTerm.trim().toLowerCase()
  if (!term) return false
  return items.some((item) => item.sku.toLowerCase() === term)
}
