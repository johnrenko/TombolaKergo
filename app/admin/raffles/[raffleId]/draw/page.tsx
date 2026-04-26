"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { use, useMemo, useState } from "react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { getAdminPassword } from "../../../../components/adminPassword";
import { formatDate, statusLabel } from "../../../../components/format";

export default function DrawPage({ params }: { params: Promise<{ raffleId: string }> }) {
  const { raffleId } = use(params);
  const typedRaffleId = raffleId as Id<"raffles">;
  const adminRaffle = useQuery(api.raffles.getAdminRaffle, { raffleId: typedRaffleId }) as any;
  const runDraw = useMutation(api.winners.runDraw);
  const publishRaffle = useMutation(api.raffles.publishRaffle);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
      await runDraw({ raffleId: typedRaffleId, adminPassword: getAdminPassword() });
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
      await publishRaffle({ raffleId: typedRaffleId, adminPassword: getAdminPassword() });
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
          <p className="eyebrow">Tirage au sort</p>
          <h1 className="page-title">{raffle.title}</h1>
          <span className={`badge ${raffle.status}`}>{statusLabel(raffle.status)}</span>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="button ghost" href={`/admin/raffles/${raffleId}/settings`}>
            Paramètres
          </Link>
          <Link className="button secondary" href={`/r/${raffle.publicSlug}`}>
            Page publique
          </Link>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      <section className="grid-3">
        <div className="card">
          <p className="eyebrow">Disponibles</p>
          <h2 className="page-title" style={{ fontSize: "2.1rem" }}>
            {summary.available}
          </h2>
          <p className="muted">numéros éligibles</p>
        </div>
        <div className="card">
          <p className="eyebrow">Lots</p>
          <h2 className="page-title" style={{ fontSize: "2.1rem" }}>
            {summary.prizes}
          </h2>
          <p className="muted">lots à attribuer</p>
        </div>
        <div className="card">
          <p className="eyebrow">Exclus</p>
          <h2 className="page-title" style={{ fontSize: "2.1rem" }}>
            {summary.excluded}
          </h2>
          <p className={summary.conflict ? "error" : "success"} style={{ margin: 0 }}>
            {summary.conflict ? "Conflit : pas assez de numéros." : "Aucun conflit détecté."}
          </p>
        </div>
      </section>

      {raffle.status === "draft" ? (
        <section className="card stack">
          <h2 className="section-title">Lancer le tirage</h2>
          <div className="notice">
            Cette action attribuera un numéro gagnant à chaque lot. Le tirage ne pourra plus être modifié.
          </div>
          <button className="button primary" disabled={busy || summary.conflict} onClick={draw} type="button">
            {busy ? "Tirage en cours…" : "Lancer le tirage"}
          </button>
        </section>
      ) : null}

      {raffle.status === "drawn" ? (
        <section className="card stack">
          <h2 className="section-title">Résultats prêts</h2>
          <p className="muted">Tirage effectué le {formatDate(raffle.drawnAt)}. Les résultats ne sont pas encore publics.</p>
          <button className="button primary" disabled={busy} onClick={publish} type="button">
            {busy ? "Publication…" : "Publier les résultats"}
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
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Rang</th>
                  <th>Numéro gagnant</th>
                  <th>Lot gagné</th>
                </tr>
              </thead>
              <tbody>
                {sortedWinners.map((winner) => {
                  const prize = prizeById.get(winner.prizeId);
                  return (
                    <tr key={winner._id}>
                      <td>{winner.position}</td>
                      <td>
                        <strong>{winner.winningNumber}</strong>
                      </td>
                      <td>{prize?.name ?? "Lot supprimé"}</td>
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
