'use client';

import { useState, useMemo } from 'react';
import { calculateSimilarity } from '../../utils/similarityUtils';

interface MatchResult {
  pastedName: string;
  matchedGeneric: string | null;
  quantity: number;
  similarity: number;
}

interface ShoppingListPasteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmAdd: (items: Array<{ genericName: string; quantity: number }>) => void;
  availableGenerics: string[];
}

export default function ShoppingListPasteModal({
  isOpen,
  onClose,
  onConfirmAdd,
  availableGenerics,
}: ShoppingListPasteModalProps) {
  const [text, setText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const parsedLines = useMemo(() => {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        let clean = line.replace(/[\u{1F300}-\u{1F9FF}]|[-•▪︎]/gu, '').trim();
        const qtyMatch = clean.match(/:\s*(\d+)/) || clean.match(/\s+(\d+)\s*$/);
        const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
        const pastedName = clean
          .replace(/:\s*\d+.*$/, '')
          .replace(/\s+\d+\s*$/, '')
          .trim();

        return { original: line, pastedName, quantity };
      });
  }, [text]);

  const processPaste = () => {
    if (parsedLines.length === 0) return;

    setIsProcessing(true);

    const results: MatchResult[] = parsedLines.map(({ pastedName, quantity }) => {
      if (!pastedName) return { pastedName: '', matchedGeneric: null, quantity, similarity: 0 };

      let bestScore = 0;
      let bestMatch: string | null = null;

      availableGenerics.forEach(gen => {
        const score = calculateSimilarity(pastedName, gen);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = gen;
        }
      });

      return {
        pastedName,
        matchedGeneric: bestScore >= 0.55 ? bestMatch : null,
        quantity,
        similarity: Math.round(bestScore * 100),
      };
    });

    const hasUncertain = results.some(r => r.similarity < 90 && r.similarity >= 55);

    if (!hasUncertain) {
      // All good confidence → add immediately using matched generic
      const itemsToAdd = results
        .filter(r => r.matchedGeneric)
        .map(r => ({ genericName: r.matchedGeneric!, quantity: r.quantity }));

      onConfirmAdd(itemsToAdd);
      resetModal();
    } else {
      setMatches(results);
      setShowConfirmation(true);
    }

    setIsProcessing(false);
  };

  const handleConfirmAll = () => {
    const itemsToAdd = matches
      .filter(r => r.matchedGeneric)
      .map(r => ({ genericName: r.matchedGeneric!, quantity: r.quantity }));

    onConfirmAdd(itemsToAdd);
    resetModal();
  };

  const resetModal = () => {
    setShowConfirmation(false);
    setMatches([]);
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
                Itens com boa correspondência serão adicionados automaticamente.
              </p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="- Molho de tomate: 1\nArroz: 2\nFeijão 1"
                className="w-full h-64 bg-zinc-950 border border-zinc-700 rounded-xl p-4 text-white font-mono text-sm resize-y focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="border-t border-zinc-700 p-4 flex gap-3">
              <button onClick={onClose} className="flex-1 py-3 text-zinc-400 hover:text-white font-medium">
                Cancelar
              </button>
              <button
                onClick={processPaste}
                disabled={isProcessing || parsedLines.length === 0}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 text-black font-medium py-3 rounded-xl transition-colors"
              >
                {isProcessing ? 'Processando...' : `Processar ${parsedLines.length} itens`}
              </button>
            </div>
          </>
        ) : (
          <div className="p-6">
            <h2 className="text-xl font-medium mb-4">Confirmação de correspondências</h2>
            <div className="max-h-96 overflow-y-auto space-y-4 mb-6">
              {matches.map((match, idx) => (
                <div key={idx} className="bg-zinc-800 p-4 rounded-lg">
                  <div className="text-sm">
                    <span className="text-zinc-400">Digitado:</span> {match.pastedName}
                  </div>
                  {match.matchedGeneric ? (
                    <div className="text-emerald-400 text-sm mt-1">
                      ✓ Corresponde a: <strong>{match.matchedGeneric}</strong> ({match.similarity}%)
                    </div>
                  ) : (
                    <div className="text-red-400 text-sm mt-1">
                      ✗ Sem correspondência boa
                    </div>
                  )}
                  <div className="text-xs text-zinc-500 mt-2">
                    Quantidade: {match.quantity}
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
                Adicionar todos os itens encontrados
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}