'use client';

import React, {
    createContext,
    useContext,
    useMemo,
    useCallback,
    useEffect,
    useRef,
    useState
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useShoppingLists, ShoppingListItem } from '@/hooks/useShoppingLists';
import { GenericResponse, GenericProduct, Group } from '@/types/models';
import { normalizeUnit } from '@/utils/normalizeUnit';


const API = process.env.NEXT_PUBLIC_API_URL;

// ─── Shape ──────────────────────────────────────────────────────────────────

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
    openItem: (genericName: string, productId?: number) => void;
    closeItem: () => void;
    pinVariant: (productId: number, unit?: string, stdSize?: number, price?: number, store?: string) => void;
    unpinItem: (itemId: string) => void;
    updateItem: ReturnType<typeof useShoppingLists>['updateItem'];
    removeItem: ReturnType<typeof useShoppingLists>['removeItem'];
    addItem: ReturnType<typeof useShoppingLists>['addItem'];
    isReady: boolean;
}
// ─── Context ─────────────────────────────────────────────────────────────────

const ShoppingListDetailContext =
    createContext<ShoppingListDetailContextValue | null>(null);

export function useShoppingListDetail() {
    const ctx = useContext(ShoppingListDetailContext);
    if (!ctx)
        throw new Error(
            'useShoppingListDetail must be used within ShoppingListDetailProvider'
        );
    return ctx;
}

// ─── Provider ────────────────────────────────────────────────────────────────

interface ProviderProps {
    listId: string;
    availableGenerics: string[];
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
    // URL params are the source of truth for panel state — initial values
    // come from the server component (SSR), then the client takes over via router
    const generic = initialGeneric;
    const productId = initialProductId;
    const currentGroup = initialGroup;
    const currentSort = initialSort;
    const currentStore = initialStore;
    const router = useRouter();
    const searchParams = useSearchParams();

    const {
        lists,
        updateItem,
        removeItem,
        pinVariantToItem,
        unpinItem: unpinItemInList,
        addItem,
        isReady,
    } = useShoppingLists();

    const list = lists.find((l) => l.id === listId);


    const genericCache = useRef<Map<string, GenericResponse>>(new Map());
    const [data, setData] = useState<GenericResponse | null>(null);
    const [isFetchingPanel, setIsFetchingPanel] = useState(false);

    const fetchGeneric = useCallback(async (
        term: string,
        group: string,
        sort: string,
        store: string
    ): Promise<GenericResponse | null> => {
        const key = `${term}::${group}::${sort}::${store}`;
        if (genericCache.current.has(key)) return genericCache.current.get(key)!;

        const params = new URLSearchParams({ group, sort_by: sort });
        if (store) params.set('store', store);

        try {
            const res = await fetch(
                `${API}/generics/${encodeURIComponent(term)}?${params}`
            );
            if (!res.ok) return null;
            const json: GenericResponse = await res.json();
            genericCache.current.set(key, json);
            return json;
        } catch {
            return null;
        }
    }, []);

    // prefetch all list items once list is ready
    useEffect(() => {
        if (!list) return;
        list.items.forEach(item => {
            fetchGeneric(item.genericName, currentGroup, currentSort, currentStore);
        });
    }, [list?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // fetch when URL params change
    useEffect(() => {
        if (!generic) {
            setData(null);
            return;
        }
        setIsFetchingPanel(true);
        fetchGeneric(generic, currentGroup, currentSort, currentStore).then(result => {
            setData(result);
            setIsFetchingPanel(false);
        });
    }, [generic, currentGroup, currentSort, currentStore, fetchGeneric]);

    const currentOpenItem = useMemo(() => {
        if (!list || !generic) return undefined;
        return list.items.find((item) => item.genericName === generic);
    }, [list, generic]);


    const openItem = useCallback(
        (genericName: string, pinnedProductId?: number) => {
            const params = new URLSearchParams(searchParams.toString());
            params.set('generic', genericName);
            if (pinnedProductId !== undefined) {
                params.set('productId', pinnedProductId.toString());
            } else {
                params.delete('productId');
            }
            // Preserve current filter state from URL (not from props,
            // because the user may have changed them via panel Links)
            router.replace(`/shopping-lists/${listId}?${params.toString()}`, {
                scroll: false,
            });
        },
        [searchParams, listId, router]
    );

    const closeItem = useCallback(() => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('generic');
        params.delete('productId');
        router.replace(`/shopping-lists/${listId}?${params.toString()}`, {
            scroll: false,
        });
    }, [searchParams, listId, router]);

    const pinVariant = useCallback(
        (
            variantProductId: number,
            unit?: string,
            stdSize?: number,
            price?: number,
            store?: string
        ) => {
            if (!currentOpenItem) return;
            const normalized = unit && stdSize
                ? normalizeUnit(stdSize, unit)
                : null;

            pinVariantToItem(
                listId,
                currentOpenItem.id,
                variantProductId,
                normalized?.unit ?? unit,
                normalized?.size ?? stdSize,
                price,
                store
            );
            
            // Sync the URL to reflect the new pinned product ID
            const params = new URLSearchParams(searchParams.toString());
            params.set('productId', variantProductId.toString());
            router.replace(`/shopping-lists/${listId}?${params.toString()}`, { scroll: false });
        },
        [currentOpenItem, listId, pinVariantToItem, searchParams, router]
    );

    const unpinItem = useCallback(
        (itemId: string) => {
            unpinItemInList(listId, itemId);
        },
        [listId, unpinItemInList]
    );

    const allProducts = data?.groups
        ? data.groups.flatMap(g => g.variants)
        : data?.products || [];

    const mainProduct = allProducts.find(p => p.product_id === productId);

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
            openItem,
            closeItem,
            pinVariant,
            unpinItem,
            updateItem,
            removeItem,
            addItem,
            isReady,
        }),
        [
            listId, availableGenerics, generic, productId,
            currentGroup, currentSort, currentStore,
            data, isFetchingPanel, mainProduct, list, currentOpenItem,
            openItem, closeItem, pinVariant, unpinItem,
            updateItem, removeItem, addItem, isReady,
        ]
    );

    return (
        <ShoppingListDetailContext.Provider value={value}>
            {children}
        </ShoppingListDetailContext.Provider>
    );
}