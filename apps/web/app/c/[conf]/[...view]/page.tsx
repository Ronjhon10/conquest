import { Signup } from "../../../../src/components/signup";
import { notFound } from "next/navigation";
import { RoutePreview } from "../../../../src/components/route-preview";
import { linkedinAvailable } from "../../../../src/lib/linkedin-server";
import { CharacterProfile } from "../../../../src/components/character-profile";
// Sign-in availability depends on runtime secrets, not build-time environment.
export const dynamic = "force-dynamic";
const titles: Record<string, string> = {
  join: "Join the adventure",
  map: "Your dungeon map",
  boss: "Talk details",
  connect: "Your allies",
  party: "Your party",
  recap: "Your recap",
  profile: "Your adventurer",
};
type Props = { params: Promise<{ conf: string; view: string[] }> };
export async function generateMetadata({ params }: Props) {
  const { view } = await params;
  return { title: titles[view[0] ?? ""] ?? "Adventure" };
}
export default async function Page({ params }: Props) {
  const { conf, view } = await params;
  const name = view[0];
  if (
    !name ||
    !titles[name] ||
    (name === "boss" ? view.length !== 2 : view.length !== 1)
  )
    notFound();
  if (name === "join")
    return <Signup conf={conf} linkedinEnabled={linkedinAvailable()} />;
  if (name === "profile") return <CharacterProfile conf={conf} />;
  return <RoutePreview conf={conf} view={name} talkId={view[1]} />;
}
