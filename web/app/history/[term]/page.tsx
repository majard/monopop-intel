import { notFound } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL;

interface PricePoint {
    date: string;
    price: number | null;
    available: boolean;
}

interface HistoryProduct {
    product_id: number;
    vtex_product_id: string;
    store: string;
    name: string;
    brand: string | null;
    ean: string | null;
    category: string | null;
    url: string | null;
    current_price: number | null;
    current_available: boolean;
    trend: "up" | "down" | "flat" | null;
    price_series: PricePoint[];
}

interface TermHistory {
    term: string;
    store: string | null;
    category: string | null;
    days: number;
    products: HistoryProduct[];
}

const STORE_LABELS: Record<string, string> = {
    prezunic: "Prezunic",
    zonasul: "Zona Sul",
    hortifruti: "Hortifruti",
};

const TREND_ICON: Record<string, string> = {
    up: "↑",
    down: "↓",
    flat: "→",
};

const TREND_COLOR: Record<string, string> = {
    up: "text-red-400",
    down: "text-emerald-400",
    flat: "text-zinc-500",
};

function formatPrice(p: number | null) {
    if (p === null) return "—";
    return `R$ ${p.toFixed(2)}`;
}

async function fetchTermHistory(
    term: string,
    store?: string,
    category?: string,
    days?: number
): Promise<TermHistory | null> {
    const params = new URLSearchParams();
    if (store) params.set("store", store);
    if (category) params.set("category", category);
    if (days) params.set("days", String(days));
    try {
        const res = await fetch(
            `${API}/history/term/${encodeURIComponent(term)}?${params}`,
            { cache: "no-store" }
        );
        if (!res.ok) return null;
        return res.json();
    } catch {
        return null;
    }
}

export default async function TermPage({
    params,
    searchParams,
}: {
    params: Promise<{ term: string }>;
    searchParams: Promise<{ store?: string; category?: string; days?: string }>;
}) {
    const { term } = await params;
    const sp = await searchParams;
    const decoded = decodeURIComponent(term);

    const data = await fetchTermHistory(
        decoded,
        sp.store,
        sp.category,
        sp.days ? parseInt(sp.days) : 30
    );

    if (!data) notFound();

    const categories = [...new Set(data.products.map((p) => p.category).filter(Boolean))].sort();

    return (
        <main className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
            <div className="max-w-3xl mx-auto px-6 py-16">

                {/* Header */}
                <div className="mb-2">
                    <a href="/history" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
                        ← histórico
                    </a>
                </div>
                <div className="mb-8">
                    <h1 className="text-xl font-bold text-white">{decoded}</h1>
                    <p className="text-zinc-500 text-sm mt-1">
                        {data.products.length} produtos · últimos {data.days} dias
                    </p>
                </div>

                {/* Filters */}
                <form method="GET" className="flex flex-wrap gap-3 mb-8">
                    <select
                        name="store"
                        defaultValue={sp.store ?? ""}
                        className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
                    >
                        <option value="">todas as lojas</option>
                        {Object.entries(STORE_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                        ))}
                    </select>

                    {categories.length > 0 && (
                        <select
                            name="category"
                            defaultValue={sp.category ?? ""}
                            className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
                        >
                            <option value="">todas as categorias</option>
                            {categories.map((c) => (
                                <option key={c} value={c!}>{c}</option>
                            ))}
                        </select>
                    )}

                    <select
                        name="days"
                        defaultValue={sp.days ?? "30"}
                        className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
                    >
                        <option value="30">30 dias</option>
                        <option value="60">60 dias</option>
                        <option value="90">90 dias</option>
                    </select>

                    <button
                        type="submit"
                        className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 px-4 py-2 rounded text-sm transition-colors"
                    >
                        filtrar
                    </button>
                </form>

                {/* Products */}
                {data.products.length === 0 ? (
                    <p className="text-zinc-600 text-sm">nenhum produto encontrado.</p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {data.products.map((p) => (

                            <a key={`${p.store}-${p.product_id}`}
                                href={`/history/${encodeURIComponent(decoded)}/${p.product_id}`}
                                className="group flex items-center justify-between bg-zinc-900 border border-zinc-800 hover:border-emerald-500 rounded px-5 py-4 transition-colors"
                            >
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-sm text-zinc-100 group-hover:text-white truncate">
                                            {p.name}
                                        </p>
                                        <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700 shrink-0">
                                            {STORE_LABELS[p.store] ?? p.store}
                                        </span>
                                        {p.category && (
                                            <span className="text-xs px-2 py-0.5 rounded bg-zinc-800/50 text-zinc-500 border border-zinc-800 shrink-0">
                                                {p.category}
                                            </span>
                                        )}
                                        {!p.current_available && (
                                            <span className="text-xs px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 shrink-0">
                                                indisponível
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-zinc-500 mt-0.5">{p.brand}</p>
                                </div>
                                <div className="text-right ml-4 shrink-0">
                                    <p className="text-emerald-400 font-bold">
                                        {formatPrice(p.current_price)}
                                    </p>
                                    {p.trend && (
                                        <p className={`text-xs ${TREND_COLOR[p.trend]}`}>
                                            {TREND_ICON[p.trend]}
                                        </p>
                                    )}
                                </div>
                            </a>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}