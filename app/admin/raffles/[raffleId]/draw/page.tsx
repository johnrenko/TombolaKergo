"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { getAdminSessionToken } from "../../../../components/adminSession";
import { formatDate, statusLabel } from "../../../../components/format";

export default function DrawPage({ params }: { params: Promise<{ raffleId: string }> }) {
  const { raffleId } = use(params);
  const typedRaffleId = raffleId as Id<"raffles">;
  const [sessionToken, setSessionToken] = useState("");
  const adminRaffle = useQuery(
    api.raffles.getAdminRaffle,
    sessionToken ? { raffleId: typedRaffleId, sessionToken } : "skip"
  ) as any;
  const runDraw = useMutation(api.winners.runDraw);
  const publishRaffle = useMutation(api.raffles.publishRaffle);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSessionToken(getAdminSessionToken());
  }, []);

  const summary = useMemo(() => {
    if (!adminRaffle) return null;
    const excluded = new Set(adminRaffle.raffle.excludedNumbers);
    let available = 0;
    for (let value = adminRaffle.raffle.numberMin; value <= adminRaffle.raffle.numberMax; value += 1) {
      if (!excluded.has(value)) available += 1;
    }
    return {
      available,
      prizes: adminRaffle.prizes.length,
      excluded: adminRaffle.raffle.excludedNumbers.length,
      conflict: available < adminRaffle.prizes.length
    };
  }, [adminRaffle]);

  async function draw() {
    setError("");
    setBusy(true);
    try {
      await runDraw({ raffleId: typedRaffleId, sessionToken: getAdminSessionToken() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de lancer le tirage.");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setError("");
    setBusy(true);
    try {
      await publishRaffle({ raffleId: typedRaffleId, sessionToken: getAdminSessionToken() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de publier les résultats.");
    } finally {
      setBusy(false);
    }
  }

  if (adminRaffle === undefined) {
    return (
      <main className="content">
        <section className="card">Chargement…</section>
      </main>
    );
  }

  if (adminRaffle === null || !summary) {
    return (
      <main className="content">
        <section className="card error">Tombola introuvable.</section>
      </main>
    );
  }

  const { raffle, prizes, winners } = adminRaffle;
  const prizeById = new Map<string, any>(prizes.map((prize: any) => [prize._id, prize]));
  const sortedWinners = [...winners].sort((a, b) => a.position - b.position);

  return (
    <main className="content stack">
      <div className="card-header">
        <div>
          <h1 className="page-title">Tirage au sort</h1>
          <p className="muted">Lancez le tirage au sort et découvrez les gagnants.</p>
          <span className={`badge ${raffle.status}`}>{statusLabel(raffle.status)}</span>
        </div>
        <div className="admin-header-actions">
          <Link className="button ghost" href={`/admin/raffles/${raffleId}/settings`}>
            Paramètres
          </Link>
          <Link className="button secondary" href={`/r/${raffle.publicSlug}`}>
            Page publique
          </Link>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      <section className="card">
        <div className="metric-grid">
        <div className="metric-card">
          <span className="soft-icon">▧</span>
          <span className="metric-value">{summary.available}</span>
          <strong>numéros</strong>
          <p className="muted" style={{ margin: "6px 0 0" }}>Plage {raffle.numberMin} – {raffle.numberMax}</p>
        </div>
        <div className="metric-card">
          <span className="soft-icon" style={{ background: "#edf6ff", color: "#1971e8" }}>♙</span>
          <span className="metric-value">{summary.prizes}</span>
          <strong>lots</strong>
          <p className="muted" style={{ margin: "6px 0 0" }}>À attribuer</p>
        </div>
        <div className="metric-card">
          <span className="soft-icon" style={{ background: "#eaf8ef", color: "#159455" }}>✓</span>
          <span className="metric-value">{summary.conflict ? "!" : "0"}</span>
          <strong>conflit</strong>
          <p className="muted" style={{ margin: "6px 0 0" }}>{summary.conflict ? "À corriger" : "Tout est OK"}</p>
        </div>
        </div>
      </section>

      {raffle.status === "draft" ? (
        <section className="card stack">
          <button className="button primary" disabled={busy || summary.conflict} onClick={draw} type="button">
            ▷ {busy ? "Tirage en cours…" : "Lancer le tirage"}
          </button>
          <div className="notice">
            ⚠ <strong>Cette action est irréversible</strong>
            <br />
            Une fois les résultats publiés, ils seront verrouillés et ne pourront plus être modifiés.
          </div>
        </section>
      ) : null}

      {raffle.status === "drawn" ? (
        <section className="card stack">
          <h2 className="section-title">Résultats prêts</h2>
          <p className="muted">Tirage effectué le {formatDate(raffle.drawnAt)}. Les résultats ne sont pas encore publics.</p>
          <button className="button secondary" disabled={busy} onClick={publish} type="button">
            ⇧ {busy ? "Publication…" : "Publier les résultats"}
          </button>
        </section>
      ) : null}

      {raffle.status === "published" ? <div className="success">Résultats publiés le {formatDate(raffle.publishedAt)}.</div> : null}

      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="section-title">Résultats</h2>
            <p className="muted">Rang, numéro gagnant et lot attribué.</p>
          </div>
        </div>
        {sortedWinners.length === 0 ? (
          <p className="muted">Aucun résultat pour le moment.</p>
        ) : (
          <div className="result-list">
            {sortedWinners.map((winner, index) => {
              const prize = prizeById.get(winner.prizeId);
              return (
                <div className="result-row" key={winner._id}>
                  <span className={`rank-dot ${index === 1 ? "silver" : index === 2 ? "bronze" : ""}`}>{winner.position}</span>
                  <span className="number-strong">{winner.winningNumber}</span>
                  <span className="muted">→</span>
                  <span className="prize-icon emoji">{prize?.emoji ?? "🎁"}</span>
                  <span>{prize?.name ?? "Lot supprimé"}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
