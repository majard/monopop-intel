// web/hooks/useShoppingLists.ts
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface ShoppingListItem {
  id: string;
  genericName: string;
  productId?: number;
  quantity: number;
  preferredUnit?: string;
  preferredStdSize?: number;
  notes?: string;
}

export interface ShoppingList {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  items: ShoppingListItem[];
}

const STORAGE_KEY = 'mintel-shopping-lists';

export function useShoppingLists() {
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const isInitialized = useRef(false);
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);

  // Load from localStorage - runs reliably on every mount
  useEffect(() => {
    if (isInitialized.current) return;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setLists(parsed);
      } else {
        // Only create default list if truly empty
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
    } catch (e) {
      console.error('Failed to load shopping lists from localStorage', e);
    }

    isInitialized.current = true;
  }, []);

  // Save to localStorage with debounce to prevent race conditions during navigation
  useEffect(() => {
    if (!isInitialized.current || lists.length === 0) return;

    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
    }

    saveTimeout.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
      } catch (e) {
        console.error('Failed to save shopping lists to localStorage', e);
      }
    }, 50); // small debounce

    return () => {
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
      }
    };
  }, [lists]);

  const createList = useCallback((name: string = 'Nova Lista') => {
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
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000); // 6-digit random suffix

    const newItem: ShoppingListItem = {
      ...item,
      id: `item-${timestamp}-${random}`,
      quantity: item.quantity || 1,
    };

    setLists(prev =>
      prev.map(list =>
        list.id === listId
          ? {
            ...list,
            items: [...list.items, newItem],
            updatedAt: new Date().toISOString(),
          }
          : list
      )
    );

    return newItem.id;
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
            items: list.items.filter(item => item.id !== itemId),   // strict !== 
            updatedAt: new Date().toISOString(),
          }
          : list
      )
    );
  }, []);

  const getListById = useCallback((listId: string) => {
    return lists.find(list => list.id === listId);
  }, [lists]);

  const getActiveList = useCallback(() => {
    return lists[0] || null;
  }, [lists]);

  return {
    lists,
    createList,
    renameList,
    deleteList,
    addItem,
    updateItem,
    removeItem,
    getListById,
    getActiveList,
  };
}