import Link from 'next/link';
import { notFound } from 'next/navigation';
import FilterSelect from '@/components/ui/FilterSelect';
import AddToListButton from '@/components/ui/AddToListButton';
import { STORES } from '@/constants/stores';
import { GenericProduct, Group, GenericResponse } from '@/types/models';
import { ShoppingListsProvider } from '@/hooks/useShoppingLists';
import IntelFooter from '@/components/ui/IntelFooter';
import GenericProductList from '@/components/ui/GenericProductList';

const API = process.env.NEXT_PUBLIC_API_URL;

const GROUP_OPTIONS = [
  { value: '', label: 'Lista simples' },
  { value: 'brand_size', label: 'Por marca + tamanho' },
  { value: 'size_only', label: 'Por tamanho' },
  { value: 'brand_only', label: 'Por marca' },
];

const SORT_OPTIONS = [
  { value: 'price', label: 'Menor preço' },
  { value: 'price_per_unit', label: 'Menor preço por unidade' },
];

function formatPrice(p: number | null): string {
  if (p === null || p <= 0) return '—';
  return `R$ ${p.toFixed(2)}`;
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
      { next: { revalidate: 14400 } }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ term: string }>;
}) {
  const { term } = await params;
  const decoded = decodeURIComponent(term);
  return {
    title: `${decoded} — comparar preços`,
    description: `Preços de ${decoded} no Prezunic, Zona Sul e Hortifruti. Compare e escolha o melhor custo por unidade.`,
    openGraph: {
      title: `${decoded} · Monopop Intel`,
      description: `Compare preços de ${decoded} em supermercados do Rio.`,
    },
  };
}

export default async function GenericTermPage({
  params,
  searchParams,
}: {
  params: Promise<{ term: string }>;
  searchParams: Promise<{ group?: string; sort_by?: string; store?: string }>;
}) {
  const { term } = await params;
  const sp = await searchParams;
  const decodedTerm = decodeURIComponent(term);
  const currentGroup = sp.group !== undefined ? sp.group : 'brand_size';
  const currentSort = sp.sort_by || 'price';
  const currentStore = sp.store;

  const data = await fetchGeneric(decodedTerm, currentGroup, currentSort, currentStore);
  if (!data) notFound();

  const isGrouped = !!data.group_mode && !!data.groups?.length;

  const allProducts: GenericProduct[] = isGrouped
    ? data.groups!.flatMap(g => g.variants as GenericProduct[])
    : data.products ?? [];
    
  const availableWithUnit = allProducts.filter(
    p => p.price_per_unit !== null && p.available
  );
  const minPricePerUnit =
    availableWithUnit.length > 0
      ? Math.min(...availableWithUnit.map(p => p.price_per_unit!))
      : null;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      <div className="max-w-4xl mx-auto px-6 py-16">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-zinc-600 mb-8">
          <Link href="/generics" className="hover:text-zinc-400 transition-colors">
            básicos
          </Link>
          <span>·</span>
          <span className="text-zinc-400">{decodedTerm}</span>
        </div>

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">{decodedTerm}</h1>
              <p className="text-zinc-600 text-sm mt-1">
                {allProducts.length} produto{allProducts.length !== 1 ? 's' : ''}
                {currentStore && (
                  <> · {STORES[currentStore as keyof typeof STORES]?.label ?? currentStore}</>
                )}
                {data._meta?.fresh_cutoff && (
                  <span className="text-zinc-700">
                    {' '}· atualizado {new Date(data._meta.fresh_cutoff).toLocaleDateString('pt-BR')}
                  </span>
                )}
              </p>
            </div>
            <ShoppingListsProvider>
              <AddToListButton
                term={decodedTerm}
                className="flex-shrink-0 flex items-center gap-2 border border-zinc-800 hover:border-emerald-500/40 text-zinc-500 hover:text-emerald-400 px-3 py-2 rounded-lg text-xs transition-all cursor-pointer disabled:opacity-30"
                label="+ adicionar à lista"
              />
            </ShoppingListsProvider>
          </div>
        </div>

        {/* Grouping tabs */}
        <div className="flex flex-wrap gap-1 mb-6 border-b border-zinc-800 pb-1 overflow-x-auto">
          {GROUP_OPTIONS.map(({ value, label }) => (
            <Link
              key={value}
              href={`?${new URLSearchParams({
                ...(currentStore && { store: currentStore }),
                group: value,
                sort_by: currentSort,
              })}`}
              className={`px-4 py-1.5 text-xs rounded-t-lg transition-all whitespace-nowrap font-medium ${currentGroup === value
                ? 'bg-zinc-900 border border-b-0 border-zinc-700 text-white'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
                }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          <FilterSelect
            name="store"
            options={[
              { value: '', label: 'todas as lojas' },
              ...Object.entries(STORES).map(([k, s]) => ({ value: k, label: s.label })),
            ]}
            defaultValue={currentStore ?? ''}
          />
          <FilterSelect
            name="sort_by"
            options={SORT_OPTIONS}
            defaultValue={currentSort}
          />
        </div>

        {/* Products */}

        <GenericProductList
          termEncoded={encodeURIComponent(decodedTerm)}
          isGrouped={isGrouped}
          groups={isGrouped ? data.groups ?? [] : undefined}
          products={!isGrouped ? data.products ?? [] : undefined}
          minPricePerUnit={minPricePerUnit}
        />

        <IntelFooter className="mt-10" />
      </div>
    </main >
  );
}