"use client";
// Home hero (WEB-1): one character that hops when you start your adventure, then signup opens.
import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { DEMO_CONFERENCE_ID } from "../lib/demo";
import { Avatar } from "./avatar";
import { Icon } from "./icon";

export const HOP_MS = 520;

export function HomeHero() {
  const [hopping, setHopping] = useState(false);
  const leaving = useRef(false);
  const joinHref = `/c/${DEMO_CONFERENCE_ID}/join`;

  useEffect(() => {
    const reset = (e: PageTransitionEvent) => {
      if (e.persisted) {
        leaving.current = false;
        setHopping(false);
      }
    };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  function start(e: MouseEvent<HTMLAnchorElement>) {
    // New tab, modified click or reduced motion: just follow the link.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    e.preventDefault();
    if (leaving.current) return;
    leaving.current = true;
    setHopping(true);
    window.setTimeout(() => window.location.assign(joinHref), HOP_MS);
  }

  return (
    <section className="home-hero" aria-labelledby="home-title">
      <div className="home-hero__copy">
        <p className="cq-label">Make conferences fun</p>
        <h1 id="home-title">
          YOUR NEXT
          <br />
          GREAT <span>QUEST.</span>
        </h1>
        <p className="home-lede">
          Tell Conquest what you came to learn. It turns the schedule into a path of talks that fit, finds you a party,
          and keeps score in XP.
        </p>
        <div className="actions">
          <Link className="cq-btn" href={joinHref} onClick={start}>
            Start your adventure <Icon name="arrow-right" />
          </Link>
          <Link className="cq-btn cq-btn--secondary" href={`/organizer/${DEMO_CONFERENCE_ID}/live`}>
            See the leaderboard
          </Link>
        </div>
      </div>
      <figure className="home-stage">
        <div className="home-hero__ground">
          <span className={`home-hero__character${hopping ? " home-hero__character--hop" : ""}`}>
            <Avatar name="Your adventurer" characterClass="knight" variant="full" size={260} eager />
          </span>
        </div>
        <figcaption className="home-stage__floor">
          <span className="cq-chip">Your adventurer</span>
          <span>Knight, Wizard, Rogue or Bard: you pick at signup</span>
        </figcaption>
      </figure>
    </section>
  );
}
