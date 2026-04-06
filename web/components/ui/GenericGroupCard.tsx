import Link from 'next/link';
import { STORES } from '@/constants/stores';
import { Group, GenericProduct } from '@/types/models';

function formatPrice(p: number | null): string {
  if (p === null || p <= 0) return '—';
  return `R$ ${p.toFixed(2)}`;
}

interface Props {
  group: Group;
  termEncoded: string;
  minPricePerUnit: number | null;
  exactMatch?: boolean;
}

export default function GenericGroupCard({
  group,
  termEncoded,
  minPricePerUnit,
  exactMatch,
}: Props) {
  const validPrices = group.variants
    .filter(v => v.price !== null && v.available)
    .map(v => v.price!);
  const minGroupPrice = validPrices.length > 0 ? Math.min(...validPrices) : null;
  const maxGroupPrice = validPrices.length > 0 ? Math.max(...validPrices) : null;

  const isGlobalBest = (v: GenericProduct) =>
    v.price_per_unit !== null &&
    v.available &&
    minPricePerUnit !== null &&
    Math.abs(v.price_per_unit - minPricePerUnit) < 0.0001;

  return (
    <div className={`bg-zinc-900 border rounded-xl p-5 ${exactMatch ? 'border-emerald-500/40' : 'border-zinc-800'}`}>
      {exactMatch && (
        <div className="text-emerald-400 text-xs font-medium mb-3">
          <span className="bg-emerald-500/10 px-2 py-0.5 rounded">
            MESMA EMBALAGEM EM OUTRAS LOJAS
          </span>
        </div>
      )}

      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="font-medium text-white text-sm">
            {Array.isArray(group.brand)
              ? group.brand.join(' · ')
              : group.brand || 'Sem marca'}
          </p>
          {group.normalized_size && (
            <p className="text-xs text-zinc-500 mt-0.5">{group.normalized_size}</p>
          )}
        </div>
        {minGroupPrice !== null && (
          <div className="text-right shrink-0">
            <p className="text-emerald-400 text-sm font-medium tabular-nums">
              {formatPrice(minGroupPrice)}
              {maxGroupPrice !== null && maxGroupPrice !== minGroupPrice && (
                <span className="text-zinc-600"> — {formatPrice(maxGroupPrice)}</span>
              )}
            </p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {group.variants.map(v => {
          const isCheapest = minGroupPrice !== null && v.price === minGroupPrice && v.available;
          const isBestUnit = isGlobalBest(v);

          return (
            <Link
              key={v.product_id}
              href={`/generics/${termEncoded}/${v.product_id}`}
              className="block group"
            >
              <div className={`relative flex justify-between items-center px-4 py-3 rounded-lg border transition-colors ${
                isCheapest ? 'border-emerald-500/30' : 'border-zinc-800'
              } hover:border-emerald-500/60`}>
                {isCheapest && (
                  <div className="absolute -top-2 left-3 bg-zinc-950 px-1">
                    <span className="bg-emerald-500 text-zinc-950 text-[9px] font-bold px-2 py-0.5 rounded">
                      melhor preço
                    </span>
                  </div>
                )}
                {isBestUnit && (
                  <div className="absolute -top-2 right-3 bg-zinc-950 px-1">
                    <span className="bg-amber-500 text-zinc-950 text-[9px] font-bold px-2 py-0.5 rounded">
                      melhor/unid
                    </span>
                  </div>
                )}

                <div className="flex-1 pr-4 min-w-0">
                  <p className="text-xs text-zinc-500">
                    {STORES[v.store as keyof typeof STORES]?.label ?? v.store}
                  </p>
                  <p className="text-sm text-zinc-200 group-hover:text-emerald-400 transition-colors truncate mt-0.5">
                    {v.name}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className={`font-medium tabular-nums ${isCheapest ? 'text-emerald-400' : 'text-zinc-300'}`}>
                    {formatPrice(v.price)}
                  </p>
                  {v.display_per_unit && (
                    <p className="text-[10px] text-zinc-600">{v.display_per_unit}</p>
                  )}
                  <span className="text-[10px] text-emerald-500 opacity-0 group-hover:opacity-70 transition-opacity mt-0.5 inline-block">
                    ver detalhes →
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}