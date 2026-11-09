"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Icon } from "./icon";
import { Brand } from "./brand";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Attendee pages share one tab bar (bottom on phones, under the header on laptops); not on signup.
  const attendee = /^\/c\/([^/]+)\/(map|boss|connect|party|recap|profile)(\/|$)/.exec(pathname ?? "");
  const fake = process.env.NEXT_PUBLIC_FAKE_API === "1";
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <Link href="/" className="brand" aria-label="Conquest home">
          <Brand />
        </Link>
        <nav aria-label="Main navigation">
          <Link href="/play">Play</Link>
          <Link href="/organize" className="nav-organize">
            Organize <Icon name="arrow-up-right" />
          </Link>
        </nav>
      </header>
      {attendee && <AttendeeTabs conf={attendee[1]!} current={attendee[2]!} />}
      <main id="main" className={attendee ? "with-tabs" : undefined}>
        {fake && (
          <div className="demo-banner">
            Demo world{" "}
            <span>Sample conference · your character stays in this tab</span>
          </div>
        )}
        {children}
      </main>
      <footer className="site-footer">
        <span className="brand-small"><Brand compact /></span>
        <p>Find your talks. Meet your party.</p>
        <span>Made for the moments between sessions.</span>
      </footer>
    </>
  );
}

const TABS = [
  ["map", "Map", "sword"],
  ["connect", "Allies", "people"],
  ["party", "Party", "knight"],
  ["recap", "Recap", "quests"],
  ["profile", "You", "wizard"],
] as const;

/** The attendee tab bar: one nav for every attendee page. The boss page belongs to Map. */
export function AttendeeTabs({ conf, current }: { conf: string; current: string }) {
  const active = current === "boss" ? "map" : current;
  return (
    <nav className="attendee-tabs" aria-label="Attendee pages">
      {TABS.map(([route, label, icon]) => (
        <Link key={route} href={`/c/${conf}/${route}`} aria-current={route === active ? "page" : undefined}>
          <Icon name={icon} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
