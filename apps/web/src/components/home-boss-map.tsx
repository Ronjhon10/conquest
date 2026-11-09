"use client";
// Home page sample map (WEB-1): a real path through KubeCon NA 2026, ranked by search-api for
// three sample goals, linking to real boss pages on the demo conference.
import type { BossSlot, Speaker, Talk } from "@conquest/contracts";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getApi } from "../lib/api";
import { DEMO_CONFERENCE_ID, SAMPLE_GOALS } from "../lib/demo";
import { formatTalkTime } from "../lib/time";

type Stop = { boss: BossSlot; talk: Talk; speakers: Speaker[] };

export function HomeBossMap() {
  const [stops, setStops] = useState<Stop[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const api = getApi();
    api
      .rank({ goals: SAMPLE_GOALS, about: "", limit: 6 })
      .then(async ({ bosses }) => {
        const found = await Promise.allSettled(bosses.map((boss) => api.talk(boss.talk_id)));
        return bosses.flatMap((boss, i) => {
          const r = found[i];
          return r?.status === "fulfilled" ? [{ boss, talk: r.value.talk, speakers: r.value.speakers }] : [];
        });
      })
      .then((s) => active && setStops(s))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="home-boss-map" aria-label="Sample boss map for KubeCon NA 2026" aria-busy={!stops && !failed}>
      <div className="home-boss-map__header">
        <span className="cq-chip">Sample map · KubeCon NA 2026</span>
        <p>Goals: {SAMPLE_GOALS.join(", ")}. Follow the trail. Meet the bosses.</p>
      </div>
      <div className="home-boss-map__terrain">
        <span className="home-boss-map__start" aria-hidden="true">START</span>
        {failed ? (
          <p className="home-boss-map__legend">The map couldn&apos;t load right now. Start your adventure to get your own.</p>
        ) : !stops ? (
          <p className="home-boss-map__legend">Charting a path through KubeCon…</p>
        ) : (
          <ol className="home-boss-map__route" aria-label="Boss encounters in time order">
            {stops.map(({ boss, talk, speakers }, index) => (
              <li key={talk.id} className={`home-boss-map__stop home-boss-map__stop--${index + 1}`}>
                <Link href={`/c/${DEMO_CONFERENCE_ID}/boss/${talk.id}`} className="home-boss-map__boss">
                  <span className="home-boss-map__number" aria-hidden="true">{index + 1}</span>
                  <span className="home-boss-map__room-art" aria-hidden="true">
                    <img src={`/rooms/${index % 2 === 0 ? "keynote" : "workshop"}-v1.png`} alt="" />
                  </span>
                  <span className="home-boss-map__copy">
                    <span className="home-boss-map__eyebrow">{talk.room} · {formatTalkTime(talk.starts_at)}</span>
                    <strong>{speakers.map((s) => s.name).join(", ")}</strong>
                    <span>{talk.title}</span>
                    <span className="home-boss-map__eyebrow">{boss.reason}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
        <span className="home-boss-map__end" aria-hidden="true">YOUR QUEST</span>
      </div>
      <p className="home-boss-map__legend">Every speaker is a boss. Open an encounter to see why it fits your goals, where it is, and how to earn XP.</p>
    </div>
  );
}
