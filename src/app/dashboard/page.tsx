import { auth } from '@/auth';

export default async function DashboardPage() {
  const session = await auth();
  // session is guaranteed non-null here (middleware redirects unauthenticated)

  return (
    <main className="flex-1 flex items-center justify-center">
      <h1 className="text-xl font-semibold text-foreground">
        Welcome, {session?.user?.name}
      </h1>
    </main>
  );
}
