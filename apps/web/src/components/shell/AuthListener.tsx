"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { SIGN_IN_ROUTE } from "@/lib/routes";
import { createClient } from "@/lib/supabase/client";

/**
 * Returns to the sign-in screen when the session ends outside this page (sign-out in
 * another tab, a renewal token that can no longer be used).
 */
export function AuthListener() {
  const router = useRouter();
  useEffect(() => {
    const { data } = createClient().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        router.replace(SIGN_IN_ROUTE);
        router.refresh();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [router]);
  return null;
}
