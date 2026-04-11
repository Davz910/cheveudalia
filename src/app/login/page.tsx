import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect("/dashboard");
  }

  const sp = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(60_5%_96%)] p-6">
      <div className="w-full max-w-[400px] rounded-lg border border-border bg-card p-8 shadow-sm">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground">
            C
          </div>
          <div>
            <h1 className="text-base font-medium">Cheveudalia</h1>
            <p className="text-xs text-muted-foreground">Espace de gestion</p>
          </div>
        </div>
        <Suspense fallback={<div className="text-sm text-muted-foreground">Chargement…</div>}>
          <LoginForm next={sp.next} />
        </Suspense>
      </div>
    </div>
  );
}
