"use client";

import Image from "next/image";
import { useId } from "react";
import type { Attendee, Room, Talk } from "@conquest/contracts";
import { classSpriteSource } from "./avatar";
import { formatTalkTime } from "../lib/time";
import styles from "./dungeon-map.module.css";

export type MapStop = {
  talk: Talk;
  reason: string;
  room: Room | undefined;
  speakerNames: string[];
};

/** A schematic dungeon, not a claim about the venue's physical floor plan. */
export function DungeonWorld({ stops, selectedId, onSelect, attendee }: {
  stops: MapStop[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  attendee: Attendee;
}) {
  const patternId = useId().replace(/:/g, "");
  const rows = Math.ceil(stops.length / 2);
  const height = rows * 238 + 72;
  const positions = stops.map((_, index) => {
    const row = Math.floor(index / 2);
    const column = row % 2 === 0 ? index % 2 : 1 - index % 2;
    const singleLast = index === stops.length - 1 && stops.length % 2 === 1;
    return { x: singleLast ? 240 : 128 + column * 224, y: 122 + row * 238 };
  });
  const selectedPosition = positions[stops.findIndex((stop) => stop.talk.id === selectedId)];

  return (
    <div className={styles.worldScroll}>
      <div className={styles.world} style={{ aspectRatio: `480 / ${height}` }}>
        <svg className={styles.floorPlan} viewBox={`0 0 480 ${height}`} aria-hidden="true" focusable="false">
          <defs>
            <pattern id={`${patternId}-tiles`} width="24" height="24" patternUnits="userSpaceOnUse">
              <rect width="24" height="24" fill="#292c48" />
              <path d="M0 23V0H23" stroke="#454a6c" strokeWidth="2" fill="none" />
              <path d="M3 21H21V3" stroke="#1c2036" fill="none" />
            </pattern>
            <pattern id={`${patternId}-stone`} width="32" height="16" patternUnits="userSpaceOnUse">
              <rect width="32" height="16" fill="#555e89" />
              <path d="M0 0H32M0 0V16M16 0V8M0 8H32M32 8V16" stroke="#303750" strokeWidth="2" />
              <path d="M2 2H14M18 10H30" stroke="#7c87ac" strokeWidth="1" />
            </pattern>
          </defs>
          {positions.slice(1).map((point, index) => {
            const previous = positions[index]!;
            const midpoint = (previous.y + point.y) / 2;
            const d = `M${previous.x} ${previous.y}V${midpoint}H${point.x}V${point.y}`;
            return (
              <g key={index}>
                <path d={d} fill="none" stroke="#151a30" strokeWidth="54" />
                <path d={d} fill="none" stroke={`url(#${patternId}-stone)`} strokeWidth="46" />
                <path d={d} fill="none" stroke={`url(#${patternId}-tiles)`} strokeWidth="28" />
              </g>
            );
          })}
          {positions.map(({ x, y }, index) => (
            <g key={stops[index]!.talk.id}>
              <rect x={x - 94} y={y - 88} width="188" height="180" fill="#14182b" />
              <rect x={x - 90} y={y - 84} width="180" height="172" fill={`url(#${patternId}-stone)`} />
              <rect x={x - 78} y={y - 72} width="156" height="148" fill={`url(#${patternId}-tiles)`} stroke="#151a30" strokeWidth="4" />
              {[positions[index - 1], positions[index + 1]].flatMap((neighbor, door) => {
                if (!neighbor) return [];
                const horizontal = neighbor.y === y;
                const dx = horizontal ? (neighbor.x > x ? 76 : -96) : -14;
                const dy = horizontal ? -14 : (neighbor.y > y ? 72 : -90);
                return [<rect key={`door-${door}`} x={x + dx} y={y + dy} width={horizontal ? 20 : 28} height={horizontal ? 28 : 20} fill={`url(#${patternId}-tiles)`} />];
              })}
              {[-65, 65].map((offset) => (
                <g key={offset}>
                  <rect x={x + offset - 4} y={y - 66} width="8" height="16" fill="#191627" />
                  <rect x={x + offset - 5} y={y - 66} width="10" height="8" fill="#b46d35" />
                  <rect x={x + offset - 3} y={y - 70} width="6" height="10" fill="#ffd685" />
                  <rect x={x + offset - 1} y={y - 72} width="2" height="10" fill="#fff3c4" />
                </g>
              ))}
              <rect x={x - 6} y={y + 58} width="12" height="6" fill="#94dbed" stroke="#151a30" strokeWidth="2" />
            </g>
          ))}
        </svg>
        <ol role="list" aria-label="Dungeon path" className={styles.roomNodes}>
          {stops.map((stop, index) => {
            const { x, y } = positions[index]!;
            const selected = stop.talk.id === selectedId;
            return (
              <li key={stop.talk.id} style={{ left: `${(x - 74) / 480 * 100}%`, top: `${(y - 66) / height * 100}%`, width: `${148 / 480 * 100}%`, height: `${138 / height * 100}%` }}>
                <button
                  type="button"
                  className={`${styles.roomNode} ${selected ? styles.selectedRoom : ""}`}
                  aria-pressed={selected}
                  aria-label={`${stop.talk.title}. ${formatTalkTime(stop.talk.starts_at)}. ${stop.talk.room}. ${stop.reason}. ${stop.room?.step_free === true ? "Step-free access" : stop.room?.step_free === false ? "Not step-free" : "Step-free access unconfirmed"}${stop.room?.step_free_note ? `. ${stop.room.step_free_note}` : ""}`}
                  onClick={() => onSelect(stop.talk.id)}
                >
                  <time className={styles.roomTime} dateTime={stop.talk.starts_at}>{formatTalkTime(stop.talk.starts_at)}</time>
                  <span className={styles.bossSprite} aria-hidden="true">
                    <Image src={classSpriteSource("wizard", stop.talk.id)} alt="" width={96} height={96} sizes="96px" quality={100} />
                  </span>
                  <span className={styles.roomName}>{stop.talk.room}</span>
                </button>
              </li>
            );
          })}
        </ol>
        {selectedPosition && (
          <div className={styles.you} aria-hidden="true" style={{ left: `${(selectedPosition.x - 26) / 480 * 100}%`, top: `${(selectedPosition.y + 88) / height * 100}%` }}>
            <Image src={classSpriteSource(attendee.class, attendee.avatar_seed)} alt="" width={52} height={52} sizes="52px" quality={100} />
            <span>You</span>
          </div>
        )}
      </div>
    </div>
  );
}
