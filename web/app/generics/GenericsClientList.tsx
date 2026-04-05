'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import AddToListButton from '@/components/ui/AddToListButton';
import { GenericSummary } from '@/types/models';
import IntelFooter from '@/components/ui/IntelFooter';
import { PAGE_SIZE, ShowMoreButton } from '@/components/ui/ShowMoreButton';
import { ESSENTIALS } from '@/constants/essentials';

const ESSENTIALS_SET = new Set(ESSENTIALS);

const normalize = (s: string) => s.normalize("NFD").trim().replace(/[\u0300-\u036f]/g, "").toLowerCase();

function GenericCard({ generic, count, with_size }: GenericSummary) {
  return (
    <div className="group bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl px-4 py-3 transition-all flex items-center justify-between gap-3">
      <Link href={`/generics/${encodeURIComponent(generic)}`} className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors truncate">
          {generic}
        </p>
        <p className="text-[10px] text-zinc-700 mt-0.5">
          {count} produto{count !== 1 ? 's' : ''}
          {with_size > 0 && <> · <span className="text-zinc-600">{with_size} com tamanho</span></>}
        </p>
      </Link>
      <div className="flex-shrink-0">
        <AddToListButton
          term={generic}
          label="+"
          forwardToList={false}
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-zinc-800 text-zinc-600 hover:border-emerald-500/40 hover:text-emerald-500 hover:bg-emerald-500/5 transition-all cursor-pointer text-base leading-none disabled:opacity-30 disabled:cursor-not-allowed"
        />
      </div>
    </div>
  );
}

export default function GenericsClientList({ generics }: { generics: GenericSummary[] }) {
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Sort and split once — only reruns when generics prop changes
  const { essentialItems, restSorted } = useMemo(() => {
    const byName = new Map(generics.map(g => [g.generic, g]));
    const essentialItems = ESSENTIALS
      .map(name => byName.get(name))
      .filter((g): g is GenericSummary => !!g);
    const restSorted = generics
      .filter(g => !ESSENTIALS_SET.has(g.generic))
      .sort((a, b) => b.count - a.count);
    return { essentialItems, restSorted };
  }, [generics]);

  // Filter runs on query change only — no re-sort
  const { filteredEssentials, filteredRest } = useMemo(() => {
    const q = normalize(query);
    if (!q) return { filteredEssentials: essentialItems, filteredRest: restSorted };
    return {
      filteredEssentials: essentialItems.filter(g => normalize(g.generic).includes(q)),
      filteredRest: restSorted.filter(g => normalize(g.generic).includes(q)),
    };
  }, [essentialItems, restSorted, query]);

  const allFiltered = [...filteredEssentials, ...filteredRest];
  const visible = allFiltered.slice(0, visibleCount);
  const hasMore = allFiltered.length > visibleCount;

  const handleQueryChange = (val: string) => {
    setQuery(val);
    setVisibleCount(PAGE_SIZE);
  };

  const isSearching = query.trim().length > 0;

  return (
    <div>
      <div className="relative mb-6">
        <input
          type="text"
          value={query}
          onChange={e => handleQueryChange(e.target.value)}
          placeholder="filtrar básicos..."
          className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-600 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-700 focus:outline-none transition-colors font-mono"
        />
        {query && (
          <button
            onClick={() => handleQueryChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-700 hover:text-zinc-400 transition-colors cursor-pointer text-lg leading-none"
          >
            ×
          </button>
        )}
      </div>

      {isSearching && (
        <p className="text-xs text-zinc-600 mb-4">
          {allFiltered.length} resultado{allFiltered.length !== 1 ? 's' : ''} para "{query}"
        </p>
      )}

      {allFiltered.length === 0 ? (
        <p className="text-zinc-700 text-sm py-6 text-center">Nenhum básico encontrado.</p>
      ) : isSearching ? (
        // Search mode: flat list, no section headers
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {visible.map(g => <GenericCard key={g.generic} {...g} />)}
          </div>
          {hasMore && <ShowMoreButton visibleCount={visibleCount} filteredLength={allFiltered.length} setVisibleCount={setVisibleCount} />}
        </>
      ) : (
        // Browse mode: essentials section + rest with show-more
        <>
          {filteredEssentials.length > 0 && (
            <>
              <p className="text-[10px] text-zinc-700 uppercase tracking-widest mb-3">Essenciais</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-8">
                {filteredEssentials.map(g => <GenericCard key={g.generic} {...g} />)}
              </div>
              <p className="text-[10px] text-zinc-700 uppercase tracking-widest mb-3">Mais produtos</p>
            </>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {visible.filter(g => !ESSENTIALS_SET.has(g.generic)).map(g => <GenericCard key={g.generic} {...g} />)}
          </div>
          {hasMore && <ShowMoreButton visibleCount={visibleCount} filteredLength={allFiltered.length} setVisibleCount={setVisibleCount} />}
        </>
      )}

      <IntelFooter className="mt-10" />
    </div>
  );
}