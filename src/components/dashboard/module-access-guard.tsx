"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Role } from "@/lib/roles";
import { defaultDashboardPath, moduleAllowed, moduleFromPath } from "@/lib/roles";

export function ModuleAccessGuard({
  role,
  permissions,
  children,
}: {
  role: Role;
  permissions?: Record<string, unknown> | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const mod = moduleFromPath(pathname);
    if (!moduleAllowed(role, mod, permissions)) {
      router.replace(defaultDashboardPath(role));
    }
  }, [pathname, role, permissions, router]);

  return <>{children}</>;
}
