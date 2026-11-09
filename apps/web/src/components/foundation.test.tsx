import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { fixtures } from "@conquest/contracts";
import { Landing } from "./landing";
import { RouteContent } from "./route-preview";
import { ErrorNotice, themeStyle } from "./ui";

it("WEB-1 renders the landing and every planned page shell with fixture data", () => {
  const landingHtml = renderToStaticMarkup(createElement(Landing));
  expect(landingHtml).toContain("Make conferences fun");
  expect(landingHtml).toContain("Start your adventure");
  expect(landingHtml).toContain('href="/organizer/new"');
  expect(landingHtml).toContain("Create a conference");
  expect(landingHtml).toContain('class="text-link"');
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
