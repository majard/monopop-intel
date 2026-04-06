import Link from "next/link";
import { notFound } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL;

interface GenericSummary {
  generic: string;
  count: number;
  with_size: number;
  noise_count: number;
}

async function fetchGenerics(q?: string): Promise<GenericSummary[]> {
  try {
    const params = q ? `?q=${encodeURIComponent(q)}` : "";
    const res = await fetch(`${API}/generics${params}`, { cache: "no-store" });
    if (!res.ok) return [];

    const data = await res.json();
    
    // ←←← THIS IS THE FIX
    return Array.isArray(data.generics) ? data.generics : [];
  } catch {
    return [];
  }
}

function timeAgo(iso: string, now: number): string {
  const diff = now - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(h / 24);
  if (d > 0) return `há ${d}d`;
  if (h > 0) return `há ${h}h`;
  return "agora";
}

export default async function GenericsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const filter = (params.q ?? "").toLowerCase().trim();

  const allGenerics = await fetchGenerics(filter);   // now always an array

  const now = Date.now();

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-10">
          <h1 className="text-xl font-bold text-white">básicos</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {allGenerics.length} itens normalizados · cesta básica expandida
          </p>
        </div>

        <form method="GET" className="flex gap-2 mb-8">
          <input
            type="text"
            name="q"
            defaultValue={filter}
            placeholder="filtrar básicos... (arroz, leite...)"
            className="flex-1 sm:w-72 bg-zinc-900 border border-zinc-700 rounded px-4 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 px-4 py-2 rounded text-sm transition-colors"
          >
            buscar
          </button>
        </form>

        {allGenerics.length === 0 ? (
          <p className="text-zinc-600 text-sm">nenhum básico encontrado.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {allGenerics.map((g) => {
              const sizePct = g.count > 0 ? Math.round((g.with_size / g.count) * 100) : 0;
              return (
                <Link
                  key={g.generic}
                  href={`/generics/${encodeURIComponent(g.generic)}`}
                  className="group bg-zinc-900 border border-zinc-800 hover:border-emerald-500 rounded px-4 py-3 transition-colors"
                >
                  <p className="text-sm text-zinc-100 group-hover:text-white font-bold truncate">
                    {g.generic}
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">
                    {g.count} produtos
                  </p>
                  <p className="text-xs text-emerald-400/70 mt-0.5">
                    {sizePct}% com tamanho
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}