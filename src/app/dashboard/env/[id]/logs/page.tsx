import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { environments } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { LogsLoader } from './_components/logs-loader';

type Params = { params: Promise<{ id: string }> };

export default async function LogsPage({ params }: Params) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const [env] = await db
    .select({
      id: environments.id,
      name: environments.name,
      slug: environments.slug,
      status: environments.status,
    })
    .from(environments)
    .where(and(
      eq(environments.id, id),
      eq(environments.userId, session.user.id),
    ))
    .limit(1);

  if (!env) redirect('/dashboard');
  if (env.status !== 'running') redirect('/dashboard');

  return (
    <LogsLoader
      environmentId={env.id}
      environmentName={env.name}
      environmentStatus={env.status}
    />
  );
}
