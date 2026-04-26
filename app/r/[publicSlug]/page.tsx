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
      <section className="public-shell stack">
        <div className="hero-card stack">
          <p className="eyebrow">Résultats de tombola</p>
          <h1 className="page-title">{raffle.title}</h1>
          <p className="muted">
            Entrez votre numéro pour vérifier s’il fait partie des gagnants. Aucun ticket n’est vendu sur cette page.
          </p>
        </div>

        {!published ? (
          <div className="notice">Les résultats ne sont pas encore publiés.</div>
        ) : !raffle.allowNumberLookup ? (
          <div className="notice">La recherche par numéro n’est pas activée pour cette tombola.</div>
        ) : (
          <section className="card stack">
            <h2 className="section-title">Vérifier mon numéro</h2>
            <form className="form-grid" onSubmit={submit}>
              <label className="field">
                <span className="label">Entrez votre numéro</span>
                <input className="input" inputMode="numeric" value={input} onChange={(event) => setInput(event.target.value)} />
              </label>
              <div className="field" style={{ justifyContent: "end" }}>
                <button className="button primary" type="submit">
                  Vérifier
                </button>
              </div>
            </form>

            {checkedNumber !== null && checkResult === undefined ? <p className="muted">Vérification…</p> : null}
            {checkResult?.status === "invalid_number" || checkResult?.status === "excluded_number" || checkResult?.status === "lookup_disabled" ? (
              <div className="error">{checkResult.message}</div>
            ) : null}
            {checkResult?.status === "losing_number" ? (
              <div className="notice">Le numéro {checkResult.number} n’est pas gagnant.</div>
            ) : null}
            {checkResult?.status === "winning_number" ? (
              <div className="success">
                <strong>Bravo, le numéro {checkResult.number} gagne : {checkResult.prize.name}</strong>
                {checkResult.prize.description ? <p>{checkResult.prize.description}</p> : null}
              </div>
            ) : null}
          </section>
        )}

        {published && raffle.showPublicWinners ? (
          <section className="card">
            <div className="card-header">
              <div>
                <h2 className="section-title">Résultats de la tombola</h2>
                <p className="muted">Liste publique des gagnants.</p>
              </div>
            </div>
            {rows.length === 0 ? (
              <p className="muted">Aucun résultat publié.</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Rang</th>
                      <th>Numéro</th>
                      <th>Lot</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ winner, prize }) => (
                      <tr key={winner._id}>
                        <td>{winner.position}</td>
                        <td>
                          <strong>{winner.winningNumber}</strong>
                        </td>
                        <td>{prize?.name ?? "Lot"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}
      </section>
    </main>
  );
}
