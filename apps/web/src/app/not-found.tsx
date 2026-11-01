import { redirect } from "next/navigation";
import { DEFAULT_ROUTE } from "@/lib/routes";

// app-shell: unknown URLs go to the Builds list (the proxy handles most of them).
export default function NotFound() {
  redirect(DEFAULT_ROUTE);
}
