// web/app/shopping-lists/[listId]/page.tsx
import { notFound } from 'next/navigation';
import ShoppingListDetailClient from './ShoppingListDetailClient';

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

export default async function ShoppingListDetailPage() {
  const availableGenerics = await getAvailableGenerics();

  return <ShoppingListDetailClient availableGenerics={availableGenerics} />;
}