'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ShoppingListItem, ShoppingList } from '@/types/models';

export type { ShoppingListItem, ShoppingList };

const STORAGE_KEY = 'mintel-shopping-lists';

export function useShoppingLists() {
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const isInitialized = useRef(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (isInitialized.current) return;

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
      console.error('Failed to load shopping lists from localStorage', error);
    } finally {
      isInitialized.current = true;
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    if (!isInitialized.current || lists.length === 0) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
    } catch (error) {
      console.error('Failed to save shopping lists to localStorage', error);
    }
  }, [lists]);

  const createList = useCallback((name = 'Nova Lista'): string => {
    const newList: ShoppingList = {
      id: `list-${Date.now()}`,
      name: name.trim() || `Lista ${lists.length + 1}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [],
    };
    setLists(prev => [...prev, newList]);
    return newList.id;
  }, [lists.length]);

  const renameList = useCallback((listId: string, newName: string) => {
    setLists(prev =>
      prev.map(list =>
        list.id === listId
          ? { ...list, name: newName.trim() || list.name, updatedAt: new Date().toISOString() }
          : list
      )
    );
  }, []);

  const deleteList = useCallback((listId: string) => {
    setLists(prev => prev.filter(list => list.id !== listId));
  }, []);

  const addItem = useCallback((listId: string, item: Omit<ShoppingListItem, 'id'>) => {
    const newItem: ShoppingListItem = {
      ...item,
      id: `item-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
      quantity: item.quantity || 1,
    };
    setLists(prev =>
      prev.map(list =>
        list.id === listId
          ? { ...list, items: [...list.items, newItem], updatedAt: new Date().toISOString() }
          : list
      )
    );
    return newItem.id;
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
      prev.map(list =>
        list.id === listId
          ? {
            ...list,
            items: list.items.map(item =>
              item.id === itemId
                ? { ...item, productId, preferredUnit, preferredStdSize, pinnedPrice, pinnedStore }
                : item
            ),
            updatedAt: new Date().toISOString(),
          }
          : list
      )
    );
  }, []);

  const unpinItem = useCallback((listId: string, itemId: string) => {
    setLists(prev =>
      prev.map(list =>
        list.id === listId
          ? {
            ...list,
            items: list.items.map(item =>
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
          : list
      )
    );
  }, []);

  const updateItem = useCallback((listId: string, itemId: string, updates: Partial<ShoppingListItem>) => {
    setLists(prev =>
      prev.map(list =>
        list.id === listId
          ? {
            ...list,
            items: list.items.map(item =>
              item.id === itemId ? { ...item, ...updates } : item
            ),
            updatedAt: new Date().toISOString(),
          }
          : list
      )
    );
  }, []);

  const removeItem = useCallback((listId: string, itemId: string) => {
    setLists(prev =>
      prev.map(list =>
        list.id === listId
          ? {
            ...list,
            items: list.items.filter(item => item.id !== itemId),
            updatedAt: new Date().toISOString(),
          }
          : list
      )
    );
  }, []);

  const getListById = useCallback((listId: string) => {
    return lists.find(list => list.id === listId);
  }, [lists]);

  const getActiveList = useCallback(() => lists[0] ?? null, [lists]);

  return {
    lists,
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
    isInitialized,
    isReady,
  };
}