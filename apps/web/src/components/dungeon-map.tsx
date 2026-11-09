"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import type { Attendee, Conference, Speaker, Talk } from "@conquest/contracts";
import { CONFERENCE_TIME_ZONE, formatTalkTime } from "../lib/time";
import { themeStyle } from "./ui";
import { DungeonWorld, type MapStop } from "./dungeon-world";
import styles from "./dungeon-map.module.css";

const motionQuery = "(prefers-reduced-motion: reduce)";
const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: CONFERENCE_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
function subscribeMotion(onChange: () => void) {
  const media = window.matchMedia?.(motionQuery);
  media?.addEventListener("change", onChange);
  return () => media?.removeEventListener("change", onChange);
}
function prefersList() {
  return window.matchMedia?.(motionQuery).matches ?? true;
}
function accessText(stop: MapStop) {
  const text = stop.room?.step_free === true ? "Step-free access" : stop.room?.step_free === false ? "Not step-free" : "Step-free access unconfirmed";
  return `${text}${stop.room?.step_free_note ? ` — ${stop.room.step_free_note}` : ""}`;
}
function TalkDetails({ stop, conf, selected = false }: { stop: MapStop; conf: string; selected?: boolean }) {
  return (
    <div className={styles.details}>
      <div className={styles.chips}>
        <time dateTime={stop.talk.starts_at}>{formatTalkTime(stop.talk.starts_at)}</time>
        <span>{stop.talk.room}</span>
      </div>
      <h3>{stop.talk.title}</h3>
      {stop.speakerNames.length > 0 && <p className={styles.speaker}>Speaker: {stop.speakerNames.join(", ")}</p>}
      <p>{stop.reason}</p>
      <p className={styles.access}>{accessText(stop)}</p>
      <Link className={selected ? "cq-btn" : "text-link"} href={`/c/${encodeURIComponent(conf)}/boss/${encodeURIComponent(stop.talk.id)}`}>
        {selected ? "View encounter" : stop.talk.title}
        {selected && <span aria-hidden="true">→</span>}
      </Link>
    </div>
  );
}

