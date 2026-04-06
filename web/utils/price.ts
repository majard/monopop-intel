export function hasDiscount(p: { price: number | null; list_price?: number | null }): boolean {
  return p.list_price != null && p.price != null && p.list_price > p.price;
}