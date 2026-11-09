import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { fixtures } from "@conquest/contracts";
import { Avatar, classSpriteSource } from "./avatar";
import defaultWardrobe from "../lib/default-wardrobe.json";
import { RouteContent, type PreviewData } from "./route-preview";
it("WEB-25 renders outfit windows from one saved character sheet at every avatar size", () => {
  for (const variant of ["portrait", "full"] as const)
    for (const characterClass of [
      "knight",
      "wizard",
      "rogue",
      "bard",
    ] as const) {
      const html = renderToStaticMarkup(
        createElement(Avatar, {
          name: "Danny",
          photo: defaultWardrobe.photo,
          characterClass,
          variant,
          size: 40,
          eager: true,
        }),
      );
      expect(html.includes(defaultWardrobe.photo)).toBe(true);
      expect(html).toContain(`${characterClass} game character`);
      expect(html).toContain("overflow:hidden");
      expect(html).toContain("viewBox=");
    }
});
it("WEB-16 gives all four classes distinct deterministic sprites with text alternatives", () => {
  const classes = ["knight", "wizard", "rogue", "bard"] as const;
  expect(new Set(classes.map((c) => classSpriteSource(c, "seed"))).size).toBe(
    4,
  );
  for (const characterClass of classes) {
    expect(classSpriteSource(characterClass, "seed")).toBe(
      classSpriteSource(characterClass, "seed"),
    );
    const html = renderToStaticMarkup(
      createElement(Avatar, { name: "Danny", characterClass, seed: "seed" }),
    );
    expect(html).toContain(`alt="Danny&#x27;s ${characterClass} character"`);
  }
});
it("WEB-16 shows profile photos on map, leaderboard and allies, with sprite fallbacks", () => {
  const photo = "data:image/jpeg;base64,AAAA";
  for (const view of ["map", "live", "connect"]) {
    const data: PreviewData = {
      conference: fixtures.conference,
      talks: fixtures.talks,
      attendee: { ...fixtures.attendee, photo },
      rows: fixtures.leaderboard.map((r) => ({ ...r, photo })),
      allies: fixtures.allies.map((a) => ({ ...a, photo })),
    };
    const html = renderToStaticMarkup(
      createElement(RouteContent, { data, conf: "conf-demo", view }),
    );
    expect(html).toContain("avatar-photo");
    expect(html).toContain(photo);
    expect(html).toContain("profile photo");
    if (data.attendee) data.attendee.photo = null;
    data.rows.forEach((r) => (r.photo = null));
    data.allies?.forEach((a) => (a.photo = null));
    expect(
      renderToStaticMarkup(
        createElement(RouteContent, { data, conf: "conf-demo", view }),
      ),
    ).toContain("avatar-sprite");
  }
});
