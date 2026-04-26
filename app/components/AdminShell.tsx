"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const nav = [
  ["Dashboard", "/admin/raffles"],
  ["Tombolas", "/admin/raffles"],
  ["Lots", "/admin/raffles"],
  ["Résultats", "/admin/raffles"],
  ["Paramètres", "/admin/raffles"]
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const expectedPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;

  useEffect(() => {
    setUnlocked(window.localStorage.getItem("tombola-admin") === "ok");
  }, []);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password && (!expectedPassword || password === expectedPassword)) {
      window.localStorage.setItem("tombola-admin", "ok");
      window.localStorage.setItem("tombola-admin-password", password);
      setUnlocked(true);
    }
  }

  if (!unlocked) {
    return (
      <main className="public-page">
        <form className="public-shell hero-card stack" onSubmit={submit}>
          <p className="eyebrow">Accès admin</p>
          <h1 className="page-title">Connexion administrateur</h1>
          <p className="muted">
            Authentification simple pour la V1. Définissez <code>ADMIN_PASSWORD</code> dans l’environnement Convex.
          </p>
          <label className="field">
            <span className="label">Mot de passe</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoFocus
            />
          </label>
          <button className="button primary" type="submit">
            Se connecter
          </button>
        </form>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/admin/raffles">
          <span className="brand-mark">TK</span>
          <span>Tombola Kergo</span>
        </Link>
        <nav className="nav-list" aria-label="Navigation admin">
          {nav.map(([label, href]) => (
            <Link className={`nav-item ${pathname.startsWith(href) ? "active" : ""}`} href={href} key={label}>
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <section className="main-panel">
        <header className="topbar">
          <div>
            <strong>Administration</strong>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              Préparation, tirage et publication des résultats.
            </p>
          </div>
          <Link className="button secondary" href="/">
            Page d’accueil
          </Link>
        </header>
        {children}
      </section>
    </div>
  );
}
