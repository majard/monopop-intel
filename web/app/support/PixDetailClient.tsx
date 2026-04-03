'use client';

import { useState } from 'react';

export function PixDetailClient() {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText("1cc6061c-b503-4701-8253-3406ba9f25e3"); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="text-blue-400 hover:underline">
      {copied ? 'Copiado!' : '1cc6061c-b503-4701-8253-3406ba9f25e3'}
    </button>
  );
}
