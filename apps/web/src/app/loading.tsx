import { LoadingScreen } from "@/components/LoadingScreen";

// app-shell: Session Restore Loading State. This boundary sits above the shell layout,
// so it shows while the server reads the session and the profile.
export default function Loading() {
  return <LoadingScreen />;
}
