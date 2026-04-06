'use client';

import { useState, useMemo } from 'react';
import { calculateSimilarity } from '@/utils/similarityUtils';

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

function parseListText(text: string): Array<{ original: string; pastedName: string; quantity: number }> {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      // Strip emojis and common bullet characters
      const clean = line.replace(/[\u{1F300}-\u{1F9FF}]|[-•▪︎]/gu, '').trim();
      // Detect quantity patterns like ": 2" or trailing "x2" or just "2" at end
      const quantityMatch =
        clean.match(/:\s*(\d+)/) ||
        clean.match(/\bx\s*(\d+)\s*$/i) ||
        clean.match(/\s+(\d+)\s*$/);
      const quantity = quantityMatch ? parseInt(quantityMatch[1], 10) : 1;
      const pastedName = clean
        .replace(/:\s*\d+.*$/, '')
        .replace(/\bx\s*\d+\s*$/i, '')
        .replace(/\s+\d+\s*$/, '')
        .trim();

      return { original: line, pastedName, quantity };
    });
}

const PLACEHOLDER = `Exemplos de formatos aceitos:
- Arroz: 2
- Feijão carioca x3
Azeite
Leite integral 1`;

export default function ShoppingListPasteModal({
  isOpen,
  onClose,
  onConfirmAdd,
  availableGenerics,
}: ShoppingListPasteModalProps) {
  const [text, setText] = useState('');
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [editedMatches, setEditedMatches] = useState<MatchResult[]>([]);
  const [step, setStep] = useState<'input' | 'review'>('input');

  const parsedLines = useMemo(() => parseListText(text), [text]);

  const runMatching = () => {
    if (parsedLines.length === 0) return;

    const results: MatchResult[] = parsedLines.map(({ pastedName, quantity }) => {
      if (!pastedName) return { pastedName: '', matchedGeneric: null, quantity, similarity: 0 };

      let bestScore = 0;
      let bestMatch: string | null = null;

      availableGenerics.forEach(generic => {
        const score = calculateSimilarity(pastedName, generic);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = generic;
        }
      });

      return {
        pastedName,
        matchedGeneric: bestScore >= 0.55 ? bestMatch : null,
        quantity,
        similarity: Math.round(bestScore * 100),
      };
    });

    const needsReview = results.some(
      result => result.similarity < 90 && result.similarity >= 55
    );

    if (!needsReview) {
      const itemsToAdd = results
        .filter(result => result.matchedGeneric)
        .map(result => ({ genericName: result.matchedGeneric!, quantity: result.quantity }));
      onConfirmAdd(itemsToAdd);
      resetModal();
    } else {
      setMatches(results);
      setEditedMatches(results.map(result => ({ ...result })));
      setStep('review');
    }
  };

  const updateMatchedGeneric = (index: number, value: string | null) => {
    setEditedMatches(prev =>
      prev.map((match, matchIndex) =>
        matchIndex === index ? { ...match, matchedGeneric: value } : match
      )
    );
  };

  const handleConfirm = () => {
    const itemsToAdd = editedMatches
      .filter(result => result.matchedGeneric)
      .map(result => ({ genericName: result.matchedGeneric!, quantity: result.quantity }));
    onConfirmAdd(itemsToAdd);
    resetModal();
  };

  const resetModal = () => {
    setText('');
    setMatches([]);
    setEditedMatches([]);
    setStep('input');
    onClose();
  };

  if (!isOpen) return null;

  const confirmedCount = editedMatches.filter(result => result.matchedGeneric).length;
  const skippedCount = editedMatches.filter(result => !result.matchedGeneric).length;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={event => event.target === event.currentTarget && resetModal()}
    >
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg flex flex-col max-h-[92vh] shadow-2xl shadow-black/60">

        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4">
          <div>
            <h2 className="text-base font-semibold text-white tracking-tight">
              {step === 'input' ? 'Colar lista de compras' : 'Confirmar itens'}
            </h2>
            <p className="text-sm text-zinc-500 mt-0.5">
              {step === 'input'
                ? 'Cole sua lista em texto — um item por linha'
                : `${confirmedCount} encontrado${confirmedCount !== 1 ? 's' : ''}${skippedCount > 0 ? ` · ${skippedCount} sem correspondência` : ''}`}
            </p>
          </div>
          <button
            onClick={resetModal}
            className="text-zinc-600 hover:text-white transition-colors cursor-pointer text-xl leading-none p-1 -mr-1 -mt-1"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        {step === 'input' ? (
          <>
            <div className="px-6 pb-4 flex-1 overflow-hidden flex flex-col min-h-0 scrollbar-subtle">
              <textarea
                value={text}
                onChange={event => setText(event.target.value)}
                placeholder={PLACEHOLDER}
                autoFocus
                className="w-full flex-1 min-h-[200px] bg-zinc-950 border border-zinc-700/80 rounded-xl p-4 text-zinc-200 font-mono text-sm resize-none focus:outline-none focus:border-emerald-500/60 placeholder:text-zinc-700 transition-colors"
              />
              {parsedLines.length > 0 && (
                <p className="text-xs text-zinc-600 mt-2 tabular-nums">
                  {parsedLines.length} {parsedLines.length === 1 ? 'linha detectada' : 'linhas detectadas'}
                </p>
              )}
            </div>

            <div className="p-4 pt-0 border-t border-zinc-800 flex gap-2 mt-2">
              <button
                onClick={resetModal}
                className="flex-1 py-2.5 text-sm text-zinc-500 hover:text-zinc-300 font-medium transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={runMatching}
                disabled={parsedLines.length === 0}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-black font-semibold py-2.5 rounded-xl transition-colors cursor-pointer text-sm"
              >
                Processar {parsedLines.length > 0 ? `${parsedLines.length} itens` : ''}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-2 min-h-0">
              {matches.map((match, index) => {
                const edited = editedMatches[index];
                const isSkipped = !edited.matchedGeneric;
                const isLowConfidence = match.similarity < 90 && match.similarity >= 55;

                return (
                  <div
                    key={index}
                    className={`rounded-lg border px-4 py-3 transition-colors ${
                      isSkipped
                        ? 'border-zinc-800 bg-zinc-800/20'
                        : isLowConfidence
                        ? 'border-amber-500/20 bg-amber-500/5'
                        : 'border-emerald-500/20 bg-emerald-500/5'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-zinc-500 mb-1 truncate">
                          "{match.pastedName}"
                          <span className="text-zinc-700 ml-1.5">
                            × {match.quantity}
                          </span>
                        </p>

                        {isSkipped ? (
                          <p className="text-sm text-zinc-600 italic">
                            Sem correspondência — será ignorado
                          </p>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                              isLowConfidence
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}>
                              {match.similarity}%
                            </span>
                            <span className="text-sm text-white font-medium truncate">
                              {edited.matchedGeneric}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Quick actions */}
                      <div className="flex gap-1.5 shrink-0">
                        {!isSkipped && (
                          <button
                            onClick={() => updateMatchedGeneric(index, null)}
                            className="text-xs px-2 py-1 rounded border border-zinc-700 text-zinc-500 hover:border-red-500/50 hover:text-red-400 transition-colors cursor-pointer"
                            title="Ignorar este item"
                          >
                            ignorar
                          </button>
                        )}
                        {isSkipped && match.matchedGeneric && (
                          <button
                            onClick={() => updateMatchedGeneric(index, match.matchedGeneric)}
                            className="text-xs px-2 py-1 rounded border border-zinc-700 text-zinc-500 hover:border-emerald-500/50 hover:text-emerald-400 transition-colors cursor-pointer"
                          >
                            restaurar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 pt-3 border-t border-zinc-800 flex gap-2">
              <button
                onClick={() => setStep('input')}
                className="flex-1 py-2.5 text-sm text-zinc-500 hover:text-zinc-300 font-medium transition-colors cursor-pointer"
              >
                ← Voltar
              </button>
              <button
                onClick={handleConfirm}
                disabled={confirmedCount === 0}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-black font-semibold py-2.5 rounded-xl transition-colors cursor-pointer text-sm"
              >
                Adicionar {confirmedCount > 0 ? `${confirmedCount} ${confirmedCount === 1 ? 'item' : 'itens'}` : ''}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}