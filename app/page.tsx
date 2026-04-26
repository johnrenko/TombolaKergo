import Link from "next/link";

export default function HomePage() {
  return (
    <main className="public-page">
      <section className="public-shell hero-card stack">
        <p className="eyebrow">Tombola Kergo</p>
        <h1 className="page-title">Outil d’administration et de publication de résultats.</h1>
        <p className="muted">
          Cette V1 ne vend aucun ticket et ne gère aucun paiement en ligne. Elle sert à préparer un tirage,
          l’exécuter côté serveur, puis publier les résultats.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link className="button primary" href="/admin/raffles">
            Ouvrir l’administration
          </Link>
        </div>
      </section>
    </main>
  );
}
