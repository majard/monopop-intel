'use client';

import { useState, useEffect, useCallback, useRef, useContext, createContext, ReactNode } from 'react';
import type { ShoppingListItem, ShoppingList } from '@/types/models';

export type { ShoppingListItem, ShoppingList };

const STORAGE_KEY = 'mintel-shopping-lists';

// ─── Context ──────────────────────────────────────────────────────────────────

type ShoppingListsContextValue = ReturnType<typeof useShoppingListsInternal>;

export const ShoppingListsContext = createContext<ShoppingListsContextValue | null>(null);

export function ShoppingListsProvider({ children }: { children: ReactNode }) {
  const value = useShoppingListsInternal();
  return (
    <ShoppingListsContext.Provider value= { value } >
    { children }
    </ShoppingListsContext.Provider>
  );
}

export function useShoppingLists() {
  const ctx = useContext(ShoppingListsContext);
  if (!ctx) throw new Error('useShoppingLists must be used within ShoppingListsProvider');
  return ctx;
}

// ─── Internal implementation ──────────────────────────────────────────────────

function useShoppingListsInternal() {
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const isInitialized = useRef(false);
  const [isReady, setIsReady] = useState(false);
  const lastAddedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setLists(JSON.parse(saved));
      } else {
        const defaultList: ShoppingList = {
          id: `list-${Date.now()}`,
          name: 'Lista de Compras',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: [],
        };
        setLists([defaultList]);
        localStorage.setItem(STORAGE_KEY, JSON.stringify([defaultList]));
      }
    } catch (error) {
      console.error('Failed to load shopping lists', error);
    } finally {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    if (!isReady) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
    } catch (error) {
      console.error('Failed to save shopping lists', error);
    }
  }, [lists, isReady]);

  const createList = useCallback((name = 'Nova Lista'): string => {
    const newList: ShoppingList = {
      id: `list-${Date.now()}`,
      name: name.trim() || 'Nova Lista',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [],
    };
    setLists(prev => [...prev, newList]);
    return newList.id;
  }, []);

  const renameList = useCallback((listId: string, newName: string) => {
    setLists(prev =>
      prev.map(l =>
        l.id === listId
          ? { ...l, name: newName.trim() || l.name, updatedAt: new Date().toISOString() }
          : l
      )
    );
  }, []);

  const deleteList = useCallback((listId: string) => {
    setLists(prev => prev.filter(l => l.id !== listId));
  }, []);

  const addItem = useCallback((listId: string, item: Omit<ShoppingListItem, 'id'>): string => {
    let resultId: string | null = null;
    
    setLists(prev => {
      const targetList = prev.find(l => l.id === listId);
      if (!targetList) return prev;
      
      const existing = targetList.items.find(
        i => i.genericName.toLowerCase() === item.genericName.toLowerCase()
      );
      
      if (existing) {
        resultId = existing.id;
        return prev; // No change needed
      }
      
      // Create new item
      const newItem: ShoppingListItem = {
        ...item,
        id: `item-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
        quantity: item.quantity || 1,
      };
      
      resultId = newItem.id;
      
      // Update the list with the new item
      return prev.map(l =>
        l.id === listId
          ? { ...l, items: [...l.items, newItem], updatedAt: new Date().toISOString() }
          : l
      );
    });
    
    // Store the result in ref for synchronous access
    lastAddedIdRef.current = resultId;
    return resultId!;
  }, []);

  const pinVariantToItem = useCallback((
    listId: string,
    itemId: string,
    productId: number,
    preferredUnit?: string,
    preferredStdSize?: number,
    pinnedPrice?: number,
    pinnedStore?: string
  ) => {
    setLists(prev =>
      prev.map(l =>
        l.id === listId
          ? {
            ...l,
            items: l.items.map(item =>
              item.id === itemId
                ? { ...item, productId, preferredUnit, preferredStdSize, pinnedPrice, pinnedStore }
                : item
            ),
            updatedAt: new Date().toISOString(),
          }
          : l
      )
    );
  }, []);

  const unpinItem = useCallback((listId: string, itemId: string) => {
    setLists(prev =>
      prev.map(l =>
        l.id === listId
          ? {
            ...l,
            items: l.items.map(item =>
              item.id === itemId
                ? {
                  ...item,
                  productId: undefined,
                  pinnedPrice: undefined,
                  pinnedStore: undefined,
                  preferredUnit: undefined,
                  preferredStdSize: undefined,
                }
                : item
            ),
            updatedAt: new Date().toISOString(),
          }
          : l
      )
    );
  }, []);

  const updateItem = useCallback((listId: string, itemId: string, updates: Partial<ShoppingListItem>) => {
    setLists(prev =>
      prev.map(l =>
        l.id === listId
          ? {
            ...l,
            items: l.items.map(item =>
              item.id === itemId ? { ...item, ...updates } : item
            ),
            updatedAt: new Date().toISOString(),
          }
          : l
      )
    );
  }, []);

  const removeItem = useCallback((listId: string, itemId: string) => {
    setLists(prev =>
      prev.map(l =>
        l.id === listId
          ? {
            ...l,
            items: l.items.filter(item => item.id !== itemId),
            updatedAt: new Date().toISOString(),
          }
          : l
      )
    );
  }, []);

  const getListById = useCallback((listId: string) => {
    return lists.find(l => l.id === listId);
  }, [lists]);

  const getActiveList = useCallback(() => lists[0] ?? null, [lists]);

  return {
    lists,
    isReady,
    isInitialized,
    createList,
    renameList,
    deleteList,
    addItem,
    updateItem,
    removeItem,
    pinVariantToItem,
    unpinItem,
    getListById,
    getActiveList,
  };
}