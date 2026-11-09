"use client";
// The dungeon window: a winding path of rooms, one boss per talk. Skinned by the conference's
// generated theme (palette + boss noun) and laid out from a seed, so every player's path differs.
// A schematic dungeon, not a claim about the venue's floor plan.
import Image from "next/image";
import type { Attendee, CharacterClass, Room, Talk, Theme } from "@conquest/contracts";
import { classSpriteSource } from "./avatar";
import { formatTalkTime } from "../lib/time";
import styles from "./quest-map.module.css";

export type MapStop = {
  talk: Talk;
  reason: string;
  room: Room | undefined;
  speakerNames: string[];
};

/** Small stable hash (FNV-1a) so layouts and bosses are the same on every reload. */
export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mix(a: string, b: string, t: number): string {
  const p = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i]! - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

const CLASSES: CharacterClass[] = ["knight", "wizard", "rogue", "bard"];
const STOP_WORDS = new Set(["about", "beyond", "with", "from", "your", "into", "when", "what", "that", "this", "their", "using", "without"]);

/** "The Kubernetes Kraken": a word from the talk title plus the theme's boss noun. */
export function bossName(talk: Talk, theme: Theme): string {
  const words = talk.title.split(/[^A-Za-z0-9+]+/).filter((w) => w.length > 3 && !STOP_WORDS.has(w.toLowerCase()));
  const word = words.sort((a, b) => b.length - a.length)[hash(talk.id) % Math.max(1, Math.min(3, words.length))] ?? "Elder";
  const noun = theme.boss_noun.replace(/^\w/, (c) => c.toUpperCase());
  return `The ${word.replace(/^\w/, (c) => c.toUpperCase())} ${noun}`;
}

/** Each boss gets its own look: body, tint, size and facing, all from the talk id. */
export function bossLook(talkId: string) {
  const h = hash(talkId);
  return {
    sprite: CLASSES[h % 4]!,
    hue: (h >> 3) % 360,
    scale: 1 + ((h >> 11) % 4) * 0.08,
    flip: Boolean((h >> 15) & 1),
  };
}

export function DungeonWorld({ stops, selectedId, onSelect, attendee, theme, seed }: {
  stops: MapStop[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  attendee: Attendee;
  theme: Theme;
  seed: string;
}) {
  const s = hash(seed);
  const { bg, accent, fg } = theme.palette;
  const floor = mix(bg, fg, 0.12);
  const tile = mix(bg, fg, 0.2);
  const wall = mix(bg, accent, 0.35);
  const W = 360;
  const ROW = 168;
  const height = stops.length * ROW + 40;
  // A winding trail: each room drifts left or right of the last, never off the window.
  const positions = stops.map((_, i) => {
    const swing = ((s >> (i * 3)) % 3) - 1; // -1, 0, 1
    const side = i % 2 === 0 ? -1 : 1;
    return { x: W / 2 + side * (60 + swing * 18), y: 92 + i * ROW };
  });
  const decor = (i: number) => (s >> (i * 2 + 5)) % 3; // 0 torches, 1 pillars, 2 crystals

  return (
    <div className={styles.world} style={{ aspectRatio: `${W} / ${height}`, background: bg }}>
      <svg className={styles.floorPlan} viewBox={`0 0 ${W} ${height}`} aria-hidden="true" focusable="false">
        {positions.slice(1).map((point, index) => {
          const prev = positions[index]!;
          const mid = (prev.y + point.y) / 2;
          const d = `M${prev.x} ${prev.y}V${mid}H${point.x}V${point.y}`;
          return (
            <g key={index}>
              <path d={d} fill="none" stroke={wall} strokeWidth="34" />
              <path d={d} fill="none" stroke={tile} strokeWidth="22" />
            </g>
          );
        })}
        {positions.map(({ x, y }, i) => {
          const kind = decor(i);
          return (
            <g key={stops[i]!.talk.id}>
              <rect x={x - 76} y={y - 70} width="152" height="140" rx="6" fill={wall} />
              <rect x={x - 68} y={y - 62} width="136" height="124" rx="4" fill={floor} />
              {[-52, 52].map((dx) =>
                kind === 0 ? (
                  <g key={dx}>
                    <rect x={x + dx - 3} y={y - 58} width="6" height="12" fill={mix(bg, "#000000", 0.4)} />
                    <rect x={x + dx - 4} y={y - 64} width="8" height="8" fill={accent} />
                  </g>
                ) : kind === 1 ? (
                  <rect key={dx} x={x + dx - 6} y={y - 58} width="12" height="22" fill={wall} />
                ) : (
                  <polygon key={dx} points={`${x + dx},${y - 62} ${x + dx + 7},${y - 48} ${x + dx},${y - 40} ${x + dx - 7},${y - 48}`} fill={accent} opacity="0.8" />
                ),
              )}
            </g>
          );
        })}
      </svg>
      <ol role="list" aria-label="Dungeon path" className={styles.rooms}>
        {stops.map((stop, i) => {
          const { x, y } = positions[i]!;
          const selected = stop.talk.id === selectedId;
          const look = bossLook(stop.talk.id);
          return (
            <li key={stop.talk.id} style={{ left: `${((x - 68) / W) * 100}%`, top: `${((y - 62) / height) * 100}%`, width: `${(136 / W) * 100}%`, height: `${(124 / height) * 100}%` }}>
              <button
                type="button"
                className={`${styles.room} ${selected ? styles.selected : ""}`}
                style={{ color: fg, ["--accent" as string]: accent }}
                aria-pressed={selected}
                aria-label={`${bossName(stop.talk, theme)}: ${stop.talk.title}. ${formatTalkTime(stop.talk.starts_at)}, ${stop.talk.room}.`}
                onClick={() => onSelect(stop.talk.id)}
              >
                <time dateTime={stop.talk.starts_at}>{formatTalkTime(stop.talk.starts_at)}</time>
                <span
                  className={styles.boss}
                  aria-hidden="true"
                  style={{ filter: `hue-rotate(${look.hue}deg) saturate(1.4)`, transform: `scale(${look.flip ? -look.scale : look.scale}, ${look.scale})` }}
                >
                  <Image src={classSpriteSource(look.sprite, stop.talk.id)} alt="" width={72} height={72} sizes="72px" quality={100} />
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {(() => {
        const at = positions[Math.max(0, stops.findIndex((stop) => stop.talk.id === selectedId))];
        return at ? (
          <div className={styles.you} aria-hidden="true" style={{ left: `${((at.x - 22) / W) * 100}%`, top: `${((at.y + 52) / height) * 100}%` }}>
            <Image src={classSpriteSource(attendee.class, attendee.avatar_seed)} alt="" width={44} height={44} sizes="44px" quality={100} />
          </div>
        ) : null;
      })()}
    </div>
  );
}