export function DungeonMap({ conference, attendee, talks, speakers = [], conf }: {
  conference: Conference;
  attendee: Attendee | null;
  talks: Talk[];
  speakers?: Speaker[];
  conf: string;
}) {
  const reducedMotion = useSyncExternalStore(subscribeMotion, prefersList, () => true);
  const [listChoice, setListChoice] = useState<boolean | null>(null);
  const [stepFreeOnly, setStepFreeOnly] = useState(false);
  const [dayChoice, setDayChoice] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const showList = listChoice ?? reducedMotion;
  const stops: MapStop[] = (attendee?.map ?? []).flatMap((boss) => {
    const talk = talks.find((talk) => talk.id === boss.talk_id);
    if (!talk) return [];
    const room = conference.rooms.find((room) => room.name === talk.room);
    const speakerNames = talk.speaker_ids.flatMap((id) => {
      const speaker = speakers.find((speaker) => speaker.id === id);
      return speaker ? [speaker.name] : [];
    });
    return [{ talk, reason: boss.reason, room, speakerNames }];
  }).sort((a, b) => Date.parse(a.talk.starts_at) - Date.parse(b.talk.starts_at));
  const days = [...new Set(stops.map((stop) => dayFormat.format(new Date(stop.talk.starts_at))))];
  const day = dayChoice && days.includes(dayChoice) ? dayChoice : days[0];
  const dayStops = stops.filter((stop) => dayFormat.format(new Date(stop.talk.starts_at)) === day);
  const visibleStops = stepFreeOnly ? dayStops.filter((stop) => stop.room?.step_free === true) : dayStops;
  const selected = visibleStops.find((stop) => stop.talk.id === selectedId) ?? visibleStops[0];
  const missingTalks = (attendee?.map.length ?? 0) - stops.length;
  // Level thresholds from spec 030; this displays progress without awarding XP.
  const levelStart = attendee ? (attendee.level - 1) ** 2 * 100 : 0;
  const levelEnd = attendee ? attendee.level ** 2 * 100 : 100;
  const levelProgress = Math.max(0, Math.min(levelEnd - levelStart, (attendee?.xp ?? 0) - levelStart));

  return (
    <section className={styles.map} style={themeStyle(conference.theme)}>
      <header className={styles.heading}>
        <p className="cq-label">{conference.theme.name}</p>
        <h2>Your {conference.theme.boss_noun} trail</h2>
        <p>{conference.theme.intro}</p>
      </header>
      {!attendee ? (
        <p><Link href={`/c/${encodeURIComponent(conf)}/join`}>Create your adventurer</Link> to get your personal map.</p>
      ) : (
        <>
          <div className={styles.controls}>
            <label><input type="checkbox" checked={showList} onChange={(event) => setListChoice(event.target.checked)} /> List view</label>
            <label><input type="checkbox" checked={stepFreeOnly} onChange={(event) => setStepFreeOnly(event.target.checked)} /> Step-free only</label>
          </div>
          <p className={styles.hint}>Times are in Salt Lake City time. The list keeps all days and every room’s access notes.</p>
          <p className={styles.count} role="status">{showList ? `${stops.length} talks in your list.` : `${visibleStops.length} of ${dayStops.length} talks on your path.`}</p>
          {missingTalks > 0 && <p role="alert">{missingTalks} {missingTalks === 1 ? "talk could" : "talks could"} not be loaded. Refresh to try again; your other talks are still available.</p>}
          {!stops.length ? (
            <p>{missingTalks ? "Your map will appear when the talks can be loaded." : "No talks on your map yet."}</p>
          ) : showList ? (
            <ol role="list" aria-label="Talk list" className={styles.list}>
              {stops.map((stop) => <li className="cq-card" key={stop.talk.id}><TalkDetails stop={stop} conf={conf} /></li>)}
            </ol>
          ) : (
            <div className={styles.mapFrame}>
              <div className={styles.hud}>
                <div className={styles.hudTop}>
                  <strong>CONQUEST</strong>
                  <div className={styles.xp}>
                    <span>LV {attendee.level}</span>
                    <progress aria-label="Progress to next level" max={levelEnd - levelStart} value={levelProgress} />
                    <span>{attendee.xp} XP</span>
                  </div>
                </div>
                <div className={styles.days} role="group" aria-label="Conference day">
                  {days.map((value, index) => (
                    <button type="button" key={value} aria-pressed={value === day} onClick={() => { setDayChoice(value); setSelectedId(null); }}>
                      Day {index + 1}<span className="sr-only"> · {value}</span>
                    </button>
                  ))}
                </div>
              </div>
              {visibleStops.length ? (
                <>
                  <DungeonWorld key={day} stops={visibleStops} selectedId={selected?.talk.id} onSelect={setSelectedId} attendee={attendee} />
                  {selected && (
                    <section className={styles.encounter} aria-label="Selected boss" aria-live="polite">
                      <p className={styles.selectedLabel}>Selected {conference.theme.boss_noun}</p>
                      <TalkDetails stop={selected} conf={conf} selected />
                    </section>
                  )}
                </>
              ) : (
                <p className={styles.empty}>No confirmed step-free rooms on this path. Switch to List view for all talks and access notes.</p>
              )}
              <nav className={styles.actionBar} aria-label="Map actions">
                <Link href={`/c/${encodeURIComponent(conf)}/map#quests`}>Quests</Link>
                {selected && <Link href={`/c/${encodeURIComponent(conf)}/boss/${encodeURIComponent(selected.talk.id)}`}>Talk actions</Link>}
                <Link href={`/c/${encodeURIComponent(conf)}/connect`}>Connect</Link>
              </nav>
            </div>
          )}
        </>
      )}
    </section>
  );
}
