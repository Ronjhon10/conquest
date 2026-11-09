import { notFound } from "next/navigation";
import { RoutePreview } from "../../../../src/components/route-preview";
const titles: Record<string, string> = {
  setup: "Conference setup",
  theme: "Theme studio",
  live: "Live leaderboard",
  report: "Conference report",
};
type Props = { params: Promise<{ conf: string; view?: string[] }> };
export async function generateMetadata({ params }: Props) {
  const { view } = await params;
  return { title: titles[view?.[0] ?? "setup"] ?? "Organizer" };
}
export default async function Page({ params }: Props) {
  const { conf, view } = await params;
  const name = view?.[0] ?? "setup";
  if (!titles[name] || (view?.length ?? 0) > 1) notFound();
  return <RoutePreview conf={conf} view={name} />;
}
