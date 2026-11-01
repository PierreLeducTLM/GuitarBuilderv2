import { getTranslations } from "next-intl/server";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { safeNextPath } from "@/lib/routes";

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const [params, t] = await Promise.all([searchParams, getTranslations("auth.errors")]);
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  const initialError = params.error === "confirmation" ? t("confirmationFailed") : null;
  return <AuthScreen next={next} initialError={initialError} />;
}
