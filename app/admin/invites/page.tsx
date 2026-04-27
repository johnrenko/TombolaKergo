"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { getAdminSessionToken } from "../../components/adminSession";

function inviteErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("Session admin invalide")) {
    return "Votre session a expiré. Reconnectez-vous pour générer un lien.";
  }
  if (message.includes("Secret de génération")) {
    return "Le secret de génération n’est pas valide. Vérifiez la configuration Convex.";
  }
  return message || "Impossible de générer le lien pour le moment.";
}

export default function InvitesPage() {
  const createInvite = useMutation(api.auth.createInvite);
  const [maxUses, setMaxUses] = useState(1);
  const [inviteUrl, setInviteUrl] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setInviteUrl("");
    try {
      const invite = await createInvite({
        sessionToken: getAdminSessionToken(),
        maxUses,
        expiresInHours: 24 * 7
      });
      setInviteUrl(`${window.location.origin}${invite.signupPath}`);
    } catch (err) {
      setError(inviteErrorMessage(err));
    }
  }

  return (
    <main className="content stack">
      <div>
        <h1 className="page-title">Invitations admin</h1>
        <p className="muted">
          Créez un lien d’invitation admin. Le lien expire dans 7 jours et peut créer le nombre de comptes choisi.
        </p>
      </div>
      <form className="card stack" onSubmit={submit}>
        {error ? <div className="error">{error}</div> : null}
        <label className="field">
          <span className="label">Nombre de comptes autorisés</span>
          <input
            className="input"
            min={1}
            step={1}
            type="number"
            value={maxUses}
            onChange={(event) => setMaxUses(Math.max(1, Number.parseInt(event.target.value, 10) || 1))}
          />
        </label>
        <button className="button primary" type="submit">
          Générer le lien
        </button>
      </form>
      {inviteUrl ? (
        <section className="card stack">
          <h2 className="section-title">Lien généré</h2>
          <p className="muted">Envoyez ce lien aux administrateurs concernés. Chaque personne renseignera ses informations et son mot de passe.</p>
          <input className="input" readOnly value={inviteUrl} onFocus={(event) => event.currentTarget.select()} />
          <button className="button secondary" type="button" onClick={() => navigator.clipboard.writeText(inviteUrl)}>
            Copier
          </button>
        </section>
      ) : null}
    </main>
  );
}
