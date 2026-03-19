interface Product {
  store: string;
  product_id: string;
  name: string;
  brand: string;
  ean: string;
  price: number;
  list_price: number;
  available: boolean;
  url: string;
}

interface SearchResult {
  query: string;
  store: string;
  sort: string;
  page: number;
  page_size: number;
  total: number | null;
  has_more: boolean;
  results: Product[];
}

async function fetchProducts(
  query: string,
  store: string,
  sort: string,
  page: number
): Promise<SearchResult | null> {
  if (!query) return null;
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/search?q=${encodeURIComponent(query)}&store=${store}&sort=${sort}&page=${page}`,
      { cache: "no-store" }
    );
    console.log('\n\n\nres: ', res);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

const SORT_LABELS: Record<string, string> = {
  relevance: "relevância",
  price_asc: "menor preço",
  price_desc: "maior preço",
  name_asc: "a → z",
  name_desc: "z → a",
};

const STORE_LABELS: Record<string, string> = {
  prezunic: "Prezunic",
  zonasul: "Zona Sul",
  all: "Todas as lojas",
};

function buildUrl(params: Record<string, string>) {
  return `?${new URLSearchParams(params).toString()}`;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; store?: string; sort?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = params.q ?? "";
  const store = params.store ?? "prezunic";
  const sort = params.sort ?? "relevance";
  const page = parseInt(params.page ?? "1");

  const data = await fetchProducts(q, store, sort, page);
  const totalPages = data?.total ? Math.ceil(data.total / (data.page_size ?? 10)) : null;

  console.log("API URL:", process.env.NEXT_PUBLIC_API_URL);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      <div className="max-w-3xl mx-auto px-6 py-16">

        {/* Header */}
        <div className="mb-12">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            monopop<span className="text-emerald-400">-intel</span>
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            market price intelligence · rio de janeiro
          </p>
        </div>

        {/* Search form — hidden inputs preservam sort e store */}
        <form method="GET" className="flex gap-3 mb-10">
          <input type="hidden" name="sort" value={sort} />
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="arroz, feijão, óleo..."
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-4 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
          />
          <select
            name="store"
            defaultValue={store}
            className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
          >
            <option value="prezunic">Prezunic</option>
            <option value="zonasul">Zona Sul</option>
            <option value="all">Todas as lojas</option>
          </select>
          <button
            type="submit"
            className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-5 py-2 rounded text-sm transition-colors"
          >
            buscar
          </button>
        </form>

        {data && (
          <>
            {/* Sort */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className="text-zinc-500 text-xs">ordenar:</span>
              {Object.entries(SORT_LABELS).map(([key, label]) => (
                <a
                  key={key}
                  href={buildUrl({ q, store, sort: key, page: "1" })}
                  className={`text-xs px-3 py-1 rounded border transition-colors ${
                    sort === key
                      ? "border-emerald-500 text-emerald-400"
                      : "border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {label}
                </a>
              ))}
            </div>

            {/* Results count */}
            <p className="text-zinc-500 text-xs mb-4">
              {data.total ? `${data.total} resultado${data.total !== 1 ? "s" : ""} · ` : ""}
              página {data.page}{totalPages ? ` de ${totalPages}` : ""} ·{" "}
              <span className="text-emerald-400">"{data.query}"</span> em{" "}
              <span className="text-zinc-300">{STORE_LABELS[data.store] ?? data.store}</span>
            </p>

            {/* Results */}
            {!data.results || data.results.length === 0 ? (
              <p className="text-zinc-600 text-sm">nenhum resultado encontrado.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {data.results.map((product) => (
                  <a
                    key={`${product.store}-${product.product_id}`}
                    href={product.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center justify-between bg-zinc-900 border border-zinc-800 hover:border-emerald-500 rounded px-5 py-4 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm text-zinc-100 group-hover:text-white">
                          {product.name}
                        </p>
                        {store === "all" && (
                          <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                            {STORE_LABELS[product.store] ?? product.store}
                          </span>
                        )}
                        {product.list_price > product.price && (
                          <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            oferta
                          </span>
                        )}
                        {!product.available && (
                          <span className="text-xs px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                            indisponível
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">{product.brand}</p>
                    </div>
                    <div className="text-right ml-4 shrink-0">
                      <p className="text-emerald-400 font-bold">
                        R$ {product.price.toFixed(2)}
                      </p>
                      {product.list_price > product.price && (
                        <p className="text-xs text-zinc-600 line-through">
                          R$ {product.list_price.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            )}

            {/* Pagination */}
            <div className="flex items-center gap-2 mt-8 flex-wrap">
              {page > 1 && (
                <a
                  href={buildUrl({ q, store, sort, page: String(page - 1) })}
                  className="text-xs px-4 py-2 rounded border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
                >
                  ←
                </a>
              )}

              {totalPages ? (
                [...Array(totalPages)].map((_, i) => {
                  const p = i + 1;
                  const isNear = Math.abs(p - page) <= 2 || p === 1 || p === totalPages;
                  if (!isNear) return null;
                  return (
                    <a
                      key={p}
                      href={buildUrl({ q, store, sort, page: String(p) })}
                      className={`text-xs px-3 py-2 rounded border transition-colors ${
                        p === page
                          ? "border-emerald-500 text-emerald-400"
                          : "border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {p}
                    </a>
                  );
                })
              ) : (
                <span className="text-zinc-600 text-xs">página {page}</span>
              )}
  
              {data.has_more && (
                <a
                  href={buildUrl({ q, store, sort, page: String(page + 1) })}
                  className="text-xs px-4 py-2 rounded border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
                >
                  →
                </a>
              )}
            </div>
          </>
        )}

        {!data && !q && (
          <p className="text-zinc-600 text-sm">
            digite um produto pra começar.
          </p>
        )}

      </div>
    </main>
  );
}