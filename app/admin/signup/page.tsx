"use client";

import { useMutation } from "convex/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { setAdminSessionToken } from "../../components/adminSession";

function signupErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("Lien d’invitation")) {
    return "Ce lien n’est plus utilisable. Il a peut-être expiré ou déjà servi à créer un compte.";
  }
  if (message.includes("réservée à une autre adresse")) {
    return "Cette invitation est réservée à une autre adresse email. Vérifiez l’adresse ou demandez un nouveau lien.";
  }
  if (message.includes("Un compte existe déjà")) {
    return "Un compte existe déjà avec cet email. Retournez à la connexion pour vous identifier.";
  }
  if (message.includes("mot de passe")) {
    return "Choisissez un mot de passe d’au moins 10 caractères.";
  }
  return message || "Impossible de créer le compte pour le moment.";
}

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
      setError(signupErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="public-page">
      <form className="public-shell hero-card stack" onSubmit={submit}>
        <p className="eyebrow">Invitation admin</p>
        <h1 className="page-title">Créer mon compte</h1>
        <p className="muted">
          Renseignez vos informations pour activer votre accès administrateur. Ce lien ne fonctionne qu’une seule fois.
        </p>
        {!token ? <div className="error">Lien incomplet : demandez un nouveau lien d’invitation.</div> : null}
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
          <span className="muted">Minimum 10 caractères.</span>
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
