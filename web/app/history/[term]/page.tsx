import Link from 'next/link';
import { notFound } from 'next/navigation';
import { STORES } from '@/constants/stores';
import IntelFooter from '@/components/ui/IntelFooter';

const API = process.env.NEXT_PUBLIC_API_URL;

interface PricePoint {
  date: string;
  price: number | null;
  available: boolean;
}

interface HistoryProduct {
  product_id: number;
  store: string;
  name: string;
  brand: string | null;
  ean: string | null;
  category: string | null;
  url: string | null;
  current_price: number | null;
  current_available: boolean;
  trend: 'up' | 'down' | 'flat' | null;
  price_series: PricePoint[];
}

interface TermHistory {
  term: string;
  store: string | null;
  category: string | null;
  days: number;
  products: HistoryProduct[];
}

const TREND_ICON = { up: '↑', down: '↓', flat: '→' };
const TREND_COLOR = {
  up: 'text-red-400',
  down: 'text-emerald-400',
  flat: 'text-zinc-600',
};

function formatPrice(p: number | null) {
  if (p === null) return '—';
  return `R$ ${p.toFixed(2)}`;
}

async function fetchTermHistory(
  term: string,
  store?: string,
  category?: string,
  days = 30
): Promise<TermHistory | null> {
  const params = new URLSearchParams();
  if (store) params.set('store', store);
  if (category) params.set('category', category);
  params.set('days', String(days));
  try {
    const res = await fetch(
      `${API}/history/term/${encodeURIComponent(term)}?${params}`,
      { next: { revalidate: 14400 } }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ term: string }>;
}) {
  const { term } = await params;
  const decoded = decodeURIComponent(term);
  return {
    title: `histórico · ${decoded}`,
    description: `Histórico de preços de ${decoded} nos supermercados do Rio nos últimos 90 dias.`,
  };
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
  const days = sp.days ? parseInt(sp.days) : 30;

  const data = await fetchTermHistory(decoded, sp.store, sp.category, days);
  if (!data) notFound();

  const categories = [
    ...new Set(data.products.map(p => p.category).filter(Boolean)),
  ].sort() as string[];

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      <div className="max-w-3xl mx-auto px-6 py-16">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-zinc-600 mb-8">
          <Link href="/history" className="hover:text-zinc-400 transition-colors">
            histórico
          </Link>
          <span>·</span>
          <span className="text-zinc-400">{decoded}</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-10">
          <div>
            <h1 className="text-2xl font-bold text-white">{decoded}</h1>
            <p className="text-zinc-600 text-sm mt-1">
              {data.products.length} produto{data.products.length !== 1 ? 's' : ''}
              {' '}· últimos {data.days} dias
            </p>
          </div>
        </div>

        {/* Filters */}
        <form method="GET" className="flex flex-wrap gap-2 mb-8">
          <select
            name="store"
            defaultValue={sp.store ?? ''}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-400 focus:outline-none focus:border-zinc-600 transition-colors cursor-pointer"
          >
            <option value="">todas as lojas</option>
            {Object.entries(STORES).map(([k, s]) => (
              <option key={k} value={k}>{s.label}</option>
            ))}
          </select>

          {categories.length > 0 && (
            <select
              name="category"
              defaultValue={sp.category ?? ''}
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-400 focus:outline-none focus:border-zinc-600 transition-colors cursor-pointer"
            >
              <option value="">todas as categorias</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}

          <select
            name="days"
            defaultValue={String(days)}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-400 focus:outline-none focus:border-zinc-600 transition-colors cursor-pointer"
          >
            <option value="30">30 dias</option>
            <option value="60">60 dias</option>
            <option value="90">90 dias</option>
          </select>

          <button
            type="submit"
            className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-500 hover:text-zinc-300 px-4 py-2 rounded-lg text-xs transition-colors cursor-pointer"
          >
            filtrar
          </button>
        </form>

        {/* Products */}
        {data.products.length === 0 ? (
          <p className="text-zinc-600 text-sm">Nenhum produto encontrado.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {data.products.map(p => (
              <Link
                key={`${p.store}-${p.product_id}`}
                href={`/history/${encodeURIComponent(decoded)}/${p.product_id}`}
                className="group flex items-center justify-between bg-zinc-900 border border-zinc-800 hover:border-emerald-500/30 rounded-xl px-5 py-4 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-zinc-200 group-hover:text-white transition-colors truncate">
                      {p.name}
                    </p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700/60 shrink-0">
                      {STORES[p.store as keyof typeof STORES]?.label ?? p.store}
                    </span>
                    {!p.current_available && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 shrink-0">
                        indisponível
                      </span>
                    )}
                  </div>
                  {p.brand && (
                    <p className="text-[10px] text-zinc-600 mt-0.5">{p.brand}</p>
                  )}
                </div>
                <div className="text-right ml-4 shrink-0">
                  <p className="text-emerald-400 font-bold tabular-nums">
                    {formatPrice(p.current_price)}
                  </p>
                  {p.trend && (
                    <p className={`text-xs ${TREND_COLOR[p.trend]}`}>
                      {TREND_ICON[p.trend]}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        <IntelFooter className="mt-12" />
      </div>
    </main>
  );
}