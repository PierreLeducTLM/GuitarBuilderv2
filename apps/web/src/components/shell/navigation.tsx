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
import type { EntryId, SectionId } from "@/lib/routes";

/** Icon per section (app-shell: Navigation Entry Presentation). */
export const sectionIcons: Record<SectionId, LucideIcon> = {
  builds: Guitar,
  chat: MessagesSquare,
  simulator: AudioWaveform,
  woodProperties: Trees,
  references: BookOpen,
  admin: ShieldCheck,
};

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
