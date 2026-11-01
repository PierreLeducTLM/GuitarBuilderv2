import {
  AudioWaveform,
  BookOpen,
  Guitar,
  type LucideIcon,
  MessagesSquare,
  ShieldCheck,
  Trees,
} from "lucide-react";
import type { SectionId } from "@/lib/routes";

/** Icon per section (app-shell: Navigation Entry Presentation). */
export const sectionIcons: Record<SectionId, LucideIcon> = {
  builds: Guitar,
  chat: MessagesSquare,
  simulator: AudioWaveform,
  woodProperties: Trees,
  references: BookOpen,
  admin: ShieldCheck,
};
