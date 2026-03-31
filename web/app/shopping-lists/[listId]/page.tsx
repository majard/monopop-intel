import { GenericProduct, GenericResponse, Group } from '@/types/models';
import ShoppingListDetailClient from './ShoppingListDetailClient';
import { notFound } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL;

interface GenericSummary {
  generic: string;
  count: number;
  with_size: number;
  noise_count: number;
}

async function getAvailableGenerics(): Promise<string[]> {
  if (!API) {
    console.error('NEXT_PUBLIC_API_URL is not defined');
    return [];
  }

  try {
    const res = await fetch(`${API}/generics`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      console.error('Failed to fetch generics:', res.status);
      return [];
    }

    const data = await res.json();
    const genericsList = Array.isArray(data.generics) ? data.generics : [];
    return genericsList.map((g: GenericSummary) => g.generic);
  } catch (err) {
    console.error('Error fetching generics:', err);
    return [];
  }
}


async function fetchGeneric(term: string, group?: string, sortBy?: string, store?: string): Promise<GenericResponse | null> {
  const params = new URLSearchParams();
  // FIX: Always include group parameter, even if empty, to allow flat list mode
  if (group !== undefined) params.set("group", group);
  if (sortBy) params.set("sort_by", sortBy);
  if (store) params.set("store", store);

  try {
    const res = await fetch(
      `${API}/generics/${encodeURIComponent(term)}?${params}`,
      { cache: "no-store" }
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
  params: Promise<{ term: string; product_id: string }>;
  searchParams: Promise<{
    group?: string;
    sort_by?: string;
    store?: string;
    generic?: string;
  }>;
}) {
  const { term, product_id } = await params;
  const sp = await searchParams;
  const decodedTerm = decodeURIComponent(term);
  // FIX: Check if group is explicitly in search params, default to brand_size only if not present
  const generic = sp.generic || "";
  const currentGroup = sp.group !== undefined ? sp.group : "brand_size";
  const currentSort = sp.sort_by || "price";
  const currentStore = sp.store || "";

  const data = await fetchGeneric(generic, currentGroup, currentSort, currentStore);
  console.log("data", data);
  if (!data) notFound();

  // Determine if we're in grouped mode (backend returns groups when group_mode is set)
  const isGrouped = !!data.group_mode && data.groups && data.groups.length > 0;

  let allProducts: GenericProduct[] = [];
  if (data.products) {
    allProducts = data.products;
  } else if (data.groups) {
    allProducts = data.groups.flatMap(g => g.variants);
  }


  const isMainProductGlobalBest = false;
  const minPricePerUnit = null;
  let mainProductCanonicalKey: string | null = null;

  const mainProduct: GenericProduct | undefined = allProducts.find(p => String(p.product_id) === product_id);
  if (mainProduct) {

    // Find the main product's canonical key using the group it belongs to
    if (data.groups) {
      const mainProductGroup = data.groups.find(g =>
        g.variants.some(v => String(v.product_id) === product_id)
      );
      if (mainProductGroup) {
        mainProductCanonicalKey = mainProductGroup.canonical_key;
      }
    }

    // Calculate global best price per unit across ALL products
    const availableProductsWithUnitPrice = allProducts.filter(p =>
      p.price_per_unit !== null && p.available
    );

    const minPricePerUnit = availableProductsWithUnitPrice.length > 0
      ? Math.min(...availableProductsWithUnitPrice.map(p => p.price_per_unit!))
      : null;

    const isMainProductGlobalBest = mainProduct.price_per_unit !== null &&
      mainProduct.available &&
      minPricePerUnit !== null &&
      Math.abs(mainProduct.price_per_unit - minPricePerUnit) < 0.0001;
  }
  // Prepare related data (exclude main product)
  let relatedGroups: Group[] = [];
  let relatedProducts: GenericProduct[] = [];

  if (isGrouped && data.groups) {
    // Filter out main product from groups
    relatedGroups = data.groups.map(group => ({
      ...group,
      variants: group.variants.filter(v => String(v.product_id) !== product_id)
    })).filter(group => group.variants.length > 0);

    // Sort groups: exact match first (only in brand_size mode)
    if (currentGroup === "brand_size" && mainProductCanonicalKey) {
      relatedGroups = [...relatedGroups].sort((a, b) => {
        const aIsExact = a.canonical_key === mainProductCanonicalKey;
        const bIsExact = b.canonical_key === mainProductCanonicalKey;

        if (aIsExact && !bIsExact) return -1;
        if (!aIsExact && bIsExact) return 1;
        return 0;
      });
    }
  } else if (data.products) {
    // Flat list mode
    relatedProducts = data.products.filter(p => String(p.product_id) !== product_id);
  }


  const availableGenerics = await getAvailableGenerics();


  return <ShoppingListDetailClient availableGenerics={availableGenerics} currentStore={currentStore} currentGroup={currentGroup} currentSort={currentSort} mainProduct={mainProduct} data={data} relatedGroups={relatedGroups} relatedProducts={relatedProducts} isMainProductGlobalBest={isMainProductGlobalBest} minPricePerUnit={minPricePerUnit} />;
}