# Meeting Recordings

Transcripts and notes from our talks. This repo is public, so everything here is too.

## Naming

`YYYY-MM-DD-HHMM-topic-transcript.md` with `YYYY-MM-DD-HHMM-topic-summary.md` beside it. Whiteboard photos go beside them as `YYYY-MM-DD-HHMM-topic-whiteboard.jpg` with a `-whiteboard.md` that transcribes the text. Strip location data before committing. Audio files are optional. If you add one, keep it under 25 MB. Prefer the transcript.

## Recording to repo

1. Record on your phone (Voice Memos on iPhone transcribes for you), or with Otter, Granola, or a Zoom/Meet transcript.
2. Paste the transcript into a new `-transcript.md` file in `team/` (or your own folder).
3. Ask Claude: "summarize meeting-recordings/team/<file> per AGENTS.md". It writes the summary: decisions, open questions, action items, spec changes.
4. Commit both files and push.

## Folders

- `team/`: full-team talks
- `groupchat/`: the team chat, one file per day (`YYYY-MM-DD.md`)
- `<name>/`: each person's own notes and voice memos. Make your folder when you need it.
