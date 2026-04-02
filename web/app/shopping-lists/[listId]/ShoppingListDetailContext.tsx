'use client';

import React, {
  createContext,
  useContext,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useShoppingLists, ShoppingListItem } from '@/hooks/useShoppingLists';
import { GenericResponse, GenericProduct } from '@/types/models';
import { normalizeUnit } from '@/utils/normalizeUnit';

const API = process.env.NEXT_PUBLIC_API_URL;

// ─── Shape ───────────────────────────────────────────────────────────────────

interface ShoppingListDetailContextValue {
  listId: string;
  availableGenerics: string[];
  generic: string;
  productId?: number;
  currentGroup: string;
  currentSort: string;
  currentStore: string;
  data: GenericResponse | null;
  isFetchingPanel: boolean;
  mainProduct?: GenericProduct;
  list: ReturnType<typeof useShoppingLists>['lists'][0] | undefined;
  currentOpenItem: ShoppingListItem | undefined;
  isReady: boolean;
  openItem: (genericName: string, productId?: number) => void;
  closeItem: () => void;
  pinVariant: (productId: number, unit?: string, stdSize?: number, price?: number, store?: string) => void;
  unpinItem: (itemId: string) => void;
  updateItem: ReturnType<typeof useShoppingLists>['updateItem'];
  removeItem: ReturnType<typeof useShoppingLists>['removeItem'];
  addItem: ReturnType<typeof useShoppingLists>['addItem'];
  // For the export modal — always fetches without store filter so all stores are present
  fetchGenericForExport: (term: string) => Promise<GenericResponse | null>;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ShoppingListDetailContext =
  createContext<ShoppingListDetailContextValue | null>(null);

export function useShoppingListDetail() {
  const ctx = useContext(ShoppingListDetailContext);
  if (!ctx)
    throw new Error('useShoppingListDetail must be used within ShoppingListDetailProvider');
  return ctx;
}

// ─── Provider ────────────────────────────────────────────────────────────────

interface ProviderProps {
  listId: string;
  availableGenerics: string[];
  // Initial values from SSR — context takes over via useSearchParams after hydration
  initialGeneric: string;
  initialProductId?: number;
  initialGroup: string;
  initialSort: string;
  initialStore: string;
  children: React.ReactNode;
}

export function ShoppingListDetailProvider({
  listId,
  availableGenerics,
  initialGeneric,
  initialProductId,
  initialGroup,
  initialSort,
  initialStore,
  children,
}: ProviderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // useSearchParams is the live source of truth after hydration.
  // Initial* props seed the SSR render; after that, URL changes are reactive.
  const generic = searchParams.get('generic') ?? initialGeneric;
  const productId = searchParams.get('productId')
    ? parseInt(searchParams.get('productId')!, 10)
    : initialProductId;
  const currentGroup = searchParams.get('group') ?? initialGroup;
  const currentSort = searchParams.get('sort_by') ?? initialSort;
  const currentStore = searchParams.get('store') ?? initialStore;

  const {
    lists,
    updateItem,
    removeItem,
    pinVariantToItem,
    unpinItem: unpinItemInList,
    addItem,
    isReady,
  } = useShoppingLists();

  const list = lists.find(shoppingList => shoppingList.id === listId);

  // ─── Generic data fetching with in-memory cache ───────────────────────────

  const genericCache = useRef<Map<string, GenericResponse>>(new Map());
  const [data, setData] = useState<GenericResponse | null>(null);
  const [isFetchingPanel, setIsFetchingPanel] = useState(false);

  const fetchGeneric = useCallback(async (
    term: string,
    group: string,
    sort: string,
    store: string
  ): Promise<GenericResponse | null> => {
    const cacheKey = `${term}::${group}::${sort}::${store}`;
    if (genericCache.current.has(cacheKey)) return genericCache.current.get(cacheKey)!;

    const queryParams = new URLSearchParams({ group, sort_by: sort });
    if (store) queryParams.set('store', store);

    try {
      const response = await fetch(`${API}/generics/${encodeURIComponent(term)}?${queryParams}`);
      if (!response.ok) return null;
      const json: GenericResponse = await response.json();
      genericCache.current.set(cacheKey, json);
      return json;
    } catch {
      return null;
    }
  }, []);

  // Prefetch all list items once the list is available — makes panel opening instant
  useEffect(() => {
    if (!list) return;
    list.items.forEach(item => {
      fetchGeneric(item.genericName, currentGroup, currentSort, currentStore);
    });
  }, [list?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch the open generic whenever URL params change
  useEffect(() => {
    if (!generic) { setData(null); return; }

    // Check cache synchronously first — no flash if already cached
    const cacheKey = `${generic}::${currentGroup}::${currentSort}::${currentStore}`;
    if (genericCache.current.has(cacheKey)) {
      setData(genericCache.current.get(cacheKey)!);
      setIsFetchingPanel(false);
      return;
    }

    // Only show loading if we have nothing to display
    setIsFetchingPanel(true);
    fetchGeneric(generic, currentGroup, currentSort, currentStore).then(result => {
      setData(result);
      setIsFetchingPanel(false);
    });
  }, [generic, currentGroup, currentSort, currentStore, fetchGeneric]);

  // Export fetch always uses no store filter so all stores are present in one response
  const fetchGenericForExport = useCallback(
    (term: string) => fetchGeneric(term, 'brand_size', 'price', ''),
    [fetchGeneric]
  );

  // ─── Derived state ────────────────────────────────────────────────────────

  const currentOpenItem = useMemo(() => {
    if (!list || !generic) return undefined;
    return list.items.find(item => item.genericName === generic);
  }, [list, generic]);

  const allProducts: GenericProduct[] = data?.groups
    ? data.groups.flatMap(group => group.variants)
    : data?.products ?? [];

  const mainProduct = allProducts.find(product => product.product_id === productId);

  // ─── Actions ─────────────────────────────────────────────────────────────

  const openItem = useCallback(
    (genericName: string, pinnedProductId?: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('generic', genericName);
      if (pinnedProductId !== undefined) {
        params.set('productId', pinnedProductId.toString());
      } else {
        params.delete('productId');
      }
      router.replace(`/shopping-lists/${listId}?${params.toString()}`, { scroll: false });
    },
    [searchParams, listId, router]
  );

  const closeItem = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('generic');
    params.delete('productId');
    router.replace(`/shopping-lists/${listId}?${params.toString()}`, { scroll: false });
  }, [searchParams, listId, router]);

  const pinVariant = useCallback(
    (variantProductId: number, unit?: string, stdSize?: number, price?: number, store?: string) => {
      if (!currentOpenItem) return;

      const normalized = unit && stdSize ? normalizeUnit(stdSize, unit) : null;

      pinVariantToItem(
        listId,
        currentOpenItem.id,
        variantProductId,
        normalized?.unit ?? unit,
        normalized?.size ?? stdSize,
        price,
        store
      );

      const params = new URLSearchParams(searchParams.toString());
      params.set('productId', variantProductId.toString());
      router.replace(`/shopping-lists/${listId}?${params.toString()}`, { scroll: false });
    },
    [currentOpenItem, listId, pinVariantToItem, searchParams, router]
  );

  const unpinItem = useCallback(
    (itemId: string) => unpinItemInList(listId, itemId),
    [listId, unpinItemInList]
  );

  // ─── Context value ────────────────────────────────────────────────────────

  const value = useMemo<ShoppingListDetailContextValue>(
    () => ({
      listId,
      availableGenerics,
      generic,
      productId,
      currentGroup,
      currentSort,
      currentStore,
      data,
      isFetchingPanel,
      mainProduct,
      list,
      currentOpenItem,
      isReady,
      openItem,
      closeItem,
      pinVariant,
      unpinItem,
      updateItem,
      removeItem,
      addItem,
      fetchGenericForExport,
    }),
    [
      listId, availableGenerics, generic, productId,
      currentGroup, currentSort, currentStore,
      data, isFetchingPanel, mainProduct, list, currentOpenItem,
      isReady, openItem, closeItem, pinVariant, unpinItem,
      updateItem, removeItem, addItem, fetchGenericForExport,
    ]
  );

  return (
    <ShoppingListDetailContext.Provider value={value}>
      {children}
    </ShoppingListDetailContext.Provider>
  );
}