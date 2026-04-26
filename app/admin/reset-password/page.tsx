"use client";

import { useMutation } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";

function resetErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.includes("Secret d’invitation")) {
    return "Secret admin incorrect.";
  }
  if (message.includes("mot de passe")) {
    return "Choisissez un mot de passe d’au moins 10 caractères.";
  }
  if (message.includes("Aucun compte admin")) {
    return "Aucun compte admin ne correspond à cet email.";
  }
  return message || "Impossible de réinitialiser le mot de passe pour le moment.";
}

export default function ResetPasswordPage() {
  const resetPassword = useMutation(api.auth.resetPassword);
  const [adminSecret, setAdminSecret] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess(false);
    setSaving(true);
    try {
      await resetPassword({ adminSecret, email, password });
      setSuccess(true);
      setPassword("");
    } catch (err) {
      setError(resetErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="public-page">
      <form className="public-shell hero-card stack" onSubmit={submit}>
        <p className="eyebrow">Accès admin</p>
        <h1 className="page-title">Réinitialiser mon mot de passe</h1>
        <p className="muted">
          Utilisez le secret admin du projet pour définir un nouveau mot de passe. Les anciennes sessions seront déconnectées.
        </p>
        {error ? <div className="error" role="alert">{error}</div> : null}
        {success ? <div className="success" role="status">Mot de passe réinitialisé. Vous pouvez vous reconnecter.</div> : null}
        <label className="field">
          <span className="label">Secret admin</span>
          <input className="input" type="password" value={adminSecret} onChange={(event) => setAdminSecret(event.target.value)} required />
        </label>
        <label className="field">
          <span className="label">Email</span>
          <input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label className="field">
          <span className="label">Nouveau mot de passe</span>
          <input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          <span className="muted">Minimum 10 caractères.</span>
        </label>
        <button className="button primary" disabled={saving} type="submit">
          {saving ? "Réinitialisation…" : "Réinitialiser"}
        </button>
        <Link className="button secondary" href="/admin/raffles">
          Retour à la connexion
        </Link>
      </form>
    </main>
  );
}
