import { notFound } from "next/navigation";
import { RoutePreview } from "../../../../src/components/route-preview";
const titles: Record<string, string> = {
  join: "Join the adventure",
  map: "Your dungeon map",
  boss: "Talk details",
  connect: "Your allies",
  party: "Your party",
  recap: "Your recap",
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
  return <RoutePreview conf={conf} view={name} talkId={view[1]} />;
}
