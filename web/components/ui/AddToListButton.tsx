'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useShoppingLists } from '@/hooks/useShoppingLists';

interface AddToListButtonProps {
  term: string;
  className?: string;
}

export default function AddToListButton({ term, className }: AddToListButtonProps) {
  const router = useRouter();
  const { lists, createList, addItem, isReady } = useShoppingLists();
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (listId: string) => {
    addItem(listId, { genericName: term, quantity: 1 });
    setIsOpen(false);
    router.push(`/shopping-lists/${listId}`);
  };

  const handleCreate = () => {
    const listId = createList();
    addItem(listId, { genericName: term, quantity: 1 });
    setIsOpen(false);
    router.push(`/shopping-lists/${listId}`);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        disabled={!isReady}
        className={className ?? 'flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'}
      >
        + Adicionar à lista
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setIsOpen(false)}
          />
          <div className="relative bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-sm font-mono">
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">
                  adicionar à lista
                </p>
                <p className="text-base font-medium text-zinc-100">"{term}"</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-zinc-600 hover:text-white transition-colors text-xl leading-none cursor-pointer -mt-1 -mr-1 p-1"
              >
                ×
              </button>
            </div>

            {lists.length === 0 ? (
              <p className="text-sm text-zinc-500 mb-4">Nenhuma lista ainda.</p>
            ) : (
              <div className="flex flex-col gap-2 mb-4">
                {lists.map(list => (
                  <button
                    key={list.id}
                    onClick={() => handleSelect(list.id)}
                    className="w-full flex items-center justify-between bg-zinc-950 border border-zinc-800 hover:border-emerald-500/40 rounded-lg px-4 py-3 transition-colors cursor-pointer group text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors">
                        {list.name}
                      </p>
                      <p className="text-[11px] text-zinc-600 mt-0.5">
                        {list.items.length} {list.items.length === 1 ? 'item' : 'itens'}
                        {list.items.filter(i => i.productId).length > 0 && (
                          <> · {list.items.filter(i => i.productId).length} fixados</>
                        )}
                      </p>
                    </div>
                    <span className="text-[11px] text-emerald-500 border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                      selecionar
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="border-t border-zinc-800 pt-4">
              <button
                onClick={handleCreate}
                className="w-full border border-dashed border-zinc-700 hover:border-zinc-500 text-zinc-500 hover:text-zinc-300 rounded-lg py-2.5 text-sm transition-colors cursor-pointer"
              >
                + nova lista
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}