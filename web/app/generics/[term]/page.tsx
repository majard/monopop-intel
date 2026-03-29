import Link from "next/link";
import { notFound } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL;

interface GenericProduct {
    name: string;
    store: string;
    price: number | null;
    package_size: number | null;
    unit: string | null;
    parsed_brand: string | null;
    is_noise: boolean;
    available: boolean;
}

interface GenericResponse {
    generic: string;
    count: number;
    products: GenericProduct[];
    _meta: any;
}

const STORE_LABELS: Record<string, string> = {
    prezunic: "Prezunic",
    zonasul: "Zona Sul",
    hortifruti: "Hortifruti",
};

function formatPrice(p: number | null): string {
    if (p === null || p <= 0) return "—";
    return `R$ ${p.toFixed(2)}`;
}

async function fetchGeneric(
    term: string,
    store?: string,
    exclude_noise: boolean = true
): Promise<GenericResponse | null> {
    const params = new URLSearchParams();
    if (store) params.set("store", store);
    params.set("exclude_noise", String(exclude_noise));

    try {
        const res = await fetch(
            `${API}/generics/${encodeURIComponent(term)}?${params}`,
            { cache: "no-store" }
        );
        if (!res.ok) return null;
        return res.json();
    } catch {
        return null;
    }
}

export default async function GenericTermPage({
    params,
    searchParams,
}: {
    params: Promise<{ term: string }>;
    searchParams: Promise<{ store?: string; exclude_noise?: string }>;
}) {
    const { term } = await params;
    const sp = await searchParams;
    const decoded = decodeURIComponent(term);
    const excludeNoise = sp.exclude_noise !== "false";

    const data = await fetchGeneric(decoded, sp.store, excludeNoise);

    if (!data) notFound();

    return (
        <main className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
            <div className="max-w-3xl mx-auto px-6 py-16">
                {/* Breadcrumb */}
                <div className="mb-2">
                    <Link href="/generics" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
                        ← básicos
                    </Link>
                </div>

                <div className="mb-8">
                    <h1 className="text-xl font-bold text-white">{decoded}</h1>
                    <p className="text-zinc-500 text-sm mt-1">
                        {data.count} produtos normalizados
                    </p>
                </div>

                {/* Filters - remains form with GET because it's server-driven */}
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

                    <select
                        name="exclude_noise"
                        defaultValue={String(excludeNoise)}
                        className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
                    >
                        <option value="true">excluir ruído</option>
                        <option value="false">mostrar tudo</option>
                    </select>

                    <button
                        type="submit"
                        className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 px-4 py-2 rounded text-sm transition-colors"
                    >
                        filtrar
                    </button>
                </form>

                {data.products.length === 0 ? (
                    <p className="text-zinc-600 text-sm">nenhum produto encontrado.</p>
                ) : (
                    <div className="flex flex-col gap-3">
                        {data.products.map((p, i) => (
                            <div
                                key={i}
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
                                        {p.parsed_brand && (
                                            <span className="text-xs px-2 py-0.5 rounded bg-zinc-800/70 text-zinc-500 border border-zinc-800 shrink-0">
                                                {p.parsed_brand}
                                            </span>
                                        )}
                                        {p.package_size && p.unit && (
                                            <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                                                {p.package_size}{p.unit}
                                            </span>
                                        )}
                                        {!p.available && (
                                            <span className="text-xs px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 shrink-0">
                                                indisponível
                                            </span>
                                        )}
                                        {p.is_noise && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400/70 border border-red-500/20">
                                                ruído
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="text-right ml-4 shrink-0">
                                    <p className="text-emerald-400 font-bold">
                                        {formatPrice(p.price)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}