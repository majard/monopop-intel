import { notFound } from 'next/navigation';

import { ShoppingListDetailProvider } from './ShoppingListDetailContext';
import ShoppingListDetailClient from './ShoppingListDetailClient';
import { GenericProduct, GenericResponse, Group, GenericSummary } from '@/types/models';

const API = process.env.NEXT_PUBLIC_API_URL;

async function getAvailableGenerics(): Promise<string[]> {
  if (!API) return [];
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
  if (group !== undefined) params.set('group', group);
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
  const currentGroup = sp.group ?? 'brand_size';
  const currentSort = sp.sort_by ?? 'price';
  const currentStore = sp.store ?? '';

  const availableGenerics = await getAvailableGenerics();

  let data: GenericResponse | null = null;
  let mainProduct: GenericProduct | undefined;
  let isMainProductGlobalBest = false;
  let minPricePerUnit: number | null = null;

  if (generic) {
    data = await fetchGeneric(generic, currentGroup, currentSort, currentStore);
    if (!data) notFound();

    const allProducts: GenericProduct[] = data.groups
      ? data.groups.flatMap((g) => g.variants)
      : data.products || [];

    mainProduct = allProducts.find((p) => p.product_id === productId);

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
  }

  return (
    <ShoppingListDetailProvider
      listId={listId}
      availableGenerics={availableGenerics}
      data={data}
      mainProduct={mainProduct}
      isMainProductGlobalBest={isMainProductGlobalBest}
      minPricePerUnit={minPricePerUnit}
      currentStore={currentStore}
      currentGroup={currentGroup}
      currentSort={currentSort}
      generic={generic}
      productId={productId}
    >
      <ShoppingListDetailClient />
    </ShoppingListDetailProvider>
  );
}