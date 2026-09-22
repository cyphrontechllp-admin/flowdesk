import { useMemo, useState, type FormEvent } from "react";
import { PageHeader, Panel } from "../components/ui";
import { loadTheme, saveTheme } from "../api/client";
import { PRIORITIES, QUEUES, QUEUE_LABEL, type Priority, type Queue, type Settings, type ThemePref } from "../domain/types";
import { applyTheme, useDocumentTitle } from "../lib/theme";
import { useApp } from "../state/app";

const parseKeywords = (text: string) => [...new Set(text.split(/[,\n]/).map((k) => k.trim().toLowerCase()).filter(Boolean))];
const keywordText = (settings: Settings) => Object.fromEntries(QUEUES.map((q) => [q, settings.routing[q].keywords.join(", ")])) as Record<Queue, string>;

export default function SettingsPage() {
  useDocumentTitle("Settings");
  const { settings, saveSettings, resetDemoData } = useApp();
  if (!settings) return null;
  return <SettingsForm key={JSON.stringify(settings)} saved={settings} save={saveSettings} reset={resetDemoData} />;
}

function SettingsForm({ saved, save, reset }: { saved: Settings; save: (s: Settings) => Promise<boolean>; reset: () => Promise<void> }) {
  const [draft, setDraft] = useState<Settings>(() => structuredClone(saved));
  const [keywords, setKeywords] = useState(() => keywordText(saved));
  const [newMember, setNewMember] = useState("");
  const [theme, setTheme] = useState<ThemePref>(loadTheme);
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const next = useMemo<Settings>(
    () => ({ ...draft, routing: Object.fromEntries(QUEUES.map((q) => [q, { ...draft.routing[q], keywords: parseKeywords(keywords[q]) }])) as Settings["routing"] }),
    [draft, keywords],
  );
  const dirty = JSON.stringify(next) !== JSON.stringify(saved);

  function addMember() {
    const name = newMember.trim();
    if (!name || draft.team.some((m) => m.toLowerCase() === name.toLowerCase())) return;
    setDraft({ ...draft, team: [...draft.team, name] });
    setNewMember("");
  }

  function removeMember(name: string) {
    if (draft.team.length <= 1) return;
    const team = draft.team.filter((m) => m !== name);
    const routing = Object.fromEntries(QUEUES.map((q) => [q, draft.routing[q].owner === name ? { ...draft.routing[q], owner: team[0]! } : draft.routing[q]])) as Settings["routing"];
    setDraft({ ...draft, team, routing });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const problems: string[] = [];
    for (const p of PRIORITIES) {
      const hours = next.slaHours[p];
      if (!Number.isInteger(hours) || hours < 1 || hours > 720) problems.push(`${p} response target must be a whole number of hours between 1 and 720.`);
    }
    for (const q of QUEUES) if (!next.routing[q].keywords.length) problems.push(`${QUEUE_LABEL[q]} needs at least one keyword.`);
    setErrors(problems);
    if (problems.length) return;

    setBusy(true);
    await save(next);
    setBusy(false);
  }

  function changeTheme(value: ThemePref) {
    setTheme(value);
    saveTheme(value);
    applyTheme(value);
  }

  return (
    <div className="page">
      <PageHeader eyebrow="Routing setup" title="Desk rules" note="Control who owns the first response when a client issue touches support, scope, billing, or delivery access." />

      <form onSubmit={onSubmit} noValidate className="settings">
        {errors.length ? (
          <div className="alert" role="alert">
            <strong>Fix these before saving</strong>
            <ul>
              {errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="two-col">
          <Panel eyebrow="Owners" title="First response map">
            <p className="muted">Intake uses these rules and keywords to suggest a queue, owner and priority.</p>
            <div className="rules">
              {QUEUES.map((q) => (
                <fieldset key={q} className="rule">
                  <legend>{QUEUE_LABEL[q]}</legend>
                  <div className="form__row form__row--even">
                    <label className="field">
                      <span>Owner</span>
                      <select value={draft.routing[q].owner} onChange={(e) => setDraft({ ...draft, routing: { ...draft.routing, [q]: { ...draft.routing[q], owner: e.target.value } } })}>
                        {draft.team.map((m) => (
                          <option key={m}>{m}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Default priority</span>
                      <select value={draft.routing[q].priority} onChange={(e) => setDraft({ ...draft, routing: { ...draft.routing, [q]: { ...draft.routing[q], priority: e.target.value as Priority } } })}>
                        {PRIORITIES.map((p) => (
                          <option key={p}>{p}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="field">
                    <span>Keywords (comma separated)</span>
                    <textarea rows={2} value={keywords[q]} onChange={(e) => setKeywords({ ...keywords, [q]: e.target.value })} />
                  </label>
                </fieldset>
              ))}
            </div>
          </Panel>

          <div className="stack-cols">
          <Panel eyebrow="People" title="Team">
            <ul className="chips">
              {draft.team.map((name) => (
                <li key={name}>
                  {name}
                  <button type="button" aria-label={`Remove ${name}`} disabled={draft.team.length <= 1} onClick={() => removeMember(name)}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <div className="form__row">
              <label className="field">
                <span>Add owner</span>
                <input
                  value={newMember}
                  maxLength={40}
                  placeholder="Team or person"
                  onChange={(e) => setNewMember(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addMember();
                    }
                  }}
                />
              </label>
              <button className="button button--secondary" type="button" onClick={addMember}>
                Add
              </button>
            </div>
            <p className="hint">Removing an owner moves any rule that used them to the first remaining owner.</p>
          </Panel>

          <Panel eyebrow="Response targets" title="SLA hours by priority">
            <div className="form__row form__row--even">
              {PRIORITIES.map((p) => (
                <label className="field" key={p}>
                  <span>{p}</span>
                  <input
                    type="number"
                    min={1}
                    max={720}
                    value={Number.isNaN(draft.slaHours[p]) ? "" : draft.slaHours[p]}
                    onChange={(e) => setDraft({ ...draft, slaHours: { ...draft.slaHours, [p]: e.target.valueAsNumber } })}
                  />
                </label>
              ))}
            </div>
            <p className="hint">New requests get a due time this many hours after they are logged.</p>
          </Panel>

          <Panel eyebrow="Alerts" title="Notifications">
            <ul className="toggles">
              {(
                [
                  ["dailyDigest", "Daily digest email", "Open and overdue handoffs each morning."],
                  ["slackAlerts", "Slack alerts", "Post new High priority handoffs to the desk channel."],
                  ["overdueEmail", "Overdue email", "Email the owner when a handoff passes its due time."],
                ] as const
              ).map(([key, label, help]) => (
                <li key={key}>
                  <label>
                    <input type="checkbox" checked={draft.notifications[key]} onChange={(e) => setDraft({ ...draft, notifications: { ...draft.notifications, [key]: e.target.checked } })} />
                    <span>
                      <strong>{label}</strong>
                      <small>{help}</small>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="hint">Preview only. No messages are sent from this demo build.</p>
          </Panel>
          </div>
        </div>

        <div className="savebar" role="region" aria-label="Save settings">
          <span>{dirty ? "You have unsaved changes." : "All changes saved."}</span>
          <button
            className="button button--ghost"
            type="button"
            disabled={!dirty || busy}
            onClick={() => {
              setDraft(structuredClone(saved));
              setKeywords(keywordText(saved));
              setErrors([]);
            }}
          >
            Discard
          </button>
          <button className="button button--primary" type="submit" disabled={!dirty || busy}>
            {busy ? "Saving…" : "Save settings"}
          </button>
        </div>
      </form>

      <div className="grid-2">
        <Panel eyebrow="Appearance" title="Theme">
          <label className="field">
            <span>Colour scheme</span>
            <select value={theme} onChange={(e) => changeTheme(e.target.value as ThemePref)}>
              <option value="system">Match my device</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
        </Panel>

        <Panel eyebrow="Demo data" title="Reset workspace">
          <p className="muted">Restores the sample handoffs and default rules. Anything you added in this browser is removed.</p>
          {confirmReset ? (
            <div className="action-row">
              <button
                className="button button--danger"
                type="button"
                onClick={async () => {
                  await reset();
                  setConfirmReset(false);
                }}
              >
                Yes, reset everything
              </button>
              <button className="button button--ghost" type="button" onClick={() => setConfirmReset(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button className="button button--secondary" type="button" onClick={() => setConfirmReset(true)}>
              Reset demo data
            </button>
          )}
        </Panel>
      </div>
    </div>
  );
}
