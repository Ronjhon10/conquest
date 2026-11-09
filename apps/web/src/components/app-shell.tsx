"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Icon } from "./icon";
import { Brand } from "./brand";
import mapStyles from "./dungeon-map.module.css";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const immersive = /^\/c\/[^/]+\/map\/?$/.test(pathname ?? "");
  const fake = process.env.NEXT_PUBLIC_FAKE_API === "1";
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {!immersive && <header className="site-header">
        <Link href="/" className="brand" aria-label="Conquest home">
          <Brand />
        </Link>
        <nav aria-label="Main navigation">
          <Link href="/play">Play</Link>
          <Link href="/organize" className="nav-organize">
            Organize <Icon name="arrow-up-right" />
          </Link>
        </nav>
      </header>}
      <main id="main" className={immersive ? mapStyles.routeShell : undefined}>
        {fake && !immersive && (
          <div className="demo-banner">
            Demo world{" "}
            <span>Sample conference · your character stays in this tab</span>
          </div>
        )}
        {children}
      </main>
      {!immersive && <footer className="site-footer">
        <span className="brand-small"><Brand compact /></span>
        <p>Find your talks. Meet your party.</p>
        <span>Made for the moments between sessions.</span>
      </footer>}
    </>
  );
}
