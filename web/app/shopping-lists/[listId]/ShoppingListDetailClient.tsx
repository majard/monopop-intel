// web/app/shopping-lists/[listId]/ShoppingListDetailClient.tsx
'use client';

import React, { useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ProductDetailPanel from '../../../components/ProductDetailPanel';
import ShoppingListPasteModal from '../../../components/ui/ShoppingListPasteModal';
import { useShoppingLists, ShoppingListItem } from '@/hooks/useShoppingLists';
import { GenericResponse, GenericProduct, Group } from '@/types/models';

interface ShoppingListDetailClientProps {
    listId: string;
    availableGenerics: string[];
    data: GenericResponse | null;
    mainProduct?: GenericProduct;
    relatedGroups: Group[];
    relatedProducts: GenericProduct[];
    isMainProductGlobalBest: boolean;
    minPricePerUnit: number | null;
    currentStore: string;
    currentGroup: string;
    currentSort: string;
    generic: string;
    productId?: number;
}

export default function ShoppingListDetailClient({
    listId,
    availableGenerics,
    data,
    mainProduct,
    relatedGroups,
    relatedProducts,
    isMainProductGlobalBest,
    minPricePerUnit,
    currentStore,
    currentGroup,
    currentSort,
    generic,
    productId,
}: ShoppingListDetailClientProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    // ALL HOOKS MUST BE AT THE TOP — BEFORE ANY EARLY RETURN
    const {
        lists,
        updateItem,
        removeItem,
        pinVariantToItem,
        unpinItem,
        addItem,
    } = useShoppingLists();

    const [showPasteModal, setShowPasteModal] = useState(false);

    const list = lists.find((l) => l.id === listId);

    // Safe memo — always runs, even if list is missing
    const currentOpenItem = useMemo(() => {
        if (!list || !generic) return undefined;
        return list.items.find(
            (item) =>
                item.genericName === generic &&
                (productId === undefined || item.productId === productId)
        );
    }, [list, generic, productId]);

    // Early return ONLY after all hooks
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

    const openProductPanel = (genericName: string, pinnedProductId?: number) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('generic', genericName);
        if (pinnedProductId !== undefined) {
            params.set('productId', pinnedProductId.toString());
        } else {
            params.delete('productId');
        }
        if (currentStore) params.set('store', currentStore);
        if (currentGroup) params.set('group', currentGroup);
        if (currentSort) params.set('sort_by', currentSort);

        router.replace(`/shopping-lists/${listId}?${params.toString()}`, { scroll: false });
    };

    const closeProductPanel = () => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('generic');
        params.delete('productId');
        router.replace(`/shopping-lists/${listId}?${params.toString()}`, { scroll: false });
    };

    const handlePin = (variantProductId: number, unit?: string, stdSize?: number, price?: number) => {
        if (!currentOpenItem) return;

        console.log('[pin] values received:', {
            variantProductId,
            unit,
            stdSize,
            price,
            currentOpenItemId: currentOpenItem.id,
        });

        pinVariantToItem(
            listId,
            currentOpenItem.id,
            variantProductId,
            unit,
            stdSize,
            price
        );
    };

    const handleUnpin = (itemId: string) => {
        unpinItem(listId, itemId);
    };

    const handleAddFromPaste = (newItems: Array<{ genericName: string; quantity: number }>) => {
        newItems.forEach(({ genericName, quantity }) => {
            addItem(listId, { genericName, quantity: quantity || 1 });
        });
        setShowPasteModal(false);
    };

    const calculateTotal = () => {
        return list.items.reduce((total, item) => {
            const price = item.pinnedPrice ?? 0;
            return total + item.quantity * price;
        }, 0);
    };

    const handleExport = () => {
        const { jsonString, fileName } = {
            jsonString: JSON.stringify(list, null, 2),
            fileName: `monopop-lista-${list.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.json`,
        };
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

    const isPanelOpen = !!generic && !!data;

    return (
        <main className="min-h-screen bg-zinc-950 text-zinc-100 font-mono p-6">
            <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-6 h-[calc(100vh-3rem)] overflow-hidden">
                {/* Left: Shopping List */}
                <div className="flex-1 flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.push('/shopping-lists')}
                                className="text-zinc-400 hover:text-zinc-200"
                            >
                                ←
                            </button>
                            <div>
                                <h1 className="text-2xl font-bold text-white">{list.name}</h1>
                                <p className="text-zinc-500 text-sm">
                                    {list.items.length} item{list.items.length !== 1 ? 's' : ''} •
                                    atualizado {new Date(list.updatedAt).toLocaleDateString('pt-BR')}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowPasteModal(true)}
                                className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 px-5 py-2 rounded-lg font-medium transition-colors"
                            >
                                📋 Colar lista
                            </button>
                            <button
                                onClick={handleExport}
                                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-black px-5 py-2 rounded-lg font-medium transition-colors"
                            >
                                Exportar
                            </button>
                        </div>
                    </div>

                    {list.items.length === 0 ? (
                        <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center flex flex-col justify-center">
                            <p className="text-zinc-400">Esta lista ainda está vazia.</p>
                            <p className="text-sm text-zinc-500 mt-2">Use "Colar lista" ou adicione itens das páginas de genéricos.</p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-auto space-y-3 pr-2">
                            {list.items.map((item: ShoppingListItem) => {
                                const isPinned = !!item.productId;

                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => openProductPanel(item.genericName, item.productId)}
                                        className="bg-zinc-900 border border-zinc-800 hover:border-emerald-500 rounded-xl p-5 flex items-center gap-4 group cursor-pointer transition-all"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-white group-hover:text-emerald-400 transition-colors flex items-center gap-2">
                                                {item.genericName}
                                                {isPinned && (
                                                    <span
                                                        className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded cursor-pointer hover:bg-emerald-500/20"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleUnpin(item.id);
                                                        }}
                                                    >
                                                        fixado
                                                    </span>
                                                )}
                                            </div>

                                            {isPinned && item.preferredStdSize && item.preferredUnit && (
                                                <div className="text-zinc-500 text-xs mt-0.5">
                                                    {item.preferredStdSize} {item.preferredUnit}
                                                </div>
                                            )}

                                            {isPinned ? (
                                                <div className="text-emerald-400 text-sm mt-1 font-medium">
                                                    R$ {item.pinnedPrice?.toFixed(2) || '—'}
                                                </div>
                                            ) : (
                                                <div className="mt-1">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        placeholder="R$ 0,00"
                                                        value={item.pinnedPrice ?? ''}
                                                        onChange={(e) =>
                                                            updateItem(listId, item.id, {
                                                                pinnedPrice: e.target.value ? parseFloat(e.target.value) : undefined,
                                                            })
                                                        }
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="bg-zinc-800 border border-zinc-700 rounded px-3 py-1 text-emerald-400 text-sm w-28 focus:outline-none focus:border-emerald-500"
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center border border-zinc-700 rounded">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        updateItem(listId, item.id, { quantity: Math.max(1, item.quantity - 1) });
                                                    }}
                                                    className="px-3 py-1 text-zinc-400 hover:text-white"
                                                >
                                                    −
                                                </button>
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) =>
                                                        updateItem(listId, item.id, { quantity: parseInt(e.target.value) || 1 })
                                                    }
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="w-12 bg-transparent text-center text-sm focus:outline-none"
                                                    min="1"
                                                />
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        updateItem(listId, item.id, { quantity: item.quantity + 1 });
                                                    }}
                                                    className="px-3 py-1 text-zinc-400 hover:text-white"
                                                >
                                                    +
                                                </button>
                                            </div>

                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeItem(listId, item.id);
                                                }}
                                                className="text-red-400 hover:text-red-500 text-xl leading-none px-2"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {list.items.length > 0 && (
                        <div className="mt-auto pt-6 border-t border-zinc-800 flex justify-between items-baseline text-sm">
                            <span className="text-zinc-400">Total da lista</span>
                            <span className="text-emerald-400 font-bold text-xl">
                                R$ {calculateTotal().toFixed(2)}
                            </span>
                        </div>
                    )}
                </div>

                {/* Right: Product Detail Panel */}
                {isPanelOpen && data && (
                    <div className="flex-1 lg:w-7/12 lg:border-l lg:border-zinc-800 lg:pl-6 flex flex-col min-h-0">
                        <ProductDetailPanel
                            genericName={generic}
                            productId={productId}
                            mainProduct={mainProduct}
                            relatedGroups={relatedGroups}
                            relatedProducts={relatedProducts}
                            onClose={closeProductPanel}
                            data={data}
                            currentSort={currentSort}
                            currentStore={currentStore}
                            currentGroup={currentGroup}
                            onPinVariant={handlePin}
                            pinnedProductId={currentOpenItem?.productId}
                        />
                    </div>
                )}
            </div>

            <ShoppingListPasteModal
                isOpen={showPasteModal}
                onClose={() => setShowPasteModal(false)}
                onConfirmAdd={handleAddFromPaste}
                availableGenerics={availableGenerics}
            />
        </main>
    );
}