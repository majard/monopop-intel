import Link from 'next/link';

export default function IntelFooter({ className = '' }: { className?: string }) {
  return (
    <p className={`text-[11px] text-zinc-800 text-center ${className}`}>
      Monopop Intel é gratuito e sem anúncios.{' '}
      <Link href="/support" className="text-zinc-700 hover:text-zinc-500 underline transition-colors">
        Apoiar o projeto →
      </Link>
    </p>
  );
}