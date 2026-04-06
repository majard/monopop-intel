'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useShoppingLists, ShoppingList, ShoppingListsProvider } from '../../hooks/useShoppingLists';
import { buildShoppingListExport } from '../../utils/shoppingListExport';
import { STORE_KEYS } from '@/constants/stores';
import Link from 'next/link';
import IntelFooter from '@/components/ui/IntelFooter';

export default function ShoppingListsPageWrapper() {
  return (
    <ShoppingListsProvider>
      <ShoppingListsPage />
    </ShoppingListsProvider>
  );
}

function ShoppingListsPage() {
  const router = useRouter();
  const { lists, createList, renameList, deleteList } = useShoppingLists();

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingId) setTimeout(() => renameInputRef.current?.focus(), 0);
  }, [renamingId]);

  const startRename = (e: React.MouseEvent, list: ShoppingList) => {
    e.stopPropagation();
    setRenamingId(list.id);
    setRenameValue(list.name);
    setDeletingId(null);
  };

  const commitRename = (listId: string) => {
    if (renameValue.trim()) renameList(listId, renameValue.trim());
    setRenamingId(null);
  };

  const handleExport = (e: React.MouseEvent, list: ShoppingList) => {
    e.stopPropagation();
    const { jsonString, fileName } = buildShoppingListExport(list, {
      selectedStores: STORE_KEYS,
      fillStrategy: 'none',        // no fill — export only what's pinned/manual
      getCachedGeneric: () => null, // no cache available at index level
    });
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCreate = () => {
    const id = createList();
    router.push(`/shopping-lists/${id}`);
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 font-mono p-6">
      <div className="max-w-3xl mx-auto">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Listas de Compras</h1>
            <p className="text-zinc-500 text-sm mt-1">
              {lists.length} lista{lists.length !== 1 ? 's' : ''} · exportáveis para o Monopop
            </p>
          </div>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-black font-medium px-4 py-2 rounded-lg text-sm transition-colors cursor-pointer"
          >
            + Nova lista
          </button>
        </div>

        {lists.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
            <p className="text-zinc-400 text-sm">Nenhuma lista ainda.</p>
            <button
              onClick={handleCreate}
              className="mt-6 text-emerald-400 hover:text-emerald-300 underline cursor-pointer text-sm"
            >
              Criar primeira lista
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {lists.map(list => {
              const isRenaming = renamingId === list.id;
              const isDeleting = deletingId === list.id;
              const pinnedCount = list.items.filter(i => i.productId).length;

              return (
                <div
                  key={list.id}
                  onClick={() => {
                    if (!isRenaming && !isDeleting) router.push(`/shopping-lists/${list.id}`);
                  }}
                  className={`group bg-zinc-900 border rounded-xl p-5 transition-all ${isDeleting
                    ? 'border-red-500/30'
                    : 'border-zinc-800 hover:border-emerald-500/30 cursor-pointer'
                    }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">

                      {/* Inline rename */}
                      {isRenaming ? (
                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          <input
                            ref={renameInputRef}
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') commitRename(list.id);
                              if (e.key === 'Escape') setRenamingId(null);
                            }}
                            className="flex-1 bg-zinc-800 border border-zinc-600 focus:border-zinc-400 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none"
                          />
                          <button
                            onClick={() => commitRename(list.id)}
                            className="text-xs text-emerald-500 hover:text-emerald-400 border border-emerald-500/30 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            ok
                          </button>
                          <button
                            onClick={() => setRenamingId(null)}
                            className="text-xs text-zinc-600 hover:text-zinc-400 cursor-pointer"
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <h2 className={`font-medium transition-colors ${isDeleting ? 'text-red-400' : 'text-white group-hover:text-emerald-400'
                          }`}>
                          {list.name}
                        </h2>
                      )}

                      {/* Subtitle */}
                      {!isRenaming && (
                        <p className="text-zinc-600 text-xs mt-1">
                          {list.items.length} {list.items.length === 1 ? 'item' : 'itens'}
                          {pinnedCount > 0 && (
                            <> · <span className="text-emerald-700">{pinnedCount} fixados</span></>
                          )}
                          <span className="mx-1.5">·</span>
                          {new Date(list.updatedAt).toLocaleDateString('pt-BR')}
                        </p>
                      )}

                      {/* Item preview */}
                      {!isRenaming && !isDeleting && list.items.length > 0 && (
                        <p className="mt-2 text-[11px] text-zinc-700 truncate">
                          {list.items.slice(0, 4).map(i => i.genericName).join(' · ')}
                          {list.items.length > 4 && (
                            <span className="text-zinc-800"> +{list.items.length - 4}</span>
                          )}
                        </p>
                      )}

                      {/* Inline delete confirmation */}
                      {isDeleting && (
                        <div
                          className="flex items-center gap-3 mt-2"
                          onClick={e => e.stopPropagation()}
                        >
                          <p className="text-xs text-red-400">Excluir esta lista?</p>
                          <button
                            onClick={() => { deleteList(list.id); setDeletingId(null); }}
                            className="text-xs text-red-400 hover:text-red-300 border border-red-500/30 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                          >
                            excluir
                          </button>
                          <button
                            onClick={() => setDeletingId(null)}
                            className="text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer"
                          >
                            cancelar
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    {!isRenaming && !isDeleting && (
                      <div
                        className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity flex-shrink-0"
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          onClick={e => handleExport(e, list)}
                          title="Exportar JSON"
                          className="p-2 text-zinc-600 hover:text-emerald-400 transition-colors cursor-pointer rounded-lg hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                        >
                          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                            <path d="M7 1v8M4 6.5l3 3 3-3M2 12h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        <button
                          onClick={e => startRename(e, list)}
                          title="Renomear"
                          className="p-2 text-zinc-600 hover:text-zinc-300 transition-colors cursor-pointer rounded-lg hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400/50 focus-visible:ring-2 focus-visible:ring-zinc-400/50"
                        >
                          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                            <path d="M9.5 2.5l2 2-7 7H2.5v-2l7-7z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                          </svg>
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); setDeletingId(list.id); setRenamingId(null); }}
                          title="Excluir"
                          className="p-2 text-zinc-600 hover:text-red-400 transition-colors cursor-pointer rounded-lg hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus-visible:ring-2 focus-visible:ring-red-500/50"
                        >
                          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                            <path d="M2 4h10M5 4V3a1 1 0 011-1h2a1 1 0 011 1v1M9 4v7a1 1 0 01-1 1H6a1 1 0 01-1-1V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <IntelFooter className="mt-10" />
    </main>
  );
}