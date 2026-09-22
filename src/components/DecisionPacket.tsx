import { useRef, useState } from "react";
import { PRIORITIES, QUEUE_LABEL, type HandoffRequest, type Priority } from "../domain/types";
import { formatDateTime, formatDue, timeAgo } from "../lib/format";
import { isOpen } from "../domain/metrics";
import { useApp } from "../state/app";
import { PriorityPill, QueueDot } from "./ui";

/** Detail view for one handoff. Mounted with key={request.id} so form state resets per request. */
export function DecisionPacket({ request }: { request: HandoffRequest }) {
  const { settings, assignOwner, changePriority, addNote, resolve, reopen } = useApp();
  const [owner, setOwner] = useState(request.owner);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState("");
  const [busy, setBusy] = useState(false);
  const noteField = useRef<HTMLTextAreaElement>(null);
  const open = isOpen(request);

  const team = settings?.team.includes(request.owner) ? settings.team : [request.owner, ...(settings?.team ?? [])];

  async function run(job: () => Promise<void>) {
    setBusy(true);
    try {
      await job();
    } finally {
      setBusy(false);
    }
  }

  async function submitNote() {
    if (!note.trim()) {
      setNoteError("Write a note first.");
      noteField.current?.focus();
      return;
    }
    await run(() => addNote(request.id, note));
    setNote("");
    setNoteError("");
  }

  async function close() {
    if (!note.trim()) {
      setNoteError("Add a resolution note before closing this handoff.");
      noteField.current?.focus();
      return;
    }
    await run(() => resolve(request.id, note));
    setNote("");
    setNoteError("");
  }

  return (
    <article className="packet" aria-labelledby="packet-title">
      <div className="packet__top">
        <div>
          <span className="packet__id">{request.id}</span>
          <h2 id="packet-title">{request.title}</h2>
          <p className="packet__meta">
            {request.client} · {request.type} · Source {request.source}
          </p>
        </div>
        <div className="packet__pills">
          <PriorityPill priority={request.priority} />
          <span className={`pill ${open ? "pill--status" : "pill--done"}`}>{request.status}</span>
        </div>
      </div>

      <dl className="facts">
        <div>
          <dt>Queue</dt>
          <dd>
            <QueueDot queue={request.queue} /> {QUEUE_LABEL[request.queue]}
          </dd>
        </div>
        <div>
          <dt>Owner</dt>
          <dd>{request.owner}</dd>
        </div>
        <div>
          <dt>{open ? "Due" : "Closed"}</dt>
          <dd>{open ? formatDue(request.dueAt, true) : request.resolvedAt ? formatDateTime(request.resolvedAt) : "—"}</dd>
        </div>
        <div>
          <dt>Opened</dt>
          <dd>{timeAgo(request.createdAt)}</dd>
        </div>
      </dl>

      <section className="block">
        <h3>What changed</h3>
        <p>{request.summary}</p>
      </section>

      <section className="block block--accent">
        <h3>Owner handoff</h3>
        <p>{request.nextStep}</p>
      </section>

      <section className="block" aria-label="Source evidence">
        <h3>Source evidence</h3>
        <ul className="stack">
          {request.evidence.map((item, i) => (
            <li key={i}>
              <strong>
                {item.source} · {formatDateTime(item.at)}
              </strong>
              <p>{item.text}</p>
            </li>
          ))}
        </ul>
      </section>

      {request.signals.length ? (
        <ul className="signals" aria-label="Signals">
          {request.signals.map((signal) => (
            <li key={signal}>{signal}</li>
          ))}
        </ul>
      ) : null}

      {open ? (
        <form className="form form--packet" onSubmit={(event) => event.preventDefault()}>
          <div className="form__row">
            <label className="field">
              <span>Owner</span>
              <select value={owner} onChange={(event) => setOwner(event.target.value)}>
                {team.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
            <button className="button button--secondary" type="button" disabled={busy || owner === request.owner} onClick={() => void run(() => assignOwner(request.id, owner))}>
              Assign owner
            </button>
          </div>

          <label className="field">
            <span>Priority</span>
            <select value={request.priority} disabled={busy} onChange={(event) => void run(() => changePriority(request.id, event.target.value as Priority))}>
              {PRIORITIES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span id="note-label">Note</span>
            <textarea
              ref={noteField}
              aria-labelledby="note-label"
              rows={3}
              value={note}
              maxLength={500}
              placeholder="Add an account note. Required to close the handoff."
              aria-invalid={!!noteError}
              aria-describedby={noteError ? "note-error" : undefined}
              onChange={(event) => {
                setNote(event.target.value);
                if (noteError) setNoteError("");
              }}
            />
            {noteError ? (
              <em id="note-error" className="field__error">
                {noteError}
              </em>
            ) : null}
          </label>
          <div className="action-row">
            <button className="button button--secondary" type="button" disabled={busy} onClick={() => void submitNote()}>
              Add note
            </button>
            <button className="button button--primary" type="button" disabled={busy} onClick={() => void close()}>
              Close handoff
            </button>
          </div>
        </form>
      ) : (
        <div className="closed-bar">
          <p>This handoff is closed. Reopen it if the customer needs more work.</p>
          <button className="button button--secondary" type="button" disabled={busy} onClick={() => void run(() => reopen(request.id))}>
            Reopen handoff
          </button>
        </div>
      )}

      <section className="block" aria-label="Activity trail">
        <h3>Activity trail</h3>
        <ol className="stack timeline">
          {request.history.map((item) => (
            <li key={item.id}>
              <strong>
                {item.actor} · <time dateTime={item.at}>{timeAgo(item.at)}</time>
              </strong>
              <p>{item.text}</p>
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
}
