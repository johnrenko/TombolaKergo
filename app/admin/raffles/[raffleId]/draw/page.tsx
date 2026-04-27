"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { use, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { getAdminSessionToken } from "../../../../components/adminSession";
import { formatDate, statusLabel } from "../../../../components/format";

type ResultSort = "lot" | "ticket";
type DrawSpeed = "fast" | "normal" | "slow";
type PresentationPhase = "lot" | "burst" | "number" | "summary";

const speedLabels: Record<DrawSpeed, string> = {
  fast: "Rapide",
  normal: "Normal",
  slow: "Lent"
};

const speedDurations: Record<DrawSpeed, number> = {
  fast: 900,
  normal: 1600,
  slow: 2600
};

const compactDrawThreshold = 20;

function durationForPhase(phase: PresentationPhase, speed: DrawSpeed, totalRows: number) {
  if (totalRows > compactDrawThreshold) {
    if (phase === "lot") return speed === "slow" ? 900 : speed === "normal" ? 650 : 450;
    if (phase === "burst") return 240;
    return 620;
  }
  return phase === "lot" ? speedDurations[speed] : phase === "burst" ? 520 : 1250;
}

function orderedWinnersWithPrizes(prizes: any[], winners: any[]) {
  const prizeById = new Map<string, any>(prizes.map((prize: any) => [prize._id, prize]));
  return [...winners]
    .sort((a, b) => b.position - a.position)
    .map((winner) => ({ winner, prize: prizeById.get(winner.prizeId) }));
}

