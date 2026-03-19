export default function Loading() {
  return (
    <main className="min-h-screen bg-zinc-950 font-mono">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-12">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            monopop<span className="text-emerald-400">-intel</span>
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            market price intelligence · rio de janeiro
          </p>
        </div>
        <div className="flex flex-col gap-3 mt-20">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-16 rounded bg-zinc-900 animate-pulse"
              style={{ opacity: 1 - i * 0.15 }}
            />
          ))}
        </div>
      </div>
    </main>
  );
}