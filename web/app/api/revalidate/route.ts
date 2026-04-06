import { revalidatePath } from 'next/cache';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  if (req.headers.get('x-revalidate-token') !== process.env.REVALIDATE_TOKEN)
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  
  revalidatePath('/generics', 'layout');
  revalidatePath('/history', 'layout');
  return Response.json({ revalidated: true });
}