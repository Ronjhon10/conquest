"use client";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import type { Attendee, CharacterClass } from "@conquest/contracts";
import { getApi, readableError } from "../lib/api";
import { currentAttendee } from "../lib/identity";
import { isCharacterSheet } from "../lib/character-sheet";
import { prepareProfilePhoto } from "../lib/photo";
import { characterSource, rememberCharacterSource } from "../lib/character";
import { CharacterWardrobe, DEFAULT_CHARACTER } from "./character-wardrobe";
import { ActionLink, ErrorNotice, LoadingNotice, PageHeading } from "./ui";

export function CharacterProfile({ conf }: { conf: string }) {
  const [attendee, setAttendee] = useState<Attendee | null>(null);
  const [characterClass, setClass] = useState<CharacterClass>("knight");
  const [sourcePhoto, setSourcePhoto] = useState<string | null>(null);
  const [photo, setPhoto] = useState(DEFAULT_CHARACTER);
  const [headline, setHeadline] = useState("");
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [missing, setMissing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    setMissing(false);
    const id =
      currentAttendee(conf) ??
      (process.env.NEXT_PUBLIC_FAKE_API === "1" ? "att-jane" : null);
    if (!id) {
      setMissing(true);
      return;
    }
    getApi()
      .attendee(id)
      .then(({ attendee: data }) => {
        if (!active) return;
        if (data.conference_id !== conf)
          throw new Error("That character belongs to a different conference.");
        setAttendee(data);
        setClass(data.class);
        setHeadline(data.headline);
        setPhoto(isCharacterSheet(data.photo) ? data.photo : DEFAULT_CHARACTER);
        setSourcePhoto(
          characterSource(conf, data.id) ??
            (isCharacterSheet(data.photo) ? null : data.photo),
        );
      })
      .catch((e) => {
        if (active) setError(readableError(e));
      });
    return () => {
      active = false;
    };
  }, [conf, attempt]);
  async function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || busy) return;
    setBusy(true);
    setError("");
    setSaved("");
    try {
      setSourcePhoto(await prepareProfilePhoto(file));
      setPhoto(DEFAULT_CHARACTER);
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(false);
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!attendee || busy || generating) return;
    setBusy(true);
    setError("");
    setSaved("");
    try {
      const result = await getApi().updateAttendee(attendee.id, {
        class: characterClass,
        photo,
        headline,
      });
      setAttendee(result.attendee);
      rememberCharacterSource(conf, attendee.id, sourcePhoto);
      setSaved(
        "Character saved. Your profile and map now use this appearance.",
      );
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page-container signup-page">
      <PageHeading eyebrow="Your profile" title="Your adventurer">
        One face. Your choice of outfit and gear.
      </PageHeading>
      {missing ? (
        <ActionLink href={`/c/${encodeURIComponent(conf)}/join`}>
          Create your adventurer
        </ActionLink>
      ) : !attendee ? (
        error ? (
          <ErrorNotice
            message={error}
            onRetry={() => setAttempt((n) => n + 1)}
          />
        ) : (
          <LoadingNotice />
        )
      ) : (
        <form className="signup-character-form" onSubmit={save}>
          {error && <ErrorNotice message={error} />}
          <CharacterWardrobe
            name={attendee.name}
            sourcePhoto={sourcePhoto}
            photo={photo}
            characterClass={characterClass}
            level={attendee.level}
            disabled={busy}
            onPhoto={(value) => {
              setPhoto(value);
              setSaved("");
            }}
            onClass={(value) => {
              setClass(value);
              setSaved("");
            }}
            onBusy={setGenerating}
            onSourceChange={choosePhoto}
          />
          <div className="cq-card form-field">
            <label htmlFor="character-headline">Headline</label>
            <input
              id="character-headline"
              className="cq-field"
              value={headline}
              onChange={(e) => {
                setHeadline(e.target.value);
                setSaved("");
              }}
              disabled={busy}
            />
          </div>
          <p role="status">{saved}</p>
          <div className="signup-actions">
            <ActionLink href={`/c/${encodeURIComponent(conf)}/map`} secondary>
              Back to map
            </ActionLink>
            <button
              className="cq-btn"
              disabled={busy || generating}
              type="submit"
            >
              {busy ? "Saving character…" : "Save character"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
