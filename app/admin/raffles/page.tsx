"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { getAdminSessionToken } from "../../components/adminSession";
import { formatDate, statusLabel } from "../../components/format";

export default function RafflesPage() {
  const [sessionToken, setSessionToken] = useState("");
  const raffles = useQuery(api.raffles.listRaffles, sessionToken ? { sessionToken } : "skip") as any[] | undefined;

  useEffect(() => {
    setSessionToken(getAdminSessionToken());
  }, []);

  return (
    <main className="content stack">
      <div className="card-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h1 className="page-title">Tombolas</h1>
          <p className="muted">Créez une tombola, configurez les lots, lancez le tirage puis publiez les résultats.</p>
        </div>
        <Link className="button primary" href="/admin/raffles/new">
          Créer une tombola
        </Link>
      </div>

      <section className="card">
        {!raffles ? (
          <p className="muted">Chargement…</p>
        ) : raffles.length === 0 ? (
          <div className="stack">
            <h2 className="section-title">Aucune tombola</h2>
            <p className="muted">Commencez par créer une tombola avec une plage de numéros et au moins un lot.</p>
            <Link className="button primary" href="/admin/raffles/new">
              Créer une tombola
            </Link>
          </div>
        ) : (
          <>
            <div className="table-wrap admin-table-view">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Statut</th>
                    <th>Plage</th>
                    <th>Lots</th>
                    <th>Créée</th>
                    <th>Tirage</th>
                    <th>Publication</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {raffles.map((raffle) => (
                    <tr key={raffle._id}>
                      <td>
                        <strong>{raffle.title}</strong>
                        <br />
                        <span className="muted">/r/{raffle.publicSlug}</span>
                      </td>
                      <td>
                        <span className={`badge ${raffle.status}`}>{statusLabel(raffle.status)}</span>
                      </td>
                      <td>
                        {raffle.numberMin} → {raffle.numberMax}
                      </td>
                      <td>{raffle.prizeCount}</td>
                      <td>{formatDate(raffle.createdAt)}</td>
                      <td>{formatDate(raffle.drawnAt)}</td>
                      <td>{formatDate(raffle.publishedAt)}</td>
                      <td>
                        <Link className="button secondary" href={`/admin/raffles/${raffle._id}/settings`}>
                          Ouvrir
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="raffle-card-list">
              {raffles.map((raffle) => (
                <article className="raffle-mobile-card" key={raffle._id}>
                  <div className="raffle-mobile-card-header">
                    <div>
                      <h2 className="section-title">{raffle.title}</h2>
                      <p className="muted">/r/{raffle.publicSlug}</p>
                    </div>
                    <span className={`badge ${raffle.status}`}>{statusLabel(raffle.status)}</span>
                  </div>
                  <dl className="raffle-mobile-meta">
                    <div>
                      <dt>Plage</dt>
                      <dd>
                        {raffle.numberMin} → {raffle.numberMax}
                      </dd>
                    </div>
                    <div>
                      <dt>Lots</dt>
                      <dd>{raffle.prizeCount}</dd>
                    </div>
                    <div>
                      <dt>Créée</dt>
                      <dd>{formatDate(raffle.createdAt)}</dd>
                    </div>
                    <div>
                      <dt>Tirage</dt>
                      <dd>{formatDate(raffle.drawnAt)}</dd>
                    </div>
                    <div>
                      <dt>Publication</dt>
                      <dd>{formatDate(raffle.publishedAt)}</dd>
                    </div>
                  </dl>
                  <Link className="button secondary" href={`/admin/raffles/${raffle._id}/settings`}>
                    Ouvrir
                  </Link>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
