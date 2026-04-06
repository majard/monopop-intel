import { MetadataRoute } from 'next';

const API = process.env.NEXT_PUBLIC_API_URL;
const BASE = 'https://monopop-intel.vercel.app';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const static_routes: MetadataRoute.Sitemap = [
    { url: BASE, changeFrequency: 'daily', priority: 1.0 },
    { url: `${BASE}/generics`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/shopping-lists`, changeFrequency: 'weekly', priority: 0.5 },
  ];

  try {
    const res = await fetch(`${API}/generics`, { next: { revalidate: 86400 } });
    if (!res.ok) return static_routes;
    const data = await res.json();
    const generics: Array<{ generic: string }> = data.generics ?? [];

    const dynamic_routes: MetadataRoute.Sitemap = generics.map(({ generic }) => ({
      url: `${BASE}/generics/${encodeURIComponent(generic)}`,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }));

    return [...static_routes, ...dynamic_routes];
  } catch {
    return static_routes;
  }
}