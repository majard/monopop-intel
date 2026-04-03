import Link from 'next/link';
import { notFound } from 'next/navigation';
import FilterSelect from '@/components/ui/FilterSelect';
import AddToListButton from '@/components/ui/AddToListButton';
import { STORES } from '@/constants/stores';
import { GenericProduct, Group, GenericResponse } from '@/types/models';
import { ShoppingListsProvider } from '@/hooks/useShoppingLists';

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

  const isGlobalBest = (p: { price_per_unit: number | null; available: boolean }) =>
    p.price_per_unit !== null &&
    p.available &&
    minPricePerUnit !== null &&
    Math.abs(p.price_per_unit - minPricePerUnit) < 0.0001;

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
        {isGrouped ? (
          <div className="space-y-6">
            {data.groups!.map((group: Group) => {
              const validPrices = group.variants
                .filter(v => v.price !== null && v.available)
                .map(v => v.price!);
              const minGroupPrice =
                validPrices.length > 0 ? Math.min(...validPrices) : null;
              const maxGroupPrice =
                validPrices.length > 0 ? Math.max(...validPrices) : null;

              return (
                <div
                  key={group.canonical_key}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-5"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="font-medium text-white text-sm">
                        {Array.isArray(group.brand)
                          ? group.brand.join(' · ')
                          : group.brand || 'Sem marca'}
                      </p>
                      {group.normalized_size && (
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {group.normalized_size}
                        </p>
                      )}
                    </div>
                    {minGroupPrice !== null && (
                      <div className="text-right shrink-0">
                        <p className="text-emerald-400 text-sm font-medium tabular-nums">
                          {formatPrice(minGroupPrice)}
                          {maxGroupPrice !== null && maxGroupPrice !== minGroupPrice && (
                            <span className="text-zinc-600">
                              {' '}— {formatPrice(maxGroupPrice)}
                            </span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    {group.variants.map(v => {
                      const isCheapest =
                        minGroupPrice !== null &&
                        v.price === minGroupPrice &&
                        v.available;
                      const isBestUnit = isGlobalBest(v);

                      return (
                        <Link
                          key={v.product_id}
                          href={`/generics/${encodeURIComponent(decodedTerm)}/${v.product_id}`}
                          className="block group"
                        >
                          <div
                            className={`relative flex justify-between items-center px-4 py-3 rounded-lg border transition-colors ${isCheapest
                              ? 'border-emerald-500/30'
                              : 'border-zinc-800'
                              } hover:border-emerald-500/60`}
                          >
                            {isCheapest && (
                              <div className="absolute -top-2 left-3 bg-zinc-950 px-1">
                                <span className="bg-emerald-500 text-zinc-950 text-[9px] font-bold px-2 py-0.5 rounded">
                                  melhor preço
                                </span>
                              </div>
                            )}
                            {isBestUnit && (
                              <div className="absolute -top-2 right-3 bg-zinc-950 px-1">
                                <span className="bg-amber-500 text-zinc-950 text-[9px] font-bold px-2 py-0.5 rounded">
                                  melhor/unid
                                </span>
                              </div>
                            )}

                            <div className="flex-1 pr-4 min-w-0">
                              <p className="text-xs text-zinc-500">
                                {STORES[v.store as keyof typeof STORES]?.label ?? v.store}
                              </p>
                              <p className="text-sm text-zinc-200 group-hover:text-emerald-400 transition-colors truncate mt-0.5">
                                {v.name}
                              </p>
                            </div>

                            <div className="text-right shrink-0">
                              <p
                                className={`font-medium tabular-nums ${isCheapest ? 'text-emerald-400' : 'text-zinc-300'
                                  }`}
                              >
                                {formatPrice(v.price)}
                              </p>
                              {v.display_per_unit && (
                                <p className="text-[10px] text-zinc-600">
                                  {v.display_per_unit}
                                </p>
                              )}
                              <span className="text-[10px] text-emerald-500 opacity-0 group-hover:opacity-70 transition-opacity mt-0.5 inline-block">
                                ver detalhes →
                              </span>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {(data.products ?? []).map((p: GenericProduct) => {
              const isBestUnit = isGlobalBest(p);
              return (
                <Link
                  key={p.product_id}
                  href={`/generics/${encodeURIComponent(decodedTerm)}/${p.product_id}`}
                  className="group block bg-zinc-900 border border-zinc-800 hover:border-emerald-500/40 rounded-xl px-5 py-4 transition-colors relative"
                >
                  {isBestUnit && (
                    <div className="absolute -top-2 right-4 bg-zinc-950 px-1">
                      <span className="bg-amber-500 text-zinc-950 text-[9px] font-bold px-2 py-0.5 rounded">
                        melhor/unid
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-200 group-hover:text-emerald-400 transition-colors truncate">
                        {p.name}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700/60">
                          {STORES[p.store as keyof typeof STORES]?.label ?? p.store}
                        </span>
                        {p.parsed_brand && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800/60 text-zinc-600 border border-zinc-800">
                            {p.parsed_brand}
                          </span>
                        )}
                        {p.normalized_size && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/15">
                            {p.normalized_size}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-emerald-400 font-bold tabular-nums">
                        {formatPrice(p.price)}
                      </p>
                      {p.display_per_unit && (
                        <p className="text-[10px] text-zinc-600">{p.display_per_unit}</p>
                      )}
                      <span className="text-[10px] text-emerald-500 opacity-0 group-hover:opacity-70 transition-opacity mt-0.5 inline-block">
                        ver detalhes →
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <p className="text-[11px] text-zinc-800 text-center mt-12">
          Monopop Intel é gratuito e sem anúncios.{' '}

          <Link
            href="/support"
            className="text-zinc-700 hover:text-zinc-500 underline transition-colors"
          >
            Apoiar o projeto →
          </Link>
        </p>
      </div>
    </main >
  );
}