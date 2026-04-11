"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Role } from "@/lib/roles";
import { defaultDashboardPath, moduleFromPath, roleAllowsModule } from "@/lib/roles";

export function ModuleAccessGuard({ role, children }: { role: Role; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const mod = moduleFromPath(pathname);
    if (!roleAllowsModule(role, mod)) {
      router.replace(defaultDashboardPath(role));
    }
  }, [pathname, role, router]);

  return <>{children}</>;
}
