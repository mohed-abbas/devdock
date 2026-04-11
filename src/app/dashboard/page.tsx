import { EnvironmentList } from './_components/environment-list';

export default function DashboardPage() {
  return (
    <main className="flex-1 flex flex-col p-6">
      <EnvironmentList />
    </main>
  );
}
