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
      `http://localhost:8000/search?q=${encodeURIComponent(query)}&store=${store}&sort=${sort}&page=${page}`,
      { cache: "no-store" }
    );
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

function sortUrl(current: Record<string, string>, sort: string) {
  const params = new URLSearchParams({ ...current, sort, page: "1" });
  return `?${params.toString()}`;
}

function pageUrl(current: Record<string, string>, page: number) {
  const params = new URLSearchParams({ ...current, page: String(page) });
  return `?${params.toString()}`;
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
  const currentParams = { q, store, sort, page: String(page) };

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

        {/* Search form */}
        <form method="GET" className="flex gap-3 mb-10">
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
                  href={sortUrl(currentParams, key)}
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
              página {data.page} ·{" "}
              <span className="text-emerald-400">"{data.query}"</span> em{" "}
              <span className="text-zinc-300">{data.store}</span>
            </p>

            {/* Results */}
            {data.results.length === 0 ? (
              <p className="text-zinc-600 text-sm">nenhum resultado encontrado.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {data.results.map((product) => (
                  <a                  
                    key={product.product_id}
                    href={product.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center justify-between bg-zinc-900 border border-zinc-800 hover:border-emerald-500 rounded px-5 py-4 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-zinc-100 group-hover:text-white">
                          {product.name}
                        </p>
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
            <div className="flex items-center gap-3 mt-8">
              {page > 1 && (
                <a
                  href={pageUrl(currentParams, page - 1)}
                  className="text-xs px-4 py-2 rounded border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
                >
                  ← anterior
                </a>
              )}
              <span className="text-zinc-600 text-xs">página {page}</span>
              {data.results.length === data.page_size && (
                <a
                  href={pageUrl(currentParams, page + 1)}
                  className="text-xs px-4 py-2 rounded border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
                >
                  próxima →
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