// web/components/ShoppingListPasteModal.tsx
'use client';

import React, { useState, useMemo } from 'react';
import { calculateSimilarity } from '../utils/similarityUtils';

interface ParsedItem {
    original: string;
    genericName: string;
    quantity: number;
}

interface PasteResult {
    autoAdd: Array<{ genericName: string; quantity: number }>;
    toConfirm: Array<{ genericName: string; quantity: number; similarity: number }>;
}

interface ShoppingListPasteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirmAdd: (items: Array<{ genericName: string; quantity: number }>) => void;
    availableGenerics: string[];   // list of all generic names for fuzzy matching
}

const AUTO_ADD_THRESHOLD = 0.90;   // 90%+ = auto add
const SHOW_CONFIRM_THRESHOLD = 0.55; // below this we can ignore (too weak)

export default function ShoppingListPasteModal({
    isOpen,
    onClose,
    onConfirmAdd,
    availableGenerics,
}: ShoppingListPasteModalProps) {
    const [text, setText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [pasteResult, setPasteResult] = useState<PasteResult | null>(null);

    // Parse lines like "- Molho de tomate: 1 🍅" or "Arroz: 2"
    const parsedLines = useMemo((): ParsedItem[] => {
        return text
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .map(line => {
                // Remove emojis and common bullets
                let clean = line.replace(/[\u{1F300}-\u{1F9FF}]|[-•▪︎]/gu, '').trim();

                // Extract quantity
                const qtyMatch = clean.match(/:\s*(\d+)/) || clean.match(/\s+(\d+)\s*$/);
                const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;

                // Clean generic name
                const genericName = clean
                    .replace(/:\s*\d+.*$/, '')
                    .replace(/\s+\d+\s*$/, '')
                    .trim();

                return { original: line, genericName, quantity };
            });
    }, [text]);

    const processPaste = () => {
        if (parsedLines.length === 0) return;

        setIsProcessing(true);

        const autoAdd: Array<{ genericName: string; quantity: number }> = [];
        const toConfirm: Array<{ genericName: string; quantity: number; similarity: number }> = [];

        parsedLines.forEach(({ genericName, quantity }) => {
            if (!genericName) return;

            let bestScore = 0;

            availableGenerics.forEach(gen => {
                const score = calculateSimilarity(genericName, gen);
                if (score > bestScore) bestScore = score;
            });

            if (bestScore >= AUTO_ADD_THRESHOLD) {
                autoAdd.push({ genericName, quantity });
            } else if (bestScore >= SHOW_CONFIRM_THRESHOLD) {
                toConfirm.push({ genericName, quantity, similarity: Math.round(bestScore * 100) });
            }
            // below 55% we silently ignore for now
        });

        const result: PasteResult = { autoAdd, toConfirm };

        if (toConfirm.length === 0) {
            onConfirmAdd(autoAdd);
            setText('');
            onClose();
        } else {
            setPasteResult(result);
            setShowConfirmation(true);
        }

        setIsProcessing(false);
    };

    const handleConfirmAll = () => {
        if (!pasteResult) return;
        const allItems = [
            ...pasteResult.autoAdd,
            ...pasteResult.toConfirm.map(i => ({ genericName: i.genericName, quantity: i.quantity }))
        ];
        onConfirmAdd(allItems);
        resetModal();
    };

    const resetModal = () => {
        setShowConfirmation(false);
        setPasteResult(null);
        setText('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg overflow-hidden">
                {!showConfirmation ? (
                    <>
                        <div className="p-6">
                            <h2 className="text-xl font-medium mb-2">Colar lista de compras</h2>
                            <p className="text-sm text-zinc-500 mb-4">
                                Cole sua lista. Itens com alta similaridade serão adicionados automaticamente.
                            </p>
                            <textarea
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                placeholder="- Molho de tomate: 1 🍅&#10;Arroz: 2&#10;Feijão 1"
                                className="w-full h-64 bg-zinc-950 border border-zinc-700 rounded-xl p-4 text-white font-mono text-sm resize-y focus:outline-none focus:border-emerald-500"
                            />
                        </div>

                        <div className="border-t border-zinc-700 p-4 flex gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 py-3 text-zinc-400 hover:text-white font-medium transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={processPaste}
                                disabled={isProcessing || parsedLines.length === 0}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-400 text-black font-medium py-3 rounded-xl transition-colors"
                            >
                                {isProcessing ? 'Processando...' : `Processar ${parsedLines.length} itens`}
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="p-6">
                        <h2 className="text-xl font-medium mb-4">Confirmação de itens</h2>
                        <p className="text-sm text-zinc-500 mb-6">
                            {pasteResult?.toConfirm.length} itens tiveram correspondência média.
                            Deseja adicionar todos?
                        </p>

                        <div className="max-h-80 overflow-y-auto space-y-3 mb-8 text-sm">
                            {pasteResult?.toConfirm.map((item, idx) => (
                                <div key={idx} className="bg-zinc-800 p-4 rounded-lg">
                                    <div className="font-medium">{item.genericName}</div>
                                    <div className="text-xs text-zinc-500 mt-1">
                                        Quantidade: {item.quantity} • Similaridade: {item.similarity}%
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={resetModal}
                                className="flex-1 py-3 text-zinc-400 hover:text-white font-medium transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmAll}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-black font-medium py-3 rounded-xl transition-colors"
                            >
                                Adicionar todos
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}