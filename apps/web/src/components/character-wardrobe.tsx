"use client";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import type { CharacterClass } from "@conquest/contracts";
import { Avatar } from "./avatar";
import { Icon } from "./icon";
import { CHARACTER_CLASSES } from "../lib/character-sheet";
import { createCharacter } from "../lib/character";
import defaultWardrobe from "../lib/default-wardrobe.json";
import styles from "./character-wardrobe.module.css";

export const DEFAULT_CHARACTER = defaultWardrobe.photo;
const equipment = {
  knight: "Armour & shield",
  wizard: "Robes, wand & spellbook",
  rogue: "Leather & utility gear",
  bard: "Scarf, jacket & lute",
};
export function CharacterWardrobe({
  name,
  sourcePhoto,
  photo,
  characterClass,
  suggestedClass,
  level = 1,
  disabled = false,
  onPhoto,
  onClass,
  onBusy,
  onSourceChange,
}: {
  name: string;
  sourcePhoto: string | null;
  photo: string;
  characterClass: CharacterClass;
  suggestedClass?: CharacterClass;
  level?: number;
  disabled?: boolean;
  onPhoto: (photo: string) => void;
  onClass: (value: CharacterClass) => void;
  onBusy: (busy: boolean) => void;
  onSourceChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState("");
  const request = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  useEffect(() => {
    request.current?.abort();
    request.current = null;
    setGenerating(false);
    onBusy(false);
    setNotice("");
    return () => request.current?.abort();
  }, [sourcePhoto, onBusy]);
  async function generate() {
    if (!sourcePhoto || generating || disabled) return;
    const controller = new AbortController();
    request.current = controller;
    setGenerating(true);
    onBusy(true);
    setNotice(
      "Drawing your character and four outfits. This can take a couple of minutes…",
    );
    try {
      const result = await createCharacter(sourcePhoto, controller.signal);
      if (controller.signal.aborted) return;
      if (result.photo) {
        onPhoto(result.photo);
        setNotice(
          "Your character is ready. Try every outfit—your face and hair stay the same.",
        );
      } else
        setNotice(
          result.reason === "unconfigured"
            ? "Photo conversion isn't configured yet. You can keep the default character and continue."
            : result.reason === "busy"
              ? "The character artist is busy. Try again shortly or keep your current character."
              : "Your photo couldn't be converted right now. Try again or keep your current character.",
        );
    } catch (error) {
      if (!controller.signal.aborted)
        setNotice(
          error instanceof Error
            ? error.message
            : "Try again or keep your current character.",
        );
    } finally {
      if (!controller.signal.aborted) {
        setGenerating(false);
        onBusy(false);
      }
    }
  }
  return (
    <section className={styles.studio} aria-label="Character studio">
      <div className={`cq-card ${styles.hero}`}>
        <div className={styles.stage} aria-busy={generating}>
          <span className={`cq-chip ${styles.badge}`}>
            {photo === DEFAULT_CHARACTER
              ? "DEFAULT CHARACTER"
              : "YOUR GAME CHARACTER"}
          </span>
          <Avatar
            name={name}
            photo={photo}
            characterClass={characterClass}
            size={288}
            variant="full"
          />
          <span className={styles.pedestal} aria-hidden="true" />
        </div>
        <div className={styles.details}>
          <p className="cq-label">Same you. Four adventures.</p>
          <h2 ref={heading} tabIndex={-1}>
            {name || "Your adventurer"}
          </h2>
          <p className={styles.className}>
            {characterClass} <span>Level {level}</span>
          </p>
          <p className="small-copy">
            Keep your face, hair and style. Choose the outfit and equipment for
            your adventure.
          </p>
          {sourcePhoto && (
            <div className={styles.source}>
              <Avatar name={name} photo={sourcePhoto} size={48} />
              <span className="field-hint">Your source photo</span>
            </div>
          )}
          <button
            className="cq-btn"
            type="button"
            onClick={generate}
            disabled={!sourcePhoto || generating || disabled}
          >
            {generating
              ? "Creating your character…"
              : photo === DEFAULT_CHARACTER
                ? "Create from my photo"
                : "Regenerate my character"}
            <Icon name="arrow-right" />
          </button>
          <p className="field-hint">
            Creating a character sends your photo to OpenAI to redraw it as game
            art. Review it before saving.
          </p>
          <label className={styles.upload}>
            {" "}
            {sourcePhoto
              ? "Replace source photo"
              : "Choose a photo to create your likeness"}
            <input
              aria-label="Character source photo"
              type="file"
              accept="image/*"
              disabled={disabled || generating}
              onChange={onSourceChange}
            />
          </label>
          {photo !== DEFAULT_CHARACTER && (
            <button
              className="text-button"
              type="button"
              disabled={generating || disabled}
              onClick={() => {
                onPhoto(DEFAULT_CHARACTER);
                setNotice("Default character selected.");
              }}
            >
              Use default character
            </button>
          )}
        </div>
      </div>
      <p className={styles.status} role="status" aria-live="polite">
        {notice}
      </p>
      <fieldset
        disabled={disabled || generating}
        className={`cq-card ${styles.outfits}`}
      >
        <legend className="cq-label">Choose your outfit</legend>
        <p className="field-hint">
          Only your outfit and equipment change. Your appearance stays yours.
        </p>
        <div className={styles.options}>
          {CHARACTER_CLASSES.map((option) => (
            <button
              className={`cq-tile ${styles.option}`}
              key={option}
              type="button"
              aria-label={`${option}${suggestedClass === option ? " (suggested)" : ""}`}
              aria-pressed={characterClass === option}
              onClick={() => onClass(option)}
            >
              <Avatar
                name={name}
                photo={photo}
                characterClass={option}
                size={128}
                variant="full"
              />
              <strong>
                <Icon name={option} />
                {option}
              </strong>
              <span>{equipment[option]}</span>
              <span>
                {characterClass === option
                  ? "Equipped"
                  : suggestedClass === option
                    ? "Suggested"
                    : "Try outfit"}
              </span>
            </button>
          ))}
        </div>
      </fieldset>
    </section>
  );
}
