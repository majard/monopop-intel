'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import AddToListButton from '@/components/ui/AddToListButton';

interface GenericSummary {
  generic: string;
  count: number;
  with_size: number;
  noise_count: number;
}

export default function GenericsClientList({
  generics,
}: {
  generics: GenericSummary[];
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return generics;
    return generics.filter(g => g.generic.toLowerCase().includes(q));
  }, [generics, query]);

  return (
    <div>
      {/* Search */}
      <div className="relative mb-6">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="filtrar básicos..."
          className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-600 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-700 focus:outline-none transition-colors font-mono"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-700 hover:text-zinc-400 transition-colors cursor-pointer text-lg leading-none"
          >
            ×
          </button>
        )}
      </div>

      {/* Results count when filtering */}
      {query && (
        <p className="text-xs text-zinc-600 mb-4">
          {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} para "{query}"
        </p>
      )}

      {filtered.length === 0 ? (
        <p className="text-zinc-700 text-sm py-12 text-center">
          Nenhum básico encontrado.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {filtered.map(({ generic, count, with_size }) => (
            <div
              key={generic}
              className="group bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl px-4 py-3 transition-all flex items-center justify-between gap-3"
            >
              {/* Name + stats — clickable */}
              <Link
                href={`/generics/${encodeURIComponent(generic)}`}
                className="flex-1 min-w-0"
              >
                <p className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors truncate">
                  {generic}
                </p>
                <p className="text-[10px] text-zinc-700 mt-0.5">
                  {count} produto{count !== 1 ? 's' : ''}
                  {with_size > 0 && (
                    <> · <span className="text-zinc-600">{with_size} com tamanho</span></>
                  )}
                </p>
              </Link>

              {/* Add to list — stops propagation internally */}
              <div onClick={e => e.stopPropagation()} className="flex-shrink-0">
                <AddToListButton
                  term={generic}
                  label="+"
                  forwardToList={false}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-zinc-800 text-zinc-600 hover:border-emerald-500/40 hover:text-emerald-500 hover:bg-emerald-500/5 transition-all cursor-pointer text-base leading-none disabled:opacity-30 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <p className="text-[11px] text-zinc-800 text-center mt-10">
        Monopop Intel é gratuito e sem anúncios.{' '}
        
        <Link
          href="/support"
          className="text-zinc-700 hover:text-zinc-500 underline transition-colors"
        >
          Apoiar o projeto →
        </Link>
      </p>
    </div>
  );
}