"use client";
import { Icon } from "./icon";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import type {
  CharacterClass,
  DraftAttendeeRequest,
  DraftAttendeeResponse,
} from "@conquest/contracts";
import { getApi, readableError, type Api } from "../lib/api";
import {
  attendeeRequest,
  draftRequest,
  initialGoals,
  validateProfile,
  type ProfileErrors,
  type ProfileFields,
} from "../lib/signup";
import { prepareProfilePhoto } from "../lib/photo";
import { rememberAttendee } from "../lib/identity";
import { Avatar } from "./avatar";
import { ErrorNotice, LoadingNotice, PageHeading } from "./ui";

const classes: CharacterClass[] = ["knight", "wizard", "rogue", "bard"];
export function Signup({ conf }: { conf: string }) {
  const router = useRouter();
  return (
    <SignupForm
      conf={conf}
      api={getApi}
      navigate={(path) => router.push(path)}
    />
  );
}
// Dependency seams keep interaction tests on the same UI as the real page.
export function SignupForm({
  conf,
  api,
  navigate,
}: {
  conf: string;
  api: () => Api;
  navigate: (path: string) => void;
}) {
  const [conferenceName, setConferenceName] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [stage, setStage] = useState<"profile" | "character">("profile");
  const [fields, setFields] = useState<ProfileFields>({
    linkedin_url: "",
    name: "",
    headline: "",
    about: "",
  });
  const [fieldErrors, setFieldErrors] = useState<ProfileErrors>({});
  const [profile, setProfile] = useState<DraftAttendeeRequest | null>(null);
  const [draft, setDraft] = useState<DraftAttendeeResponse | null>(null);
  const [characterClass, setCharacterClass] =
    useState<CharacterClass>("knight");
  const [goals, setGoals] = useState<string[]>([]);
  const [customGoal, setCustomGoal] = useState("");
  const [goalError, setGoalError] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const busyRef = useRef(false);
  const photoVersion = useRef(0);
  const characterHeading = useRef<HTMLHeadingElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let active = true;
    setLoadError("");
    api()
      .conference(conf)
      .then(({ conference }) => {
        if (active) setConferenceName(conference.name);
      })
      .catch((e) => {
        if (active) setLoadError(readableError(e));
      });
    return () => {
      active = false;
      photoVersion.current++;
    };
  }, [api, conf, loadAttempt]);
  useEffect(() => {
    if (stage === "character") characterHeading.current?.focus();
  }, [stage]);
  function change(field: keyof ProfileFields, value: string) {
    setFields((old) => ({ ...old, [field]: value }));
    setFieldErrors((old) => ({ ...old, [field]: undefined }));
    setError("");
  }
  async function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const version = ++photoVersion.current;
    setProcessingPhoto(true);
    setPhotoError("");
    setPhoto(null);
    try {
      const prepared = await prepareProfilePhoto(file);
      if (version === photoVersion.current) setPhoto(prepared);
    } catch (e) {
      if (version === photoVersion.current)
        setPhotoError(
          e instanceof Error
            ? e.message
            : "Choose another photo or continue without one.",
        );
    } finally {
      if (version === photoVersion.current) setProcessingPhoto(false);
    }
  }
  async function reviewCharacter(event: FormEvent) {
    event.preventDefault();
    if (busyRef.current || processingPhoto) return;
    const errors = validateProfile(fields);
    setFieldErrors(errors);
    setError("");
    if (Object.keys(errors).length) {
      document
        .getElementById(errors.linkedin_url ? "linkedin" : "name")
        ?.focus();
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      const input = draftRequest(conf, fields);
      const result = await api().draft(input);
      setProfile(input);
      setDraft(result);
      setCharacterClass(result.class);
      setGoals(initialGoals(result));
      setStage("character");
    } catch (e) {
      setError(readableError(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  function addGoal() {
    const goal = customGoal.trim();
    if (!goal) return;
    if (goals.some((g) => g.toLowerCase() === goal.toLowerCase())) {
      setCustomGoal("");
      return;
    }
    if (goals.length >= 6) {
      setGoalError("Choose up to six goals. Remove one before adding another.");
      return;
    }
    setGoals((old) => [...old, goal]);
    setCustomGoal("");
    setGoalError("");
  }
  async function enterDungeon(event: FormEvent) {
    event.preventDefault();
    if (busyRef.current || !profile || !draft) return;
    if (!goals.length) {
      setGoalError("Choose at least one goal for your conference.");
      return;
    }
    if (customGoal.trim()) {
      setGoalError("Add your typed goal or clear the field before continuing.");
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const { attendee } = await api().createAttendee(
        attendeeRequest(profile, draft, characterClass, goals, photo),
      );
      rememberAttendee(conf, attendee.id);
      navigate(`/c/${encodeURIComponent(conf)}/map`);
    } catch (e) {
      setError(readableError(e));
      busyRef.current = false;
      setBusy(false);
    }
  }
  if (loadError)
    return (
      <div className="page-container">
        <ErrorNotice
          message={loadError}
          onRetry={() => setLoadAttempt((n) => n + 1)}
        />
      </div>
    );
  if (!conferenceName)
    return (
      <div className="page-container">
        <LoadingNotice />
      </div>
    );
  return (
    <div className="page-container signup-page">
      <PageHeading eyebrow={conferenceName} title="Create your adventurer">
        A few details, a character, and the talks you want to discover.
      </PageHeading>
      <ol className="signup-steps" aria-label="Signup progress">
        <li aria-current={stage === "profile" ? "step" : undefined}>
          01 / Your profile
        </li>
        <li aria-current={stage === "character" ? "step" : undefined}>
          02 / Character & goals
        </li>
      </ol>
      {error && <ErrorNotice message={error} />}
      {stage === "profile" ? (
        <form
          onSubmit={reviewCharacter}
          noValidate
          className="cq-card signup-form"
        >
          <fieldset disabled={busy} className="form-fields">
            <legend className="cq-label">Your profile</legend>
            <div className="form-field">
              <label htmlFor="linkedin">
                LinkedIn profile link <span>(required)</span>
              </label>
              <input
                id="linkedin"
                className="cq-field"
                type="text"
                inputMode="url"
                autoComplete="url"
                required
                value={fields.linkedin_url}
                onChange={(e) => change("linkedin_url", e.target.value)}
                aria-invalid={Boolean(fieldErrors.linkedin_url)}
                aria-describedby={`linkedin-hint${fieldErrors.linkedin_url ? " linkedin-error" : ""}`}
                placeholder="linkedin.com/in/your-name"
              />
              <p id="linkedin-hint" className="field-hint">
                Copy your profile link from LinkedIn (Share profile → Copy
                link). We only link to it; enter your details below.
              </p>
              {fieldErrors.linkedin_url && (
                <p id="linkedin-error" className="field-error" role="alert">
                  {fieldErrors.linkedin_url}
                </p>
              )}
            </div>
            <div className="photo-field">
              <Avatar
                name={fields.name.trim() || "Your adventurer"}
                photo={photo}
              />
              <div>
                <label htmlFor="profile-photo">
                  Profile photo <span>(optional)</span>
                </label>
                <input
                  ref={fileInput}
                  id="profile-photo"
                  type="file"
                  accept="image/*"
                  onChange={choosePhoto}
                  aria-describedby="photo-hint photo-status"
                />
                <p id="photo-hint" className="field-hint">
                  Choose from your camera or library. We’ll crop it to a square.
                  You can also use your class character.
                </p>
                <p id="photo-status" role="status" className="field-hint">
                  {processingPhoto
                    ? "Preparing your photo…"
                    : photo
                      ? "Photo ready."
                      : photoError}
                </p>
                {photo && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      photoVersion.current++;
                      setPhoto(null);
                      if (fileInput.current) fileInput.current.value = "";
                    }}
                  >
                    Remove photo
                  </button>
                )}
              </div>
            </div>
            <div className="form-field">
              <label htmlFor="name">
                Name <span>(required)</span>
              </label>
              <input
                id="name"
                className="cq-field"
                autoComplete="name"
                required
                value={fields.name}
                onChange={(e) => change("name", e.target.value)}
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? "name-error" : undefined}
              />
              {fieldErrors.name && (
                <p id="name-error" className="field-error" role="alert">
                  {fieldErrors.name}
                </p>
              )}
            </div>
            <div className="form-field">
              <label htmlFor="headline">
                Headline <span>(optional)</span>
              </label>
              <input
                id="headline"
                className="cq-field"
                autoComplete="organization-title"
                value={fields.headline}
                onChange={(e) => change("headline", e.target.value)}
                placeholder="e.g. Platform engineer"
              />
            </div>
            <div className="form-field">
              <label htmlFor="about">
                About you <span>(optional)</span>
              </label>
              <textarea
                id="about"
                className="cq-field"
                rows={4}
                value={fields.about}
                onChange={(e) => change("about", e.target.value)}
                placeholder="What do you work on? What are you curious about?"
              />
            </div>
          </fieldset>
          <button
            className="cq-btn signup-cta"
            disabled={busy || processingPhoto}
            type="submit"
          >
            {busy ? (
              "Preparing your character…"
            ) : (
              <>
                Choose your character <Icon name="arrow-right" />
              </>
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={enterDungeon} className="signup-character-form">
          <section className="cq-card character-preview">
            <Avatar
              name={fields.name}
              photo={photo}
              characterClass={characterClass}
              seed={draft?.avatar_seed}
              size={224}
              variant="full"
            />
            <div>
              <h2 ref={characterHeading} tabIndex={-1}>
                {fields.name}
              </h2>
              <p className="character-class-name">{characterClass}</p>
              <span className="cq-chip">READY FOR LEVEL 1</span>
            </div>
          </section>
          <fieldset disabled={busy} className="cq-card class-fieldset">
            <legend className="cq-label">Choose your class</legend>
            <div className="class-options">
              {classes.map((option) => (
                <button
                  key={option}
                  type="button"
                  className="cq-tile class-option"
                  aria-label={`${option}${draft?.class === option ? " (suggested)" : ""}`}
                  aria-pressed={characterClass === option}
                  onClick={() => setCharacterClass(option)}
                >
                  <Avatar
                    name={option}
                    size={112}
                    characterClass={option}
                    seed={draft?.avatar_seed}
                  />
                  <span className="class-option-label">
                    <Icon name={option} />
                    <strong>{option}</strong>
                  </span>
                  <span>
                    {draft?.class === option ? "Suggested" : "Choose class"}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset disabled={busy} className="cq-card goals-fieldset">
            <legend className="cq-label">
              What do you want from this conference?
            </legend>
            <p className="field-hint">
              Your suggested goals are selected. Keep them, change them, or add
              your own. Choose up to six.
            </p>
            <div className="goal-options">
              {[
                ...new Set([...(draft ? initialGoals(draft) : []), ...goals]),
              ].map((goal) => (
                <button
                  type="button"
                  className="goal-chip"
                  key={goal}
                  aria-pressed={goals.includes(goal)}
                  onClick={() => {
                    setGoalError("");
                    if (goals.includes(goal))
                      setGoals((old) => old.filter((g) => g !== goal));
                    else if (goals.length < 6)
                      setGoals((old) => [...old, goal]);
                    else setGoalError("Choose up to six goals.");
                  }}
                >
                  <Icon name={goals.includes(goal) ? "check" : "plus"} />
                  {goal}
                </button>
              ))}
            </div>
            <div className="custom-goal">
              <label htmlFor="custom-goal">Add a goal</label>
              <div>
                <input
                  id="custom-goal"
                  className="cq-field"
                  value={customGoal}
                  maxLength={160}
                  onChange={(e) => {
                    setCustomGoal(e.target.value);
                    setGoalError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addGoal();
                    }
                  }}
                  placeholder="e.g. Meet other designers"
                />
                <button
                  className="cq-btn cq-btn--secondary"
                  type="button"
                  onClick={addGoal}
                >
                  Add
                </button>
              </div>
            </div>
            {goalError && (
              <p role="alert" className="field-error">
                {goalError}
              </p>
            )}
          </fieldset>
          <div className="signup-actions">
            <button
              type="button"
              className="cq-btn cq-btn--secondary"
              disabled={busy}
              onClick={() => {
                setStage("profile");
                setError("");
              }}
            >
              Back
            </button>
            <button className="cq-btn signup-cta" type="submit" disabled={busy}>
              {busy ? (
                "Building your map…"
              ) : (
                <>
                  Enter the dungeon <Icon name="arrow-right" />
                </>
              )}
            </button>
          </div>
        </form>
      )}
      <p role="status" className="sr-only">
        {busy ? "Saving your adventurer. Please wait." : ""}
      </p>
    </div>
  );
}
