'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useShoppingLists, ShoppingList, ShoppingListItem } from '../../../hooks/useShoppingLists';
import { buildShoppingListExport } from '../../../utils/shoppingListExport';

export default function ShoppingListDetailPage() {
  const params = useParams();
  const router = useRouter();
  const listId = params.listId as string;

  const {
    lists,
    renameList,
    deleteList,
    addItem,
    updateItem,
    removeItem,
  } = useShoppingLists();

  const list = lists.find(l => l.id === listId);

  const [newItemName, setNewItemName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  if (!list) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 font-mono p-6">
        <div className="max-w-2xl mx-auto text-center py-20">
          <p className="text-xl text-zinc-400">Lista não encontrada.</p>
          <button
            onClick={() => router.push('/shopping-lists')}
            className="mt-6 text-emerald-400 hover:text-emerald-300 underline"
          >
            Voltar para Listas de Compras
          </button>
        </div>
      </main>
    );
  }

  const handleAddItem = () => {
    if (!newItemName.trim()) return;

    addItem(listId, {
      genericName: newItemName.trim(),
      quantity: 1,
    });

    setNewItemName('');
    setIsAdding(false);
  };

  const handleExport = () => {
    const { jsonString, fileName } = buildShoppingListExport(list);
    
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRename = () => {
    const newName = prompt('Novo nome da lista:', list.name);
    if (newName && newName.trim() !== list.name) {
      renameList(listId, newName.trim());
    }
  };

  const handleDelete = () => {
    if (confirm(`Excluir a lista "${list.name}"?`)) {
      deleteList(listId);
      router.push('/shopping-lists');
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 font-mono p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/shopping-lists')}
              className="text-zinc-400 hover:text-zinc-200"
            >
              ←
            </button>
            <div>
              <h1 
                onClick={handleRename}
                className="text-2xl font-bold text-white cursor-pointer hover:text-emerald-400 transition-colors"
              >
                {list.name}
              </h1>
              <p className="text-zinc-500 text-sm">
                {list.items.length} item{list.items.length !== 1 ? 's' : ''} • 
                atualizado {new Date(list.updatedAt).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-black px-5 py-2 rounded-lg font-medium transition-colors"
            >
              Exportar para Monopop
            </button>
            <button
              onClick={handleDelete}
              className="text-red-400 hover:text-red-500 px-3 py-2"
            >
              Excluir
            </button>
          </div>
        </div>

        {/* Add new item */}
        <div className="mb-8">
          {isAdding ? (
            <div className="flex gap-3">
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Nome do item (ex: arroz, feijão...)"
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddItem();
                  if (e.key === 'Escape') {
                    setNewItemName('');
                    setIsAdding(false);
                  }
                }}
                autoFocus
              />
              <button
                onClick={handleAddItem}
                className="bg-emerald-600 hover:bg-emerald-500 text-black px-6 rounded-lg font-medium"
              >
                Adicionar
              </button>
              <button
                onClick={() => {
                  setNewItemName('');
                  setIsAdding(false);
                }}
                className="text-zinc-400 hover:text-zinc-200 px-4"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="w-full py-4 border border-dashed border-zinc-700 hover:border-emerald-500 rounded-xl text-zinc-400 hover:text-emerald-400 transition-colors flex items-center justify-center gap-2"
            >
              + Adicionar item manualmente
            </button>
          )}
        </div>

        {/* Items list */}
        {list.items.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
            <p className="text-zinc-400">Esta lista ainda está vazia.</p>
            <p className="text-sm text-zinc-500 mt-2">Adicione itens acima ou venha das páginas de genéricos.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {list.items.map((item: ShoppingListItem) => (
              <div
                key={item.id}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex items-center gap-4 group"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white">{item.genericName}</div>
                  {item.notes && (
                    <div className="text-xs text-zinc-500 mt-1">{item.notes}</div>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateItem(listId, item.id, { quantity: parseInt(e.target.value) || 1 })}
                    className="w-16 bg-zinc-800 border border-zinc-700 rounded px-3 py-1 text-center text-sm focus:outline-none focus:border-emerald-500"
                    min="1"
                  />

                  <button
                    onClick={() => removeItem(listId, item.id)}
                    className="opacity-40 hover:opacity-100 text-red-400 transition-opacity px-2 py-1"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}