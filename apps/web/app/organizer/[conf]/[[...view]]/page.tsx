import { notFound } from "next/navigation";
import { LiveLeaderboard, OrganizerSetup, ReportView } from "../../../../src/components/organizer";
// The dashboard link comes from the pod's runtime env (deploy/web.yaml), not the build.
export const dynamic = "force-dynamic";
const titles: Record<string, string> = {
  setup: "Conference setup",
  live: "Live leaderboard",
  report: "Conference report",
};
type Props = { params: Promise<{ conf: string; view?: string[] }> };
export async function generateMetadata({ params }: Props) {
  const { view } = await params;
  return { title: titles[view?.[0] ?? "setup"] ?? "Organizer" };
}
// A computed key keeps Next from inlining the build-time value of this NEXT_PUBLIC_ variable.
const DASHBOARD_ENV = ["NEXT_PUBLIC", "DASH0_DASHBOARD_URL"].join("_");
export default async function Page({ params }: Props) {
  const { conf, view } = await params;
  const name = view?.[0] ?? "setup";
  if (!titles[name] || (view?.length ?? 0) > 1) notFound();
  return (
    <div className="page-container">
      {name === "live" ? (
        <LiveLeaderboard conf={conf} />
      ) : name === "report" ? (
        <ReportView conf={conf} />
      ) : (
        <OrganizerSetup conf={conf} dashboardUrl={process.env[DASHBOARD_ENV] || undefined} />
      )}
    </div>
  );
}
