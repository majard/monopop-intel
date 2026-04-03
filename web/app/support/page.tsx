import Link from 'next/link';
import { PixDetailClient } from './PixDetailClient';

export const metadata = {
  title: 'Apoiar · Monopop Intel',
  description: 'Monopop Intel é gratuito e sem anúncios. Se for útil pra você, considere apoiar.',
};

export default function ApoiarPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 font-mono p-6">
      <div className="max-w-lg mx-auto py-2">

        <div className="mb-12">
          <Link
            href="/"
            className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors"
          >
            ← voltar
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-white mb-3">Apoiar o projeto</h1>

        <p className="text-zinc-400 text-sm leading-relaxed mb-8">
          Monopop Intel é gratuito, sem anúncios e sem rastreamento.
          É uma ferramenta construída para ajudar pessoas a comparar preços e
          comprar com mais consciência — parte de um projeto maior de organização
          popular de consumo.
        </p>

        <p className="text-zinc-500 text-sm leading-relaxed mb-12">
          Se for útil pra você, considere contribuir. 
          Se o Monopop já te economizou R$ 20, doar R$ 2 mantém ele vivo.
          Qualquer valor ajuda a manter o servidor no ar e o desenvolvedor motivado.
        </p>

        {/* Pix block */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-8">
          <p className="text-xs text-zinc-600 uppercase tracking-widest mb-4">Pix</p>

          <div className="space-y-3">
            <div>

              <p className="text-sm text-zinc-300 font-mono select-all">
                Para me transferir qualquer valor pela conta do Nubank ou de outros bancos pelo Pix, entre em:
                <br />
                <a href="https://nubank.com.br/cobrar/16n4l3/69cfa36b-1ce0-492d-92de-3dd670edb0c6" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                  Abrir página de pagamento do Nubank →
                </a>
              </p>

              <p className="text-sm text-zinc-300 font-mono select-all">
                ou envie um PIX para
                <br />
                <PixDetailClient />
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-600 mb-1">favorecido</p>
              <p className="text-sm text-zinc-400">Marlon Jardim</p>
            </div>
          </div>
        </div>

        <p className="text-zinc-700 text-xs text-center">
          Obrigado. Sério.
        </p>
      </div>
    </main >
  );
}