import { fixtures, type CharacterClass } from "@conquest/contracts";
import Link from "next/link";
import { Avatar } from "./avatar";
import { Icon } from "./icon";
import { ActionLink } from "./ui";

// Who each class is for mirrors game-api's keyword fallback (attendees/classes.ts).
const classes: { id: CharacterClass; name: string; fits: string }[] = [
  { id: "knight", name: "Knight", fits: "Platform, infrastructure and SRE" },
  { id: "wizard", name: "Wizard", fits: "Data, ML and AI" },
  { id: "rogue", name: "Rogue", fits: "Security and compliance" },
  { id: "bard", name: "Bard", fits: "Developers, community and the curious" },
];

const mapStops = fixtures.attendee.map
  .flatMap((boss) => {
    const talk = fixtures.talks.find(({ id }) => id === boss.talk_id);
    if (!talk) return [];
    const speakers = talk.speaker_ids
      .flatMap((id) => fixtures.speakers.find((speaker) => speaker.id === id)?.name ?? []);
    return [{ talk, speakers }];
  })
  .sort((a, b) => Date.parse(a.talk.starts_at) - Date.parse(b.talk.starts_at));

function HomeBossMap() {
  return (
    <div className="home-boss-map" aria-label="Sample boss map for Demo Con">
      <div className="home-boss-map__header">
        <span className="cq-chip">Sample map · Demo Con</span>
        <p>Follow the trail. Meet the bosses.</p>
      </div>
      <div className="home-boss-map__terrain">
        <span className="home-boss-map__start" aria-hidden="true">START</span>
        <ol className="home-boss-map__route" aria-label="Boss encounters in time order">
          {mapStops.map(({ talk, speakers }, index) => (
            <li key={talk.id} className={`home-boss-map__stop home-boss-map__stop--${index + 1}`}>
              <Link href={`/c/conf-demo/boss/${talk.id}`} className="home-boss-map__boss">
                <span className="home-boss-map__number" aria-hidden="true">{index + 1}</span>
                <span className="home-boss-map__room-art" aria-hidden="true">
                  <img
                    src={`/rooms/${index % 2 === 0 ? "keynote" : "workshop"}-v1.png`}
                    alt=""
                  />
                </span>
                <span className="home-boss-map__copy">
                  <span className="home-boss-map__eyebrow">{talk.room} · {new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(talk.starts_at))}</span>
                  <strong>{speakers.join(", ")}</strong>
                  <span>{talk.title}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
        <span className="home-boss-map__end" aria-hidden="true">YOUR QUEST</span>
      </div>
      <p className="home-boss-map__legend">Every speaker is a boss. Open an encounter to see why it fits your goals, where it is, and how to earn XP.</p>
    </div>
  );
}

export function Landing() {
  return (
    <div className="landing">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero__copy">
          <p className="cq-label">Make conferences fun</p>
          <h1 id="home-title">
            YOUR NEXT
            <br />
            GREAT <span>QUEST.</span>
          </h1>
          <p className="home-lede">
            Tell Conquest what you came to learn. It turns the schedule into a
            path of talks that fit, finds you a party, and keeps score
            in XP.
          </p>
          <div className="actions">
            <ActionLink href="/c/conf-demo/join">
              Start your adventure <Icon name="arrow-right" />
            </ActionLink>
            <ActionLink href="/organizer/new" secondary>
              Create a conference
            </ActionLink>
            <a href="#how-it-works" className="text-link">
              How it works
            </a>
          </div>
        </div>
        <figure className="home-stage">
          <ul className="home-party" aria-label="The four classes">
            {classes.map((c) => (
              <li key={c.id} className={`home-party__member home-party__member--${c.id}`}>
                <Avatar
                  name="An adventurer"
                  characterClass={c.id}
                  variant="full"
                  size={220}
                  eager
                />
              </li>
            ))}
          </ul>
          <figcaption className="home-stage__floor">
            <span className="cq-chip">Your party</span>
            <span>Knight · Wizard · Rogue · Bard</span>
          </figcaption>
        </figure>
      </section>

      <section
        id="how-it-works"
        className="home-section home-trail"
        aria-labelledby="trail-title"
      >
        <div className="home-section__intro">
          <p className="cq-label">Your map</p>
          <h2 id="trail-title">A path through the day.</h2>
          <p>
            Pick your goals. Conquest searches every talk and turns the best
            fits into one map of boss rooms, in time order, never two at once.
            Each speaker is a boss on the route.
          </p>
          <p>
            Open a boss to see why it was picked, then choose a list or
            step-free rooms only from your personal map.
          </p>
        </div>
        <div className="home-trail__map">
          <HomeBossMap />
        </div>
      </section>

      <section className="home-section home-classes" aria-labelledby="classes-title">
        <div className="home-section__intro">
          <p className="cq-label">Pick your class</p>
          <h2 id="classes-title">Every party needs all four.</h2>
          <p>
            We suggest a class from your profile. Pick another if it fits you
            better.
          </p>
        </div>
        <ul className="home-classes__grid">
          {classes.map((c) => (
            <li key={c.id} className="cq-card home-class">
              <span className="home-class__art">
                <Avatar
                  name="An adventurer"
                  characterClass={c.id}
                  variant="full"
                  size={160}
                />
              </span>
              <h3>{c.name}</h3>
              <p>{c.fits}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="home-organizer" aria-labelledby="organizer-title">
        <p className="cq-label">For organizers</p>
        <h2 id="organizer-title">
          YOUR CONFERENCE.
          <br />
          YOUR DUNGEON.
        </h2>
        <p>Describe a theme, set the quests, and watch the parties form.</p>
        <ActionLink href="/organizer/new">
          Create a conference <Icon name="arrow-right" />
        </ActionLink>
      </section>
    </div>
  );
}
