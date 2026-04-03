'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { ShoppingList, GenericResponse, PricingStrategy, StoreKey } from '@/types/models';
import { STORES, STORE_KEYS } from '@/constants/stores';
import {
  buildShoppingListExport,
  buildShoppingListText,
  resolveExportPrices,
  type ExportOptions,
} from '@/utils/shoppingListExport';

interface ShoppingListExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  list: ShoppingList;
  fetchGenericForExport: (term: string) => Promise<GenericResponse | null>;
}

const STRATEGY_OPTIONS: { value: PricingStrategy; label: string; description: string }[] = [
  {
    value: 'none',
    label: 'Não preencher',
    description: 'Exporta apenas preços fixados e inseridos manualmente',
  },
  {
    value: 'price',
    label: 'Menor preço total',
    description: 'Preenche com o produto mais barato disponível por loja',
  },
  {
    value: 'price_per_unit',
    label: 'Melhor custo por unidade',
    description: 'Preenche com melhor relação preço/quantidade por loja',
  },
];

export default function ShoppingListExportModal({
  isOpen,
  onClose,
  list,
  fetchGenericForExport,
}: ShoppingListExportModalProps) {
  const [selectedStores, setSelectedStores] = useState<StoreKey[]>([...STORE_KEYS]);
  const [fillStrategy, setFillStrategy] = useState<PricingStrategy>('price_per_unit');
  const [cachedData, setCachedData] = useState<Map<string, GenericResponse>>(new Map());
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const [copied, setCopied] = useState(false);


  const pinnedCount = list.items.filter(item => !!item.productId).length;

  // When modal opens or strategy changes, ensure all items are in cache
  useEffect(() => {
    if (!isOpen || fillStrategy === 'none') return;


    setIsLoadingPreview(true);
    Promise.all(
      list.items.map(item =>
        fetchGenericForExport(item.genericName).then(
          result => [item.genericName, result] as const
        )
      )
    ).then(results => {
      setCachedData(prev => {
        const next = new Map(prev);
        results.forEach(([term, result]) => {
          if (result) next.set(term, result);
        });
        return next;
      });
      setIsLoadingPreview(false);
    });
  }, [isOpen, fillStrategy]); // eslint-disable-line react-hooks/exhaustive-deps

  const exportOptions: ExportOptions = useMemo(() => ({
    selectedStores,
    fillStrategy,
    getCachedGeneric: (term: string) => cachedData.get(term) ?? null,
  }), [selectedStores, fillStrategy, cachedData]);

  const resolvedItems = useMemo(
    () => resolveExportPrices(list, exportOptions),
    [list, exportOptions]
  );

  const toggleStore = (store: StoreKey) => {
    setSelectedStores(prev =>
      prev.includes(store) ? prev.filter(key => key !== store) : [...prev, store]
    );
  };

  const handleDownload = () => {
    const { jsonString, fileName } = buildShoppingListExport(list, exportOptions);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    onClose();
  };


  const handleCopyText = () => {
    const text = buildShoppingListText(list);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={event => event.target === event.currentTarget && onClose()}
    >
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg flex flex-col max-h-[92vh] shadow-2xl shadow-black/60">

        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-5">
          <div>
            <h2 className="text-base font-semibold text-white tracking-tight">
              Exportar para Monopop
            </h2>
            <p className="text-sm text-zinc-500 mt-0.5">
              {list.name}
              <span className="text-zinc-700 mx-1.5">·</span>
              {list.items.length} {list.items.length === 1 ? 'item' : 'itens'}
              {pinnedCount > 0 && (
                <>
                  <span className="text-zinc-700 mx-1.5">·</span>
                  <span className="text-emerald-600">{pinnedCount} fixado{pinnedCount !== 1 ? 's' : ''}</span>
                </>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-600 hover:text-white transition-colors cursor-pointer text-xl leading-none p-1 -mr-1 -mt-1"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 pb-2 space-y-6 scrollbar-subtle">

          {/* Store selection */}
          <div>
            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">
              Lojas
            </p>
            <div className="grid grid-cols-3 gap-2">
              {STORE_KEYS.map(storeKey => {
                const isSelected = selectedStores.includes(storeKey);
                return (
                  <button
                    key={storeKey}
                    onClick={() => toggleStore(storeKey)}
                    className={`py-2.5 px-3 rounded-lg border text-sm font-medium transition-all cursor-pointer select-none ${isSelected
                      ? 'bg-emerald-500/10 border-emerald-500/60 text-emerald-400'
                      : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                      }`}
                  >
                    {STORES[storeKey].label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">
              Preços para lojas sem preço fixado
            </p>
            <div className="space-y-1.5">
              {STRATEGY_OPTIONS.map(({ value, label, description }) => (
                <button
                  key={value}
                  onClick={() => setFillStrategy(value)}
                  className={`w-full flex items-start gap-3 p-3.5 rounded-lg border text-left transition-all cursor-pointer ${fillStrategy === value
                    ? 'bg-emerald-500/5 border-emerald-500/30'
                    : 'border-zinc-800 hover:border-zinc-700 bg-transparent'
                    }`}
                >
                  {/* Custom radio dot */}
                  <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex items-center justify-center flex-shrink-0 transition-colors ${fillStrategy === value ? 'border-emerald-500' : 'border-zinc-600'
                    }`}>
                    {fillStrategy === value && (
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    )}
                  </div>
                  <div>
                    <p className={`text-sm font-medium leading-snug transition-colors ${fillStrategy === value ? 'text-white' : 'text-zinc-400'
                      }`}>
                      {label}
                    </p>
                    <p className="text-xs text-zinc-600 mt-0.5 leading-relaxed">{description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div>
            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">
              Prévia
            </p>
            {isLoadingPreview ? (
              <div className="py-8 text-center text-zinc-600 text-sm animate-pulse">
                Buscando melhores preços...
              </div>
            ) : (
              <div className="space-y-1.5">
                {resolvedItems.map(({ item, prices }) => {
                  const isPinned = !!item.productId;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg bg-zinc-800/40 border border-zinc-800/80"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm text-zinc-300 truncate">{item.genericName}</span>
                        {isPinned && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded flex-shrink-0 leading-none">
                            fixado
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0 text-xs">
                        {prices.length === 0 ? (
                          <span className="text-zinc-700">sem preço</span>
                        ) : (
                          prices.map(resolvedPrice => (
                            <span key={resolvedPrice.store} className="flex items-baseline gap-1">
                              <span className="text-zinc-600">
                                {STORES[resolvedPrice.store].shortLabel}
                              </span>
                              <span className={`font-medium tabular-nums ${resolvedPrice.source === 'pinned'
                                ? 'text-emerald-400'
                                : resolvedPrice.source === 'manual'
                                  ? 'text-zinc-300'
                                  : 'text-zinc-400'
                                }`}>
                                R$ {resolvedPrice.price.toFixed(2)}
                              </span>
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 pt-3 border-t border-zinc-800 flex gap-4 mt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm text-zinc-500 hover:text-zinc-300 font-medium transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            onClick={handleCopyText}
            className="flex flex-1 items-center gap-2 text-zinc-500 hover:text-zinc-300 px-1 py-2 rounded-lg text-sm transition-all cursor-pointer"
          >
            {copied ? (
              <><span className="text-emerald-400">✓</span> Copiado!</>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <rect x="1" y="3" width="9" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M4 3V2a1 1 0 011-1h2a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  <path d="M11 1h-2a1 1 0 00-1 1v2h3V2a1 1 0 00-1-1z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
                </svg>
                Copiar texto
              </>
            )}
          </button>

          <button
            onClick={handleDownload}
            disabled={selectedStores.length === 0}
            className="flex-1 bg-emerald-600 px-4 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-black font-semibold py-2.5 rounded-xl transition-colors cursor-pointer text-sm"
          >
            ↓ Baixar export
          </button>
        </div>

      </div>
    </div>
  );
}