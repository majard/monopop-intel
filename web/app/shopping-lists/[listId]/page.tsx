
import { ShoppingListDetailProvider } from './ShoppingListDetailContext';
import ShoppingListDetailClient from './ShoppingListDetailClient';
import { GenericSummary } from '@/types/models';

const API = process.env.NEXT_PUBLIC_API_URL;

async function getAvailableGenerics(): Promise<string[]> {
  if (!API) return [];
  try {
    const res = await fetch(`${API}/generics`, {
      next: { revalidate: 14400 }, // 4 hours
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

  const availableGenerics = await getAvailableGenerics();

  return (
    <ShoppingListDetailProvider
      listId={listId}
      availableGenerics={availableGenerics}
      initialGeneric={sp.generic ?? ''}
      initialProductId={sp.productId ? parseInt(sp.productId, 10) : undefined}
    >
      <ShoppingListDetailClient />
    </ShoppingListDetailProvider>
  );
}