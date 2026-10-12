"use client";

import { useState } from "react";

export function InviteForm({
  url,
  initialEmails,
}: {
  url: string;
  initialEmails: string[];
}) {
  const [emails, setEmails] = useState(initialEmails);
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = event.currentTarget;
    const email = String(new FormData(form).get("email") ?? "");
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const body = (await response.json()) as { invites?: Array<{ invitee_email: string }>; error?: string };
    if (!response.ok) {
      setError(body.error ?? "Could not invite.");
      return;
    }
    setEmails((body.invites ?? []).map((invite) => invite.invitee_email));
    form.reset();
  }

  return (
    <div className="card stack">
      <h2>Invite a coach</h2>
      <p className="muted">They can open this when they log in with that email.</p>
      <form className="stack" onSubmit={onSubmit}>
        <label>
          Coach email
          <input name="email" type="email" required />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn" type="submit">Invite</button>
      </form>
      {emails.length ? (
        <ul>
          {emails.map((email) => (
            <li key={email}>{email}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
