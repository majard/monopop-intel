import { notFound } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL;

interface SeriesPoint {
    date: string;
    price: number | null;
    available: boolean;
}

interface ProductHistory {
    id: number;
    vtex_product_id: string;
    store: string;
    name: string;
    brand: string | null;
    ean: string | null;
    category: string | null;
    url: string | null;
    days: number;
    series: SeriesPoint[];
}

const STORE_LABELS: Record<string, string> = {
    prezunic: "Prezunic",
    zonasul: "Zona Sul",
    hortifruti: "Hortifruti",
};

function formatPrice(p: number | null) {
    if (p === null) return "—";
    return `R$ ${p.toFixed(2)}`;
}

async function fetchProduct(
    id: string,
    days: number
): Promise<ProductHistory | null> {
    try {
        const res = await fetch(`${API}/history/product/${id}?days=${days}`, {
            cache: "no-store",
        });
        if (!res.ok) return null;
        return res.json();
    } catch {
        return null;
    }
}

// SVG sparkline — no client JS, no Recharts dependency
function Sparkline({ series }: { series: SeriesPoint[] }) {
    const points = series.filter((s) => s.price !== null);
    if (points.length < 2) {
        return (
            <div className="h-32 flex items-center justify-center text-zinc-600 text-xs">
                dados insuficientes para o gráfico
            </div>
        );
    }

    const prices = points.map((p) => p.price as number);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const range = maxP - minP || 1;

    const W = 600;
    const H = 120;
    const PAD = 8;

    const coords = points.map((p, i) => {
        const x = PAD + (i / (points.length - 1)) * (W - PAD * 2);
        const y = PAD + (1 - ((p.price as number) - minP) / range) * (H - PAD * 2);
        return { x, y, ...p };
    });

    const pathD = coords
        .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
        .join(" ");

    // area fill
    const areaD = `${pathD} L ${coords[coords.length - 1].x.toFixed(1)} ${H} L ${coords[0].x.toFixed(1)} ${H} Z`;

    return (
        <div className="w-full overflow-x-auto">
            <svg
                viewBox={`0 0 ${W} ${H}`}
                className="w-full h-32"
                preserveAspectRatio="none"
            >
                <defs>
                    <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34d399" stopOpacity="0.15" />
                        <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
                    </linearGradient>
                </defs>
                <path d={areaD} fill="url(#fill)" />
                <path d={pathD} fill="none" stroke="#34d399" strokeWidth="1.5" />
                {coords.map((c, i) => (
                    <circle key={i} cx={c.x} cy={c.y} r="2.5" fill="#34d399" />
                ))}
            </svg>
            {/* x-axis labels: first, middle, last */}
            <div className="flex justify-between text-xs text-zinc-600 mt-1 px-1">
                <span>{points[0].date}</span>
                {points.length > 2 && (
                    <span>{points[Math.floor(points.length / 2)].date}</span>
                )}
                <span>{points[points.length - 1].date}</span>
            </div>
        </div>
    );
}

export default async function ProductPage({
    params,
    searchParams,
}: {
    params: Promise<{ term: string; product_id: string }>;
    searchParams: Promise<{ days?: string }>;
}) {
    const { term, product_id } = await params;
    const sp = await searchParams;
    const days = parseInt(sp.days ?? "30");
    const decodedTerm = decodeURIComponent(term);

    const data = await fetchProduct(product_id, days);
    if (!data) notFound();

    const latest = data.series.at(-1);

    return (
        <main className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
            <div className="max-w-3xl mx-auto px-6 py-16">

                {/* Breadcrumb */}
                <div className="flex items-center gap-2 text-xs text-zinc-600 mb-6">
                    <a href="/history" className="hover:text-zinc-400 transition-colors">histórico</a>
                    <span>·</span>
                    <a href={`/history/${encodeURIComponent(decodedTerm)}`} className="hover:text-zinc-400 transition-colors">{decodedTerm}</a>
                    <span>·</span>
                    <span className="text-zinc-500 truncate">{data.name}</span>
                </div>

                {/* Product header */}
                <div className="mb-8">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h1 className="text-lg font-bold text-white leading-snug">{data.name}</h1>
                            {data.brand && <p className="text-zinc-500 text-sm mt-0.5">{data.brand}</p>}
                        </div>
                        {latest && (
                            <div className="text-right shrink-0">
                                <p className="text-2xl font-bold text-emerald-400">{formatPrice(latest.price)}</p>
                                <p className="text-xs text-zinc-500 mt-0.5">{latest.date}</p>
                            </div>
                        )}
                    </div>

                    {/* Metadata badges */}
                    <div className="flex flex-wrap gap-2 mt-3">
                        <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                            {STORE_LABELS[data.store] ?? data.store}
                        </span>
                        {data.category && (
                            <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-800">
                                {data.category}
                            </span>
                        )}
                        {data.ean && (
                            <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-600 border border-zinc-800">
                                EAN {data.ean}
                            </span>
                        )}
                        {data.url && (

                            <a href={data.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-emerald-500 border border-zinc-800 hover:border-emerald-500 transition-colors"
                            >
                                ver na loja ↗
                            </a>
                        )}
                    </div>
                </div>

                {/* Days selector */}
                <div className="flex items-center gap-2 mb-6">
                    <span className="text-zinc-500 text-xs">período:</span>
                    {[30, 60, 90].map((d) => (

                        <a
                            key={d}
                            href={`?days=${d}`}
                            className={`text-xs px-3 py-1 rounded border transition-colors ${days === d
                                    ? "border-emerald-500 text-emerald-400"
                                    : "border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300"
                                }`}
                        >
                            {d}d
                        </a>
                    ))}
                </div>

                {/* Chart */}
                <div className="bg-zinc-900 border border-zinc-800 rounded p-4 mb-8">
                    <Sparkline series={data.series} />
                </div>

                {/* Raw table */}
                <div>
                    <p className="text-xs text-zinc-500 mb-3">{data.series.length} observações</p>
                    <div className="flex flex-col gap-1">
                        {[...data.series].reverse().map((s, i) => (
                            <div
                                key={i}
                                className="flex items-center justify-between text-xs px-4 py-2 rounded bg-zinc-900 border border-zinc-800"
                            >
                                <span className="text-zinc-500">{s.date}</span>
                                <span className="text-emerald-400 font-bold">{formatPrice(s.price)}</span>
                                {!s.available && (
                                    <span className="text-red-400">indisponível</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </main>
    );
}
