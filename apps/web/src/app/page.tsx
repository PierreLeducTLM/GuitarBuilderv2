import { redirect } from "next/navigation";
import { DEFAULT_ROUTE } from "@/lib/routes";

// The proxy already redirects "/"; this covers requests it does not see.
export default function Home() {
  redirect(DEFAULT_ROUTE);
}
