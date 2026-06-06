import { AppShell } from "@/components/app-shell";

export default function TutorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell role="tutor">{children}</AppShell>;
}
