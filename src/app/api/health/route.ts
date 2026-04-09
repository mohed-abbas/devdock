import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

const VERSION = '0.1.0';

export async function GET() {
  try {
    // Verify database connectivity with a simple query
    await db.execute(sql`SELECT 1`);

    return NextResponse.json(
      {
        status: 'ok',
        version: VERSION,
        database: 'connected',
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      {
        status: 'error',
        version: VERSION,
        database: 'disconnected',
      },
      { status: 503 }
    );
  }
}
