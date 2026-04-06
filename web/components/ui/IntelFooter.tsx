import Link from 'next/link';

export default function IntelFooter({ className = '' }: { className?: string }) {
  return (
    <p className={`text-[12px] text-zinc-700 text-center ${className}`}>
      Monopop Intel é gratuito e sem anúncios.{' '}
      <Link href="/support" className="text-zinc-600 hover:text-zinc-400 underline transition-colors">
        Apoiar o projeto →
      </Link>
    </p>
  );
}