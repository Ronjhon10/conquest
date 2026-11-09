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
