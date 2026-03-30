'use client';

import Link from 'next/link';
import { useShoppingLists, ShoppingList } from '../../hooks/useShoppingLists';
import { buildShoppingListExport } from '../../utils/shoppingListExport';

export default function ShoppingListsPage() {
    const {
        lists,
        createList,
        renameList,
        deleteList,
    } = useShoppingLists();

    const handleExport = async (list: ShoppingList) => {
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

    const handleRename = (list: ShoppingList) => {
        const newName = prompt('Novo nome da lista:', list.name);
        if (newName && newName.trim() !== list.name) {
            renameList(list.id, newName.trim());
        }
    };

    const handleDelete = (list: ShoppingList) => {
        if (confirm(`Excluir a lista "${list.name}"?`)) {
            deleteList(list.id);
        }
    };

    return (
        <main className="min-h-screen bg-zinc-950 text-zinc-100 font-mono p-6">
            <div className="max-w-3xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Listas de Compras</h1>
                        <p className="text-zinc-500 text-sm mt-1">
                            {lists.length} lista{lists.length !== 1 ? 's' : ''} • exportáveis para o Monopop
                        </p>
                    </div>

                    <button
                        onClick={() => createList()}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-black font-medium px-5 py-2.5 rounded-lg transition-colors"
                    >
                        + Nova lista
                    </button>
                </div>

                {lists.length === 0 ? (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
                        <p className="text-zinc-400">Nenhuma lista ainda.</p>
                        <button
                            onClick={() => createList()}
                            className="mt-6 text-emerald-400 hover:text-emerald-300 underline"
                        >
                            Criar primeira lista
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {lists.map((list) => (
                            <div
                                key={list.id}
                                className="bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 rounded-xl p-6 transition-colors group"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                        <Link
                                            href={`/shopping-lists/${list.id}`}
                                            className="block group-hover:text-emerald-400 transition-colors"
                                        >
                                            <h2 className="text-lg font-medium text-white truncate">
                                                {list.name}
                                            </h2>
                                        </Link>
                                        <p className="text-zinc-500 text-sm mt-1">
                                            {list.items.length} item{list.items.length !== 1 ? 's' : ''} •
                                            atualizado {new Date(list.updatedAt).toLocaleDateString('pt-BR')}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2 opacity-70 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleExport(list)}
                                            className="p-2 hover:text-emerald-400 transition-colors"
                                            title="Exportar para Monopop"
                                        >
                                            ↓
                                        </button>
                                        <button
                                            onClick={() => handleRename(list)}
                                            className="p-2 hover:text-zinc-300 transition-colors"
                                        >
                                            ✎
                                        </button>
                                        <button
                                            onClick={() => handleDelete(list)}
                                            className="p-2 hover:text-red-400 transition-colors"
                                        >
                                            🗑
                                        </button>
                                    </div>
                                </div>

                                {list.items.length > 0 && (
                                    <div className="mt-4 text-xs text-zinc-500 line-clamp-2">
                                        {list.items.slice(0, 3).map(i => i.genericName).join(', ')}
                                        {list.items.length > 3 && ' ...'}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}