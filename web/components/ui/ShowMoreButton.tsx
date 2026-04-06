'use client';

interface ShowMoreButtonProps {
  visibleCount: number;
  setVisibleCount: React.Dispatch<React.SetStateAction<number>>;
  filteredLength: number;
}

export const PAGE_SIZE = 32;

export function ShowMoreButton({ visibleCount, setVisibleCount, filteredLength }: ShowMoreButtonProps) {
  const hiddenCount = Math.max(0, filteredLength - visibleCount);
  const batchSize = Math.min(hiddenCount, visibleCount);

  return (
    <div className="text-center mt-6">
      <button
        aria-label={`Mostrar mais ${batchSize} itens`}

        // Exponential pagination: doubles batch size each click
        // 20 → 40 → 80 → 160 (prevents click-fatigue on long lists)
        onClick={() => setVisibleCount(Math.min(filteredLength, visibleCount + batchSize))}
        className="text-xs text-zinc-600 hover:text-zinc-400 border border-zinc-800 hover:border-zinc-700 px-6 py-2.5 rounded-lg transition-colors cursor-pointer"
      >
        mostrar mais {batchSize} itens · {hiddenCount} restantes
      </button>
    </div>
  );
}
