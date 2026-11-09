// @vitest-environment happy-dom
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CharacterClass } from "@conquest/contracts";
import { CharacterWardrobe, DEFAULT_CHARACTER } from "./character-wardrobe";
import * as characters from "../lib/character";
import { JPEG_PREFIX, SHEET_MARKER } from "../lib/character-sheet";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function Harness() {
  const [photo, setPhoto] = useState(DEFAULT_CHARACTER);
  const [characterClass, setClass] = useState<CharacterClass>("knight");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <CharacterWardrobe
        name="Danny"
        photo={photo}
        sourcePhoto="data:image/jpeg;base64,AAAA"
        characterClass={characterClass}
        onPhoto={setPhoto}
        onClass={setClass}
        onBusy={setBusy}
        onSourceChange={() => {}}
      />
      <button disabled={busy}>Save</button>
    </>
  );
}
it("WEB-25 creates a likeness once and switches outfits using the same saved sheet", async () => {
  const photo = JPEG_PREFIX + btoa("\xff\xd8" + SHEET_MARKER + "generated");
  const generate = vi
    .spyOn(characters, "createCharacter")
    .mockResolvedValue({ photo, reason: null });
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(
    screen.getByRole("button", { name: /Create from my photo/ }),
  );
  await screen.findByText(/Your character is ready/);
  for (const name of ["wizard", "rogue", "bard"]) {
    await user.click(screen.getByRole("button", { name }));
    expect(
      screen.getByRole("button", { name }).getAttribute("aria-pressed"),
    ).toBe("true");
    const main = screen.getAllByRole("img", {
      name: `Danny's ${name} game character`,
    })[0]!;
    expect(main.querySelector("image")?.getAttribute("href")).toBe(photo);
  }
  expect(generate).toHaveBeenCalledTimes(1);
});
it("WEB-24 keeps signup available on conversion errors and prevents saving an unfinished render", async () => {
  let release!: () => void;
  vi.spyOn(characters, "createCharacter").mockImplementation(async () => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    return { photo: null, reason: "unavailable" };
  });
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(
    screen.getByRole("button", { name: /Create from my photo/ }),
  );
  expect(
    (screen.getByRole("button", { name: "Save" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  release();
  await screen.findByText(/couldn't be converted/);
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "Save" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
  expect(screen.getByText("DEFAULT CHARACTER")).toBeTruthy();
});
