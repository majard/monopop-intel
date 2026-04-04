import type { ShoppingList, ShoppingListItem, GenericResponse, GenericProduct, PricingStrategy, StoreKey } from '@/types/models';
import { STORES, STORE_KEYS } from '@/constants/stores';
import { denormalizeUnit } from '@/utils/normalizeUnit';

export type { PricingStrategy };

export interface ExportOptions {
  selectedStores: StoreKey[];
  fillStrategy: PricingStrategy;
  getCachedGeneric: (term: string) => GenericResponse | null;
}

// ─── Price resolution ────────────────────────────────────────────────────────

function findBestProductForStore(
  products: GenericProduct[],
  store: StoreKey,
  strategy: Exclude<PricingStrategy, 'none'>
): GenericProduct | null {
  const candidates = products.filter(
    product => product.store === store && product.available && product.price !== null
  );
  if (candidates.length === 0) return null;

  if (strategy === 'price_per_unit') {
    const withUnit = candidates.filter(product => product.price_per_unit !== null);
    if (withUnit.length > 0) {
      return withUnit.reduce((best, product) =>
        product.price_per_unit! < best.price_per_unit! ? product : best
      );
    }
  }

  return candidates.reduce((best, product) =>
    product.price! < best.price! ? product : best
  );
}

export type PriceSource = 'pinned' | 'manual' | 'filled';

export interface ResolvedStorePrice {
  store: StoreKey;
  storeId: number;
  price: number;
  packageSize: number | null;
  source: PriceSource;
}

export interface ResolvedItem {
  item: ShoppingListItem;
  productIndex: number;
  prices: ResolvedStorePrice[];
}

export function resolveExportPrices(
  list: ShoppingList,
  options: ExportOptions
): ResolvedItem[] {
  return list.items.map((item, productIndex) => {
    const prices: ResolvedStorePrice[] = [];

    const isPinned = !!item.productId && !!item.pinnedStore && !!item.pinnedPrice;

    if (isPinned) {
      // Pinned prices are sacred — always preserved, never overwritten
      const storeId = STORES[item.pinnedStore as StoreKey]?.monopopId;
      if (storeId) {
        prices.push({
          store: item.pinnedStore as StoreKey,
          storeId,
          price: item.pinnedPrice!,
          packageSize: item.preferredStdSize ? denormalizeUnit(item.preferredStdSize, item.preferredUnit!).size : null,
          source: 'pinned',
        });
      }
    }


    // Fill remaining stores from cache if strategy allows
    if (options.fillStrategy !== 'none') {
      const cachedData = options.getCachedGeneric(item.genericName);
      if (cachedData) {
        const allProducts: GenericProduct[] = cachedData.groups
          ? cachedData.groups.flatMap(group => group.variants.map(variant => ({ ...variant, package_size: group.package_size, unit: group.unit })))
          : cachedData.products ?? [];


        for (const store of options.selectedStores) {
          // Never override a price we already have for this store
          if (prices.some(price => price.store === store)) continue;

          const best = findBestProductForStore(allProducts, store, options.fillStrategy);
          if (best) {
            prices.push({
              store,
              storeId: STORES[store].monopopId,
              price: best.price!,
              packageSize: best.package_size ? denormalizeUnit(best.package_size, best.unit!).size : null,
              source: 'filled',
            });
          }
        }
      }
    }

    return { item, productIndex, prices };
  });
}

// ─── Monopop export format ───────────────────────────────────────────────────

