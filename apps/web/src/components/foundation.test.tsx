// @vitest-environment happy-dom
import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { fixtures } from "@conquest/contracts";
import { DEMO_CONFERENCE_ID } from "../lib/demo";
import { Landing } from "./landing";
import { RouteContent } from "./route-preview";
import { ErrorNotice, themeStyle } from "./ui";
import { HomeHero } from "./home-hero";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("WEB-1 renders the landing and every planned page shell with fixture data", () => {
  const landingHtml = renderToStaticMarkup(createElement(Landing));
  expect(landingHtml).toContain("Make conferences fun");
  // Two actions only: start (signup on the demo conference) and the live leaderboard.
  expect(landingHtml.match(/class="cq-btn/g)).toHaveLength(2);
  expect(landingHtml).toContain("Start your adventure");
  expect(landingHtml).toContain(`href="/c/${DEMO_CONFERENCE_ID}/join"`);
  expect(landingHtml).toContain(`href="/organizer/${DEMO_CONFERENCE_ID}/live"`);
  expect(landingHtml).not.toContain("conf-demo/boss");
  expect(landingHtml).toContain("home-hero__character");
  expect(landingHtml).toContain('aria-label="Sample boss map for KubeCon NA 2026"');
  expect(landingHtml).toContain("Every speaker is a boss.");
  for (const view of [
    "join",
    "map",
    "boss",
    "connect",
    "party",
    "recap",
    "new",
    "setup",
    "live",
    "report",
    "theme",
    "speaker",
  ]) {
    const html = renderToStaticMarkup(
      createElement(RouteContent, {
        view,
        conf: "conf-demo",
        talkId: "talk-1",
        data: {
          conference: fixtures.conference,
          talks: fixtures.talks,
          attendee: fixtures.attendee,
          rows: fixtures.leaderboard,
        },
      }),
    );
    expect(html).toMatch(/<h1[ >]/);
    expect(html).toContain("Conference preview");
  }
});
it("WEB-1 resets the start animation after a bfcache restore", () => {
  vi.useFakeTimers();
  const { container } = render(createElement(HomeHero));
  const start = screen.getByRole("link", { name: /Start your adventure/ });

  fireEvent.click(start);
  expect(container.querySelector(".home-hero__character--hop")).not.toBeNull();

  const pageShow = new Event("pageshow") as PageTransitionEvent;
  Object.defineProperty(pageShow, "persisted", { value: true });
  act(() => window.dispatchEvent(pageShow));

  expect(container.querySelector(".home-hero__character--hop")).toBeNull();
  fireEvent.click(start);
  expect(container.querySelector(".home-hero__character--hop")).not.toBeNull();
});
it("WEB-12 applies conference colors and the custom boss noun to the map shell", () => {
  const conference = structuredClone(fixtures.conference);
  conference.theme.boss_noun = "kraken";
  conference.theme.palette.bg = "#102030";
  const html = renderToStaticMarkup(
    createElement(RouteContent, {
      view: "map",
      conf: "conf-demo",
      data: {
        conference,
        talks: fixtures.talks,
        attendee: fixtures.attendee,
        rows: [],
      },
    }),
  );
  expect(html).toContain("Your kraken trail");
  expect(html).toContain("--dungeon-bg:#102030");
  expect(themeStyle(conference.theme)).toMatchObject({
    "--dungeon-fg": conference.theme.palette.fg,
    "--dungeon-accent": conference.theme.palette.accent,
  });
});
it("WEB-14 renders an accessible error with a visible recovery action", () => {
  const html = renderToStaticMarkup(
    createElement(ErrorNotice, {
      message: "Couldn't connect",
      onRetry: () => {},
    }),
  );
  expect(html).toContain('role="alert"');
  expect(html).toContain("Try again");
  expect(html).toContain("Couldn&#x27;t connect");
});
