import Link from 'next/link';
import { PixDetailClient } from './PixDetailClient';

export const metadata = {
  title: 'Apoiar · Monopop Intel',
  description: 'Monopop Intel é gratuito e sem anúncios. Se for útil pra você, considere apoiar.',
};

export default function ApoiarPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 font-mono p-6">
      <div className="max-w-3xl mx-auto py-0">

        <div className="mb-4">
          <Link
            href="/"
            className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors"
          >
            ← voltar
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-white mb-3">Apoiar o projeto</h1>

        <p className="text-zinc-400 text-sm leading-relaxed mb-4">
          Monopop Intel é gratuito, sem anúncios e sem rastreamento.
          É uma ferramenta construída para ajudar pessoas a comparar preços e
          comprar com mais consciência — parte de um projeto maior de organização
          popular de consumo.
        </p>

        <p className="text-zinc-500 text-sm leading-relaxed mb-6">
          Esse projeto só continua existindo se quem usa contribui.
          Se o Monopop já te fez economizar, uma pequena parte disso mantém ele no ar.
        </p>

        {/* Pix block */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6">
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
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-4">
          <p className="text-xs text-zinc-600 uppercase tracking-widest mb-4">Monopop</p>
          <p className="text-sm text-zinc-400 leading-relaxed mb-4">
            O app Monopop transforma sua compra em decisão racional.
            Compare preços por unidade, controle estoque e evite pagar mais caro por distração.
          </p>

          <a
            href="https://github.com/majard/monopop/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-emerald-500 hover:text-emerald-400 transition-colors"
          >
            Baixar no Github Releases →
          </a>
        </div>

        <p className="text-zinc-700 text-xs text-center">
          Obrigado. Isso aqui só existe porque alguém decidiu ajudar.
        </p>

      </div>
    </main >
  );
}