import { Icon } from "./icon";
import { DEMO_CONFERENCE_ID } from "../lib/demo";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { Theme } from "@conquest/contracts";

export function themeStyle(theme: Theme): CSSProperties {
  return {
    "--dungeon-bg": theme.palette.bg,
    "--dungeon-fg": theme.palette.fg,
    "--dungeon-accent": theme.palette.accent,
  } as CSSProperties;
}
export function PageHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <p className="cq-label">{eyebrow}</p>
      <h1 className="cq-slab">{title}</h1>
      {children && <p className="page-description">{children}</p>}
    </header>
  );
}
export function Panel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel cq-card ${className}`}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
export function ActionLink({
  href,
  children,
  secondary = false,
}: {
  href: string;
  children: ReactNode;
  secondary?: boolean;
}) {
  return (
    <Link
      className={`cq-btn ${secondary ? "cq-btn--secondary" : ""}`}
      href={href}
    >
      {children}
    </Link>
  );
}
export function ErrorNotice({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="error-notice" role="alert">
      <h2>Let’s try that again</h2>
      <p>{message}</p>
      {onRetry && (
        <button className="cq-btn cq-btn--secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
export function LoadingNotice() {
  return (
    <div className="loading-notice" role="status">
      <span className="loading-dot" aria-hidden="true" /> Preparing your
      adventure…
    </div>
  );
}
export function AppShell({ children }: { children: ReactNode }) {
  const fake = process.env.NEXT_PUBLIC_FAKE_API === "1";
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <Link href="/" className="brand" aria-label="Conquest home">
          CONQUEST
        </Link>
        <nav aria-label="Main navigation">
          <Link href={`/c/${DEMO_CONFERENCE_ID}/map`}>My map</Link>
          <Link href="/organizer/new" className="nav-organize">
            Organizers <Icon name="arrow-up-right" />
          </Link>
        </nav>
      </header>
      <main id="main">
        {fake && (
          <div className="demo-banner">
            Demo world{" "}
            <span>Sample conference · your character stays in this tab</span>
          </div>
        )}
        {children}
      </main>
      <footer className="site-footer">
        <span className="brand-small">CONQUEST</span>
        <p>Find your talks. Meet your party.</p>
        <span>Made for the moments between sessions.</span>
      </footer>
    </>
  );
}
