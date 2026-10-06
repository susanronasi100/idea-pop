import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import ChallengeExperience from "@/app/[locale]/challenges/_components/ChallengeExperience";
import ChallengesList from "@/app/[locale]/challenges/_components/ChallengesList";

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
// shell; everyone else gets the public marketing challenge experience. The list
// lives in the (app) group so the shell (and its sliding menu circle) stays put
// when a kid moves between Challenges and the other sections; the (app) layout
// leaves the shell off for the public experience.
export default async function ChallengesPage() {
  const isSignedIn = (await cookies()).has("ideapop_persona");
  return isSignedIn ? <ChallengesList /> : <ChallengeExperience />;
}
