'use client';

import { useState } from 'react';

export function PixDetailClient() {
  const [copied, setCopied] = useState(false);

  const PIX_KEY = "1cc6061c-b503-4701-8253-3406ba9f25e3";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(PIX_KEY);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy PIX key:", error);
      setCopied(false);
    }
  };

  return (
    <button onClick={handleCopy} className="text-blue-400 hover:underline">
      {copied ? 'Copiado!' : PIX_KEY}
    </button>
  );
}
