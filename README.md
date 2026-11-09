# Conquest

Our hackathon team's second brain and codebase. It's built spec first, and every conversation that matters gets written down here.

## Folders

| Folder | What goes in it |
| --- | --- |
| `idea/` | What we're building: the problem, who it's for, the pitch, the hackathon brief and judging criteria. Start at `idea/overview.md` |
| `research/` | What we learn from outside: APIs, competitors, links, notes |
| `meeting-recordings/` | Transcripts and summaries of our talks, plus the group chat log |
| `specs/` | What the product does, with numbered acceptance criteria. Spec first, then code. Start at `specs/README.md` |
| `product/` | The code. `BUILD.md` is the build checklist, `DECISIONS.md` logs judgment calls |
| `demo/` | The pitch, the demo script, the deck, screenshots |
| `brand-assets/` | Name ideas, logo, colors |

Add a folder when something doesn't fit, and add a row here when you do.

## How we work

1. **Talk, record, write it down.** Record any conversation where we decide something (a phone voice memo is fine). Put the transcript in `meeting-recordings/team/YYYY-MM-DD-HHMM-topic-transcript.md` and have Claude write `...-summary.md` next to it.
2. **Spec it.** Turn the decisions into a spec in `specs/` with numbered criteria (`XX-1`). Add the build steps to `product/BUILD.md`.
3. **Build it.** One branch per person or feature (`max/auth`, `jake/ui`). Never two people on one branch. Open a PR to `main` and merge it fast.
4. **Ship the demo.** `demo/` holds the script we rehearse.

This repo is **public**. Everything here, transcripts included, can be read by anyone. Never commit keys or secrets: they go in `.env`, which is gitignored.

Agents working in this repo: read `AGENTS.md`.
