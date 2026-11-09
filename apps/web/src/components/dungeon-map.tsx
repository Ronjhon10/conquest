"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import type { Attendee, Conference, Talk } from "@conquest/contracts";
import { formatTalkTime } from "../lib/time";
import { themeStyle } from "./ui";
import styles from "./dungeon-map.module.css";

const motionQuery = "(prefers-reduced-motion: reduce)";
function subscribeMotion(onChange: () => void) {
  const media = window.matchMedia?.(motionQuery);
  media?.addEventListener("change", onChange);
  return () => media?.removeEventListener("change", onChange);
}
function prefersList() {
  return window.matchMedia?.(motionQuery).matches ?? true;
}

/** Both presentations use the same ordered stops; only the path is filtered. */
export function DungeonMap({ conference, attendee, talks, conf }: {
  conference: Conference;
  attendee: Attendee | null;
  talks: Talk[];
  conf: string;
}) {
  const reducedMotion = useSyncExternalStore(subscribeMotion, prefersList, () => true);
  const [listChoice, setListChoice] = useState<boolean | null>(null);
  const [stepFreeOnly, setStepFreeOnly] = useState(false);
  const showList = listChoice ?? reducedMotion;
  const stops = (attendee?.map ?? []).flatMap((boss) => {
    const talk = talks.find((talk) => talk.id === boss.talk_id);
    if (!talk) return [];
    const room = conference.rooms.find((room) => room.name === talk.room);
    return [{ talk, reason: boss.reason, room }];
  }).sort((a, b) => Date.parse(a.talk.starts_at) - Date.parse(b.talk.starts_at));
  const visibleStops = showList || !stepFreeOnly
    ? stops : stops.filter(({ room }) => room?.step_free === true);

  return (
    <section className="dungeon-surface" style={themeStyle(conference.theme)}>
      <p className="cq-label">{conference.theme.name}</p>
      <h2>Your {conference.theme.boss_noun} trail</h2>
      <p>{conference.theme.intro}</p>
      {!attendee ? (
        <p><Link href={`/c/${encodeURIComponent(conf)}/join`}>Create your adventurer</Link> to get your personal map.</p>
      ) : (
        <>
          <div className={styles.controls}>
            <label><input type="checkbox" checked={showList} onChange={(event) => setListChoice(event.target.checked)} /> List view</label>
            <label><input type="checkbox" checked={stepFreeOnly} onChange={(event) => setStepFreeOnly(event.target.checked)} /> Step-free only</label>
          </div>
          <p className={styles.hint}>Times are in Salt Lake City time. Step-free only filters the path; the list keeps every talk and its access notes.</p>
          <p role="status">{showList ? `${stops.length} talks in your list.` : `${visibleStops.length} of ${stops.length} talks on your path.`}</p>
          {!stops.length ? (
            <p>No talks on your map yet.</p>
          ) : !visibleStops.length ? (
            <p>No confirmed step-free rooms on this path. Switch to List view for all talks and access notes.</p>
          ) : (
            <ol aria-label={showList ? "Talk list" : "Dungeon path"} className={`talk-list ${showList ? "" : styles.path}`}>
              {visibleStops.map(({ talk, reason, room }, index) => (
                <li className="cq-card" key={talk.id}>
                  {!showList && <span className={styles.marker} aria-hidden="true">{index + 1}</span>}
                  <div className="talk-meta"><time dateTime={talk.starts_at}>{formatTalkTime(talk.starts_at)}</time> · {talk.room}</div>
                  <Link href={`/c/${encodeURIComponent(conf)}/boss/${encodeURIComponent(talk.id)}`}>{talk.title}</Link>
                  <p>{reason}</p>
                  <p>{room?.step_free === true ? "Step-free access" : room?.step_free === false ? "Not step-free" : "Step-free access unconfirmed"}{room?.step_free_note ? ` — ${room.step_free_note}` : ""}</p>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  );
}
