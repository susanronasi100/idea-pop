import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import AppShell from "@/components/AppShell";
import ChallengeExperience from "./_components/ChallengeExperience";
import ChallengesList from "./_components/ChallengesList";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "challenge" });
  return {
    title: t("meta_title"),
    description: t("brief_body"),
  };
}

// Logged-in kids (persona cookie) get the in-app missions list inside the app
// shell; everyone else gets the public marketing challenge experience.
export default async function ChallengesPage() {
  const isSignedIn = (await cookies()).has("ideapop_persona");
  if (isSignedIn) {
    return (
      <AppShell section="challenge">
        <ChallengesList />
      </AppShell>
    );
  }
  return <ChallengeExperience />;
}
