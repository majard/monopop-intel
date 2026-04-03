import Link from "next/link";
import { notFound } from "next/navigation";
import FilterSelect from "@/components/ui/FilterSelect";
import AddToListButton from "@/components/ui/AddToListButton";
import { STORES } from '@/constants/stores';
import { GenericProduct, Group, GenericResponse } from "@/types/models";


const API = process.env.NEXT_PUBLIC_API_URL;


const GROUP_OPTIONS = [
  { value: "", label: "Lista simples" },
  { value: "brand_size", label: "Por marca + tamanho" },
  { value: "size_only", label: "Por tamanho" },
  { value: "brand_only", label: "Por marca" },
];

const SORT_OPTIONS = [
  { value: "price", label: "Menor preço" },
  { value: "price_per_unit", label: "Menor preço por unidade" },
];

function formatPrice(p: number | null): string {
  if (p === null || p <= 0) return "—";
  return `R$ ${p.toFixed(2)}`;
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
  params: Promise<{ term: string; product_id: string }>;
}) {
  const { term } = await params;
  const decoded = decodeURIComponent(term);
  return {
    title: `${decoded} — preço em supermercados do Rio`,
    description: `Compare o preço de ${decoded} no Prezunic, Zona Sul e Hortifruti. Atualizado diariamente pelo Monopop Intel.`,
    openGraph: {
      title: `${decoded} · Monopop Intel`,
      description: `Preços e histórico de ${decoded} nos supermercados do Rio de Janeiro.`,
    },
  };
}

