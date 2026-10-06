import { cookies } from "next/headers";
import AppShellGate from "@/components/AppShellGate";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const signedIn = (await cookies()).has("ideapop_persona");
  return <AppShellGate signedIn={signedIn}>{children}</AppShellGate>;
}
