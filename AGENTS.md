# Working on this repo

For any coding agent (Claude Code, Cursor, others). We're at a hackathon: move fast, but follow the spec.

1. Read `README.md`, `idea/overview.md` and `specs/README.md` first. If they disagree, the newest file wins.
2. **Capturing:** when asked to capture a meeting, thought or research, put it in the folder `README.md` names for it, with a dated file name. Keep people's words. Never invent facts, quotes or numbers. For a transcript, write a `-summary.md` beside it with: decisions, open questions, action items (who and what), and any spec changes they imply.
3. **Building:** read `specs/000-overview.md` first: it has the architecture, the contracts between lanes, and which folders each lane owns. Ask (or check the branch name) which lane you're in, and stay in that lane's folders. Build against `packages/contracts`; when another lane's service isn't there yet, use a fake behind the same interface instead of waiting or building it yourself. Work on the first unticked step in your lane in `product/BUILD.md`, or the step you were asked for. Read every spec it names. Build what the spec says. Every acceptance criterion in scope gets a test whose name starts with its ID (`it("XX-1 ...")`). If something is ambiguous, pick the simplest reading, log it in `product/DECISIONS.md`, and keep going. Don't edit specs unless you were asked to.
4. **Done** means the tests pass, the box in `BUILD.md` is ticked, a line is added to the log at its bottom, and the work is committed with the step and criteria IDs in the message.
5. Work on your own branch, never `main`. Pull before starting and push when a step is done.
6. Never commit secrets (use `.env`, which is gitignored). This repo is public. Never deploy or create cloud resources unless a human asked you to.
7. Don't edit `meeting-recordings/` except to add new transcripts or summaries.
8. Changing a contract (types, routes, index names) means one PR that edits both `packages/contracts` and `specs/000-overview.md`. Say so in the PR title so the other lanes see it.
9. Gitar reviews every PR. Fix what it flags or answer it in the PR; don't merge red.
10. Telemetry: follow the conventions in 000. Never put names, LinkedIn text, notes or other personal text in spans, metrics or logs.
11. Every OpenAI call needs a deterministic fallback, and tests never call OpenAI, Dash0 or a remote Elasticsearch.
