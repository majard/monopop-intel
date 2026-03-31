import { notFound } from 'next/navigation';

import ShoppingListDetailClient from './ShoppingListDetailClient';
import { GenericProduct, GenericResponse, Group, GenericSummary } from '@/types/models';

const API = process.env.NEXT_PUBLIC_API_URL;

async function getAvailableGenerics(): Promise<string[]> {
  if (!API) {
    console.error('NEXT_PUBLIC_API_URL is not defined');
    return [];
  }
  try {
    const res = await fetch(`${API}/generics`, {
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const genericsList = Array.isArray(data.generics) ? data.generics : [];
    return genericsList.map((g: GenericSummary) => g.generic);
  } catch {
    return [];
  }
}

async function fetchGeneric(
  term: string,
  group?: string,
  sortBy?: string,
  store?: string
): Promise<GenericResponse | null> {
  const params = new URLSearchParams();
  if (group !== undefined) params.set('group', group); // empty string = flat list
  if (sortBy) params.set('sort_by', sortBy);
  if (store) params.set('store', store);

  try {
    const res = await fetch(
      `${API}/generics/${encodeURIComponent(term)}?${params}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function ShoppingListDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ listId: string }>;
  searchParams: Promise<{
    generic?: string;
    productId?: string;
    group?: string;
    sort_by?: string;
    store?: string;
  }>;
}) {
  const { listId } = await params;
  const sp = await searchParams;

  const generic = sp.generic ?? '';
  const productId = sp.productId ? parseInt(sp.productId, 10) : undefined;
  const currentGroup = sp.group ?? 'brand_size'; // default matches existing UI
  const currentSort = sp.sort_by ?? 'price';
  const currentStore = sp.store ?? '';

  const availableGenerics = await getAvailableGenerics();

  // Only fetch when a generic is selected (panel is "open")
  let data: GenericResponse | null = null;
  let mainProduct: GenericProduct | undefined;
  let relatedGroups: Group[] = [];
  let relatedProducts: GenericProduct[] = [];
  let isMainProductGlobalBest = false;
  let minPricePerUnit: number | null = null;

  if (generic) {
    data = await fetchGeneric(generic, currentGroup, currentSort, currentStore);

    if (!data) notFound();

    // Flatten all products (grouped or flat mode)
    const allProducts: GenericProduct[] = data.groups
      ? data.groups.flatMap((g) => g.variants)
      : data.products || [];

    // Main product (pinned by productId)
    mainProduct = allProducts.find((p) => p.product_id === productId);

    // Global best-per-unit calculation (used by badges)
    const availableWithUnit = allProducts.filter(
      (p) => p.price_per_unit !== null && p.available
    );
    minPricePerUnit =
      availableWithUnit.length > 0
        ? Math.min(...availableWithUnit.map((p) => p.price_per_unit!))
        : null;

    if (mainProduct && minPricePerUnit !== null) {
      isMainProductGlobalBest =
        mainProduct.price_per_unit !== null &&
        mainProduct.available &&
        Math.abs(mainProduct.price_per_unit - minPricePerUnit) < 0.0001;
    }

    // Related items (exclude the pinned product)
    if (data.groups) {
      relatedGroups = data.groups
        .map((group) => ({
          ...group,
          variants: group.variants.filter((v) => v.product_id !== productId),
        }))
        .filter((group) => group.variants.length > 0);
    } else if (data.products) {
      relatedProducts = data.products.filter((p) => p.product_id !== productId);
    }
  }

  return (
    <ShoppingListDetailClient
      listId={listId}
      availableGenerics={availableGenerics}
      data={data}
      mainProduct={mainProduct}
      relatedGroups={relatedGroups}
      relatedProducts={relatedProducts}
      isMainProductGlobalBest={isMainProductGlobalBest}
      minPricePerUnit={minPricePerUnit}
      currentStore={currentStore}
      currentGroup={currentGroup}
      currentSort={currentSort}
      generic={generic}
      productId={productId}
    />
  );
}