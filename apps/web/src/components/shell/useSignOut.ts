"use client";

import { useToast } from "@gb/ui";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { signOutThisBrowser } from "@/lib/auth/signOut";
import { SIGN_IN_ROUTE } from "@/lib/routes";
import { createClient } from "@/lib/supabase/client";

/**
 * app-shell: Sign Out From the Shell. On success the session ends and the sign-in
 * screen is shown; on failure "Failed to sign out" is shown and the user stays.
 */
export function useSignOut() {
  const t = useTranslations("shell");
  const toast = useToast();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const signOut = useCallback(async () => {
    setPending(true);
    const { ok } = await signOutThisBrowser(createClient());
    if (ok) {
      router.replace(SIGN_IN_ROUTE);
      router.refresh();
      return;
    }
    toast.show({ type: "error", message: t("signOutFailed") });
    setPending(false);
  }, [router, t, toast]);

  return { signOut, pending };
}
