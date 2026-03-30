import Link from "next/link";
import { notFound } from "next/navigation";
import FilterSelect from "@/components/ui/FilterSelect";

const API = process.env.NEXT_PUBLIC_API_URL;

interface GenericProduct {
    name: string;
    store: string;
    price: number | null;
    package_size: number | null;
    unit: string | null;
    parsed_brand: string | null;
    available: boolean;
    price_per_unit: number | null;
    normalized_size: string | null;
    display_per_unit: string | null;
}

interface Group {
    canonical_key: string;
    generic: string;
    brand: string | string[] | null;
    package_size: number | null;
    unit: string | null;
    normalized_size: string | null;
    variants: Array<{
        store: string;
        name: string;
        price: number | null;
        available: boolean;
        price_per_unit: number | null;
        normalized_size: string | null;
        display_per_unit: string | null;
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
    sort_by: string;
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

const SORT_OPTIONS = [
    { value: "price", label: "Menor preço" },
    { value: "price_per_unit", label: "Menor preço por unidade" },
];

function formatPrice(p: number | null): string {
    if (p === null || p <= 0) return "—";
    return `R$ ${p.toFixed(2)}`;
}

async function fetchGeneric(
    term: string,
    store?: string,
    group?: string,
    sortBy?: string
): Promise<GenericResponse | null> {
    const params = new URLSearchParams();
    if (store) params.set("store", store);
    if (group) params.set("group", group);
    if (sortBy) params.set("sort_by", sortBy);

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
        sort_by?: string;
    }>;
}) {
    const { term } = await params;
    const sp = await searchParams;
    const decoded = decodeURIComponent(term);
    const currentGroup = sp.group || "";
    const currentSort = sp.sort_by || "price";

    const data = await fetchGeneric(decoded, sp.store, currentGroup || undefined, currentSort);

    if (!data) notFound();

    const isGrouped = !!data.group_mode && data.groups && data.groups.length > 0;

    // Find global best price per unit across all items
    let globalBestPerUnit: { groupIndex: number; variantIndex: number; value: number } | null = null;

    if (isGrouped && data.groups) {
        data.groups.forEach((group, gIdx) => {
            group.variants.forEach((v, vIdx) => {
                if (v.price_per_unit !== null && v.available) {
                    if (!globalBestPerUnit || v.price_per_unit < globalBestPerUnit.value) {
                        globalBestPerUnit = { groupIndex: gIdx, variantIndex: vIdx, value: v.price_per_unit };
                    }
                }
            });
        });
    }

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
                        {data.count} produtos normalizados • atualizado em {new Date(data._meta.fresh_cutoff).toLocaleDateString('pt-BR')}
                    </p>
                </div>

                {/* Grouping Tabs */}
                <div className="flex flex-wrap gap-1 mb-6 border-b border-zinc-800 pb-1 overflow-x-auto">
                    {GROUP_OPTIONS.map(({ value, label }) => (
                        <Link
                            key={value}
                            href={`?${new URLSearchParams({
                                store: sp.store || "",
                                ...(value && { group: value }),
                                sort_by: currentSort,
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

                {/* Filters: Store + Sort in one clean row */}
                <div className="flex flex-wrap gap-3 mb-8">
                    <FilterSelect
                        name="store"
                        options={[
                            { value: "", label: "todas as lojas" },
                            ...Object.entries(STORE_LABELS).map(([k, v]) => ({ value: k, label: v })),
                        ]}
                        defaultValue={sp.store ?? ""}
                    />

                    <FilterSelect
                        name="sort_by"
                        options={SORT_OPTIONS}
                        defaultValue={currentSort}
                    />
                </div>

                {isGrouped && data.groups ? (
                    <div className="space-y-6">
                        {data.groups.map((group, gIdx) => {
                            const validPrices = group.variants
                                .filter(v => v.price !== null && v.available)
                                .map(v => v.price!);

                            const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : null;

                            return (
                                <div key={group.canonical_key} className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 relative">
                                    <div className="flex justify-between mb-4">
                                        <div>
                                            <div className="font-semibold text-white">
                                                {Array.isArray(group.brand) ? group.brand.join(" • ") : group.brand || "Sem marca"}
                                            </div>
                                            {group.normalized_size && (
                                                <div className="text-sm text-zinc-400">{group.normalized_size}</div>
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
                                            const isCheapestInGroup = minPrice !== null && v.price === minPrice && v.available;
                                            const isGlobalBestPerUnit = globalBestPerUnit &&
                                                globalBestPerUnit.groupIndex === gIdx &&
                                                globalBestPerUnit.variantIndex === i;

                                            return (
                                                <div
                                                    key={i}
                                                    className={`relative flex justify-between items-center px-4 py-3 rounded border ${isCheapestInGroup ? "border-emerald-500/40" : "border-zinc-800"}`}
                                                >
                                                    {isCheapestInGroup && (
                                                        <div className="absolute -top-2 left-3 bg-zinc-950 px-1">
                                                            <div className="bg-emerald-500 text-zinc-950 text-[10px] font-bold px-2.5 py-0.5 rounded">
                                                                melhor preço
                                                            </div>
                                                        </div>
                                                    )}

                                                    {isGlobalBestPerUnit && (
                                                        <div className="absolute -top-2 right-3 bg-zinc-950 px-1">
                                                            <div className="bg-amber-500 text-zinc-950 text-[10px] font-bold px-2.5 py-0.5 rounded">
                                                                melhor por unidade
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="text-sm pr-8">
                                                        <span className="text-zinc-400">{STORE_LABELS[v.store] ?? v.store}</span>
                                                        {" • "}
                                                        <span className="text-zinc-100">{v.name}</span>
                                                        {v.normalized_size && (
                                                            <span className="text-zinc-500 ml-2">({v.normalized_size})</span>
                                                        )}
                                                    </div>

                                                    <div className="text-right shrink-0">
                                                        <div className={`font-medium ${isCheapestInGroup ? "text-emerald-400" : ""}`}>
                                                            {formatPrice(v.price)}
                                                        </div>
                                                        {v.display_per_unit && (
                                                            <div className="text-xs text-zinc-500">{v.display_per_unit}</div>
                                                        )}
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
                        {data.products.map((p, i) => {
                            const isGlobalBestPerUnit = p.price_per_unit !== null &&
                                globalBestPerUnit !== null &&
                                Math.abs(p.price_per_unit - globalBestPerUnit.value) < 0.0001;

                            return (
                                <div
                                    key={i}
                                    className="group bg-zinc-900 border border-zinc-800 hover:border-emerald-500 rounded-lg px-5 py-5 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 relative"
                                >
                                    {isGlobalBestPerUnit && (
                                        <div className="absolute -top-2 right-4 bg-zinc-950 px-1">
                                            <div className="bg-amber-500 text-zinc-950 text-[10px] font-bold px-2.5 py-0.5 rounded">
                                                melhor por unidade
                                            </div>
                                        </div>
                                    )}

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
                                            {p.normalized_size && (
                                                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                    {p.normalized_size}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <p className="text-emerald-400 font-bold text-[20px]">
                                            {formatPrice(p.price)}
                                        </p>
                                        {p.display_per_unit && (
                                            <p className="text-xs text-zinc-500">{p.display_per_unit}</p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-zinc-600 text-sm">nenhum produto encontrado.</p>
                )}
            </div>
        </main>
    );
}