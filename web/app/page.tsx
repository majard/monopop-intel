// app/page.tsx

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
  count: number;
  results: Product[];
}

async function fetchProducts(query: string, store: string): Promise<SearchResult | null> {
  if (!query) return null;

  try {
    const res = await fetch(
      `http://localhost:8000/search?q=${encodeURIComponent(query)}&store=${store}`,
      { cache: "no-store" }
    );
    return res.json();
  } catch {
    return null;
  }
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; store?: string }>;
}) {
  const { q = "", store = "prezunic" } = await searchParams;
  const data = await fetchProducts(q, store);

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

        {/* Results */}
        {data && (
          <div>
            <p className="text-zinc-500 text-xs mb-4">
              {data.count} resultado{data.count !== 1 ? "s" : ""} para{" "}
              <span className="text-emerald-400">"{data.query}"</span> em{" "}
              <span className="text-zinc-300">{data.store}</span>
            </p>

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
                    <p className="text-sm text-zinc-100 group-hover:text-white">
                      {product.name}
                    </p>
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
          </div>
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