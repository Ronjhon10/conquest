# Working on this repo

For any coding agent (Claude Code, Cursor, others). We're at a hackathon: move fast, but follow the spec.

1. Read `README.md`, `idea/overview.md` and `specs/README.md` first. If they disagree, the newest file wins.
2. **Capturing:** when asked to capture a meeting, thought or research, put it in the folder `README.md` names for it, with a dated file name. Keep people's words. Never invent facts, quotes or numbers. For a transcript, write a `-summary.md` beside it with: decisions, open questions, action items (who and what), and any spec changes they imply.
3. **Building:** work on the first unticked step in `product/BUILD.md`, or the step you were asked for. Read every spec it names. Build what the spec says. Every acceptance criterion in scope gets a test whose name starts with its ID (`it("XX-1 ...")`). If something is ambiguous, pick the simplest reading, log it in `product/DECISIONS.md`, and keep going. Don't edit specs unless you were asked to.
4. **Done** means the tests pass, the box in `BUILD.md` is ticked, a line is added to the log at its bottom, and the work is committed with the step and criteria IDs in the message.
5. Work on your own branch, never `main`. Pull before starting and push when a step is done.
6. Never commit secrets (use `.env`, which is gitignored). This repo is public. Never deploy or create cloud resources unless a human asked you to.
7. Don't edit `meeting-recordings/` except to add new transcripts or summaries.
