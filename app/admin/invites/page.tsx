"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { getAdminSessionToken } from "../../components/adminSession";
import { formatDate } from "../../components/format";

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
  const [sessionToken, setSessionToken] = useState("");
  const [maxUses, setMaxUses] = useState("1");
  const [inviteUrl, setInviteUrl] = useState("");
  const [error, setError] = useState("");
  const activeInvites = useQuery(
    api.auth.listActiveInvites,
    sessionToken ? { sessionToken, limit: 50 } : "skip"
  );

  useEffect(() => {
    setSessionToken(getAdminSessionToken());
  }, []);

  function absoluteSignupUrl(signupPath: string) {
    return `${window.location.origin}${signupPath}`;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setInviteUrl("");
    try {
      const parsedMaxUses = Number.parseInt(maxUses, 10);
      const invite = await createInvite({
        sessionToken: sessionToken || getAdminSessionToken(),
        maxUses: Number.isFinite(parsedMaxUses) ? Math.max(1, parsedMaxUses) : 1,
        expiresInHours: 24 * 7
      });
      setInviteUrl(absoluteSignupUrl(invite.signupPath));
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
            onChange={(event) => setMaxUses(event.target.value)}
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
      <section className="card stack">
        <div>
          <h2 className="section-title">Liens actifs</h2>
          <p className="muted">Suivez les invitations encore utilisables et leur quota de création de comptes.</p>
        </div>
        {!activeInvites ? (
          <p className="muted">Chargement…</p>
        ) : activeInvites.length === 0 ? (
          <p className="muted">Aucun lien actif.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Lien</th>
                  <th>Utilisés</th>
                  <th>Restants</th>
                  <th>Total</th>
                  <th>Créé</th>
                  <th>Expire</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {activeInvites.map((invite) => {
                  const signupUrl = invite.signupPath ? absoluteSignupUrl(invite.signupPath) : null;
                  return (
                    <tr key={invite.id}>
                      <td>
                        {signupUrl ? (
                          <input className="input" readOnly value={signupUrl} onFocus={(event) => event.currentTarget.select()} />
                        ) : (
                          <span className="muted">Lien créé avant le suivi des URLs</span>
                        )}
                      </td>
                      <td>{invite.usedCount}</td>
                      <td>{invite.remainingUses}</td>
                      <td>{invite.maxUses}</td>
                      <td>{formatDate(invite.createdAt)}</td>
                      <td>{formatDate(invite.expiresAt)}</td>
                      <td>
                        {signupUrl ? (
                          <button className="button secondary" type="button" onClick={() => navigator.clipboard.writeText(signupUrl)}>
                            Copier
                          </button>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
