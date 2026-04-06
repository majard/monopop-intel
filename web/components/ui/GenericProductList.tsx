'use client';

import { useState } from 'react';
import { GenericProduct, Group } from '@/types/models';
import GenericProductCard from './GenericProductCard';
import GenericGroupCard from './GenericGroupCard';
import { ShowMoreButton } from './ShowMoreButton';

const PAGE_SIZE = 8;

interface Props {
  termEncoded: string;
  isGrouped: boolean;
  groups?: Group[];
  products?: GenericProduct[];
  minPricePerUnit: number | null;
  // For product detail page — canonical key of the main product's group
  mainProductCanonicalKey?: string | null;
}

export default function GenericProductList({
  termEncoded,
  isGrouped,
  groups = [],
  products = [],
  minPricePerUnit,
  mainProductCanonicalKey,
}: Props) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const isGlobalBest = (p: GenericProduct) =>
    p.price_per_unit !== null &&
    p.available &&
    minPricePerUnit !== null &&
    Math.abs(p.price_per_unit - minPricePerUnit) < 0.0001;


  if (isGrouped) {
    // Accumulate groups until we've shown PAGE_SIZE products
    let productCount = 0;
    let cutoff = 0;
    for (const group of groups) {
      if (productCount >= visibleCount) break;
      productCount += group.variants.length;
      cutoff++;
    }
    const visible = groups.slice(0, cutoff);
    const totalProducts = groups.reduce((sum, g) => sum + g.variants.length, 0);
    const visibleProducts = visible.reduce((sum, g) => sum + g.variants.length, 0);
    const hasMore = visibleProducts < totalProducts;

    return (
      <>
        <div className="space-y-6">
          {visible.map(group => (
            <GenericGroupCard
              key={group.canonical_key}
              group={group}
              termEncoded={termEncoded}
              minPricePerUnit={minPricePerUnit}
              exactMatch={
                !!mainProductCanonicalKey &&
                group.canonical_key === mainProductCanonicalKey
              }
            />
          ))}
        </div>
        {hasMore && (
          <ShowMoreButton
            visibleCount={visibleCount}
            filteredLength={totalProducts}
            setVisibleCount={setVisibleCount}
          />
        )}
      </>
    );
  }

  const visible = products.slice(0, visibleCount);
  const hasMore = products.length > visibleCount;

  return (
    <>
      {products.length === 0 ? (
        <p className="text-zinc-600 text-sm">Nenhuma variação encontrada.</p>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {visible.map(p => (
              <GenericProductCard
                key={p.product_id}
                product={p}
                href={`/generics/${termEncoded}/${p.product_id}`}
                isBestUnit={isGlobalBest(p)}
              />
            ))}
          </div>
          {hasMore && (
            <ShowMoreButton
              visibleCount={visibleCount}
              filteredLength={products.length}
              setVisibleCount={setVisibleCount}
            />
          )}
        </>
      )}
    </>
  );
}