interface MonopopCategory {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface MonopopStore {
  id: number;
  name: string;
  createdAt: string;
}

interface MonopopProduct {
  id: number;
  name: string;
  categoryId: number;
  createdAt: string;
  updatedAt: string;
  unit: string | null;
  standardPackageSize: number | null;
}

interface MonopopInventoryItem {
  id: number;
  listId: number;
  productId: number;
  quantity: number;
  sortOrder: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MonopopShoppingListItem {
  id: number;
  inventoryItemId: number;
  quantity: number;
  checked: number;
  price: number | null;
  sortOrder: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  packageSize: number | null;
}

interface MonopopProductStorePrice {
  productId: number;
  storeId: number;
  price: number;
  updatedAt: string;
  packageSize: number | null;
}

export interface MonopopExport {
  type: 'list_export';
  version: '1.0';
  exportedAt: string;
  listName: string;
  data: {
    categories: MonopopCategory[];
    stores: MonopopStore[];
    products: MonopopProduct[];
    inventory_items: MonopopInventoryItem[];
    inventory_history: never[];
    shopping_list_items: MonopopShoppingListItem[];
    invoices: never[];
    invoice_items: never[];
    product_store_prices: MonopopProductStorePrice[];
    product_base_prices: never[];
  };
}

export function buildShoppingListExport(
  list: ShoppingList,
  options: ExportOptions
): { jsonString: string; fileName: string } {
  const now = new Date().toISOString();
  const safeName = list.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const resolvedItems = resolveExportPrices(list, options);

  const categories: MonopopCategory[] = [
    { id: 1, name: 'Geral', createdAt: now, updatedAt: now },
  ];

  const stores: MonopopStore[] = STORE_KEYS.map(key => ({
    id: STORES[key].monopopId,
    name: STORES[key].monopopName,
    createdAt: now,
  }));

  const products: MonopopProduct[] = list.items.map((item, index) => ({
    id: 1000 + index,
    name: item.genericName,
    categoryId: 1,
    createdAt: now,
    updatedAt: now,
    unit: item.preferredUnit ?? null,
    standardPackageSize: item.preferredStdSize ? denormalizeUnit(item.preferredStdSize, item.preferredUnit!).size : null,
  }));


  const inventoryItems: MonopopInventoryItem[] = list.items.map((item, index) => ({
    id: 2000 + index,
    listId: 999,
    productId: 1000 + index,
    quantity: 0,
    sortOrder: index,
    notes: item.notes ?? null,
    createdAt: now,
    updatedAt: now,
  }));

  const shoppingListItems: MonopopShoppingListItem[] = resolvedItems.map(
    ({ item, productIndex }) => ({
      id: 3000 + productIndex,
      inventoryItemId: 2000 + productIndex,
      quantity: item.quantity,
      checked: 0,
      price: item.pinnedPrice ?? null,
      sortOrder: productIndex,
      notes: item.notes ?? null,
      createdAt: now,
      updatedAt: now,
      packageSize: item.preferredStdSize ? denormalizeUnit(item.preferredStdSize, item.preferredUnit!).size : null,
    })
  );

  const productStorePrices: MonopopProductStorePrice[] = resolvedItems.flatMap(
    ({ productIndex, prices }) =>
      prices.map(resolvedPrice => ({
        productId: 1000 + productIndex,
        storeId: resolvedPrice.storeId,
        price: resolvedPrice.price,
        updatedAt: now,
        packageSize: resolvedPrice.packageSize,
      }))
  );

  const exportPayload: MonopopExport = {
    type: 'list_export',
    version: '1.0',
    exportedAt: now,
    listName: list.name,
    data: {
      categories,
      stores,
      products,
      inventory_items: inventoryItems,
      inventory_history: [],
      shopping_list_items: shoppingListItems,
      invoices: [],
      invoice_items: [],
      product_store_prices: productStorePrices,
      product_base_prices: [],
    },
  };

  const timestamp = now.slice(0, 16).replace(/[:T]/g, '').replace(/-/g, '');
  return {
    jsonString: JSON.stringify(exportPayload, null, 2),
    fileName: `monopop-lista-${safeName}-${timestamp}.json`,
  };
}

export function buildShoppingListText(
  list: ShoppingList,
  resolvedItems: ResolvedItem[],
  options: Pick<ExportOptions, 'fillStrategy' | 'selectedStores'>
): string {
  const lines: string[] = [
    `🛒 ${list.name}`,
    new Date().toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    }),
    '',
  ];

  for (const { item, prices } of resolvedItems) {
    const qty = item.quantity > 1 ? `${item.quantity}× ` : '';
    const pinnedPrice = prices.find(p => p.source === 'pinned');

    if (options.fillStrategy === 'none') {
      // Simple: one line per item
      const priceStr = pinnedPrice
        ? `R$ ${pinnedPrice.price.toFixed(2).replace('.', ',')} (${STORES[pinnedPrice.store]?.label ?? pinnedPrice.store})`
        : 'sem preço';
      lines.push(`${qty}${item.genericName} — ${priceStr}`);
    } else {
      // Rich: item name, then indented prices per store
      lines.push(`${qty}${item.genericName}`);
      if (prices.length === 0) {
        lines.push('  sem preço');
      } else {
        for (const p of prices) {
          const storeLabel = STORES[p.store]?.label ?? p.store;
          const priceStr = `R$ ${p.price.toFixed(2).replace('.', ',')}`;
          const tag = p.source === 'pinned' ? ' ✓' : '';
          lines.push(`  ${storeLabel}: ${priceStr}${tag}`);
        }
      }
    }
  }

  const total = resolvedItems.reduce((sum, { item, prices }) => {
    const price = prices.find(p => p.source === 'pinned')?.price ?? item.pinnedPrice ?? 0;
    return sum + item.quantity * price;
  }, 0);

  lines.push('');
  lines.push(`Total: R$ ${total.toFixed(2).replace('.', ',')}`);

  if (options.fillStrategy !== 'none') {
    const filledCount = resolvedItems.filter(
      r => r.prices.some(p => p.source === 'filled')
    ).length;
    if (filledCount > 0) {
      lines.push(`(${filledCount} ${filledCount === 1 ? 'item' : 'itens'} com preço estimado)`);
    }
  }

  return lines.join('\n');
}