export default async function GenericProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ term: string; product_id: string }>;
  searchParams: Promise<{
    group?: string;
    sort_by?: string;
    store?: string;
  }>;
}) {
  const { term, product_id } = await params;
  const sp = await searchParams;
  const decodedTerm = decodeURIComponent(term);
  // FIX: Check if group is explicitly in search params, default to brand_size only if not present
  const currentGroup = sp.group !== undefined ? sp.group : "brand_size";
  const currentSort = sp.sort_by || "price";
  const currentStore = sp.store;

  const data = await fetchGeneric(decodedTerm, currentGroup, currentSort, currentStore);
  if (!data) notFound();

  // Determine if we're in grouped mode (backend returns groups when group_mode is set)
  const isGrouped = !!data.group_mode && data.groups && data.groups.length > 0;

  let allProducts: GenericProduct[] = [];
  if (data.products) {
    allProducts = data.products;
  } else if (data.groups) {
    allProducts = data.groups.flatMap(g => g.variants);
  }

  const mainProduct = allProducts.find(p => String(p.product_id) === product_id);
  if (!mainProduct) notFound();

  // Find the main product's canonical key using the group it belongs to
  let mainProductCanonicalKey: string | null = null;
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

  // Helper to check if a product is global best
  const isGlobalBestPerUnit = (product: GenericProduct) => {
    return product.price_per_unit !== null &&
      product.available &&
      minPricePerUnit !== null &&
      Math.abs(product.price_per_unit - minPricePerUnit) < 0.0001;
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      <div className="max-w-4xl mx-auto px-6 py-16">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-zinc-600 mb-6">
          <Link href="/generics" className="hover:text-zinc-400 transition-colors">básicos</Link>
          <span>·</span>
          <Link href={`/generics/${encodeURIComponent(decodedTerm)}`} className="hover:text-zinc-400 transition-colors">
            {decodedTerm}
          </Link>
          <span>·</span>
          <span className="text-zinc-500 truncate">{mainProduct.name}</span>
        </div>

        {/* ── Main product header ────────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-lg font-bold text-white leading-snug">{mainProduct.name}</h1>
              {mainProduct.parsed_brand && (
                <p className="text-zinc-400 text-sm mt-0.5">{mainProduct.parsed_brand}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold text-emerald-400">{formatPrice(mainProduct.price)}</p>
              {mainProduct.display_per_unit && (
                <p className="text-xs text-zinc-500 mt-0.5">{mainProduct.display_per_unit}</p>
              )}
              {mainProduct.list_price != null &&
                mainProduct.price != null &&
                mainProduct.list_price > mainProduct.price && (
                  <p className="text-xs text-zinc-600 line-through mt-0.5">
                    {formatPrice(mainProduct.list_price)}
                  </p>
                )}
              {isMainProductGlobalBest && (
                <div className="mt-2">
                  <span className="bg-amber-500 text-zinc-950 text-[10px] font-bold px-2.5 py-0.5 rounded">
                    melhor por unidade
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Metadata badges */}
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
              {STORES[mainProduct.store as keyof typeof STORES]?.label ?? mainProduct.store}
            </span>
            {mainProduct.normalized_size && (
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {mainProduct.normalized_size}
              </span>
            )}
            {mainProduct.ean && (
              <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-600 border border-zinc-800">
                EAN {mainProduct.ean}
              </span>
            )}
            {mainProduct.category && (
              <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-800">
                {mainProduct.category}
              </span>
            )}
            {mainProduct.url && (

              <a
                href={mainProduct.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-emerald-500 border border-zinc-800 hover:border-emerald-500 transition-colors"
              >
                ver na loja ↗
              </a>
            )}
          </div>

          {/* Actions row */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-zinc-800/60">

            <Link
              href={`/history/${encodeURIComponent(decodedTerm)}/${product_id}`}
              className="text-sm text-zinc-500 hover:text-emerald-400 transition-colors"
            >
              histórico de preços →
            </Link>
            <span className="text-zinc-800">·</span>
            <AddToListButton
              term={decodedTerm}
              productId={mainProduct.product_id}
              price={mainProduct.price}
              store={mainProduct.store}
              unit={mainProduct.unit}
              stdSize={mainProduct.package_size ?? undefined}
              className="text-sm text-zinc-500 hover:text-emerald-400 transition-colors cursor-pointer disabled:opacity-40"
              label="+ adicionar à lista"
            />
          </div>
        </div>

        {/* Related Variants Section */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-6">Outras variações deste genérico</h2>

          {/* Grouping Tabs - FIX: Always include group parameter */}
          <div className="flex flex-wrap gap-1 mb-6 border-b border-zinc-800 pb-1 overflow-x-auto">
            {GROUP_OPTIONS.map(({ value, label }) => (
              <Link
                key={value}
                href={`?${new URLSearchParams({
                  ...(currentStore && { store: currentStore }),
                  group: value, // Always include, even if empty for flat list
                  sort_by: currentSort,
                }).toString()}`}
                className={`px-5 py-2 text-sm rounded-t-lg transition-all whitespace-nowrap font-medium ${currentGroup === value
                  ? "bg-zinc-900 border border-b-0 border-zinc-700 text-white"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-950"
                  }`}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-8">
            <FilterSelect
              name="store"
              options={[
                { value: "", label: "todas as lojas" },
                ...Object.entries(STORES).map(([k, v]) => ({
                  value: k,
                  label: STORES[k as keyof typeof STORES]?.label ?? k
                })),
              ]}
              defaultValue={currentStore ?? ""}
            />
            <FilterSelect
              name="sort_by"
              options={SORT_OPTIONS}
              defaultValue={currentSort}
            />
          </div>

          {/* Render content based on mode */}
          {isGrouped ? (
            <div className="space-y-6">
              {relatedGroups.map((group) => {
                const validPrices = group.variants
                  .filter(v => v.price !== null && v.available)
                  .map(v => v.price!);
                const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : null;

                // FIX: Only show "mesma embalagem" label in brand_size mode
                const isExactMatchGroup = currentGroup === "brand_size" &&
                  mainProductCanonicalKey &&
                  group.canonical_key === mainProductCanonicalKey;

                return (
                  <div key={group.canonical_key} className={`bg-zinc-900 border ${isExactMatchGroup ? "border-emerald-500/40" : "border-zinc-800"} rounded-lg p-5`}>
                    {isExactMatchGroup && (
                      <div className="text-emerald-400 text-xs font-medium mb-3 flex items-center gap-1">
                        <span className="bg-emerald-500/10 px-2 py-0.5 rounded">MESMA EMBALAGEM EM OUTRAS LOJAS</span>
                      </div>
                    )}
                    <div className="flex justify-between mb-4">
                      <div>
                        <div className="font-semibold text-white">
                          {Array.isArray(group.brand) ? group.brand.join(" • ") : group.brand || "Sem marca"}
                        </div>
                        {group.normalized_size && (
                          <div className="text-sm text-zinc-400">{group.normalized_size}</div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {group.variants.map((v) => {
                        const isCheapestInGroup = minPrice !== null && v.price === minPrice && v.available;
                        const vIsGlobalBest = isGlobalBestPerUnit(v);

                        return (
                          <Link
                            key={v.product_id}
                            href={`/generics/${encodeURIComponent(decodedTerm)}/${v.product_id}`}
                            className="block group"
                          >
                            <div className={`relative flex justify-between items-center px-4 py-3 rounded border ${isCheapestInGroup ? "border-emerald-500/40" : "border-zinc-800"} hover:border-emerald-500 transition-colors`}>
                              {isCheapestInGroup && (
                                <div className="absolute -top-2 left-3 bg-zinc-950 px-1">
                                  <div className="bg-emerald-500 text-zinc-950 text-[10px] font-bold px-2.5 py-0.5 rounded">
                                    melhor preço
                                  </div>
                                </div>
                              )}

                              {vIsGlobalBest && (
                                <div className="absolute -top-2 right-3 bg-zinc-950 px-1">
                                  <div className="bg-amber-500 text-zinc-950 text-[10px] font-bold px-2.5 py-0.5 rounded">
                                    melhor por unidade
                                  </div>
                                </div>
                              )}

                              <div className="text-sm pr-8">
                                <span className="text-zinc-400">{STORES[v.store as keyof typeof STORES]?.label ?? v.store}</span>
                                {" • "}
                                <span className="text-zinc-100 group-hover:text-emerald-400 transition-colors">{v.name}</span>
                                {v.normalized_size && (
                                  <span className="text-zinc-500 ml-2">({v.normalized_size})</span>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <div className={`font-medium ${isCheapestInGroup ? "text-emerald-400" : ""}`}>
                                  {formatPrice(v.price)}
                                </div>
                                {v.display_per_unit && (
                                  <div className="text-xs text-zinc-500">{v.display_per_unit}</div>
                                )}
                                <span className="text-xs text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity mt-1 inline-block">
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
          ) : relatedProducts.length > 0 ? (
            <div className="flex flex-col gap-3">
              {relatedProducts.map((p) => {
                const pIsGlobalBest = isGlobalBestPerUnit(p);

                return (
                  <Link
                    key={p.product_id}
                    href={`/generics/${encodeURIComponent(decodedTerm)}/${p.product_id}`}
                    className="group block bg-zinc-900 border border-zinc-800 hover:border-emerald-500 rounded-lg px-5 py-5 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 relative">
                      {pIsGlobalBest && (
                        <div className="absolute -top-2 right-4 bg-zinc-950 px-1">
                          <div className="bg-amber-500 text-zinc-950 text-[10px] font-bold px-2.5 py-0.5 rounded">
                            melhor por unidade
                          </div>
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] text-zinc-100 group-hover:text-emerald-400 transition-colors truncate">
                          {p.name}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2 text-xs">
                          <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                            {STORES[p.store as keyof typeof STORES]?.label ?? p.store}
                          </span>
                          {p.parsed_brand && (
                            <span className="px-2 py-0.5 rounded bg-zinc-800/70 text-zinc-500 border border-zinc-800">
                              {p.parsed_brand}
                            </span>
                          )}
                          {p.normalized_size && (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {p.normalized_size}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-emerald-400 font-bold text-[20px]">
                          {formatPrice(p.price)}
                        </p>
                        {p.display_per_unit && (
                          <p className="text-xs text-zinc-500">{p.display_per_unit}</p>
                        )}
                        <span className="text-xs text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity mt-2 inline-block">
                          ver detalhes →
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-zinc-600 text-sm">Nenhuma variação encontrada.</p>
          )}
        </div>

        <p className="text-[11px] text-zinc-800 text-center mt-10">
          Monopop Intel é gratuito e sem anúncios.{' '}
          <Link href="/support" className="text-zinc-700 hover:text-zinc-500 underline transition-colors">
            Apoiar o projeto →
          </Link>
        </p>
      </div >
    </main >
  );
}