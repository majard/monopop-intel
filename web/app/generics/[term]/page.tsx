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
    available: boolean;
}

interface Group {
    canonical_key: string;
    generic: string;
    brand: string | string[] | null;
    package_size: number | null;
    unit: string | null;
    variants: Array<{
        store: string;
        name: string;
        price: number | null;
        available: boolean;
    }>;
    price_stats: {
        min: number | null;
        max: number | null;
        avg: number | null;
    };
}

interface GenericResponse {
    generic: string;
    count: number;
    products?: GenericProduct[];
    groups?: Group[];
    group_mode?: string | null;
    _meta: {
        fresh_cutoff: string;
        excluded_noise: boolean;
        store_filter: string | null;
    };
}

const STORE_LABELS: Record<string, string> = {
    prezunic: "Prezunic",
    zonasul: "Zona Sul",
    hortifruti: "Hortifruti",
};

const GROUP_OPTIONS = [
    { value: "", label: "Lista simples" },
    { value: "brand_size", label: "Por marca + tamanho" },
    { value: "size_only", label: "Por tamanho" },
    { value: "brand_only", label: "Por marca" },
];

function formatPrice(p: number | null): string {
    if (p === null || p <= 0) return "—";
    return `R$ ${p.toFixed(2)}`;
}

async function fetchGeneric(
    term: string,
    store?: string,
    group?: string
): Promise<GenericResponse | null> {
    const params = new URLSearchParams();
    if (store) params.set("store", store);
    if (group) params.set("group", group);

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
    searchParams: Promise<{
        store?: string;
        group?: string;
    }>;
}) {
    const { term } = await params;
    const sp = await searchParams;
    const decoded = decodeURIComponent(term);
    const currentGroup = sp.group || "";

    const data = await fetchGeneric(decoded, sp.store, currentGroup || undefined);

    if (!data) notFound();

    const isGrouped = !!data.group_mode && data.groups && data.groups.length > 0;

    return (
        <main className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
            <div className="max-w-4xl mx-auto px-6 py-16">

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

                {/* Grouping selector */}
                <div className="flex flex-wrap gap-1 mb-8 border-b border-zinc-800 pb-1 overflow-x-auto">
                    {GROUP_OPTIONS.map(({ value, label }) => (
                        <Link
                            key={value}
                            href={`?${new URLSearchParams({
                                store: sp.store || "",
                                ...(value && { group: value }),
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
                <form method="GET" className="flex flex-wrap gap-3 mb-8">
                    <input type="hidden" name="group" value={currentGroup} />

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

                    <button
                        type="submit"
                        className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 px-4 py-2 rounded text-sm transition-colors"
                    >
                        aplicar filtros
                    </button>
                </form>

                {isGrouped && data.groups ? (
                    <div className="space-y-6">
                        {data.groups.map((group) => {
                            // Find minimum available price safely
                            const validPrices = group.variants
                                .filter(v => v.price !== null && v.available)
                                .map(v => v.price!);

                            const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : null;

                            return (
                                <div key={group.canonical_key} className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
                                    <div className="flex justify-between mb-4">
                                        <div>
                                            <div className="font-semibold text-white">
                                                {Array.isArray(group.brand)
                                                    ? group.brand.join(" • ")
                                                    : group.brand || "Sem marca"}
                                            </div>
                                            {(group.package_size && group.unit) && (
                                                <div className="text-sm text-zinc-400">
                                                    {group.package_size}{group.unit}
                                                </div>
                                            )}
                                        </div>

                                        {minPrice !== null && (
                                            <div className="text-right">
                                                <div className="text-emerald-400 font-medium">
                                                    R$ {minPrice.toFixed(2)} — {group.price_stats.max?.toFixed(2)}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        {group.variants.map((v, i) => {
                                            const isCheapest = minPrice !== null && v.price === minPrice && v.available;

                                            return (
                                                <div
                                                    key={i}
                                                    className={`flex justify-between items-center px-4 py-3 rounded border ${isCheapest ? "border-emerald-500/30" : "border-zinc-800"
                                                        }`}
                                                >
                                                    <div className="text-sm">
                                                        <span className="text-zinc-400">{STORE_LABELS[v.store] ?? v.store}</span>
                                                        {" • "}
                                                        <span className="text-zinc-100">{v.name}</span>
                                                    </div>
                                                    <div className={`font-medium ${isCheapest ? "text-emerald-400" : ""}`}>
                                                        {formatPrice(v.price)}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : data.products ? (
                    <div className="flex flex-col gap-3">
                        {data.products.map((p, i) => (
                            <div
                                key={i}
                                className="group bg-zinc-900 border border-zinc-800 hover:border-emerald-500 rounded-lg px-5 py-5 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-[15px] text-zinc-100 group-hover:text-white truncate">
                                        {p.name}
                                    </p>
                                    <div className="flex flex-wrap gap-2 mt-2 text-xs">
                                        <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                                            {STORE_LABELS[p.store] ?? p.store}
                                        </span>
                                        {p.parsed_brand && (
                                            <span className="px-2 py-0.5 rounded bg-zinc-800/70 text-zinc-500 border border-zinc-800">
                                                {p.parsed_brand}
                                            </span>
                                        )}
                                        {p.package_size && p.unit && (
                                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                {p.package_size}{p.unit}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="text-right">
                                    <p className="text-emerald-400 font-bold text-[20px]">
                                        {formatPrice(p.price)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-zinc-600 text-sm">nenhum produto encontrado.</p>
                )}
            </div>
        </main>
    );
}