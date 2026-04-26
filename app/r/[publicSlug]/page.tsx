"use client";

import { useQuery } from "convex/react";
import { use, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";

export default function PublicRafflePage({ params }: { params: Promise<{ publicSlug: string }> }) {
  const { publicSlug } = use(params);
  const publicRaffle = useQuery(api.raffles.getPublicRaffle, { publicSlug }) as any;
  const [input, setInput] = useState("");
  const [checkedNumber, setCheckedNumber] = useState<number | null>(null);
  const checkResult = useQuery(
    api.winners.checkNumber,
    checkedNumber === null ? "skip" : { publicSlug, number: checkedNumber }
  ) as any;

  const rows = useMemo(() => {
    if (!publicRaffle) return [];
    const prizeById = new Map(publicRaffle.prizes.map((prize) => [prize._id, prize]));
    return publicRaffle.winners
      .map((winner) => ({ winner, prize: prizeById.get(winner.prizeId) }))
      .sort((a, b) => a.winner.position - b.winner.position);
  }, [publicRaffle]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const number = Number(input);
    if (Number.isFinite(number)) {
      setCheckedNumber(Math.trunc(number));
    }
  }

  if (publicRaffle === undefined) {
    return (
      <main className="public-page">
        <section className="public-shell card">Chargement…</section>
      </main>
    );
  }

  if (publicRaffle === null) {
    return (
      <main className="public-page">
        <section className="public-shell card error">Tombola introuvable.</section>
      </main>
    );
  }

  const { raffle } = publicRaffle;
  const published = raffle.status === "published";

  return (
    <main className="public-page">
      <section className="public-shell public-card">
        <header className="public-topbar">
          <span className="brand public-brand">
            <span className="brand-mark" aria-hidden="true" />
            KergoTombo
          </span>
        </header>

        <div className="public-content stack">
          <div className="public-hero stack">
            <span className="confetti" aria-hidden="true">
              <i style={{ left: "8%", top: "18%", transform: "rotate(-20deg)", background: "#3f28e8" }} />
              <i style={{ left: "22%", top: "8%", transform: "rotate(16deg)", background: "#8ea7ee" }} />
              <i style={{ left: "82%", top: "15%", transform: "rotate(12deg)", background: "#3f28e8" }} />
              <i style={{ left: "94%", top: "30%", transform: "rotate(-12deg)", background: "#f28a4b" }} />
              <i style={{ left: "12%", top: "58%", transform: "rotate(21deg)", background: "#71c7a1" }} />
            </span>
            <div style={{ paddingTop: 100, position: "relative" }}>
              <h1 className="page-title">Vérifier mon numéro</h1>
              <p className="muted">Entrez votre numéro de participation pour savoir si vous avez gagné.</p>
            </div>
          </div>

        {!published ? (
          <div className="notice">Les résultats ne sont pas encore publiés.</div>
        ) : !raffle.allowNumberLookup ? (
          <div className="notice">La recherche par numéro n’est pas activée pour cette tombola.</div>
        ) : (
          <section className="card lookup-card stack">
            <form className="lookup-form" onSubmit={submit}>
              <label className="field" style={{ gap: 6 }}>
                <input
                  className="input"
                  inputMode="numeric"
                  placeholder="Entrez votre numéro"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                />
                <span className="muted" style={{ fontSize: "0.82rem" }}>Exemple : 142</span>
              </label>
              <button className="button primary" type="submit">
                Vérifier
              </button>
            </form>

            {checkedNumber !== null && checkResult === undefined ? <p className="muted">Vérification…</p> : null}
            {checkResult?.status === "invalid_number" || checkResult?.status === "excluded_number" || checkResult?.status === "lookup_disabled" ? (
              <div className="error">{checkResult.message}</div>
            ) : null}
            {checkResult?.status === "losing_number" ? (
              <div className="notice">Le numéro {checkResult.number} n’est pas gagnant.</div>
            ) : null}
          </section>
        )}

        {checkResult?.status === "winning_number" ? (
          <div className="winner-banner">
            <span className="prize-icon emoji gold">{checkResult.prize.emoji ?? "🎁"}</span>
            <span>
              Bravo, le numéro <span className="winner-number">{checkResult.number}</span> gagne :
              <br />
              <strong style={{ display: "block", fontSize: "1.55rem", marginTop: 8 }}>{checkResult.prize.name}</strong>
              {checkResult.prize.description ? <span className="muted">{checkResult.prize.description}</span> : null}
            </span>
          </div>
        ) : null}

        {published && raffle.showPublicWinners ? (
          <section className="card">
            <div className="card-header">
              <div>
                <h2 className="section-title">Résultats de la tombola</h2>
              </div>
            </div>
            {rows.length === 0 ? (
              <p className="muted">Aucun résultat publié.</p>
            ) : (
              <div className="result-list">
                {rows.map(({ winner, prize }, index) => (
                  <div className="result-row" key={winner._id}>
                    <span className={`rank-dot ${index === 1 ? "silver" : index === 2 ? "bronze" : ""}`}>{winner.position}</span>
                    <span className="number-strong">{winner.winningNumber}</span>
                    <span className="prize-icon emoji">{prize?.emoji ?? "🎁"}</span>
                    <span>{prize?.name ?? "Lot"}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}
          <footer style={{ padding: "14px 0 0", textAlign: "center" }}>
            <strong>Merci à tous pour votre participation !</strong>
            <p className="muted">Les gains sont à retirer selon les modalités indiquées par l’organisateur.</p>
          </footer>
        </div>
      </section>
    </main>
  );
}
