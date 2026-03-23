const API = process.env.NEXT_PUBLIC_API_URL;

interface TermSummary {
    term: string;
    last_scraped_at: string;
    product_count: number;
}

async function fetchTerms(): Promise<TermSummary[]> {
    try {
        const res = await fetch(`${API}/history/terms`, { cache: "no-store" });
        if (!res.ok) return [];
        return res.json();
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

export default async function HistoryPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string }>;
}) {
    const params = await searchParams;
    const filter = (params.q ?? "").toLowerCase();
    const terms = await fetchTerms();
    const filtered = filter
        ? terms.filter((t) => t.term.toLowerCase().includes(filter))
        : terms;

    const now = Date.now();

    return (
        <main className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
            <div className="max-w-3xl mx-auto px-6 py-16">
                <div className="mb-10">
                    <h1 className="text-xl font-bold text-white">histórico de preços</h1>
                    <p className="text-zinc-500 text-sm mt-1">
                        {terms.length} termos monitorados · últimas 24h
                    </p>
                </div>

                <form method="GET" className="flex gap-2 mb-8">
                    <input
                        type="text"
                        name="q"
                        defaultValue={filter}
                        placeholder="filtrar termos..."
                        className="flex-1 sm:w-72 bg-zinc-900 border border-zinc-700 rounded px-4 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                        type="submit"
                        className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 px-4 py-2 rounded text-sm transition-colors"
                    >
                        buscar
                    </button>
                </form>

                {filtered.length === 0 ? (
                    <p className="text-zinc-600 text-sm">nenhum termo encontrado.</p>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {filtered.map((t) => (
                            <a 
                                key={t.term} 
                                href={`/history/${encodeURIComponent(t.term)}`}
                                className="group bg-zinc-900 border border-zinc-800 hover:border-emerald-500 rounded px-4 py-3 transition-colors"
                            >
                                <p className="text-sm text-zinc-100 group-hover:text-white font-bold truncate">
                                    {t.term}
                                </p>
                                <p className="text-xs text-zinc-500 mt-1">
                                    {t.product_count} produtos
                                </p>
                                <p className="text-xs text-zinc-600 mt-0.5">
                                    {timeAgo(t.last_scraped_at, now)}
                                </p>
                            </a>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}
