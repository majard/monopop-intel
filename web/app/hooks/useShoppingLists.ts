// web/hooks/useShoppingLists.ts
import { useState, useEffect, useCallback } from 'react';

export interface ShoppingListItem {
  id: string;
  genericName: string;           // required - primary matching key
  productId?: number;            // optional pinning to specific intel product
  quantity: number;              // defaults to 1
  preferredUnit?: string;        // 'g' | 'ml' | 'un' etc.
  preferredStdSize?: number;     // atomic value (e.g. 1000 for 1kg)
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

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setLists(JSON.parse(saved));
      } else {
        // Create one default empty list on first visit
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
  }, []);

  // Persist to localStorage whenever lists change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
    } catch (e) {
      console.error('Failed to save shopping lists to localStorage', e);
    }
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
    const newItem: ShoppingListItem = {
      ...item,
      id: `item-${Date.now()}`,
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