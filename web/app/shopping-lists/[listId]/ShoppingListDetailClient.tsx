'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import ProductDetailPanel from '@/components/ProductDetailPanel';
import ShoppingListPasteModal from '@/components/ui/ShoppingListPasteModal';
import ShoppingListExportModal from '@/components/ui/ShoppingListExportModal';
import { useShoppingListDetail } from './ShoppingListDetailContext';
import { normalizeUnit } from '@/utils/normalizeUnit';
import type { ShoppingListItem } from '@/types/models';

export default function ShoppingListDetailClient() {
  const router = useRouter();
  const {
    listId,
    availableGenerics,
    data,
    generic,
    list,
    isReady,
    openItem,
    unpinItem,
    updateItem,
    removeItem,
    addItem,
    fetchGenericForExport,
  } = useShoppingListDetail();

  const [showPasteModal, setShowPasteModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  if (!isReady) {
    return (
      <main className="h-[calc(100vh-68px)] bg-zinc-950 text-zinc-100 font-mono flex items-center justify-center">
        <span className="text-zinc-600 text-sm animate-pulse">carregando...</span>
      </main>
    );
  }

  if (!list) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 font-mono p-6">
        <div className="max-w-2xl mx-auto text-center py-20">
          <p className="text-xl text-zinc-500">Lista não encontrada.</p>
          <button
            onClick={() => router.push('/shopping-lists')}
            className="mt-6 text-emerald-400 hover:text-emerald-300 underline cursor-pointer transition-colors"
          >
            ← Voltar para listas
          </button>
        </div>
      </main>
    );
  }

  const handleAddFromPaste = (newItems: Array<{ genericName: string; quantity: number }>) => {
    newItems.forEach(({ genericName, quantity }) => {
      addItem(listId, { genericName, quantity: quantity || 1 });
    });
    setShowPasteModal(false);
  };

  const calculateTotal = () =>
    list.items.reduce((total, item) => total + item.quantity * (item.pinnedPrice ?? 0), 0);

  const isPanelOpen = !!generic && !!data;

  return (
    <main className="h-[calc(100vh-68px)] bg-zinc-950 text-zinc-100 font-mono p-6 flex flex-col overflow-hidden">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-6 flex-1 min-h-0 w-full">

        {/* Left: Shopping List */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

          {/* List header */}
          <div className="flex items-center justify-between mb-6 flex-shrink-0">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/shopping-lists')}
                className="text-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer"
                aria-label="Voltar para listas"
              >
                ←
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white leading-tight">{list.name}</h1>
                <p className="text-zinc-600 text-sm mt-0.5">
                  {list.items.length} {list.items.length === 1 ? 'item' : 'itens'}
                  <span className="text-zinc-700 mx-1.5">·</span>
                  atualizado {new Date(list.updatedAt).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPasteModal(true)}
                className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer"
              >
                📋 Colar lista
              </button>
              <button
                onClick={() => setShowExportModal(true)}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-black px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
              >
                ↓ Exportar
              </button>
            </div>
          </div>

          {/* Empty state */}
          {list.items.length === 0 ? (
            <div className="flex-1 min-h-0 border border-dashed border-zinc-800 rounded-xl flex flex-col items-center justify-center gap-3 text-center p-12">
              <p className="text-zinc-500">Esta lista ainda está vazia.</p>
              <p className="text-sm text-zinc-700">
                Cole uma lista em texto ou adicione itens a partir das páginas de básicos.
              </p>
              <button
                onClick={() => setShowPasteModal(true)}
                className="mt-2 text-sm text-emerald-500 hover:text-emerald-400 underline cursor-pointer transition-colors"
              >
                Colar lista agora →
              </button>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto scrollbar-subtle space-y-2 pr-1 min-h-0">
              {list.items.map((item: ShoppingListItem) => {
                const isPinned = !!item.productId;
                const sizeDisplay = item.preferredStdSize && item.preferredUnit
                  ? normalizeUnit(item.preferredStdSize, item.preferredUnit).display
                  : null;

                return (
                  <div
                    key={item.id}
                    onClick={() => openItem(item.genericName, item.productId)}
                    className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl p-4 flex items-center gap-4 group cursor-pointer transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      {/* Item name + pinned badge */}
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-zinc-200 group-hover:text-white transition-colors truncate">
                          {item.genericName}
                        </span>
                        {isPinned && (
                          <button
                            onClick={event => {
                              event.stopPropagation();
                              unpinItem(item.id);
                            }}
                            className="text-[10px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all cursor-pointer flex-shrink-0"
                            title="Clique para desafixar"
                          >
                            fixado
                          </button>
                        )}
                      </div>

                      {/* Size info */}
                      {sizeDisplay && (
                        <p className="text-zinc-600 text-xs mt-0.5">{sizeDisplay}</p>
                      )}

                      {/* Price */}
                      {isPinned ? (
                        <p className="text-emerald-400 text-sm mt-1 font-medium tabular-nums">
                          {item.pinnedPrice != null ? `R$ ${item.pinnedPrice.toFixed(2)}` : '—'}
                        </p>
                      ) : (
                        <div className="mt-1.5" onClick={event => event.stopPropagation()}>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0,00"
                            value={item.pinnedPrice ?? ''}
                            onChange={event =>
                              updateItem(listId, item.id, {
                                pinnedPrice: event.target.value
                                  ? parseFloat(event.target.value)
                                  : undefined,
                              })
                            }
                            className="bg-zinc-800 border border-zinc-700 focus:border-zinc-500 rounded-lg px-3 py-1 text-emerald-400 placeholder:text-zinc-700 text-sm w-28 focus:outline-none transition-colors tabular-nums"
                          />
                        </div>
                      )}
                    </div>

                    {/* Quantity controls + remove */}
                    <div className="flex items-center gap-3 shrink-0" onClick={event => event.stopPropagation()}>
                      <div className="flex items-center border border-zinc-700 rounded-lg overflow-hidden">
                        <button
                          onClick={() => updateItem(listId, item.id, { quantity: Math.max(1, item.quantity - 1) })}
                          className="px-3 py-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={event =>
                            updateItem(listId, item.id, { quantity: parseInt(event.target.value) || 1 })
                          }
                          className="w-10 bg-transparent text-center text-sm focus:outline-none text-zinc-300 tabular-nums"
                          min="1"
                        />
                        <button
                          onClick={() => updateItem(listId, item.id, { quantity: item.quantity + 1 })}
                          className="px-3 py-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                        >
                          +
                        </button>
                      </div>

                      <button
                        onClick={() => removeItem(listId, item.id)}
                        className="text-zinc-700 hover:text-red-400 transition-colors cursor-pointer p-1 rounded"
                        title="Remover item"
                        aria-label={`Remover ${item.genericName}`}
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M2 4h10M5 4V3a1 1 0 011-1h2a1 1 0 011 1v1M9 4v7a1 1 0 01-1 1H6a1 1 0 01-1-1V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Total */}
          {list.items.length > 0 && (
            <div className="flex-shrink-0 pt-4 mt-2 border-t border-zinc-800 flex justify-between items-baseline">
              <span className="text-zinc-500 text-sm">Total estimado</span>
              <span className="text-emerald-400 font-bold text-lg tabular-nums">
                R$ {calculateTotal().toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Right: Product Detail Panel */}
        {isPanelOpen && (
          <div className="flex-1 lg:max-w-[55%] lg:border-l lg:border-zinc-800 lg:pl-6 flex flex-col min-h-0 overflow-hidden scrollbar-subtle">
            <ProductDetailPanel />
          </div>
        )}
      </div>

      <ShoppingListPasteModal
        isOpen={showPasteModal}
        onClose={() => setShowPasteModal(false)}
        onConfirmAdd={handleAddFromPaste}
        availableGenerics={availableGenerics}
      />

      {showExportModal && (
        <ShoppingListExportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          list={list}
          fetchGenericForExport={fetchGenericForExport}
        />
      )}
    </main>
  );
}