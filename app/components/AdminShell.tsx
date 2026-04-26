"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import { clearAdminSessionToken, getAdminSessionToken, setAdminSessionToken } from "./adminSession";

const nav = [
  ["⌂", "Dashboard", "/admin/raffles"],
  ["✦", "Tombolas", "/admin/raffles"],
  ["□", "Lots", "/admin/raffles"],
  ["▥", "Résultats", "/admin/raffles"],
  ["☷", "Historique", "/admin/audit"],
  ["⚙", "Invitations", "/admin/invites"]
] as const;

function loginErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("Identifiants invalides")) {
    return "Email ou mot de passe incorrect. Si vous n’avez pas encore de compte, ouvrez d’abord le lien d’invitation envoyé par l’administrateur.";
  }
  if (message.includes("Session admin invalide")) {
    return "Votre session a expiré. Reconnectez-vous pour continuer.";
  }
  return message || "Connexion impossible pour le moment. Réessayez dans quelques instants.";
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const loginMutation = useMutation(api.auth.login);
  const logoutMutation = useMutation(api.auth.logout);
  const [sessionToken, setSessionTokenState] = useState("");
  const me = useQuery(api.auth.me, sessionToken ? { sessionToken } : "skip");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setSessionTokenState(getAdminSessionToken());
  }, [pathname]);

  if (pathname.startsWith("/admin/signup")) {
    return <>{children}</>;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const result = await loginMutation({ email, password });
      setAdminSessionToken(result.sessionToken);
      setSessionTokenState(result.sessionToken);
    } catch (err) {
      setError(loginErrorMessage(err));
    }
  }

  async function logout() {
    if (sessionToken) {
      await logoutMutation({ sessionToken });
    }
    clearAdminSessionToken();
    setSessionTokenState("");
  }

  if (!sessionToken || me === null) {
    return (
      <main className="public-page">
        <form className="public-shell hero-card stack" onSubmit={submit}>
          <p className="eyebrow">Accès admin</p>
          <h1 className="page-title">Connexion administrateur</h1>
          <p className="muted">
            Utilisez l’email et le mot de passe définis lors de la création de votre compte. Le premier compte se crée depuis un lien d’invitation.
          </p>
          {error ? <div className="error">{error}</div> : null}
          <label className="field">
            <span className="label">Email</span>
            <input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoFocus />
          </label>
          <label className="field">
            <span className="label">Mot de passe</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button className="button primary" type="submit">
            Se connecter
          </button>
          <p className="muted">
            Pas encore de compte ? Générez ou demandez un lien d’invitation, puis ouvrez-le pour choisir vos identifiants.
          </p>
        </form>
      </main>
    );
  }

  if (me === undefined) {
    return (
      <main className="public-page">
        <section className="public-shell card">Chargement de la session…</section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/admin/raffles">
          <span className="brand-mark" aria-hidden="true" />
          <span>Tombola</span>
        </Link>
        <button className="mobile-menu" type="button" aria-label="Ouvrir le menu">
          ≡
        </button>
        <nav className="nav-list" aria-label="Navigation admin">
          {nav.map(([icon, label, href]) => (
            <Link className={`nav-item ${pathname.startsWith(href) ? "active" : ""}`} href={href} key={label}>
              <span className="nav-icon" aria-hidden="true">
                {icon}
              </span>
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <section className="main-panel">
        <header className="topbar">
          <div>
            <strong>Tombola</strong>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              Préparation, tirage et publication des résultats.
            </p>
          </div>
          <div className="admin-header-actions">
            <span className="muted">{me.name}</span>
            <button className="button secondary" type="button" onClick={logout}>
              Déconnexion
            </button>
          </div>
        </header>
        {children}
        <nav className="bottom-nav" aria-label="Navigation mobile admin">
          <Link href="/admin/raffles">
            <span>✦</span>
            Tombolas
          </Link>
          <Link href="/admin/raffles">
            <span>□</span>
            Lots
          </Link>
          <Link href="/admin/raffles">
            <span>▥</span>
            Résultats
          </Link>
        </nav>
      </section>
    </div>
  );
}
