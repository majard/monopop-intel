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
    canonical_key?: string;
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
        parsed_brand?: string | null;
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
    _meta: any;
}

const STORE_LABELS: Record<string, string> = {
    prezunic: "Prezunic",
    zonasul: "Zona Sul",
    hortifruti: "Hortifruti",
};

const GROUP_OPTIONS = [
    { value: "", label: "Lista simples" },
    { value: "brand_size", label: "Por marca + embalagem" },
    { value: "size_only", label: "Por embalagem" },
    { value: "brand_only", label: "Por marca" },
];

function formatPrice(p: number | null): string {
    if (p === null || p <= 0) return "—";
    return `R$ ${p.toFixed(2)}`;
}

async function fetchGeneric(
    term: string,
    store?: string,
    exclude_noise: boolean = true,
    group?: string
): Promise<GenericResponse | null> {
    const params = new URLSearchParams();
    if (store) params.set("store", store);
    params.set("exclude_noise", String(exclude_noise));
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
        exclude_noise?: string;
        group?: string;
    }>;
}) {
    const { term } = await params;
    const sp = await searchParams;
    const decoded = decodeURIComponent(term);
    const excludeNoise = sp.exclude_noise !== "false";
    const currentGroup = sp.group || "";

    const data = await fetchGeneric(decoded, sp.store, excludeNoise, currentGroup || undefined);

    if (!data) notFound();

    const isGrouped = !!data.group_mode && data.groups;

    return (
        <main className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
            <div className="max-w-4xl mx-auto px-6 py-16">

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

                {/* Grouping selector - clean tabs */}
                <div className="flex flex-wrap gap-1 mb-8 border-b border-zinc-800 pb-1">
                    {GROUP_OPTIONS.map(({ value, label }) => (
                        <Link
                            key={value}
                            href={`?${new URLSearchParams({
                                ...(sp.store && { store: sp.store }),
                                exclude_noise: String(excludeNoise),
                                ...(value && { group: value }),
                            }).toString()}`}
                            className={`px-5 py-2 text-sm rounded-t-lg transition-all font-medium ${currentGroup === value
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
                        aplicar
                    </button>
                </form>

                {isGrouped && data.groups ? (
                    /* GROUPED VIEW */
                    <div className="space-y-6">
                        {data.groups.map((group, idx) => {
                            const cheapestVariant = group.variants.reduce((prev, curr) =>
                                (curr.price && curr.available && (!prev.price || curr.price < prev.price))
                                    ? curr : prev
                                , group.variants[0]);

                            return (
                                <div key={idx} className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <div className="font-semibold text-lg text-white">
                                                {Array.isArray(group.brand)
                                                    ? group.brand.join(" • ")
                                                    : group.brand || "Sem marca específica"}
                                            </div>
                                            {(group.package_size && group.unit) && (
                                                <div className="text-sm text-emerald-400 mt-0.5">
                                                    {group.package_size}{group.unit}
                                                </div>
                                            )}
                                        </div>

                                        <div className="text-right">
                                            <div className="text-emerald-400 font-medium">
                                                R$ {group.price_stats.min?.toFixed(2)} — {group.price_stats.max?.toFixed(2)}
                                            </div>
                                            <div className="text-xs text-zinc-500">
                                                média R$ {group.price_stats.avg?.toFixed(2)}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid gap-3">
                                        {group.variants.map((v, i) => {
                                            const isCheapest = v === cheapestVariant && v.price && v.available;
                                            return (
                                                <div
                                                    key={i}
                                                    className={`flex justify-between items-center px-4 py-3 rounded border ${isCheapest
                                                            ? "border-emerald-500 bg-emerald-500/5"
                                                            : "border-zinc-800"
                                                        }`}
                                                >
                                                    <div className="flex-1">
                                                        <span className="text-zinc-400 text-sm">
                                                            {STORE_LABELS[v.store] ?? v.store}
                                                        </span>
                                                        {" • "}
                                                        <span className="text-zinc-100">{v.name}</span>
                                                    </div>
                                                    <div className={`font-medium ${isCheapest ? "text-emerald-400" : "text-zinc-100"}`}>
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
                    /* FLAT VIEW */
                    <div className="flex flex-col gap-3">
                        {data.products.map((p, i) => (
                            <div
                                key={i}
                                className="group flex items-center justify-between bg-zinc-900 border border-zinc-800 hover:border-emerald-500 rounded px-5 py-4 transition-colors"
                            >
                                <div className="min-w-0 flex-1">
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
                ) : (
                    <p className="text-zinc-600 text-sm">nenhum produto encontrado.</p>
                )}
            </div>
        </main>
    );
}