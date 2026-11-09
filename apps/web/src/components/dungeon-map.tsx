"use client";
// The attendee map (040 /c/[conf]/map): today's bosses on a themed, winding path in a window that
// fills a phone and sits inside the page on a laptop. No controls: it shows today's day by itself
// (the next conference day before the event, the last one after). Screen readers get every talk,
// all days, with step-free notes, as a list (WEB-3, WEB-5).
import Link from "next/link";
import { useState } from "react";
import { xpForLevel } from "@conquest/contracts";
import type { Attendee, Conference, Speaker, Talk } from "@conquest/contracts";
import { CONFERENCE_TIME_ZONE, formatTalkTime } from "../lib/time";
import { Avatar } from "./avatar";
import { themeStyle } from "./ui";
import { bossName, DungeonWorld, type MapStop } from "./dungeon-world";
import styles from "./quest-map.module.css";

const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: CONFERENCE_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const dayLabel = new Intl.DateTimeFormat("en-US", { timeZone: CONFERENCE_TIME_ZONE, weekday: "long", month: "short", day: "numeric" });

export function accessText(stop: MapStop) {
  const text = stop.room?.step_free === true ? "Step-free access" : stop.room?.step_free === false ? "Not step-free" : "Step-free access unconfirmed";
  return `${text}${stop.room?.step_free_note ? `: ${stop.room.step_free_note}` : ""}`;
}

/** Today's conference day; before the event the first day, after it the last. */
export function pickDay(days: string[], now: Date): string | undefined {
  const today = dayKey.format(now);
  return days.find((d) => d >= today) ?? days.at(-1);
}

export function DungeonMap({ conference, attendee, talks, speakers = [], conf, now = new Date() }: {
  conference: Conference;
  attendee: Attendee | null;
  talks: Talk[];
  speakers?: Speaker[];
  conf: string;
  now?: Date;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { theme } = conference;
  const confHref = encodeURIComponent(conf);
  if (!attendee)
    return (
      <p>
        <Link className="cq-btn" href={`/c/${confHref}/join`}>Create your adventurer</Link>
      </p>
    );

  const stops: MapStop[] = attendee.map
    .flatMap((boss) => {
      const talk = talks.find((t) => t.id === boss.talk_id);
      if (!talk) return [];
      const room = conference.rooms.find((r) => r.name === talk.room);
      const speakerNames = talk.speaker_ids.flatMap((id) => speakers.find((sp) => sp.id === id)?.name ?? []);
      return [{ talk, reason: boss.reason, room, speakerNames }];
    })
    .sort((a, b) => Date.parse(a.talk.starts_at) - Date.parse(b.talk.starts_at));
  const days = [...new Set(stops.map((st) => dayKey.format(new Date(st.talk.starts_at))))];
  const day = pickDay(days, now);
  const todays = stops.filter((st) => dayKey.format(new Date(st.talk.starts_at)) === day);
  const selected = todays.find((st) => st.talk.id === selectedId) ?? todays[0];
  const missing = attendee.map.length - stops.length;
  const levelStart = xpForLevel(attendee.level);
  const levelEnd = xpForLevel(attendee.level + 1);
  const progress = Math.max(0, Math.min(levelEnd - levelStart, attendee.xp - levelStart));

  return (
    <section className={styles.map} style={themeStyle(theme)}>
      <header className={styles.head}>
        <p className="cq-label">{theme.name}</p>
        <h1 className="cq-slab">Your {theme.boss_noun} trail</h1>
        {day && <p className={styles.day}>{dayLabel.format(new Date(todays[0]?.talk.starts_at ?? now))} · {todays.length} {todays.length === 1 ? "talk" : "talks"} today</p>}
      </header>

      <div className={styles.player}>
        <Link href={`/c/${confHref}/profile`} aria-label="Edit your character">
          <Avatar name={attendee.name} photo={attendee.photo} characterClass={attendee.class} seed={attendee.avatar_seed} size={44} />
        </Link>
        <div className={styles.level}>
          <strong>{attendee.name}</strong>
          <span>Level {attendee.level}</span>
          <progress aria-label="Progress to next level" max={levelEnd - levelStart} value={progress} />
        </div>
        <div className={styles.stat}><strong>{attendee.xp}</strong><span>XP</span></div>
        <div className={styles.stat}><strong>{attendee.coins}</strong><span>coins</span></div>
      </div>

      {missing > 0 && <p role="alert">{missing} {missing === 1 ? "talk" : "talks"} couldn&apos;t load. Refresh to try again.</p>}

      <div className={styles.window}>
        {todays.length ? (
          <DungeonWorld
            stops={todays}
            selectedId={selected?.talk.id}
            onSelect={setSelectedId}
            attendee={attendee}
            theme={theme}
            seed={`${conference.id}:${attendee.id}:${day}`}
          />
        ) : (
          <p className={styles.empty}>No talks on your map yet.</p>
        )}
      </div>

      {selected && (
        <section className={`cq-card ${styles.encounter}`} aria-live="polite" aria-label="Selected boss">
          <p className="cq-label">{bossName(selected.talk, theme)}</p>
          <h2>{selected.talk.title}</h2>
          <p className={styles.meta}>
            {formatTalkTime(selected.talk.starts_at)} · {selected.talk.room}
            {selected.speakerNames.length > 0 && <> · {selected.speakerNames.join(", ")}</>}
          </p>
          <p>{selected.reason}</p>
          <Link className="cq-btn" href={`/c/${confHref}/boss/${encodeURIComponent(selected.talk.id)}`}>
            Fight this boss <span aria-hidden="true">→</span>
          </Link>
        </section>
      )}

      {attendee.quests.length > 0 && (
        <details className={`cq-card ${styles.quests}`}>
          <summary>Quests ({attendee.quests.length})</summary>
          <ul>
            {attendee.quests.map((q) => (
              <li key={q.id}>
                <strong>{q.title}</strong> · {q.xp} XP
                <br />
                {q.description}
              </li>
            ))}
          </ul>
        </details>
      )}

      <ol className="sr-only" aria-label="All your talks">
        {stops.map((st) => (
          <li key={st.talk.id}>
            <Link href={`/c/${confHref}/boss/${encodeURIComponent(st.talk.id)}`}>{st.talk.title}</Link>. {formatTalkTime(st.talk.starts_at)}, {st.talk.room}. {st.reason}. {accessText(st)}.
          </li>
        ))}
      </ol>
    </section>
  );
}
