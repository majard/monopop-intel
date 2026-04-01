'use client';

import React, {
    createContext,
    useContext,
    useMemo,
    useCallback,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useShoppingLists, ShoppingListItem } from '@/hooks/useShoppingLists';
import { GenericResponse, GenericProduct, Group } from '@/types/models';

// ─── Shape ──────────────────────────────────────────────────────────────────

interface ShoppingListDetailContextValue {
    listId: string;
    availableGenerics: string[];
    // URL state (server-driven)
    generic: string;
    productId?: number;
    currentGroup: string;
    currentSort: string;
    currentStore: string;
    // Server-fetched data
    data: GenericResponse | null;
    mainProduct?: GenericProduct;
    isMainProductGlobalBest: boolean;
    minPricePerUnit: number | null;
    // Derived list state
    list: ReturnType<typeof useShoppingLists>['lists'][0] | undefined;
    currentOpenItem: ShoppingListItem | undefined;
    // Actions
    openItem: (genericName: string, productId?: number) => void;
    closeItem: () => void;
    pinVariant: (
        productId: number,
        unit?: string,
        stdSize?: number,
        price?: number,
        store?: string
    ) => void;
    unpinItem: (itemId: string) => void;
    updateItem: ReturnType<typeof useShoppingLists>['updateItem'];
    removeItem: ReturnType<typeof useShoppingLists>['removeItem'];
    addItem: ReturnType<typeof useShoppingLists>['addItem'];
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
    data: GenericResponse | null;
    mainProduct?: GenericProduct;
    isMainProductGlobalBest: boolean;
    minPricePerUnit: number | null;
    currentStore: string;
    currentGroup: string;
    currentSort: string;
    generic: string;
    productId?: number;
    children: React.ReactNode;
}

export function ShoppingListDetailProvider({
    listId,
    availableGenerics,
    data,
    mainProduct,
    isMainProductGlobalBest,
    minPricePerUnit,
    currentStore,
    currentGroup,
    currentSort,
    generic,
    productId,
    children,
}: ProviderProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const {
        lists,
        updateItem,
        removeItem,
        pinVariantToItem,
        unpinItem: unpinItemInList,
        addItem,
    } = useShoppingLists();

    const list = lists.find((l) => l.id === listId);


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
            pinVariantToItem(listId, currentOpenItem.id, variantProductId, unit, stdSize, price, store);

            // Sync URL para refletir o novo productId pinado
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
            mainProduct,
            isMainProductGlobalBest,
            minPricePerUnit,
            list,
            currentOpenItem,
            openItem,
            closeItem,
            pinVariant,
            unpinItem,
            updateItem,
            removeItem,
            addItem,
        }),
        [
            listId,
            availableGenerics,
            generic,
            productId,
            currentGroup,
            currentSort,
            currentStore,
            data,
            mainProduct,
            isMainProductGlobalBest,
            minPricePerUnit,
            list,
            currentOpenItem,
            openItem,
            closeItem,
            pinVariant,
            unpinItem,
            updateItem,
            removeItem,
            addItem,
        ]
    );

    return (
        <ShoppingListDetailContext.Provider value={value}>
            {children}
        </ShoppingListDetailContext.Provider>
    );
}