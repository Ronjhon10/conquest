// The conference the public links open: the fixture conference with fakes on, the live
// KubeCon NA 2026 demo conference on the cluster (created 2026-11-09 through POST /api/game/conferences).
import { fixtures } from "@conquest/contracts";

export const LIVE_DEMO_CONFERENCE_ID = "d2927cdd-f3e6-404f-b34f-4c4b766b8520";

export const DEMO_CONFERENCE_ID =
  process.env.NEXT_PUBLIC_FAKE_API === "1"
    ? fixtures.conference.id
    : process.env.NEXT_PUBLIC_DEMO_CONFERENCE_ID || LIVE_DEMO_CONFERENCE_ID;

/** Goals for the sample path on the home page: ranked live by search-api, so the stops are real talks. */
export const SAMPLE_GOALS = ["Platform Engineering", "Security", "Observability"];
