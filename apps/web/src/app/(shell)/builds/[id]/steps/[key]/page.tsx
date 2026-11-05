import { StepRoute } from "@/components/builds/StepRoute";
import type { StepKey } from "@/lib/sequence/template";

export default async function BuildStepPage({ params }: PageProps<"/builds/[id]/steps/[key]">) {
  const { key } = await params;
  return <StepRoute stepKey={key as StepKey} />;
}
