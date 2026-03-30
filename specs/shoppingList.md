### monopop-intel — Shopping Lists / Listas de Compras — Feature Spec (v1 MVP)
**Master document.** Update only on explicit decision.  
**Last updated:** 2026-03-30  
**Branch:** `feature/shopping-lists`

#### 1. Goal
Add a **session-based** "Listas de Compras" feature that lets users build shopping lists from the clean generics data and export them in the exact `ListExportData` format that Monopop already knows how to import.

The flow must feel familiar to existing Monopop users (paste → fuzzy match → confirmation → summary) while leveraging the rich intel data (generics, package_size, unit, price_per_unit, brands, cross-store variants).

#### 2. Core Constraints (non-negotiable for v1)
- **Session-based only**: All state in React + localStorage. No new PostgreSQL tables, no auth, no persistent backend lists.
- **Multiple lists supported**: User can have several named lists ("Semana", "Festa", "Churrasco", etc.).
- **Export must be 100% compatible**: Produce exactly the `ListExportData` shape from the provided JSON samples (`type: "list_export"`, `version: "1.0"`, `listName`, `data` with categories/stores/products/inventory_items/shopping_list_items/etc.). History and invoices can be minimal/empty.
- **Reuse Monopop import patterns**: Paste text → fuzzy match against generics → confirmation modal when uncertain → final summary report.
- **Units alignment**: Use Monopop’s atomic model (g/ml/un). When a generic has `package_size` + `unit`, treat it as `standardPackageSize` + `unit` in the exported product.
- **Stores in export**: Prefix with `[mintel]` (e.g. `[mintel]prezunic`, `[mintel]zonasul`) to avoid collision with user-created stores on their phone.


#### 3. Data Model (Session)
A cesta/list is stored as:
```ts
interface ShoppingList {
  id: string;                    // uuid or timestamp-based
  name: string;                  // "Semana", "Festa", etc.
  createdAt: string;
  updatedAt: string;
  items: ShoppingListItem[];
}

interface ShoppingListItem {
  id: string;                    // local id
  genericName: string;           // required — primary matching key
  productId?: number;            // optional pinning to specific intel product
  quantity: number;              // defaults to 1
  preferredUnit?: string;        // 'g' | 'ml' | 'un' etc.
  preferredStdSize?: number;     // atomic value (e.g. 1000 for 1kg)
  notes?: string;
}
```

- Stored in localStorage under key `mintel-shopping-lists`.
- When exporting, `genericName` becomes the `product.name` in the JSON.
- If `productId` is present, we can enrich with real intel data (name, brand, etc.) for better export.

#### 4. Main Screens & Flows

**4.1 List Picker Screen (`/listas-de-compras`)**
- Shows all saved lists as cards (name + item count + last updated).
- FAB: "Nova lista".
- Each card has:
  - Open
  - Rename
  - Export (generates ListExportData)
  - Delete
- Simple CRUD, no heavy features.

**4.2 Single List Screen (`/listas-de-compras/[listId]`)**
- Header with list name (editable) + export button.
- "Colar lista" button → opens text input modal (reuses Monopop’s paste logic).
- List of items (similar to Monopop ShoppingList but simpler).
- Each item row shows: genericName, quantity, preferred unit/size if set, notes.
- Swipe/edit to change quantity, unit, notes, or pin to specific product.
- "Adicionar manualmente" → search generics or type free text.

**Import on this screen (paste flow — mirrors Monopop):**
- User pastes text.
- System splits lines → parses products + quantities.
- For each line:
  - Exact match on `genericName` → silent add.
  - Fuzzy match (using same similarityUtils) → confirmation modal (like ConfirmationModal).
  - No match → create as new genericName.
- After all items processed → summary report (like ImportSummaryModal).
- Imported items land in the **current** list (not a new one).

**4.3 Adding from Generics pages**
- On `/generics` list or `/generics/[term]` detail:
  - Button "Adicionar à lista de compras" on cards/groups.
  - Adds with quantity = 1.
  - Toast: "Adicionado à Lista de Compras" with "Ver lista" action that navigates to the list picker (or last active list).

#### 5. Export Transformation
When user clicks Export on a list:
- Generate `ListExportData`:
  - `listName`: user’s list name.
  - `categories`: minimal set derived from generics or empty.
  - `stores`: `[mintel]prezunic`, `[mintel]zonasul`, `[mintel]hortifruti` (only those that appear in pinned products).
  - `products`: one entry per unique genericName (or pinned product). Use `unit` + `preferredStdSize` as `standardPackageSize`.
  - `inventory_items`: one per cesta item (quantity, notes).
  - `shopping_list_items`: matching the inventory_items (quantity, price = null for now).
  - `invoices`, `invoice_items`, `inventory_history`: empty arrays.
  - `product_store_prices`, `product_base_prices`: empty or minimal.
- File name: `monopop-lista-[safeName]-[timestamp].json`
- Use existing `shareJsonFile` utility.

#### 6. Technical Decisions
- **Session persistence**: JSON.stringify the array of ShoppingList → localStorage. Load on app start / route mount.
- **Fuzzy matching**: Reuse `calculateSimilarity` from `similarityUtils.ts`. Threshold ~0.55 (same as Monopop).
- **Units**: When exporting, map intel `unit` + `package_size` directly to Monopop’s `unit` + `standardPackageSize`.
- **No new backend endpoints for MVP**: All logic client-side. (We can add a `/export/list` endpoint later if wanted.)
- **Reuse existing components**: ConfirmationModal, ImportSummaryModal, PriceTriangle logic for unit editing, toast patterns.
- **Performance**: Lists are small (< 100 items). No pagination needed.

#### 7. Out of Scope for v1
- Persistent server-side lists.
- Real-time collaboration.
- Price suggestions inside the cesta (can be added later using intel prices).
- Advanced unit editing inside cesta (use Monopop for that after import).
- "Adicionar à cesta" on every generics card (toast + optional navigation is enough).
- Full Monopop → intel roundtrip (importing a monopop list into intel for price lookup).

#### 8. Open Questions (to be decided before implementation)
1. Exact route names: `/listas-de-compras` and `/listas-de-compras/[listId]`?
2. Default first list name when creating new: "Nova Lista" or "Lista de Compras"?
3. When pasting, if no generics match at all, still create the items or show warning?
4. Toast duration and copy: "Adicionado à Lista de Compras" + "Ver" button?
