// ─── Shopping Lists ─────────────────────────────────────────────────────────
export interface ShoppingListItem {
  id: string;
  genericName: string;
  productId?: number;
  quantity: number;
  preferredUnit?: string;
  preferredStdSize?: number;
  notes?: string;
}

export interface ShoppingList {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  items: ShoppingListItem[];
}

// ─── Generics / Products ────────────────────────────────────────────────────
export interface GenericSummary {
  generic: string;
  count: number;
  with_size: number;
  noise_count: number;
}

export interface GenericProduct {
  product_id: number;
  name: string;
  store: string;
  price: number | null;
  package_size: number | null;
  unit: string | null;
  parsed_brand: string | null;
  available: boolean;
  price_per_unit: number | null;
  normalized_size: string | null;
  display_per_unit: string | null;
  brand?: string | null;
  ean?: string | null;
  category?: string | null;
  url?: string | null;
}

export interface Group {
  canonical_key: string;
  generic: string;
  brand: string | string[] | null;
  package_size: number | null;
  unit: string | null;
  normalized_size: string | null;
  variants: GenericProduct[];
  price_stats: {
    min: number | null;
    max: number | null;
    avg: number | null;
  };
}

export interface GenericResponse {
  generic: string;
  count: number;
  products?: GenericProduct[];
  groups?: Group[];
  group_mode?: string | null;
  sort_by: string;
  _meta: any;
}

// Re-export for convenience
export type UnitSymbol = 'g' | 'kg' | 'ml' | 'L' | 'un';