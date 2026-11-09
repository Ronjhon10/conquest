"use client";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Attendee, Party } from "@conquest/contracts";
import { getApi, readableError, type Api } from "../lib/api";
import { currentAttendee } from "../lib/identity";
import { Avatar } from "./avatar";
import { Icon } from "./icon";
import { ErrorNotice, LoadingNotice, Panel } from "./ui";

const MAX_MEMBERS = 4;

/** Page for view `party` (route /c/[conf]/party). Reads the attendee from local identity. */
export function PartyPage({ conf }: { conf: string }) {
  return (
    <PartyView
      conf={conf}
      api={getApi}
      attendeeId={() => currentAttendee(conf)}
    />
  );
}

// Dependency seams (api, attendeeId) keep tests on the same UI as the real page.
export function PartyView({
  conf,
  api,
  attendeeId,
}: {
  conf: string;
  api: () => Api;
  attendeeId: () => string | null;
}) {
  const [me, setMe] = useState<string | null | undefined>(undefined);
  const [party, setParty] = useState<Party | null>(null);
  const [members, setMembers] = useState<Record<string, Attendee>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [announcement, setAnnouncement] = useState("");

  const loadMembers = useCallback(
    async (next: Party) => {
      const found = await Promise.all(
        next.member_ids.map((id) =>
          api()
            .attendee(id)
            .then((r) => r.attendee)
            .catch(() => null),
        ),
      );
      const byId: Record<string, Attendee> = {};
      for (const a of found) if (a) byId[a.id] = a;
      setMembers(byId);
    },
    [api],
  );
  const load = useCallback(async () => {
    const id = attendeeId();
    setMe(id);
    setLoadError("");
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { party: existing } = await api().attendee(id);
      setParty(existing);
      if (existing) await loadMembers(existing);
    } catch (error) {
      setLoadError(readableError(error));
    } finally {
      setLoading(false);
    }
  }, [api, attendeeId, loadMembers]);
  useEffect(() => {
    void load();
    try {
      const shared = new URLSearchParams(window.location.search).get("join");
      if (shared) setCode(shared);
    } catch {
      /* No window during tests of other environments. */
    }
  }, [load]);

  async function submit(
    event: FormEvent,
    action: () => Promise<Party>,
    done: (party: Party) => string,
  ) {
    event.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      const next = await action();
      setParty(next);
      await loadMembers(next);
      setAnnouncement(done(next));
    } catch (error) {
      setFormError(readableError(error));
      setAnnouncement("");
    } finally {
      setBusy(false);
    }
  }
  function create(event: FormEvent) {
    const trimmed = name.trim();
    if (!trimmed) {
      event.preventDefault();
      setFormError("Give your party a name to create it.");
      return Promise.resolve();
    }
    return submit(
      event,
      async () =>
        (await api().createParty({ attendee_id: me!, name: trimmed })).party,
      (p) => `Party ${p.name} created. Share its code so friends can join.`,
    );
  }
  function join(event: FormEvent) {
    const trimmed = code.trim();
    if (!trimmed) {
      event.preventDefault();
      setFormError("Enter a party code to join.");
      return Promise.resolve();
    }
    return submit(
      event,
      async () =>
        (await api().joinParty(trimmed, { attendee_id: me! })).party,
      (p) => `You joined ${p.name}.`,
    );
  }

  if (loading) return <LoadingNotice />;
  if (loadError) return <ErrorNotice message={loadError} onRetry={load} />;
  if (!me)
    return (
      <Panel title="Create your adventurer first">
        <p>You need an adventurer before you can gather a party.</p>
        <Link
          className="cq-btn"
          href={`/c/${encodeURIComponent(conf)}/join`}
        >
          Create your adventurer
        </Link>
      </Panel>
    );

  const live = (
    <div aria-live="polite" role="status" className="party-status">
      {announcement}
    </div>
  );
  const errorLine = formError && (
    <p className="field-error" role="alert">
      {formError}
    </p>
  );

  if (party)
    return (
      <div className="preview-grid">
        <Panel title={party.name}>
          <p>
            Party code to share: <strong className="party-code">{party.id}</strong>
          </p>
          <p>
            <Link
              className="text-link"
              href={`/c/${encodeURIComponent(conf)}/party?join=${encodeURIComponent(party.id)}`}
            >
              Invite link
            </Link>
          </p>
          <p>
            <Icon name="people" /> {party.member_ids.length} of {MAX_MEMBERS}{" "}
            adventurers. Party XP bonus: when a party mate has already checked
            into a talk, your check-in earns x1.25 XP.
          </p>
          {live}
        </Panel>
        <Panel title="Party members">
          <ul className="allies-list">
            {party.member_ids.map((id) => {
              const member = members[id];
              return (
                <li key={id}>
                  <Avatar
                    name={member?.name ?? "Adventurer"}
                    photo={member?.photo}
                    characterClass={member?.class}
                    seed={member?.avatar_seed ?? id}
                  />
                  <div>
                    <strong>{member?.name ?? "Adventurer"}</strong>
                    {id === me && <span> (you)</span>}
                    {member && <p>{member.class}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
    );

  return (
    <div className="preview-grid">
      <Panel title="Start a party">
        <p>
          Adventure together: when a party mate has already checked into a
          talk, your check-in earns a x1.25 XP party bonus. Parties hold up to{" "}
          {MAX_MEMBERS}.
        </p>
        <form onSubmit={create} className="form-fields" noValidate>
          <div className="form-field">
            <label htmlFor="party-name">Party name</label>
            <input
              id="party-name"
              className="cq-field"
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <button className="cq-btn" type="submit" disabled={busy}>
            Create party
          </button>
        </form>
      </Panel>
      <Panel title="Join a party">
        <p>Ask a friend for their party code, then enter it here.</p>
        <form onSubmit={join} className="form-fields" noValidate>
          <div className="form-field">
            <label htmlFor="party-code">Party code</label>
            <input
              id="party-code"
              className="cq-field"
              value={code}
              autoComplete="off"
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <button
            className="cq-btn cq-btn--secondary"
            type="submit"
            disabled={busy}
          >
            Join party
          </button>
        </form>
        {errorLine}
        {live}
      </Panel>
    </div>
  );
}
