import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  return (
    <main className="min-h-svh flex items-center justify-center bg-background">
      <div className="w-full max-w-sm px-4">
        {/* Title block per D-02 and UI-SPEC */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            DevDock
          </h1>
          <p className="text-base text-muted-foreground mt-2">
            Remote development platform
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
