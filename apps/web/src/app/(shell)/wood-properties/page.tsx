import { redirect } from "next/navigation";
import { WoodCalculator } from "@/components/wood/WoodCalculator";
import { SIGN_IN_ROUTE } from "@/lib/routes";
import { getShellSession } from "@/lib/session";
import { listOwnWoodPanels } from "@/lib/wood/queries";

export default async function WoodPropertiesPage() {
  const session = await getShellSession();
  if (!session) redirect(SIGN_IN_ROUTE);
  return <WoodCalculator panels={await listOwnWoodPanels(session.userId)} />;
}
