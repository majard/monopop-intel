'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProductDetailPanel from '@/components/ProductDetailPanel';
import ShoppingListPasteModal from '@/components/ui/ShoppingListPasteModal';
import ShoppingListExportModal from '@/components/ui/ShoppingListExportModal';
import { useShoppingListDetail } from './ShoppingListDetailContext';
import { normalizeUnit } from '@/utils/normalizeUnit';
import type { ShoppingListItem } from '@/types/models';

// ─── ATM price input ──────────────────────────────────────────────────────────
// Digits fill right-to-left as cents. No raw float parsing.

function AtmPriceInput({
  value,
  onChange,
  className,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  className?: string;
}) {
  const [cents, setCents] = useState<number>(
    value != null ? Math.round(value * 100) : 0
  );
  const syncRef = useRef(value);

  useEffect(() => {
    if (syncRef.current !== value) {
      setCents(value != null ? Math.round(value * 100) : 0);
      syncRef.current = value;
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault();
      const next = cents * 10 + parseInt(e.key);
      if (next <= 99999) {
        setCents(next);
        onChange(next > 0 ? next / 100 : undefined);
      }
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      const next = Math.floor(cents / 10);
      setCents(next);
      onChange(next > 0 ? next / 100 : undefined);
    } else if (e.key === 'Escape' || e.key === 'Delete') {
      setCents(0);
      onChange(undefined);
    }
  };

  const display = cents === 0 ? '' : (cents / 100).toFixed(2).replace('.', ',');

  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      placeholder="0,00"
      onKeyDown={handleKeyDown}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '').slice(-5);
        const next = digits ? Number.parseInt(digits, 10) : 0;
        setCents(next);
        onChange(next > 0 ? next / 100 : undefined);
      }}
      className={className}
    />
  );
}

// ─── Inline size editor (unpinned items only) ─────────────────────────────────

const UNIT_OPTIONS = ['g', 'ml', 'un'] as const;
type UnitOption = typeof UNIT_OPTIONS[number];

