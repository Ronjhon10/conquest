# Conquest review conventions

Conquest is built spec first at a one-day hackathon by four people in parallel lanes. Read `AGENTS.md` and `specs/000-overview.md` for the architecture. Review every PR against these:

1. **Spec first.** Behavior must match the spec it names (`specs/0x0-*.md`). Code that does something no spec says, or contradicts a spec's non-goals, should be flagged. Judgment calls belong in `product/DECISIONS.md`.
2. **Tests are named by criterion ID** (`it("GM-6 boss check-in gives 150 XP")`). A PR that claims a criterion in its title or BUILD.md must have a test starting with that ID.
3. **Lanes.** Each lane owns its folders (000 "Lanes"). A PR that edits another lane's folder should say why.
4. **Contracts.** Types, routes and index names come from `packages/contracts`. Don't redefine them locally.
5. **Game rules live in one place.** XP numbers, the 1.25x party multiplier, coin rules and the level formula live only in `services/game-api/src/xp/rules.ts` (030 Behavior 6). Leaderboard ties break by earliest last event.
6. **Every OpenAI call has a deterministic fallback**, and tests never call OpenAI, Dash0 or a remote Elasticsearch (OV-5, OV-6).
7. **Errors** use `{ error: { code, message } }` (OV-4).
8. **Public repo.** No keys, tokens, kubeconfigs or `.env` values in any diff, Dockerfile, workflow or log line.
9. Prefer small, readable code over clever code. It's a hackathon; flag only what would break the demo, leak data, or violate the spec.
