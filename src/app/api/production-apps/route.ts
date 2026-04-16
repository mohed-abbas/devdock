import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { discoverProductionApps } from '@/lib/docker/production-discovery';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apps = await discoverProductionApps();
  return NextResponse.json(apps);
}
