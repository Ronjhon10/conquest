import { fixtures, type CharacterClass } from "@conquest/contracts";
import { Avatar } from "./avatar";
import { DungeonMap } from "./dungeon-map";
import { Icon } from "./icon";
import { ActionLink } from "./ui";

// Who each class is for mirrors game-api's keyword fallback (attendees/classes.ts).
const classes: { id: CharacterClass; name: string; fits: string }[] = [
  { id: "knight", name: "Knight", fits: "Platform, infrastructure and SRE" },
  { id: "wizard", name: "Wizard", fits: "Data, ML and AI" },
  { id: "rogue", name: "Rogue", fits: "Security and compliance" },
  { id: "bard", name: "Bard", fits: "Developers, community and the curious" },
];

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
            fits into boss rooms on your map, in time order, never two at once.
            Each speaker is the boss of their room.
          </p>
          <p>
            Each stop says why it was picked. Prefer a list, or step-free rooms
            only? Switch with one tap.
          </p>
        </div>
        <div className="home-trail__map">
          <span className="cq-chip cq-chip--light">Sample map · Demo Con</span>
          <DungeonMap
            conference={fixtures.conference}
            attendee={fixtures.attendee}
            talks={fixtures.talks}
            speakers={fixtures.speakers}
            conf="conf-demo"
          />
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
