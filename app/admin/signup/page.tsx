"use client";

import { useMutation } from "convex/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { setAdminSessionToken } from "../../components/adminSession";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const acceptInvite = useMutation(api.auth.acceptInvite);
  const token = searchParams.get("token") ?? "";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const result = await acceptInvite({ token, name, email, password });
      setAdminSessionToken(result.sessionToken);
      router.push("/admin/raffles");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de créer le compte.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="public-page">
      <form className="public-shell hero-card stack" onSubmit={submit}>
        <p className="eyebrow">Invitation admin</p>
        <h1 className="page-title">Créer mon compte</h1>
        <p className="muted">Ce lien est à usage unique. Choisissez un mot de passe d’au moins 10 caractères.</p>
        {!token ? <div className="error">Lien d’invitation manquant.</div> : null}
        {error ? <div className="error">{error}</div> : null}
        <label className="field">
          <span className="label">Nom</span>
          <input className="input" value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label className="field">
          <span className="label">Email</span>
          <input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label className="field">
          <span className="label">Mot de passe</span>
          <input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>
        <button className="button primary" disabled={!token || saving} type="submit">
          {saving ? "Création…" : "Créer le compte"}
        </button>
        <Link className="button secondary" href="/admin/raffles">
          Retour à la connexion
        </Link>
      </form>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <main className="public-page">
          <section className="public-shell hero-card stack">Chargement de l’invitation…</section>
        </main>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
