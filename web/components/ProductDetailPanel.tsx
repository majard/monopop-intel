'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import FilterSelect from '@/components/ui/FilterSelect';
import { GenericProduct, Group } from '@/types/models';
import { STORES } from '@/constants/stores';
import { useShoppingListDetail } from '@/app/shopping-lists/[listId]/ShoppingListDetailContext';

const GROUP_OPTIONS = [
  { value: '', label: 'Lista simples' },
  { value: 'brand_size', label: 'Por marca + tamanho' },
  { value: 'size_only', label: 'Por tamanho' },
  { value: 'brand_only', label: 'Por marca' },
];

const SORT_OPTIONS = [
  { value: 'price', label: 'Menor preço' },
  { value: 'price_per_unit', label: 'Menor preço por unidade' },
];

function formatPrice(price: number | null): string {
  if (price === null || price <= 0) return '—';
  return `R$ ${price.toFixed(2)}`;
}

export default function ProductDetailPanel() {
  const {
    generic,
    productId,
    mainProduct,
    data,
    isFetchingPanel,
    currentStore,
    currentGroup,
    currentSort,
    currentOpenItem,
    pinVariant,
    unpinItem,
    closeItem,
  } = useShoppingListDetail();


  const pinnedProductId = currentOpenItem?.productId;

  // ── All derived state and refs must live before any early return ──

  const lastMainProduct = useRef<GenericProduct | undefined>(undefined);
  if (mainProduct) lastMainProduct.current = mainProduct;
  const displayProduct = mainProduct ?? (currentOpenItem?.productId ? lastMainProduct.current : undefined);
  const isGrouped = !!data?.group_mode && !!data.groups?.length;

  const allProducts: GenericProduct[] = isGrouped
    ? data!.groups!.flatMap(group =>
      group.variants.map(variant => ({
        ...variant,
        package_size: group.package_size,
        unit: group.unit,
      }))
    )
    : data?.products ?? [];

  const minPricePerUnit = allProducts
    .filter(p => p.price_per_unit !== null && p.available)
    .reduce<number | null>((min, p) =>
      min === null || p.price_per_unit! < min ? p.price_per_unit! : min
      , null);

  const isGlobalBest = (product: GenericProduct) =>
    product.price_per_unit !== null &&
    product.available &&
    minPricePerUnit !== null &&
    Math.abs(product.price_per_unit - minPricePerUnit) < 0.0001;

  const filteredGroups = isGrouped
    ? data!.groups!
      .map(group => ({
        ...group,
        variants: group.variants.filter(v => v.product_id !== pinnedProductId),
      }))
      .filter(group => group.variants.length > 0)
    : [];

  const filteredProducts = !isGrouped
    ? (data?.products ?? []).filter(p => p.product_id !== pinnedProductId)
    : [];

  // Only show skeleton on first load
  if (isFetchingPanel && !data) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between border-b border-zinc-800 p-4">
          <div className="h-4 w-32 bg-zinc-800 rounded animate-pulse" />
          <button onClick={closeItem} className="text-zinc-600 hover:text-white transition-colors cursor-pointer text-xl leading-none">×</button>
        </div>
        <div className="flex-1 p-6 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-zinc-800/50 rounded-lg animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    // Subtle overlay while refetching cached → new item transition
    <div className={`h-full flex flex-col transition-opacity duration-150 ${isFetchingPanel ? 'opacity-60' : 'opacity-100'}`}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="border-b border-zinc-800 p-4 flex-shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-zinc-600 uppercase tracking-widest mb-1">{generic}</p>

            {displayProduct ? (
              /* Pinned product display */
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white leading-snug truncate">
                    {displayProduct.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-zinc-500">
                      {STORES[displayProduct.store as keyof typeof STORES]?.label ?? displayProduct.store}
                    </span>
                    {displayProduct.normalized_size && (
                      <>
                        <span className="text-zinc-700">·</span>
                        <span className="text-xs text-zinc-500">{displayProduct.normalized_size}</span>
                      </>
                    )}
                    {displayProduct.display_per_unit && (
                      <>
                        <span className="text-zinc-700">·</span>
                        <span className="text-xs text-zinc-600">{displayProduct.display_per_unit}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-emerald-400 font-bold tabular-nums">
                    {formatPrice(displayProduct.price)}
                  </p>

                  {displayProduct && isGlobalBest(displayProduct) && (
                    <span className="text-[9px] mt-1 mr-1 inline-block bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded">
                      melhor/unid
                    </span>
                  )}
                  {pinnedProductId && currentOpenItem && (
                    <button
                      onClick={() => unpinItem(currentOpenItem.id)}
                      className="text-[10px] mt-1 px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all cursor-pointer"
                      title="Desafixar este produto"
                    >
                      fixado
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">
                Clique em "Fixar" para associar um produto a este item da lista.
              </p>
            )}
          </div>

          <button
            onClick={closeItem}
            className="text-zinc-600 hover:text-white transition-colors cursor-pointer text-xl leading-none flex-shrink-0 p-1 -mt-1 -mr-1"
            aria-label="Fechar painel"
          >
            ×
          </button>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-4">

        {/* Grouping tabs */}
        <div className="flex flex-wrap gap-1 mb-4 border-b border-zinc-800 pb-1 overflow-x-auto">
          {GROUP_OPTIONS.map(({ value, label }) => (
            <Link
              key={value}
              href={`?${new URLSearchParams({
                generic,
                ...(productId && { productId: productId.toString() }),
                ...(currentStore && { store: currentStore }),
                group: value,
                sort_by: currentSort,
              }).toString()}`}
              replace
              scroll={false}
              className={`px-4 py-1.5 text-xs rounded-t-lg transition-all whitespace-nowrap font-medium cursor-pointer ${currentGroup === value
                ? 'bg-zinc-900 border border-b-0 border-zinc-700 text-white'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
                }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-5">
          <FilterSelect
            name="store"
            options={[
              { value: '', label: 'todas as lojas' },
              ...Object.entries(STORES).map(([key, store]) => ({
                value: key,
                label: store.label,
              })),
            ]}
            defaultValue={currentStore}
          />
          <FilterSelect name="sort_by" options={SORT_OPTIONS} defaultValue={currentSort} />
        </div>

        {/* Products */}
        {isGrouped ? (
          <div className="space-y-4">
            {filteredGroups.map((group: Group) => {
              const groupPrices = group.variants
                .filter(v => v.price !== null && v.available)
                .map(v => v.price!);
              const minGroupPrice = groupPrices.length > 0 ? Math.min(...groupPrices) : null;

              return (
                <div key={group.canonical_key} className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4">
                  <div className="mb-3">
                    <p className="font-medium text-white text-sm">
                      {Array.isArray(group.brand)
                        ? group.brand.join(' · ')
                        : group.brand || 'Sem marca'}
                    </p>
                    {group.normalized_size && (
                      <p className="text-xs text-zinc-500 mt-0.5">{group.normalized_size}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    {group.variants.map((variant: GenericProduct) => {
                      const isCheapestInGroup =
                        minGroupPrice !== null &&
                        variant.price === minGroupPrice &&
                        variant.available;
                      const isBestPerUnit = isGlobalBest(variant);
                      const isCurrentlyPinned = variant.product_id === pinnedProductId;

                      return (
                        <div
                          key={variant.product_id}
                          className={`relative flex justify-between items-center px-3 py-2.5 rounded-lg border transition-colors ${isCheapestInGroup ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-zinc-800'
                            } hover:border-zinc-600`}
                        >
                          {isCheapestInGroup && (
                            <div className="absolute -top-3.5 left-2.5 bg-zinc-950 px-1">
                              <span className="bg-emerald-500 text-zinc-950 text-[9px] font-bold px-2 py-0.5 rounded">
                                melhor preço
                              </span>
                            </div>
                          )}
                          {isBestPerUnit && (
                            <div className="absolute -top-3 right-2.5 bg-zinc-950 px-1">
                              <span className="bg-amber-500 text-zinc-950 text-[9px] font-bold px-2 py-0.5 rounded">
                                melhor/unid
                              </span>
                            </div>
                          )}

                          <div className="flex-1 pr-4 min-w-0">
                            <p className="text-xs text-zinc-200 leading-snug break-words">{variant.name}</p>
                            <p className="text-[10px] text-zinc-500 mt-0.5">
                              {STORES[variant.store as keyof typeof STORES]?.label ?? variant.store}
                              {variant.normalized_size && <span className="text-zinc-600 ml-1.5">{variant.normalized_size}</span>}
                            </p>
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0">
                            <div className="text-right">
                              <p className={`text-sm font-medium tabular-nums ${isCheapestInGroup ? 'text-emerald-400' : 'text-zinc-300'}`}>
                                {formatPrice(variant.price)}
                              </p>
                              {variant.display_per_unit && (
                                <p className="text-[10px] text-zinc-600">{variant.display_per_unit}</p>
                              )}
                            </div>
                            <button
                              onClick={() =>
                                pinVariant(
                                  variant.product_id,
                                  group.unit || undefined,
                                  group.package_size || undefined,
                                  variant.price || undefined,
                                  variant.store || undefined
                                )
                              }
                              className={`text-xs px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${isCurrentlyPinned
                                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-red-500/10 hover:border-red-500/40 hover:text-red-400'
                                : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-white'
                                }`}
                            >
                              {isCurrentlyPinned ? 'fixado' : 'fixar'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredProducts.map((product: GenericProduct) => {
              const isBestPerUnit = isGlobalBest(product);
              const isCurrentlyPinned = product.product_id === pinnedProductId;

              return (
                <div
                  key={product.product_id}
                  className="relative bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 rounded-lg px-4 py-3.5 transition-colors"
                >
                  {isBestPerUnit && (
                    <div className="absolute -top-2 right-3 bg-zinc-950 px-1">
                      <span className="bg-amber-500 text-zinc-950 text-[9px] font-bold px-2 py-0.5 rounded">
                        melhor/unid
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-zinc-200 leading-snug break-words">{product.name}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        <p className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700/60">
                          {STORES[product.store as keyof typeof STORES]?.label ?? product.store}
                        </p>
                        {product.parsed_brand && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800/60 text-zinc-600 border border-zinc-800">
                            {product.parsed_brand}
                          </span>
                        )}
                        {product.normalized_size && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/15">
                            {product.normalized_size}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className="text-right">
                        <p className="text-emerald-400 font-bold tabular-nums">{formatPrice(product.price)}</p>
                        {product.display_per_unit && (
                          <p className="text-[10px] text-zinc-600">{product.display_per_unit}</p>
                        )}
                      </div>
                      <button
                        onClick={() =>
                          pinVariant(
                            product.product_id,
                            product.unit || undefined,
                            product.package_size || undefined,
                            product.price || undefined,
                            product.store || undefined
                          )
                        }
                        className={`text-xs px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${isCurrentlyPinned
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-red-500/10 hover:border-red-500/40 hover:text-red-400'
                          : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-white'
                          }`}
                      >
                        {isCurrentlyPinned ? 'fixado' : 'fixar'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}