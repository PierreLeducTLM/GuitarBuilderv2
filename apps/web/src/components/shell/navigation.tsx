import {
  AudioWaveform,
  BookOpen,
  CircleUser,
  Guitar,
  type LucideIcon,
  MessagesSquare,
  ShieldCheck,
  Trees,
  Wrench,
} from "lucide-react";
import type { EntryId } from "@/lib/routes";

/** Icon per navigation entry (app-shell: Navigation Entry Presentation). */
export const entryIcons: Record<EntryId, LucideIcon> = {
  builds: Guitar,
  tools: Wrench,
  woodPanels: Trees,
  simulator: AudioWaveform,
  assistant: MessagesSquare,
  you: CircleUser,
  references: BookOpen,
  admin: ShieldCheck,
};
