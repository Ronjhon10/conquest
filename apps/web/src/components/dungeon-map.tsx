"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import type { Attendee, Conference, Speaker, Talk } from "@conquest/contracts";
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

/** Both presentations share ordered stops; only the illustrated path is filtered. */
export function DungeonMap({
  conference, attendee, talks, speakers = [], conf,
}: {
  conference: Conference;
  attendee: Attendee | null;
  talks: Talk[];
  speakers?: Speaker[];
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
    const speakerNames = talk.speaker_ids.flatMap((id) => {
      const speaker = speakers.find((speaker) => speaker.id === id);
      return speaker ? [speaker.name] : [];
    });
    return [{ talk, reason: boss.reason, room, speakerNames }];
  }).sort((a, b) => Date.parse(a.talk.starts_at) - Date.parse(b.talk.starts_at));
  const visibleStops = showList || !stepFreeOnly
    ? stops : stops.filter(({ room }) => room?.step_free === true);
  const missingTalks = (attendee?.map.length ?? 0) - stops.length;

  return (
    <section className={`dungeon-surface ${styles.map}`} style={themeStyle(conference.theme)}>
      <header className={styles.header}>
        <p className="cq-label">{conference.theme.name}</p>
        <h2>Your {conference.theme.boss_noun} trail</h2>
        <p>{conference.theme.intro}</p>
      </header>
      {!attendee ? (
        <p><Link href={`/c/${encodeURIComponent(conf)}/join`}>Create your adventurer</Link> to get your personal map.</p>
      ) : (
        <>
          <div className={styles.controls}>
            <label>
              <input type="checkbox" checked={showList} onChange={(event) => setListChoice(event.target.checked)} />
              List view
            </label>
            <label>
              <input type="checkbox" checked={stepFreeOnly} onChange={(event) => setStepFreeOnly(event.target.checked)} />
              Step-free only
            </label>
          </div>
          <p className={styles.hint}>Times are in Salt Lake City time. Step-free only filters the path; the list keeps every talk and its access notes.</p>
          <p className={styles.count} role="status">
            {showList ? `${stops.length} talks in your list.` : `${visibleStops.length} of ${stops.length} talks on your path.`}
          </p>
          {missingTalks > 0 && (
            <p role="alert">{missingTalks} {missingTalks === 1 ? "talk could" : "talks could"} not be loaded. Refresh to try again; your other talks are still available.</p>
          )}
          {!stops.length ? (
            <p>{missingTalks ? "Your map will appear when the talks can be loaded." : "No talks on your map yet."}</p>
          ) : !visibleStops.length ? (
            <p>No confirmed step-free rooms on this path. Switch to List view for all talks and access notes.</p>
          ) : (
            <>
              {!showList && (
                <p className={styles.trailStart}>Your adventure starts here <span aria-hidden="true">↓</span></p>
              )}
              <ol
                role="list"
                aria-label={showList ? "Talk list" : "Dungeon path"}
                className={showList ? `talk-list ${styles.list}` : styles.path}
              >
                {visibleStops.map(({ talk, reason, room, speakerNames }) => {
                  // Preserve stop numbers when the step-free filter hides a room.
                  const stopNumber = stops.findIndex((stop) => stop.talk.id === talk.id) + 1;
                  const art = stopNumber % 2 === 0 ? "workshop" : "keynote";
                  return (
                    <li className={showList ? "cq-card" : styles.room} key={talk.id}>
                      {!showList && (
                        <div className={styles.scene} aria-hidden="true">
                          <div className={styles.roomLabel}>
                            <span className={styles.marker}>{String(stopNumber).padStart(2, "0")}</span>
                            <span>{talk.room}</span>
                          </div>
                          <Image
                            className={styles.roomArt}
                            src={`/rooms/${art}-v1.png`}
                            width={640}
                            height={640}
                            sizes="(max-width: 600px) 300px, 380px"
                            quality={100}
                            alt=""
                          />
                          <span className={styles.sceneCaption}>{conference.theme.room_noun} {String(stopNumber).padStart(2, "0")}</span>
                        </div>
                      )}
                      <div className={styles.details}>
                        <div className={styles.chips}>
                          <time dateTime={talk.starts_at}>{formatTalkTime(talk.starts_at)}</time>
                          <span>{talk.room}</span>
                        </div>
                        <p className={styles.bossLabel}>{conference.theme.boss_noun} encounter</p>
                        <Link
                          className={styles.talkLink}
                          href={`/c/${encodeURIComponent(conf)}/boss/${encodeURIComponent(talk.id)}`}
                        >
                          {talk.title}
                        </Link>
                        {speakerNames.length > 0 && <p className={styles.speaker}>Speaker: {speakerNames.join(", ")}</p>}
                        <p className={styles.reason}>{reason}</p>
                        <p className={styles.access}>
                          <span aria-hidden="true">{room?.step_free === true ? "↗ " : "! "}</span>
                          {room?.step_free === true ? "Step-free access" : room?.step_free === false ? "Not step-free" : "Step-free access unconfirmed"}
                          {room?.step_free_note ? ` — ${room.step_free_note}` : ""}
                        </p>
                        {!showList && <span className={styles.enter} aria-hidden="true">View encounter <span>↗</span></span>}
                      </div>
                    </li>
                  );
                })}
              </ol>
              {!showList && <p className={styles.trailEnd}>Your trail. Your conference.</p>}
            </>
          )}
        </>
      )}
    </section>
  );
}
