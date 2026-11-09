import Link from "next/link";
import { ActionLink } from "./ui";

export function Landing() {
  return (
    <div className="landing">
      <section className="hero">
        <div className="hero-copy">
          <p className="cq-label">Make conferences fun</p>
          <h1>
            YOUR NEXT
            <br />
            GREAT <span>QUEST.</span>
          </h1>
          <p className="hero-description">
            Find talks for your goals. Meet your party. Turn a conference into
            an adventure worth sharing.
          </p>
          <div className="actions">
            <ActionLink href="/c/conf-demo/join">
              Start your adventure <span aria-hidden="true">→</span>
            </ActionLink>
            <ActionLink href="/organizer/new" secondary>
              Create a conference
            </ActionLink>
          </div>
          <p className="hero-footnote">
            A personal path through the conference.
          </p>
        </div>
        <section
          className="hero-preview cq-card"
          aria-labelledby="preview-title"
        >
          <div className="preview-top">
            <span className="cq-chip">DEMO CON</span>
            <span className="cq-chip cq-chip--light">LEVEL 2</span>
          </div>
          <p className="cq-label">Next on your path</p>
          <h2 id="preview-title">
            Platform Engineering
            <br />
            Without Tears
          </h2>
          <div className="chips">
            <span className="cq-chip cq-chip--light">9:00 AM</span>
            <span className="cq-chip cq-chip--light">Hall A</span>
          </div>
          <p className="small-copy">Matches your goal: platform engineering.</p>
          <Link href="/c/conf-demo/boss/talk-1" className="cq-btn">
            View your next talk <span aria-hidden="true">→</span>
          </Link>
          <div className="preview-route" aria-label="Demo path">
            <span>01 / FIND A TALK</span>
            <span>02 / MEET AN ALLY</span>
            <span>03 / EARN XP</span>
          </div>
        </section>
      </section>
      <section className="journey-section" aria-labelledby="journey-title">
        <div className="section-intro">
          <p className="cq-label">Your conference, with a quest</p>
          <h2 id="journey-title">
            MORE FROM
            <br />
            EVERY SESSION.
          </h2>
          <Link href="/c/conf-demo/map" className="text-link">
            Explore the demo map <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="journey-cards">
          {[
            {
              number: "01",
              title: "Find your talks",
              text: "Choose your goals. Get a personal map of sessions that match.",
            },
            {
              number: "02",
              title: "Meet your party",
              text: "Connect with other attendees and explore the conference together.",
            },
            {
              number: "03",
              title: "Share your recap",
              text: "Take home a story of what you learned and who you met.",
            },
          ].map((card) => (
            <article className="journey-card cq-card" key={card.number}>
              <span className="cq-chip">{card.number}</span>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="organizer-strip">
        <p className="cq-label">For conference organizers</p>
        <h2>
          YOUR CONFERENCE.
          <br />
          YOUR DUNGEON.
        </h2>
        <p>Set the theme. Create the quests. Bring people together.</p>
        <ActionLink href="/organizer/new">
          Create your conference <span aria-hidden="true">→</span>
        </ActionLink>
      </section>
    </div>
  );
}
