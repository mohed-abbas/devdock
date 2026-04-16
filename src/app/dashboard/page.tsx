import { EnvironmentList } from './_components/environment-list';
import { ProductionAppList } from './_components/production-app-list';

export default function DashboardPage() {
  return (
    <main className="flex-1 flex flex-col p-6">
      <EnvironmentList />
      <ProductionAppList />
    </main>
  );
}