function SizeEditor({
  stdSize,
  unit,
  onSave,
}: {
  stdSize: number | undefined;
  unit: string | undefined;
  onSave: (size: number | undefined, unit: string | undefined) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [sizeInput, setSizeInput] = useState(stdSize?.toString() ?? '');
  const [unitInput, setUnitInput] = useState<UnitOption>((unit as UnitOption) ?? 'g');
  const inputRef = useRef<HTMLInputElement>(null);

  const hasSize = !!stdSize && !!unit;
  const display = hasSize ? normalizeUnit(stdSize, unit).display : null;

  useEffect(() => {
    if (isOpen) {
      setSizeInput(stdSize?.toString() ?? '');
      setUnitInput((unit as UnitOption) ?? 'g');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen, stdSize, unit]);

  const handleSave = () => {
    const parsed = parseFloat(sizeInput);
    const valid = !isNaN(parsed) && parsed > 0;
    onSave(valid ? parsed : undefined, valid ? unitInput : undefined);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <button
        onClick={e => { e.stopPropagation(); setIsOpen(true); }}
        className="text-[10px] cursor-pointer mt-1 transition-colors flex items-center gap-1"
      >
        {display ? (
          <span className="text-zinc-600 hover:text-zinc-400">
            {display} <span className="opacity-60">✎</span>
          </span>
        ) : (
          <span className="text-zinc-700 hover:text-zinc-500 border border-dashed border-zinc-800 hover:border-zinc-700 px-1.5 py-0.5 rounded transition-colors">
            + tamanho
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 mt-1.5" onClick={e => e.stopPropagation()}>
      <input
        ref={inputRef}
        type="number"
        value={sizeInput}
        onChange={e => setSizeInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="500"
        className="w-16 bg-zinc-800 border border-zinc-600 focus:border-zinc-400 rounded px-2 py-0.5 text-xs text-zinc-300 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <select
        value={unitInput}
        onChange={e => setUnitInput(e.target.value as UnitOption)}
        className="bg-zinc-800 border border-zinc-600 rounded px-1 py-0.5 text-xs text-zinc-400 focus:outline-none cursor-pointer"
      >
        {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
      </select>
      <button
        onClick={handleSave}
        className="text-[10px] text-emerald-500 hover:text-emerald-400 cursor-pointer px-1.5 py-0.5 border border-emerald-500/30 rounded transition-colors"
      >
        ok
      </button>
      {hasSize && (
        <button
          onClick={e => {
            e.stopPropagation();
            onSave(undefined, undefined);
            setIsOpen(false);
          }}
          className="text-[10px] text-zinc-700 hover:text-red-400 cursor-pointer transition-colors"
        >
          ×
        </button>
      )}
    </div>
  );
}

// ─── Derive price/unit from stored item data ──────────────────────────────────
// Works for both pinned (size set at pin time) and manually-sized unpinned items.

function deriveDisplayPerUnit(
  price: number | null | undefined,
  size: number | null | undefined,
  unit: string | null | undefined
): string | null {
  if (!price || !size || !unit || size <= 0) return null;
  if (unit === 'g') return `R$ ${(price / size * 1000).toFixed(2).replace('.', ',')}/kg`;
  if (unit === 'ml') return `R$ ${(price / size * 1000).toFixed(2).replace('.', ',')}/L`;
  return `R$ ${(price / size).toFixed(2).replace('.', ',')}/${unit}`;
}

// ─── Main component ───────────────────────────────────────────────────────────

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

  const handleAddFromPaste = (items: Array<{ genericName: string; quantity: number }>) => {
    items.forEach(({ genericName, quantity }) => {
      addItem(listId, { genericName, quantity: quantity || 1 });
    });
    setShowPasteModal(false);
  };

  const calculateTotal = () =>
    list.items.reduce((sum, item) => sum + item.quantity * (item.pinnedPrice ?? 0), 0);

  const pinnedCount = list.items.filter(i => i.productId).length;
  const unpricedCount = list.items.filter(i => !i.pinnedPrice).length;
  const isPanelOpen = !!generic && !!data;

  return (
    <main className="h-[calc(100vh-68px)] bg-zinc-950 text-zinc-100 font-mono p-6 flex flex-col overflow-hidden">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-6 flex-1 min-h-0 w-full">

        {/* ── Left: list ───────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between mb-5 flex-shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/shopping-lists')}
                className="text-zinc-600 hover:text-zinc-300 transition-colors cursor-pointer"
                aria-label="Voltar para listas"
              >
                ←
              </button>
              <div>
                <h1 className="text-xl font-bold text-white leading-tight">{list.name}</h1>
                <p className="text-zinc-600 text-xs mt-0.5">
                  {list.items.length} {list.items.length === 1 ? 'item' : 'itens'}
                  {pinnedCount > 0 && (
                    <> · <span className="text-emerald-700">{pinnedCount} fixados</span></>
                  )}
                  <span className="text-zinc-800 mx-1.5">·</span>
                  {new Date(list.updatedAt).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPasteModal(true)}
                className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-700 px-3 py-2 rounded-lg text-xs transition-all cursor-pointer"
              >
                {/* clipboard icon */}
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <rect x="1" y="3" width="9" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M4 3V2a1 1 0 011-1h2a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  <path d="M3.5 7h5M3.5 9.5h3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  <rect x="8" y="8" width="5" height="5" rx="1" fill="currentColor" fillOpacity=".15" stroke="currentColor" strokeWidth="1.1" />
                  <path d="M10 10h1M10 11.5h1" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
                </svg>
                Colar lista
              </button>
              <button
                onClick={() => setShowExportModal(true)}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-black px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                {/* download icon */}
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <path d="M7 1v8M4 6.5l3 3 3-3M2 12h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Exportar
              </button>
            </div>
          </div>

          {/* Empty state */}
          {list.items.length === 0 ? (
            <div className="flex-1 min-h-0 border border-dashed border-zinc-800 rounded-xl flex flex-col items-center justify-center gap-3 text-center p-12">
              <p className="text-zinc-500 text-sm">Esta lista está vazia.</p>
              <p className="text-xs text-zinc-700 max-w-xs">
                Cole uma lista em texto ou adicione itens a partir das páginas de básicos.
              </p>
              <button
                onClick={() => setShowPasteModal(true)}
                className="mt-2 text-xs text-emerald-500 hover:text-emerald-400 underline cursor-pointer transition-colors"
              >
                Colar lista agora →
              </button>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto scrollbar-subtle space-y-1.5 pr-1 min-h-0">
              {list.items.map((item: ShoppingListItem) => {
                const isPinned = !!item.productId;
                const displayPerUnit = deriveDisplayPerUnit(
                  item.pinnedPrice,
                  item.preferredStdSize,
                  item.preferredUnit
                );

                return (
                  <div
                    key={item.id}
                    onClick={() => openItem(item.genericName, item.productId)}
                    className={`border rounded-xl px-4 py-3 flex items-center gap-4 group cursor-pointer transition-all ${isPinned
                      ? 'bg-zinc-900 border-zinc-800 hover:border-emerald-500/25'
                      : 'bg-zinc-900/70 border-zinc-800/70 hover:border-zinc-700'
                      }`}
                  >
                    {/* ── Left: info ─────────────────────────────────────── */}
                    <div className="flex-1 min-w-0">

                      {/* Name row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors truncate">
                          {item.genericName}
                        </span>
                        {isPinned && (
                          <button
                            onClick={e => { e.stopPropagation(); unpinItem(item.id); }}
                            className="text-[10px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all cursor-pointer flex-shrink-0"
                            title="Clique para desafixar"
                          >
                            fixado
                          </button>
                        )}
                      </div>

                      {/* Price + per-unit */}
                      {isPinned ? (
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="text-emerald-400 text-sm font-medium tabular-nums">
                            {item.pinnedPrice != null
                              ? `R$ ${item.pinnedPrice.toFixed(2).replace('.', ',')}`
                              : '—'}
                          </span>
                          {displayPerUnit && (
                            <span className="text-zinc-600 text-[10px] tabular-nums">
                              {displayPerUnit}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div
                          className="flex items-baseline gap-2 mt-1.5"
                          onClick={e => e.stopPropagation()}
                        >
                          <AtmPriceInput
                            value={item.pinnedPrice}
                            onChange={v => updateItem(listId, item.id, { pinnedPrice: v })}
                            className="bg-zinc-800 border border-zinc-700 focus:border-zinc-500 rounded-lg px-3 py-1 text-emerald-400 placeholder:text-zinc-700 text-sm w-28 focus:outline-none transition-colors tabular-nums font-mono"
                          />
                          {displayPerUnit && (
                            <span className="text-zinc-600 text-[10px] tabular-nums">
                              {displayPerUnit}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Size editor — unpinned only */}
                      {!isPinned && (
                        <SizeEditor
                          stdSize={item.preferredStdSize}
                          unit={item.preferredUnit}
                          onSave={(size, unit) =>
                            updateItem(listId, item.id, {
                              preferredStdSize: size,
                              preferredUnit: unit,
                            })
                          }
                        />
                      )}
                    </div>

                    {/* ── Right: qty + delete ─────────────────────────────── */}
                    <div
                      className="flex items-center gap-2 shrink-0"
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="flex items-center border border-zinc-800 rounded-lg overflow-hidden">
                        <button
                          onClick={() =>
                            updateItem(listId, item.id, {
                              quantity: Math.max(1, item.quantity - 1),
                            })
                          }
                          className="px-2.5 py-1.5 text-zinc-600 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer text-sm leading-none"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={e =>
                            updateItem(listId, item.id, {
                              quantity: parseInt(e.target.value) || 1,
                            })
                          }
                          className="w-8 bg-transparent text-center text-sm focus:outline-none text-zinc-300 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          min="1"
                        />
                        <button
                          onClick={() =>
                            updateItem(listId, item.id, { quantity: item.quantity + 1 })
                          }
                          className="px-2.5 py-1.5 text-zinc-600 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer text-sm leading-none"
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
                        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                          <path
                            d="M2 4h10M5 4V3a1 1 0 011-1h2a1 1 0 011 1v1M9 4v7a1 1 0 01-1 1H6a1 1 0 01-1-1V4"
                            stroke="currentColor"
                            strokeWidth="1.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
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
              <div>
                <span className="text-zinc-500 text-sm">Total estimado</span>
                {unpricedCount > 0 && (
                  <span className="text-zinc-700 text-xs ml-2">
                    · {unpricedCount} sem preço
                  </span>
                )}
              </div>
              <span className="text-emerald-400 font-bold text-lg tabular-nums">
                R$ {calculateTotal().toFixed(2).replace('.', ',')}
              </span>
            </div>
          )}
        </div>

        {/* ── Right: panel ─────────────────────────────────────────────────── */}
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
