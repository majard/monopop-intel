'use client';

import React from 'react';
import Link from 'next/link';
import FilterSelect from '@/components/ui/FilterSelect';
import { GenericProduct, Group } from '@/types/models';
import { useShoppingListDetail } from '@/app/shopping-lists/[listId]/ShoppingListDetailContext';

const STORE_LABELS: Record<string, string> = {
  prezunic: 'Prezunic',
  zonasul: 'Zona Sul',
  hortifruti: 'Hortifruti',
};

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

function formatPrice(p: number | null): string {
  if (p === null || p <= 0) return '—';
  return `R$ ${p.toFixed(2)}`;
}

export default function ProductDetailPanel() {
  const {
    isFetchingPanel,
    generic,
    productId,
    mainProduct,
    data,
    currentStore,
    currentGroup,
    currentSort,
    currentOpenItem,
    pinVariant,
    closeItem,
  } = useShoppingListDetail();

  // Renomear para legibilidade local
  const genericName = generic;
  const pinnedProductId = currentOpenItem?.productId;

  if (isFetchingPanel) {
    return (
      <div className="p-8 text-center text-zinc-500">
        Carregando detalhes do produto...
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const isGrouped =
    !!data.group_mode && data.groups !== undefined && data.groups.length > 0;

  const allProducts: GenericProduct[] = isGrouped
    ? data.groups?.flatMap((g) => g.variants) || []
    : data.products || [];

  const availableWithUnit = allProducts.filter(
    (p) => p.price_per_unit !== null && p.available
  );
  const minPricePerUnit =
    availableWithUnit.length > 0
      ? Math.min(...availableWithUnit.map((p) => p.price_per_unit!))
      : null;

  const isGlobalBestPerUnit = (product: GenericProduct) =>
    product.price_per_unit !== null &&
    product.available &&
    minPricePerUnit !== null &&
    Math.abs(product.price_per_unit - minPricePerUnit) < 0.0001;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 p-4">
        <div>
          <h2 className="font-medium text-white">{genericName}</h2>
          {mainProduct && (
            <p className="text-sm text-zinc-500">{mainProduct.name}</p>
          )}
        </div>
        <button
          onClick={closeItem}
          className="text-2xl text-zinc-400 hover:text-white transition-colors"
          aria-label="Fechar painel"
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Grouping tabs */}
        <div className="flex flex-wrap gap-1 mb-6 border-b border-zinc-800 pb-1 overflow-x-auto">
          {GROUP_OPTIONS.map(({ value, label }) => (
            <Link
              key={value}
              href={`?${new URLSearchParams({
                generic: genericName,
                ...(productId && { productId: productId.toString() }),
                ...(currentStore && { store: currentStore }),
                group: value,
                sort_by: currentSort,
              }).toString()}`}
              replace
              scroll={false}
              className={`px-5 py-2 text-sm rounded-t-lg transition-all whitespace-nowrap font-medium ${
                currentGroup === value
                  ? 'bg-zinc-900 border border-b-0 border-zinc-700 text-white'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-950'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-8">
          <FilterSelect
            name="store"
            options={[
              { value: '', label: 'todas as lojas' },
              ...Object.entries(STORE_LABELS).map(([k, v]) => ({
                value: k,
                label: v,
              })),
            ]}
            defaultValue={currentStore}
          />
          <FilterSelect
            name="sort_by"
            options={SORT_OPTIONS}
            defaultValue={currentSort}
          />
        </div>

        {/* Products / Groups */}
        {isGrouped && data.groups ? (
          <div className="space-y-6">
            {data.groups.map((group: Group) => {
              const validPrices = group.variants
                .filter((v) => v.price !== null && v.available)
                .map((v) => v.price!);
              const minPrice =
                validPrices.length > 0 ? Math.min(...validPrices) : null;

              return (
                <div
                  key={group.canonical_key}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg p-5"
                >
                  <div className="flex justify-between mb-4">
                    <div>
                      <div className="font-semibold text-white">
                        {Array.isArray(group.brand)
                          ? group.brand.join(' • ')
                          : group.brand || 'Sem marca'}
                      </div>
                      {group.normalized_size && (
                        <div className="text-sm text-zinc-400">
                          {group.normalized_size}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {group.variants.map((v: GenericProduct) => {
                      const isCheapestInGroup =
                        minPrice !== null &&
                        v.price === minPrice &&
                        v.available;
                      const isBestPerUnit = isGlobalBestPerUnit(v);
                      const isCurrentlyPinned = v.product_id === pinnedProductId;

                      return (
                        <div
                          key={v.product_id}
                          className={`relative flex justify-between items-center px-4 py-3 rounded border ${
                            isCheapestInGroup
                              ? 'border-emerald-500/40'
                              : 'border-zinc-800'
                          } hover:border-emerald-500 transition-colors`}
                        >
                          {isCheapestInGroup && (
                            <div className="absolute -top-2 left-3 bg-zinc-950 px-1">
                              <div className="bg-emerald-500 text-zinc-950 text-[10px] font-bold px-2.5 py-0.5 rounded">
                                melhor preço
                              </div>
                            </div>
                          )}
                          {isBestPerUnit && (
                            <div className="absolute -top-2 right-3 bg-zinc-950 px-1">
                              <div className="bg-amber-500 text-zinc-950 text-[10px] font-bold px-2.5 py-0.5 rounded">
                                melhor por unidade
                              </div>
                            </div>
                          )}

                          <div className="text-sm pr-8 flex-1">
                            <span className="text-zinc-400">
                              {STORE_LABELS[v.store] ?? v.store}
                            </span>
                            {' • '}
                            <span className="text-zinc-100">{v.name}</span>
                            {v.normalized_size && (
                              <span className="text-zinc-500 ml-2">
                                ({v.normalized_size})
                              </span>
                            )}
                          </div>

                          <div className="text-right shrink-0 flex items-center gap-3">
                            <div
                              className={`font-medium ${
                                isCheapestInGroup ? 'text-emerald-400' : ''
                              }`}
                            >
                              {formatPrice(v.price)}
                            </div>
                            {v.display_per_unit && (
                              <div className="text-xs text-zinc-500">
                                {v.display_per_unit}
                              </div>
                            )}
                            <button
                              onClick={() =>
                                pinVariant(
                                  v.product_id,
                                  group.unit || undefined,
                                  group.package_size || undefined,
                                  v.price || undefined,
                                  v.store || undefined
                                )
                              }
                              className={`text-xs px-3 py-1 rounded border transition-colors ${
                                isCurrentlyPinned
                                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                                  : 'hover:bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'
                              }`}
                            >
                              {isCurrentlyPinned ? 'Fixado' : 'Fixar'}
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
          <div className="flex flex-col gap-3">
            {allProducts.map((p: GenericProduct) => {
              const isBestPerUnit = isGlobalBestPerUnit(p);
              const isCurrentlyPinned = p.product_id === pinnedProductId;

              return (
                <div
                  key={p.product_id}
                  className="group block bg-zinc-900 border border-zinc-800 hover:border-emerald-500 rounded-lg px-5 py-5 transition-colors relative"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    {isBestPerUnit && (
                      <div className="absolute -top-2 right-4 bg-zinc-950 px-1">
                        <div className="bg-amber-500 text-zinc-950 text-[10px] font-bold px-2.5 py-0.5 rounded">
                          melhor por unidade
                        </div>
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] text-zinc-100 group-hover:text-white truncate">
                        {p.name}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2 text-xs">
                        <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                          {STORE_LABELS[p.store] ?? p.store}
                        </span>
                        {p.parsed_brand && (
                          <span className="px-2 py-0.5 rounded bg-zinc-800/70 text-zinc-500 border border-zinc-800">
                            {p.parsed_brand}
                          </span>
                        )}
                        {p.normalized_size && (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {p.normalized_size}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0 flex items-center gap-3">
                      <div>
                        <p className="text-emerald-400 font-bold text-[20px]">
                          {formatPrice(p.price)}
                        </p>
                        {p.display_per_unit && (
                          <p className="text-xs text-zinc-500">
                            {p.display_per_unit}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() =>
                          pinVariant(
                            p.product_id,
                            p.unit || undefined,
                            p.package_size || undefined,
                            p.price || undefined,
                            p.store || undefined
                          )
                        }
                        className={`text-xs px-3 py-1 rounded border transition-colors ${
                          isCurrentlyPinned
                            ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                            : 'hover:bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'
                        }`}
                      >
                        {isCurrentlyPinned ? 'Fixado' : 'Fixar'}
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