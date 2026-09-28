import { JourneyShell } from "@/components/journey/Shell";

// Every journey route shares this layout, so the avatar and the conversation
// stay mounted while the screen changes.
export default function JourneyLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <JourneyShell>{children}</JourneyShell>;
}
