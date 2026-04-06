import { Suspense } from 'react';
import GenericsClientList from './GenericsClientList';
import { ShoppingListsProvider } from '@/hooks/useShoppingLists';

export const metadata = {
  title: 'Básicos',
  description: 'Todos os produtos básicos com comparação de preços entre supermercados do Rio.',
};

const API = process.env.NEXT_PUBLIC_API_URL;

async function fetchGenerics() {
  if (!API) return [];
  try {
    const res = await fetch(`${API}/generics`, { next: { revalidate: 14400 } });
    if (!res.ok) {
      if (res.status === 404) return [];
      throw new Error(`fetchGenerics failed: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    return data.generics ?? [];
  } catch (error) {
    console.error("fetchGenerics failed", error);
    return null;
  }
}

export default async function GenericsPage() {
  const generics = await fetchGenerics();
  const isError = generics === null;
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-white">Básicos</h1>
          {!isError && (
            <p className="text-zinc-600 text-sm mt-1">
              {generics.length} itens básicos monitorados · atualizado diariamente
            </p>
          )}
        </div>

        {isError ? (
          <div className="text-red-500 text-sm">Erro ao carregar itens básicos</div>
        ) : (
          <Suspense fallback={
            <div className="text-zinc-700 text-sm animate-pulse">carregando...</div>
          }>
            <ShoppingListsProvider>
              <GenericsClientList generics={generics} />
            </ShoppingListsProvider>
          </Suspense>)}
      </div>
    </main>
  );
}