function DrawPresentation({
  rows,
  speeds,
  onClose,
  onReplay,
  onPublish,
  publicSlug,
  title,
  canPublish,
  busy
}: {
  rows: { winner: any; prize: any }[];
  speeds: Record<string, DrawSpeed>;
  onClose: () => void;
  onReplay: () => void;
  onPublish: () => Promise<boolean>;
  publicSlug: string;
  title: string;
  canPublish: boolean;
  busy: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<PresentationPhase>("lot");
  const [showQrCode, setShowQrCode] = useState(false);
  const [origin, setOrigin] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);
  const activeRow = rows[index];
  const revealedRows = phase === "summary" ? rows : rows.slice(0, phase === "number" ? index + 1 : index);
  const isCompactDraw = rows.length > compactDrawThreshold;
  const progressValue = rows.length > 0 ? Math.min(100, Math.round((revealedRows.length / rows.length) * 100)) : 0;
  const publicUrl = origin ? `${origin}/r/${publicSlug}` : `/r/${publicSlug}`;

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  useEffect(() => {
    overlayRef.current?.focus();
  }, []);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!showQrCode || !origin) return;
    let cancelled = false;
    QRCode.toDataURL(publicUrl, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 420,
      color: {
        dark: "#0d1533",
        light: "#ffffff"
      }
    })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [origin, publicUrl, showQrCode]);

  useEffect(() => {
    if (!activeRow || phase === "summary") return;
    const speed = speeds[activeRow.prize?._id] ?? "normal";
    const duration = durationForPhase(phase, speed, rows.length);
    const timeout = window.setTimeout(() => {
      goToNextStep();
    }, duration);
    return () => window.clearTimeout(timeout);
  }, [activeRow, index, phase, rows.length, speeds]);

  function goToNextStep() {
    if (phase === "summary") return;
    if (phase === "lot") {
      setPhase("burst");
    } else if (phase === "burst") {
      setPhase("number");
    } else if (index + 1 >= rows.length) {
      setPhase("summary");
    } else {
      setIndex((current) => current + 1);
      setPhase("lot");
    }
  }

  function showSummary() {
    setIndex(Math.max(0, rows.length - 1));
    setPhase("summary");
  }

  function replay() {
    setIndex(0);
    setPhase("lot");
    setShowQrCode(false);
    onReplay();
  }

  async function publishAndShowQrCode() {
    const published = await onPublish();
    if (published) {
      setQrDataUrl("");
      setShowQrCode(true);
    }
  }

  return (
    <div className="tirage-overlay" ref={overlayRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Mode tirage">
      <div className="tirage-topbar">
        <div>
          <span className="tirage-kicker">Mode tirage</span>
          <strong>
            {!activeRow && phase !== "summary" ? "Préparation" : phase === "summary" ? "Tirage terminé" : `Lot ${activeRow.winner.position} sur ${rows.length}`}
          </strong>
        </div>
        <div className="tirage-topbar-actions">
          {activeRow && phase !== "summary" ? (
            <>
              <button className="tirage-control" type="button" onClick={goToNextStep}>
                Suivant
              </button>
              <button className="tirage-control" type="button" onClick={showSummary}>
                Résumé
              </button>
            </>
          ) : null}
          <button className="tirage-close" type="button" onClick={onClose} aria-label="Quitter le mode tirage">
            ×
          </button>
        </div>
      </div>

      {showQrCode ? (
        <div className="tirage-qr">
          <span className="tirage-kicker">Résultats publiés</span>
          <h2>{title}</h2>
          <div className="tirage-qr-code" aria-label="QR code de la page publique">
            {qrDataUrl ? <img src={qrDataUrl} alt="QR code de la page publique" /> : <span>Génération…</span>}
          </div>
          <p>Scannez ce QR code pour consulter les résultats.</p>
          <strong>{publicUrl}</strong>
          <button className="button secondary" type="button" onClick={onClose}>
            Fermer
          </button>
        </div>
      ) : !activeRow && phase !== "summary" ? (
        <div className="tirage-preparing" role="status">
          <span className="tirage-loader" aria-hidden="true" />
          <h2>Préparation du tirage</h2>
          <p>Les gagnants sont en cours d’attribution. L’animation démarre juste après.</p>
        </div>
      ) : phase === "summary" ? (
        <div className="tirage-summary">
          <h2>Gagnants</h2>
          <div className="tirage-summary-grid">
            {rows.map(({ winner, prize }) => (
              <div className="tirage-summary-row" key={winner._id}>
                <span>{winner.position}</span>
                <strong>{winner.winningNumber}</strong>
                <em>{prize?.emoji ?? "🎁"}</em>
                <small>{prize?.name ?? "Lot supprimé"}</small>
              </div>
            ))}
          </div>
          <div className="tirage-summary-actions">
            <button className="button secondary" type="button" onClick={replay}>
              Rejouer le mode tirage
            </button>
            {canPublish ? (
              <button className="button primary" disabled={busy} type="button" onClick={publishAndShowQrCode}>
                {busy ? "Publication…" : "Publier les résultats"}
              </button>
            ) : null}
            <button className="button ghost" type="button" onClick={onClose}>
              Quitter
            </button>
          </div>
        </div>
      ) : (
        <div className={`tirage-stage ${phase}`} data-phase={phase}>
          <div className="tirage-prize">
            <span className="tirage-emoji" aria-hidden="true">
              {activeRow?.prize?.emoji ?? "🎁"}
            </span>
            <div>
              <p>Lot {activeRow?.winner.position}</p>
              <h2>{activeRow?.prize?.name ?? "Lot supprimé"}</h2>
              {activeRow?.prize?.description ? <span>{activeRow.prize.description}</span> : null}
            </div>
          </div>
          <div className="tirage-burst" aria-hidden="true">
            {Array.from({ length: 16 }).map((_, burstIndex) => (
              <i key={burstIndex} style={{ "--burst-rotate": `${burstIndex * 22.5}deg` } as CSSProperties} />
            ))}
          </div>
          <div className="tirage-number" aria-live="polite">
            <span>Numéro gagnant</span>
            <strong>{activeRow?.winner.winningNumber}</strong>
          </div>
        </div>
      )}

      {phase !== "summary" ? (
        isCompactDraw ? (
          <div className="tirage-progress-compact" aria-label="Lots révélés">
            <span>{revealedRows.length}/{rows.length}</span>
            <div>
              <i style={{ width: `${progressValue}%` }} />
            </div>
          </div>
        ) : (
          <div className="tirage-progress" aria-label="Lots révélés">
            {rows.map(({ winner }, rowIndex) => (
              <span className={rowIndex <= revealedRows.length - 1 ? "done" : rowIndex === index ? "active" : ""} key={winner._id} />
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}

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
  const [resultSort, setResultSort] = useState<ResultSort>("lot");
  const [presentationActive, setPresentationActive] = useState(false);
  const [presentationPending, setPresentationPending] = useState(false);
  const [confirmPresentation, setConfirmPresentation] = useState(false);
  const [prizeSpeeds, setPrizeSpeeds] = useState<Record<string, DrawSpeed>>({});
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(1);
  const [rangeSpeed, setRangeSpeed] = useState<DrawSpeed>("normal");

  useEffect(() => {
    setSessionToken(getAdminSessionToken());
  }, []);

  useEffect(() => {
    if (!adminRaffle) return;
    const maxPosition = Math.max(1, ...adminRaffle.prizes.map((prize: any) => prize.position));
    setRangeEnd((current) => (current === 1 ? maxPosition : Math.min(Math.max(current, 1), maxPosition)));
    setPrizeSpeeds((current) => {
      const next = { ...current };
      for (const prize of adminRaffle.prizes) {
        if (!next[prize._id]) next[prize._id] = "normal";
      }
      return next;
    });
  }, [adminRaffle]);

  useEffect(() => {
    if (presentationPending && adminRaffle?.winners.length > 0) {
      setPresentationPending(false);
      setPresentationActive(true);
    }
  }, [adminRaffle, presentationPending]);

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

  function applyRangeSpeed() {
    const min = Math.min(rangeStart, rangeEnd);
    const max = Math.max(rangeStart, rangeEnd);
    setPrizeSpeeds((current) => {
      const next = { ...current };
      for (const prize of prizes) {
        if (prize.position >= min && prize.position <= max) {
          next[prize._id] = rangeSpeed;
        }
      }
      return next;
    });
  }

  async function startPresentation() {
    setError("");
    if (raffle.status === "drawn" && winners.length > 0) {
      setPresentationActive(true);
      return;
    }
    if (raffle.status !== "draft") return;
    setConfirmPresentation(true);
  }

  async function confirmStartPresentation() {
    setError("");
    setConfirmPresentation(false);
    setPresentationActive(true);
    setBusy(true);
    setPresentationPending(true);
    try {
      await runDraw({ raffleId: typedRaffleId, sessionToken: getAdminSessionToken() });
    } catch (err) {
      setPresentationPending(false);
      setPresentationActive(false);
      setError(err instanceof Error ? err.message : "Impossible de lancer le tirage.");
    } finally {
      setBusy(false);
    }
  }

  function closePresentation() {
    setPresentationActive(false);
    setPresentationPending(false);
    setConfirmPresentation(false);
  }

  async function publish() {
    setError("");
    setBusy(true);
    try {
      await publishRaffle({ raffleId: typedRaffleId, sessionToken: getAdminSessionToken() });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de publier les résultats.");
      return false;
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
  const presentationRows = orderedWinnersWithPrizes(prizes, winners);
  const canUsePresentation = raffle.status === "draft" || (raffle.status === "drawn" && winners.length > 0);
  const sortedWinners = [...winners].sort((a, b) => {
    if (resultSort === "ticket") {
      return a.winningNumber - b.winningNumber;
    }
    return a.position - b.position;
  });

  return (
    <main className="content stack">
      {presentationActive ? (
        <DrawPresentation
          rows={presentationRows}
          speeds={prizeSpeeds}
          onClose={closePresentation}
          onReplay={() => undefined}
          onPublish={publish}
          publicSlug={raffle.publicSlug}
          title={raffle.title}
          canPublish={raffle.status === "drawn"}
          busy={busy}
        />
      ) : null}

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
            <strong>numéros éligibles</strong>
            <p className="muted" style={{ margin: "6px 0 0" }}>Plage {raffle.numberMin} – {raffle.numberMax}</p>
          </div>
          <div className="metric-card">
            <span className="soft-icon" style={{ background: "#edf6ff", color: "#1971e8" }}>♙</span>
            <span className="metric-value">{summary.prizes}</span>
            <strong>lots à tirer</strong>
            <p className="muted" style={{ margin: "6px 0 0" }}>Un gagnant par lot</p>
          </div>
          <div className="metric-card">
            <span className="soft-icon" style={{ background: summary.conflict ? "#fff1f0" : "#eaf8ef", color: summary.conflict ? "#b42318" : "#159455" }}>
              {summary.conflict ? "!" : "✓"}
            </span>
            <span className="metric-value">{summary.conflict ? "Non" : "Oui"}</span>
            <strong>Tirage possible</strong>
            <p className="muted" style={{ margin: "6px 0 0" }}>{summary.conflict ? "Pas assez de numéros" : "Assez de numéros"}</p>
          </div>
        </div>
      </section>

      {canUsePresentation ? (
        <section className="card stack">
          <div className="card-header">
            <div>
              <h2 className="section-title">Mode tirage</h2>
              <p className="muted">Présentez les lots en plein écran, puis révélez chaque numéro gagnant.</p>
            </div>
            <button className="button primary" disabled={busy || summary.conflict || presentationPending} onClick={startPresentation} type="button">
              ▷ {busy && presentationPending ? "Préparation…" : raffle.status === "draft" ? "Lancer le mode tirage" : "Rejouer le mode tirage"}
            </button>
          </div>
          {confirmPresentation ? (
            <div className="tirage-confirm" role="alert">
              <div>
                <strong>Êtes-vous sûr ?</strong>
                <p>Cette action va faire le tirage et attribuer un numéro gagnant à chaque lot. Le tirage ne pourra plus être modifié.</p>
              </div>
              <div className="tirage-confirm-actions">
                <button className="button ghost" type="button" onClick={() => setConfirmPresentation(false)}>
                  Annuler
                </button>
                <button className="button primary" disabled={busy || summary.conflict} type="button" onClick={confirmStartPresentation}>
                  Confirmer le tirage
                </button>
              </div>
            </div>
          ) : null}
          <div className="tirage-range-tool" aria-label="Appliquer une vitesse à une plage de lots">
            <span>Lots</span>
            <label>
              <span>de</span>
              <input
                aria-label="Début de plage"
                min={1}
                max={prizes.length}
                type="number"
                value={rangeStart}
                onChange={(event) => setRangeStart(Math.max(1, Math.min(prizes.length, Number(event.target.value) || 1)))}
              />
            </label>
            <label>
              <span>à</span>
              <input
                aria-label="Fin de plage"
                min={1}
                max={prizes.length}
                type="number"
                value={rangeEnd}
                onChange={(event) => setRangeEnd(Math.max(1, Math.min(prizes.length, Number(event.target.value) || 1)))}
              />
            </label>
            <select
              aria-label="Vitesse à appliquer"
              value={rangeSpeed}
              onChange={(event) => setRangeSpeed(event.target.value as DrawSpeed)}
            >
              {Object.entries(speedLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button className="button secondary" type="button" onClick={applyRangeSpeed}>
              Appliquer
            </button>
          </div>
          <div className="tirage-speed-list">
            {prizes.map((prize: any) => (
              <label className="tirage-speed-row" key={prize._id}>
                <span className="prize-icon emoji">{prize.emoji ?? "🎁"}</span>
                <span>
                  <strong>{prize.name}</strong>
                  <small>Lot {prize.position}</small>
                </span>
                <select
                  aria-label={`Vitesse du lot ${prize.position}`}
                  value={prizeSpeeds[prize._id] ?? "normal"}
                  onChange={(event) =>
                    setPrizeSpeeds((current) => ({ ...current, [prize._id]: event.target.value as DrawSpeed }))
                  }
                >
                  {Object.entries(speedLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </section>
      ) : null}

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
          <label className="sort-control">
            <span className="muted">Trier par</span>
            <select value={resultSort} onChange={(event) => setResultSort(event.target.value as ResultSort)}>
              <option value="lot">Numéro de lot</option>
              <option value="ticket">Numéro de ticket</option>
            </select>
          </label>
        </div>
        {sortedWinners.length === 0 ? (
          <p className="muted">Aucun résultat pour le moment.</p>
        ) : (
          <div className="result-list">
            {sortedWinners.map((winner) => {
              const prize = prizeById.get(winner.prizeId);
              return (
                <div className="result-row" key={winner._id}>
                  <span className={`rank-dot ${winner.position === 2 ? "silver" : winner.position === 3 ? "bronze" : ""}`}>{winner.position}</span>
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
