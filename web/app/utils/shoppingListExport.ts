// web/utils/shoppingListExport.ts
import { ShoppingList, ShoppingListItem } from '../hooks/useShoppingLists';

export interface ListExportData {
  type: 'list_export';
  version: '1.0';
  exportedAt: string;
  listName: string;
  data: {
    categories: Array<{
      id: number;
      name: string;
      createdAt: string;
      updatedAt: string;
    }>;
    stores: Array<{
      id: number;
      name: string;
      createdAt: string;
    }>;
    products: Array<{
      id: number;
      name: string;
      categoryId: number | null;
      createdAt: string;
      updatedAt: string;
      unit: string | null;
      standardPackageSize: number | null;
    }>;
    inventory_items: Array<{
      id: number;
      listId: number;
      productId: number;
      quantity: number;
      sortOrder: number;
      notes: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
    inventory_history: any[];
    shopping_list_items: Array<{
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
    }>;
    invoices: any[];
    invoice_items: any[];
    product_store_prices: any[];
    product_base_prices: any[];
  };
}

/**
 * Converts a ShoppingList into a Monopop-compatible ListExportData JSON.
 * - genericName becomes the product name.
 * - preferredUnit + preferredStdSize are mapped to unit + standardPackageSize.
 * - Stores are prefixed with [mintel] to avoid collisions with user stores.
 * - History and invoices are left minimal/empty (import engine tolerates this).
 */
export function buildShoppingListExport(list: ShoppingList): {
  jsonString: string;
  fileName: string;
} {
  const now = new Date().toISOString();
  const safeName = list.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();

  // Minimal categories
  const categories = [
    {
      id: 1,
      name: 'Geral',
      createdAt: now,
      updatedAt: now,
    },
  ];

  // Mintel-prefixed stores
  const stores = [
    { id: 101, name: '[mintel]prezunic', createdAt: now },
    { id: 102, name: '[mintel]zonasul', createdAt: now },
    { id: 103, name: '[mintel]hortifruti', createdAt: now },
  ];

  // Products (one per item)
  const products = list.items.map((item, index) => ({
    id: 1000 + index,
    name: item.genericName,
    categoryId: 1,
    createdAt: now,
    updatedAt: now,
    unit: item.preferredUnit ?? null,
    standardPackageSize: item.preferredStdSize ?? null,
  }));

  // Inventory items
  const inventoryItems = list.items.map((item, index) => ({
    id: 2000 + index,
    listId: 999, // synthetic for export
    productId: 1000 + index,
    quantity: item.quantity,
    sortOrder: index,
    notes: item.notes ?? null,
    createdAt: now,
    updatedAt: now,
  }));

  // Shopping list items (mirrors inventory for Monopop)
  const shoppingListItems = list.items.map((item, index) => ({
    id: 3000 + index,
    inventoryItemId: 2000 + index,
    quantity: item.quantity,
    checked: 0,
    price: null,
    sortOrder: index,
    notes: item.notes ?? null,
    createdAt: now,
    updatedAt: now,
    packageSize: item.preferredStdSize ?? null,
  }));

  const empty: any[] = [];

  const exportData: ListExportData = {
    type: 'list_export',
    version: '1.0',
    exportedAt: now,
    listName: list.name,
    data: {
      categories,
      stores,
      products,
      inventory_items: inventoryItems,
      inventory_history: empty,
      shopping_list_items: shoppingListItems,
      invoices: empty,
      invoice_items: empty,
      product_store_prices: empty,
      product_base_prices: empty,
    },
  };

  const jsonString = JSON.stringify(exportData, null, 2);
  const timestamp = now.slice(0, 16).replace('T', '-').replace(':', 'h');
  const fileName = `monopop-lista-${safeName}-${timestamp}.json`;

  return { jsonString, fileName };
}