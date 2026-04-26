"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { getAdminSessionToken } from "../../components/adminSession";

export default function InvitesPage() {
  const createInvite = useMutation(api.auth.createInvite);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setInviteUrl("");
    try {
      const invite = await createInvite({
        sessionToken: getAdminSessionToken(),
        email: email || undefined,
        name: name || undefined,
        expiresInHours: 24 * 7
      });
      setInviteUrl(`${window.location.origin}${invite.signupPath}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de générer le lien.");
    }
  }

  return (
    <main className="content stack">
      <div>
        <h1 className="page-title">Invitations admin</h1>
        <p className="muted">Générez un lien à usage unique pour créer un compte administrateur.</p>
      </div>
      <form className="card stack" onSubmit={submit}>
        {error ? <div className="error">{error}</div> : null}
        <label className="field">
          <span className="label">Email invité</span>
          <input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="field">
          <span className="label">Nom invité</span>
          <input className="input" value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <button className="button primary" type="submit">
          Générer le lien
        </button>
      </form>
      {inviteUrl ? (
        <section className="card stack">
          <h2 className="section-title">Lien généré</h2>
          <input className="input" readOnly value={inviteUrl} onFocus={(event) => event.currentTarget.select()} />
          <button className="button secondary" type="button" onClick={() => navigator.clipboard.writeText(inviteUrl)}>
            Copier
          </button>
        </section>
      ) : null}
    </main>
  );
}
