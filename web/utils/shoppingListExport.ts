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
    product_store_prices: Array<{
      productId: number;
      storeId: number;
      price: number | null;
      updatedAt: string;
      packageSize: number | null;
    }>;
    product_base_prices: Array<{
      productId: number;
      price: number | null;
      updatedAt: string;
      packageSize: number | null;
    }>;
  };
}

/**
 * Converts a ShoppingList into a Monopop-compatible ListExportData JSON.
 * Matches the shape of a working export from Monopop ("Casa Express").
 * Uses pinnedPrice when available for product_store_prices.
 * Stores prefixed with [mintel] per spec.
 */
export function buildShoppingListExport(list: ShoppingList): {
  jsonString: string;
  fileName: string;
} {
  const now = new Date().toISOString();
  const safeName = list.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();

  // Minimal categories (Monopop tolerates one "Geral")
  const categories = [
    {
      id: 1,
      name: 'Geral',
      createdAt: now,
      updatedAt: now,
    },
  ];

  // Mintel-prefixed stores (avoid collision with user stores)
  const stores = [
    { id: 101, name: '[mintel]prezunic', createdAt: now },
    { id: 102, name: '[mintel]zonasul', createdAt: now },
    { id: 103, name: '[mintel]hortifruti', createdAt: now },
  ];

  // Products — one per unique genericName
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
    listId: 999, // synthetic
    productId: 1000 + index,
    quantity: item.quantity,
    sortOrder: index,
    notes: item.notes ?? null,
    createdAt: now,
    updatedAt: now,
  }));

  // Shopping list items
  const shoppingListItems = list.items.map((item, index) => ({
    id: 3000 + index,
    inventoryItemId: 2000 + index,
    quantity: item.quantity,
    checked: 0,
    price: item.pinnedPrice ?? null,
    sortOrder: index,
    notes: item.notes ?? null,
    createdAt: now,
    updatedAt: now,
    packageSize: item.preferredStdSize ?? null,
  }));

  // Minimal product_store_prices using pinnedPrice when available
  const productStorePrices = list.items
    .map((item, index) => {
      if (!item.pinnedPrice) return null;
      return {
        productId: 1000 + index,
        storeId: 101, // default to prezunic for mintel items
        price: item.pinnedPrice,
        updatedAt: now,
        packageSize: item.preferredStdSize ?? null,
      };
    })
    .filter(Boolean) as any[];

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
      product_store_prices: productStorePrices,
      product_base_prices: empty, // base prices optional for mintel export
    },
  };

  const jsonString = JSON.stringify(exportData, null, 2);
  const timestamp = now.slice(0, 16).replace(/[:T]/g, '').replace(/-/g, '');
  const fileName = `monopop-lista-${safeName}-${timestamp}.json`;

  return { jsonString, fileName };
}