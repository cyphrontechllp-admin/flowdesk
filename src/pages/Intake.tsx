import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader, Panel, PriorityPill, QueueDot } from "../components/ui";
import { DEFAULT_SETTINGS } from "../domain/defaults";
import { triage } from "../domain/triage";
import { QUEUE_LABEL, REQUEST_TYPES, SOURCES, type RequestType, type Source } from "../domain/types";
import { useDocumentTitle } from "../lib/theme";
import { useApp } from "../state/app";

const MAX_DETAILS = 400;

export default function Intake() {
  useDocumentTitle("Intake");
  const { settings, createRequest } = useApp();
  const navigate = useNavigate();
  const config = settings ?? DEFAULT_SETTINGS;

  const [client, setClient] = useState("");
  const [type, setType] = useState<RequestType>("Support escalation");
  const [source, setSource] = useState<Source>("Service request");
  const [details, setDetails] = useState("");
  const [ownerOverride, setOwnerOverride] = useState("");
  const [errors, setErrors] = useState<{ client?: string; details?: string }>({});
  const [busy, setBusy] = useState(false);

  const suggestion = useMemo(() => triage({ type, details }, config), [type, details, config]);
  const owner = ownerOverride || suggestion.owner;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const next = {
      client: client.trim() ? undefined : "Enter the client or account name.",
      details: details.trim() ? undefined : "Paste the client note or describe the request.",
    };
    setErrors(next);
    if (next.client) return void document.getElementById("client")?.focus();
    if (next.details) return void document.getElementById("details")?.focus();

    setBusy(true);
    const created = await createRequest({ client, type, source, details, owner: ownerOverride || undefined });
    setBusy(false);
    if (created) navigate(`/workspace/${created.id}`);
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Intake desk"
        title="Log a client signal"
        note="Capture the exact client note, source, and operating context so the right owner can take the first clean handoff."
      />

      <div className="two-col">
        <Panel eyebrow="New signal" title="Client context">
          <form className="form" onSubmit={onSubmit} noValidate>
            <label className="field">
              <span id="client-label">Client</span>
              <input
                id="client"
                aria-labelledby="client-label"
                value={client}
                maxLength={80}
                placeholder="Example: Northline Studio"
                aria-invalid={!!errors.client}
                aria-describedby={errors.client ? "client-error" : undefined}
                onChange={(event) => setClient(event.target.value)}
              />
              {errors.client ? <em id="client-error" className="field__error">{errors.client}</em> : null}
            </label>

            <div className="form__row form__row--even">
              <label className="field">
                <span>Request type</span>
                <select value={type} onChange={(event) => setType(event.target.value as RequestType)}>
                  {REQUEST_TYPES.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Source</span>
                <select value={source} onChange={(event) => setSource(event.target.value as Source)}>
                  {SOURCES.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="field">
              <span id="details-label">Request details</span>
              <textarea
                id="details"
                aria-labelledby="details-label"
                rows={7}
                value={details}
                maxLength={MAX_DETAILS}
                placeholder="Paste the client note, support context, approval need, or billing signal."
                aria-invalid={!!errors.details}
                aria-describedby={errors.details ? "details-error details-count" : "details-count"}
                onChange={(event) => setDetails(event.target.value)}
              />
              <span id="details-count" className="field__count">
                {details.length}/{MAX_DETAILS}
              </span>
              {errors.details ? <em id="details-error" className="field__error">{errors.details}</em> : null}
            </label>

            <label className="field">
              <span>Owner</span>
              <select value={ownerOverride} onChange={(event) => setOwnerOverride(event.target.value)}>
                <option value="">Suggested: {suggestion.owner}</option>
                {config.team.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>

            <button className="button button--primary" type="submit" disabled={busy}>
              {busy ? "Adding…" : "Add to board"}
            </button>
          </form>
        </Panel>

        <div className="stack-cols">
          <Panel eyebrow="Suggested routing" title="Where this will land">
            <div className="suggest" aria-live="polite">
              <div className="suggest__line">
                <QueueDot queue={suggestion.queue} />
                <strong>{QUEUE_LABEL[suggestion.queue]} queue</strong>
                <PriorityPill priority={suggestion.priority} />
              </div>
              <p>
                Owner: <strong>{owner}</strong>. Due in {config.slaHours[suggestion.priority]}h.
              </p>
              <ul className="reasons">
                {suggestion.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
              <p className="hint">Rule-based suggestion using the keywords and owners set in Settings. You can change owner and priority after adding.</p>
            </div>
          </Panel>

          <Panel eyebrow="Routing guide" title="Desk rules">
            <ul className="stack">
              {(Object.keys(config.routing) as (keyof typeof config.routing)[]).map((queue) => (
                <li key={queue}>
                  <strong>{QUEUE_LABEL[queue]}</strong>
                  <p>{config.routing[queue].keywords.slice(0, 5).join(", ")}</p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
