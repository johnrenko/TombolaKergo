"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { getAdminSessionToken } from "../../../../components/adminSession";
import { formatDate, statusLabel } from "../../../../components/format";

type DistributionSort = "lot" | "ticket" | "status";
type DistributionFilter = "all" | "pending" | "distributed";

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

export default function DistributionPage({ params }: { params: Promise<{ raffleId: string }> }) {
  const { raffleId } = use(params);
  const typedRaffleId = raffleId as Id<"raffles">;
  const [sessionToken, setSessionToken] = useState("");
  const [sort, setSort] = useState<DistributionSort>("lot");
  const [filter, setFilter] = useState<DistributionFilter>("pending");
  const [search, setSearch] = useState("");
  const [busyWinnerId, setBusyWinnerId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const adminRaffle = useQuery(
    api.raffles.getAdminRaffle,
    sessionToken ? { raffleId: typedRaffleId, sessionToken } : "skip"
  ) as any;
  const markDistributed = useMutation(api.winners.markDistributed);

  useEffect(() => {
    setSessionToken(getAdminSessionToken());
  }, []);

  const rows = useMemo(() => {
    if (!adminRaffle) return [];
    const prizeById = new Map<string, any>(adminRaffle.prizes.map((prize: any) => [prize._id, prize]));
    const term = normalizeSearch(search);
    return adminRaffle.winners
      .map((winner: any) => ({ winner, prize: prizeById.get(winner.prizeId) }))
      .filter(({ winner, prize }: { winner: any; prize: any }) => {
        if (filter === "pending" && winner.distributedAt) return false;
        if (filter === "distributed" && !winner.distributedAt) return false;
        if (!term) return true;
        return [winner.winningNumber, winner.position, prize?.name, prize?.description]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .sort((a: any, b: any) => {
        if (sort === "ticket") return a.winner.winningNumber - b.winner.winningNumber;
        if (sort === "status") {
          const statusDelta = Number(Boolean(a.winner.distributedAt)) - Number(Boolean(b.winner.distributedAt));
          if (statusDelta !== 0) return statusDelta;
        }
        return a.winner.position - b.winner.position;
      });
  }, [adminRaffle, filter, search, sort]);

  async function distribute(winnerId: Id<"winners">, number: number) {
    setError("");
    setMessage("");
    setBusyWinnerId(winnerId);
    try {
      const result = await markDistributed({ winnerId, sessionToken: getAdminSessionToken() });
      if (result.status === "already_distributed") {
        setMessage(`Le numéro ${number} avait déjà été distribué${result.distributedByEmail ? ` par ${result.distributedByEmail}` : ""}.`);
      } else {
        setMessage(`Le numéro ${number} est marqué comme distribué.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de marquer ce lot comme distribué.");
    } finally {
      setBusyWinnerId(null);
    }
  }

  if (adminRaffle === undefined) {
    return (
      <main className="content">
        <section className="card">Chargement…</section>
      </main>
    );
  }

  if (adminRaffle === null) {
    return (
      <main className="content">
        <section className="card error">Tombola introuvable.</section>
      </main>
    );
  }

  const { raffle, winners } = adminRaffle;
  const distributedCount = winners.filter((winner: any) => Boolean(winner.distributedAt)).length;
  const pendingCount = Math.max(0, winners.length - distributedCount);
  const drawDone = raffle.status === "drawn" || raffle.status === "published";

  return (
    <main className="content stack distribution-content">
      <div className="card-header">
        <div>
          <p className="eyebrow">Distribution</p>
          <h1 className="page-title">Lots à remettre</h1>
          <p className="muted">Liste synchronisée en direct pour permettre à plusieurs admins de distribuer les lots en parallèle.</p>
          <span className={`badge ${raffle.status}`}>{statusLabel(raffle.status)}</span>
        </div>
        <div className="admin-header-actions">
          <Link className="button ghost" href={`/admin/raffles/${raffleId}/draw`}>
            Tirage
          </Link>
          <Link className="button secondary" href={`/admin/raffles/${raffleId}/settings`}>
            Paramètres
          </Link>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}
      {message ? <div className="success">{message}</div> : null}
      {!drawDone ? (
        <div className="notice">
          Lancez d’abord le tirage pour générer les numéros gagnants. La distribution sera disponible dès que les résultats existent.
        </div>
      ) : null}

      <section className="card">
        <div className="metric-grid">
          <div className="metric-card">
            <span className="soft-icon">🎁</span>
            <span className="metric-value">{winners.length}</span>
            <strong>lots gagnants</strong>
          </div>
          <div className="metric-card">
            <span className="soft-icon" style={{ background: "#e8f8ee", color: "#119455" }}>✓</span>
            <span className="metric-value">{distributedCount}</span>
            <strong>distribués</strong>
          </div>
          <div className="metric-card">
            <span className="soft-icon" style={{ background: "#fff7ed", color: "#b45309" }}>…</span>
            <span className="metric-value">{pendingCount}</span>
            <strong>à remettre</strong>
          </div>
        </div>
      </section>

      <section className="card stack">
        <div className="distribution-toolbar">
          <label className="field">
            <span className="label">Recherche</span>
            <input
              className="input"
              placeholder="Numéro, lot…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label className="field">
            <span className="label">Filtre</span>
            <select className="input" value={filter} onChange={(event) => setFilter(event.target.value as DistributionFilter)}>
              <option value="pending">À distribuer</option>
              <option value="distributed">Distribués</option>
              <option value="all">Tous</option>
            </select>
          </label>
          <label className="field">
            <span className="label">Tri</span>
            <select className="input" value={sort} onChange={(event) => setSort(event.target.value as DistributionSort)}>
              <option value="lot">Numéro de lot</option>
              <option value="ticket">Numéro de ticket</option>
              <option value="status">Statut</option>
            </select>
          </label>
        </div>

        {rows.length === 0 ? (
          <p className="muted">Aucun lot ne correspond à ces critères.</p>
        ) : (
          <div className="distribution-list">
            {rows.map(({ winner, prize }: { winner: any; prize: any }) => {
              const distributed = Boolean(winner.distributedAt);
              return (
                <article className={`distribution-row ${distributed ? "distributed" : ""}`} key={winner._id}>
                  <span className={`rank-dot ${winner.position === 2 ? "silver" : winner.position === 3 ? "bronze" : ""}`}>{winner.position}</span>
                  <div>
                    <span className="muted">Numéro</span>
                    <strong className="number-strong">{winner.winningNumber}</strong>
                  </div>
                  <span className="prize-icon emoji">{prize?.emoji ?? "🎁"}</span>
                  <div className="distribution-prize">
                    <strong>{prize?.name ?? "Lot supprimé"}</strong>
                    {prize?.description ? <span className="muted">{prize.description}</span> : null}
                  </div>
                  <div className="distribution-status">
                    {distributed ? (
                      <>
                        <span className="badge distributed-badge">Distribué</span>
                        <small className="muted">
                          {formatDate(winner.distributedAt)}{winner.distributedByEmail ? ` · ${winner.distributedByEmail}` : ""}
                        </small>
                      </>
                    ) : (
                      <span className="badge pending-badge">À remettre</span>
                    )}
                  </div>
                  <button
                    className="button primary"
                    disabled={distributed || busyWinnerId === winner._id || !drawDone}
                    type="button"
                    onClick={() => distribute(winner._id, winner.winningNumber)}
                  >
                    {busyWinnerId === winner._id ? "Validation…" : distributed ? "Déjà distribué" : "Marquer distribué"}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
