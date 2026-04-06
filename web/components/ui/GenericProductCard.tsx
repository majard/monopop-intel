import Link from 'next/link';
import { STORES } from '@/constants/stores';
import { GenericProduct } from '@/types/models';

function formatPrice(p: number | null): string {
  if (p === null || p <= 0) return '—';
  return `R$ ${p.toFixed(2)}`;
}

interface Props {
  product: GenericProduct;
  href: string;
  isBestUnit?: boolean;
}

export default function GenericProductCard({ product: p, href, isBestUnit }: Props) {
  return (
    <Link
      href={href}
      className="group block bg-zinc-900 border border-zinc-800 hover:border-emerald-500/40 rounded-xl px-5 py-4 transition-colors relative"
    >
      {isBestUnit && (
        <div className="absolute -top-2 right-4 bg-zinc-950 px-1">
          <span className="bg-amber-500 text-zinc-950 text-[9px] font-bold px-2 py-0.5 rounded">
            melhor/unid
          </span>
        </div>
      )}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-zinc-200 group-hover:text-emerald-400 transition-colors truncate">
            {p.name}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700/60">
              {STORES[p.store as keyof typeof STORES]?.label ?? p.store}
            </span>
            {p.parsed_brand && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800/60 text-zinc-600 border border-zinc-800">
                {p.parsed_brand}
              </span>
            )}
            {p.normalized_size && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/15">
                {p.normalized_size}
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-emerald-400 font-bold tabular-nums">{formatPrice(p.price)}</p>
          {p.display_per_unit && (
            <p className="text-[10px] text-zinc-600">{p.display_per_unit}</p>
          )}
          <span className="text-[10px] text-emerald-500 opacity-0 group-hover:opacity-70 transition-opacity mt-0.5 inline-block">
            ver detalhes →
          </span>
        </div>
      </div>
    </Link>
  );
}