import Link from "next/link";

// Landing (040 Pages). The real conference id comes from the organizer flow; conf-demo is the fixture.
export default function Home() {
  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "64px 16px" }}>
      <h1>Conquest</h1>
      <p>Make conferences fun.</p>
      <nav aria-label="Get started" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link href="/c/conf-demo/join">I&apos;m attending</Link>
        <Link href="/organizer/new">I&apos;m organizing</Link>
      </nav>
    </main>
  );
}
