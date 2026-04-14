import { GitHubConnectionCard } from './_components/github-connection-card';

export default function SettingsPage() {
  return (
    <main className="flex-1 p-6">
      <h1 className="text-xl font-semibold text-foreground">Settings</h1>
      <div className="mt-6 max-w-xl">
        <GitHubConnectionCard />
      </div>
    </main>
  );
}
