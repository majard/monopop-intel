'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useShoppingLists } from '@/hooks/useShoppingLists';
import { normalizeUnit } from '@/utils/normalizeUnit';
import { AccessibleDialog } from '@/components/ui/AccessibleDialog';

interface AddToListButtonProps {
  term: string;
  // When coming from a product detail page — pins immediately on add
  productId?: number;
  price?: number | null;
  store?: string;
  unit?: string | null;
  stdSize?: number | null;
  className?: string;
  label?: string;
  forwardToList?: boolean;
}

export default function AddToListButton({
  term,
  productId,
  price,
  store,
  unit,
  stdSize,
  className,
  label = '+ adicionar à lista',
  forwardToList = true,
}: AddToListButtonProps) {
  const router = useRouter();
  const { lists, createList, addItem, pinVariantToItem, isReady } = useShoppingLists();
  const [isOpen, setIsOpen] = useState(false);

  const applyToList = (listId: string) => {
    const targetList = lists.find(l => l.id === listId);
    const existingItem = targetList?.items.find(
      i => i.genericName.toLowerCase() === term.toLowerCase()
    );

    let itemId: string;
    if (existingItem) {
      itemId = existingItem.id;
    } else {
      itemId = addItem(listId, { genericName: term, quantity: 1 });
    }

    if (productId !== undefined && price != null) {
      const normalized = unit && stdSize ? normalizeUnit(stdSize, unit) : null;
      pinVariantToItem(
        listId,
        itemId,
        productId,
        normalized?.unit ?? unit ?? undefined,
        normalized?.size ?? stdSize ?? undefined,
        price,
        store
      );
    }

    setIsOpen(false);
    if (forwardToList) {
      router.push(`/shopping-lists/${listId}`);
    }
  };

  const handleCreate = () => {
    const listId = createList();
    applyToList(listId);
  };

  if (!isReady) {
    return null;
  }
  
  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        disabled={!isReady}
        className={className}
      >
        {label}
      </button>

      <AccessibleDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={`Adicionar "${term}" à lista`}
        className="relative bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-sm font-mono"
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <p id="dialog-title" className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">
              adicionar à lista
            </p>
            <p className="text-base font-medium text-zinc-100">"{term}"</p>
            {productId && price != null && (
              <p className="text-xs text-emerald-500 mt-1">
                com produto fixado · R$ {price.toFixed(2)}
              </p>
            )}
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-zinc-600 hover:text-white transition-colors text-xl leading-none cursor-pointer -mt-1 -mr-1 p-1"
            aria-label="Fechar diálogo"
          >
            ×
          </button>
        </div>

        {lists.length === 0 ? (
          <p className="text-sm text-zinc-500 mb-4">Nenhuma lista ainda.</p>
        ) : (
          <div className="flex flex-col gap-2 mb-4">
            {lists.map(list => {
              const existingItem = list.items.find(
                i => i.genericName.toLowerCase() === term.toLowerCase()
              );
              return (
                <button
                  key={list.id}
                  onClick={() => applyToList(list.id)}
                  className="w-full flex items-center justify-between bg-zinc-950 border border-zinc-800 hover:border-emerald-500/40 rounded-lg px-4 py-3 transition-colors cursor-pointer group text-left"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors">
                      {list.name}
                    </p>
                    <p className="text-[11px] text-zinc-600 mt-0.5">
                      {list.items.length} {list.items.length === 1 ? 'item' : 'itens'}
                      {existingItem && (
                        <span className="text-amber-500/70 ml-1.5">
                          · já na lista{existingItem.productId ? ', fixado' : ''}
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="text-[11px] text-emerald-500 border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-3">
                    {existingItem ? 'atualizar' : 'selecionar'}
                  </span>
                </button>
              );
            })}
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
      </AccessibleDialog>
    </>
  );
}