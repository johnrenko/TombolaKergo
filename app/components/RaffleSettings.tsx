"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { getAdminPassword } from "./adminPassword";
import { parseExcludedNumbers, statusLabel } from "./format";

type PrizeDraft = {
  name: string;
  description: string;
  position: number;
};

const initialPrizes: PrizeDraft[] = [
  { name: "Vélo adulte", description: "", position: 1 },
  { name: "Bon d’achat 50 €", description: "", position: 2 },
  { name: "Panier garni", description: "", position: 3 }
];

export function RaffleSettings({ mode, raffleId }: { mode: "create" | "edit"; raffleId?: string }) {
  const router = useRouter();
  const createRaffle = useMutation(api.raffles.createRaffle);
  const updateRaffle = useMutation(api.raffles.updateRaffle);
  const adminRaffle = useQuery(
    api.raffles.getAdminRaffle,
    mode === "edit" && raffleId ? { raffleId: raffleId as Id<"raffles"> } : "skip"
  ) as any;
  const [title, setTitle] = useState("");
  const [numberMin, setNumberMin] = useState(1);
  const [numberMax, setNumberMax] = useState(500);
  const [excludedNumbers, setExcludedNumbers] = useState("");
  const [showPublicWinners, setShowPublicWinners] = useState(true);
  const [allowNumberLookup, setAllowNumberLookup] = useState(true);
  const [prizes, setPrizes] = useState<PrizeDraft[]>(initialPrizes);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const raffle = adminRaffle?.raffle;
  const locked = raffle?.status === "drawn" || raffle?.status === "published";

  useEffect(() => {
    if (!adminRaffle) return;
    setTitle(adminRaffle.raffle.title);
    setNumberMin(adminRaffle.raffle.numberMin);
    setNumberMax(adminRaffle.raffle.numberMax);
    setExcludedNumbers(adminRaffle.raffle.excludedNumbers.join(", "));
    setShowPublicWinners(adminRaffle.raffle.showPublicWinners);
    setAllowNumberLookup(adminRaffle.raffle.allowNumberLookup);
    setPrizes(
      adminRaffle.prizes.map((prize) => ({
        name: prize.name,
        description: prize.description ?? "",
        position: prize.position
      }))
    );
  }, [adminRaffle]);

  const availableNumbersCount = useMemo(() => {
    const excluded = new Set(parseExcludedNumbers(excludedNumbers));
    let count = 0;
    for (let value = numberMin; value <= numberMax; value += 1) {
      if (!excluded.has(value)) count += 1;
    }
    return Math.max(0, count);
  }, [excludedNumbers, numberMax, numberMin]);

  function updatePrize(index: number, patch: Partial<PrizeDraft>) {
    setPrizes((current) => current.map((prize, itemIndex) => (itemIndex === index ? { ...prize, ...patch } : prize)));
  }

  function addPrize() {
    setPrizes((current) => [...current, { name: "", description: "", position: current.length + 1 }]);
  }

  function removePrize(index: number) {
    setPrizes((current) => current.filter((_, itemIndex) => itemIndex !== index).map((prize, itemIndex) => ({ ...prize, position: itemIndex + 1 })));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (numberMin > numberMax) {
      setError("Le range est invalide : le numéro minimum doit être inférieur ou égal au maximum.");
      return;
    }
    if (prizes.length === 0) {
      setError("Ajoutez au moins un lot avant d’enregistrer.");
      return;
    }
    if (availableNumbersCount < prizes.length) {
      setError("Il n’y a pas assez de numéros disponibles pour attribuer tous les lots.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        adminPassword: getAdminPassword(),
        title,
        numberMin,
        numberMax,
        excludedNumbers: parseExcludedNumbers(excludedNumbers),
        showPublicWinners,
        allowNumberLookup,
        prizes: prizes.map((prize, index) => ({
          name: prize.name,
          description: prize.description || undefined,
          position: index + 1
        }))
      };
      if (mode === "create") {
        const result = await createRaffle(payload);
        router.push(`/admin/raffles/${result.raffleId}/draw`);
      } else if (raffleId) {
        await updateRaffle({ raffleId: raffleId as Id<"raffles">, ...payload });
        router.push(`/admin/raffles/${raffleId}/draw`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d’enregistrer la tombola.");
    } finally {
      setSaving(false);
    }
  }

  if (mode === "edit" && adminRaffle === undefined) {
    return (
      <main className="content">
        <section className="card">Chargement…</section>
      </main>
    );
  }

  if (mode === "edit" && adminRaffle === null) {
    return (
      <main className="content">
        <section className="card error">Tombola introuvable.</section>
      </main>
    );
  }

  return (
    <main className="content stack">
      <div className="card-header">
        <div>
          <p className="eyebrow">Paramètres</p>
          <h1 className="page-title">{mode === "create" ? "Créer une tombola" : title || "Modifier la tombola"}</h1>
          {raffle ? <span className={`badge ${raffle.status}`}>{statusLabel(raffle.status)}</span> : null}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="button ghost" href="/admin/raffles">
            Retour
          </Link>
          {raffleId ? (
            <Link className="button secondary" href={`/admin/raffles/${raffleId}/draw`}>
              Tirage
            </Link>
          ) : null}
        </div>
      </div>

      {locked ? (
        <div className="notice">Cette tombola a déjà été tirée. Les paramètres ne peuvent plus être modifiés.</div>
      ) : null}
      {error ? <div className="error">{error}</div> : null}

      <form className="stack" onSubmit={save}>
        <section className="card stack">
          <h2 className="section-title">Informations</h2>
          <div className="form-grid">
            <label className="field full">
              <span className="label">Nom de la tombola</span>
              <input className="input" disabled={locked} value={title} onChange={(event) => setTitle(event.target.value)} required />
            </label>
            <label className="field">
              <span className="label">Numéro minimum</span>
              <input className="input" disabled={locked} type="number" value={numberMin} onChange={(event) => setNumberMin(Number(event.target.value))} />
            </label>
            <label className="field">
              <span className="label">Numéro maximum</span>
              <input className="input" disabled={locked} type="number" value={numberMax} onChange={(event) => setNumberMax(Number(event.target.value))} />
            </label>
            <label className="field full">
              <span className="label">Numéros exclus</span>
              <input className="input" disabled={locked} value={excludedNumbers} onChange={(event) => setExcludedNumbers(event.target.value)} placeholder="13, 42, 99" />
            </label>
            <label className="field">
              <span className="label">Afficher tous les gagnants</span>
              <input disabled={locked} type="checkbox" checked={showPublicWinners} onChange={(event) => setShowPublicWinners(event.target.checked)} />
            </label>
            <label className="field">
              <span className="label">Recherche par numéro</span>
              <input disabled={locked} type="checkbox" checked={allowNumberLookup} onChange={(event) => setAllowNumberLookup(event.target.checked)} />
            </label>
          </div>
          <p className="muted">
            Numéros disponibles : <strong>{availableNumbersCount}</strong> pour <strong>{prizes.length}</strong> lots.
          </p>
        </section>

        <section className="card stack">
          <div className="card-header">
            <div>
              <h2 className="section-title">Lots</h2>
              <p className="muted">L’ordre d’attribution suit la position de chaque lot.</p>
            </div>
            <button className="button secondary" disabled={locked} type="button" onClick={addPrize}>
              Ajouter un lot
            </button>
          </div>
          <div className="stack">
            {prizes.map((prize, index) => (
              <div className="card" key={index} style={{ boxShadow: "none" }}>
                <div className="form-grid">
                  <label className="field">
                    <span className="label">Ordre</span>
                    <input className="input" disabled value={index + 1} />
                  </label>
                  <label className="field">
                    <span className="label">Nom du lot</span>
                    <input className="input" disabled={locked} value={prize.name} onChange={(event) => updatePrize(index, { name: event.target.value })} required />
                  </label>
                  <label className="field full">
                    <span className="label">Description optionnelle</span>
                    <textarea className="textarea" disabled={locked} value={prize.description} onChange={(event) => updatePrize(index, { description: event.target.value })} />
                  </label>
                </div>
                {!locked ? (
                  <button className="button danger" type="button" onClick={() => removePrize(index)} style={{ marginTop: 14 }}>
                    Supprimer
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        {!locked ? (
          <button className="button primary" disabled={saving} type="submit">
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        ) : null}
      </form>
    </main>
  );
}
