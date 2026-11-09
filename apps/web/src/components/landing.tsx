import { HomeBossMap } from "./home-boss-map";
import { HomeHero } from "./home-hero";

export function Landing() {
  return (
    <div className="landing">
      <HomeHero />

      <section className="home-section home-trail" aria-labelledby="trail-title">
        <div className="home-section__intro">
          <p className="cq-label">Your map</p>
          <h2 id="trail-title">A path through the day.</h2>
          <p>
            Pick your goals. Conquest searches every KubeCon talk and turns the
            best fits into one map of boss rooms, in time order, never two at once.
          </p>
        </div>
        <div className="home-trail__map">
          <HomeBossMap />
        </div>
      </section>
    </div>
  );
}
