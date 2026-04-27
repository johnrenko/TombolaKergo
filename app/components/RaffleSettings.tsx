"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { getAdminSessionToken } from "./adminSession";
import { parseExcludedNumbers, statusLabel } from "./format";

type PrizeDraft = {
  name: string;
  emoji: string;
  description: string;
  position: number;
};

const initialPrizes: PrizeDraft[] = [
  { name: "Vélo adulte", emoji: "🚲", description: "", position: 1 },
  { name: "Bon d’achat 50 €", emoji: "🏷️", description: "", position: 2 },
  { name: "Panier garni", emoji: "🧺", description: "", position: 3 }
];

const defaultPrizeEmoji = "🎁";
const emojiChoices = ["🎁", "🚲", "🏷️", "🧺", "🏆", "🍾", "🎟️", "📚", "⚽", "🧸", "💐", "☕"];
const prizeCsvHeader = "position,emoji,name,description";

function escapeCsvCell(value: string | number) {
  const text = String(value ?? "");
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function serializePrizes(prizes: PrizeDraft[]) {
  return [
    prizeCsvHeader,
    ...prizes.map((prize, index) =>
      [index + 1, prize.emoji || defaultPrizeEmoji, prize.name, prize.description].map(escapeCsvCell).join(",")
    )
  ].join("\n");
}

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function parsePrizeCsv(text: string) {
  const rows = parseCsvRows(text);
  if (rows.length === 0) return [];
  const firstRow = rows[0].map((cell) => cell.toLowerCase());
  const hasHeader = firstRow.includes("name") || firstRow.includes("lot") || firstRow.includes("emoji");
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const indexFor = (names: string[], fallback: number) => {
    const index = firstRow.findIndex((cell) => names.includes(cell));
    return hasHeader && index >= 0 ? index : fallback;
  };
  const positionIndex = indexFor(["position", "ordre", "rank"], 0);
  const emojiIndex = indexFor(["emoji", "icone", "icône"], 1);
  const nameIndex = indexFor(["name", "nom", "lot"], 2);
  const descriptionIndex = indexFor(["description", "desc"], 3);

  return dataRows
    .map((row, index) => ({
      position: Number(row[positionIndex]) || index + 1,
      emoji: row[emojiIndex] || defaultPrizeEmoji,
      name: row[nameIndex] || "",
      description: row[descriptionIndex] || ""
    }))
    .filter((prize) => prize.name.trim())
    .sort((a, b) => a.position - b.position)
    .map((prize, index) => ({ ...prize, position: index + 1 }));
}

function downloadCsv(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function serializeRaffleDraft(draft: {
  title: string;
  numberMin: number;
  numberMax: number;
  excludedNumbers: number[];
  showPublicWinners: boolean;
  allowNumberLookup: boolean;
  prizes: PrizeDraft[];
}) {
  return JSON.stringify({
    title: draft.title,
    numberMin: draft.numberMin,
    numberMax: draft.numberMax,
    excludedNumbers: draft.excludedNumbers,
    showPublicWinners: draft.showPublicWinners,
    allowNumberLookup: draft.allowNumberLookup,
    prizes: draft.prizes.map((prize, index) => ({
      name: prize.name,
      emoji: prize.emoji || defaultPrizeEmoji,
      description: prize.description || "",
      position: index + 1
    }))
  });
}

function PublicQrShare({ publicSlug, title }: { publicSlug: string; title: string }) {
  const [origin, setOrigin] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [shareStatus, setShareStatus] = useState("");
  const publicUrl = origin ? `${origin}/r/${publicSlug}` : `/r/${publicSlug}`;
  const shareTitle = title.trim() || "Tombola";

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!origin) return;
    let cancelled = false;
    QRCode.toDataURL(publicUrl, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 320,
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
  }, [origin, publicUrl]);

  useEffect(() => {
    if (!shareStatus) return;
    const timeout = window.setTimeout(() => setShareStatus(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [shareStatus]);

  async function copyPublicUrl() {
    if (!navigator.clipboard) {
      setShareStatus("Copie indisponible sur ce navigateur.");
      return;
    }
    await navigator.clipboard.writeText(publicUrl);
    setShareStatus("Lien copié.");
  }

  async function sharePublicUrl() {
    if (!navigator.share) {
      await copyPublicUrl();
      return;
    }
    try {
      await navigator.share({
        title: shareTitle,
        text: `Accéder à l’espace public de la tombola ${shareTitle}`,
        url: publicUrl
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setShareStatus("Partage indisponible.");
    }
  }

  function printQrCode() {
    if (!qrDataUrl) return;
    const printWindow = window.open("", "print-public-qr", "width=720,height=860");
    if (!printWindow) {
      setShareStatus("Autorisez les fenêtres pop-up pour imprimer.");
      return;
    }
    const safeTitle = escapeHtml(shareTitle);
    const safePublicUrl = escapeHtml(publicUrl);
    printWindow.document.write(`<!doctype html>
      <html lang="fr">
        <head>
          <meta charset="utf-8" />
          <title>QR code - ${safeTitle}</title>
          <style>
            * { box-sizing: border-box; }
            body { align-items: center; display: flex; font-family: Avenir Next, Inter, Segoe UI, sans-serif; justify-content: center; margin: 0; min-height: 100vh; padding: 32px; color: #0d1533; }
            main { text-align: center; width: min(100%, 520px); }
            h1 { font-size: 32px; line-height: 1.1; margin: 0 0 10px; }
            p { color: #4d5a73; font-size: 16px; margin: 0 0 24px; overflow-wrap: anywhere; }
            img { border: 1px solid #d8deea; border-radius: 16px; display: block; margin: 0 auto 24px; max-width: 100%; padding: 18px; width: 360px; }
            strong { display: block; font-size: 18px; margin-top: 10px; overflow-wrap: anywhere; }
          </style>
        </head>
        <body>
          <main>
            <h1>${safeTitle}</h1>
            <p>Scannez ce QR code pour ouvrir l’espace public de la tombola.</p>
            <img alt="QR code de l’espace public" src="${qrDataUrl}" />
            <strong>${safePublicUrl}</strong>
          </main>
          <script>
            window.addEventListener("load", () => {
              window.focus();
              window.print();
            });
          </script>
        </body>
      </html>`);
    printWindow.document.close();
  }

  return (
    <section className="card stack public-share-card">
      <div className="card-header">
        <div>
          <h2 className="section-title">QR code public</h2>
          <p className="muted">Partagez l’espace public où les participants consultent la tombola.</p>
        </div>
      </div>
      <div className="public-share-layout">
        <div className="qr-preview" aria-label="QR code de l’espace public">
          {qrDataUrl ? <img src={qrDataUrl} alt="QR code de l’espace public" /> : <span className="muted">Génération…</span>}
        </div>
        <div className="public-share-details">
          <label className="field">
            <span className="label">Lien public</span>
            <input className="input" readOnly value={publicUrl} onFocus={(event) => event.target.select()} />
          </label>
          <div className="share-actions">
            <button className="button secondary" type="button" onClick={copyPublicUrl}>
              Copier le lien
            </button>
            <button className="button secondary" type="button" onClick={sharePublicUrl}>
              Partager
            </button>
            <button className="button primary" disabled={!qrDataUrl} type="button" onClick={printQrCode}>
              Imprimer le QR code
            </button>
          </div>
          {shareStatus ? (
            <div className="success compact-status" role="status">
              {shareStatus}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function RaffleSettings({ mode, raffleId }: { mode: "create" | "edit"; raffleId?: string }) {
  const router = useRouter();
  const createRaffle = useMutation(api.raffles.createRaffle);
  const updateRaffle = useMutation(api.raffles.updateRaffle);
  const [sessionToken, setSessionToken] = useState("");
  const adminRaffle = useQuery(
    api.raffles.getAdminRaffle,
    mode === "edit" && raffleId && sessionToken ? { raffleId: raffleId as Id<"raffles">, sessionToken } : "skip"
  ) as any;
  const [title, setTitle] = useState("");
  const [numberMin, setNumberMin] = useState(1);
  const [numberMax, setNumberMax] = useState(500);
  const [excludedNumbers, setExcludedNumbers] = useState("");
  const [showPublicWinners, setShowPublicWinners] = useState(true);
  const [allowNumberLookup, setAllowNumberLookup] = useState(true);
  const [prizes, setPrizes] = useState<PrizeDraft[]>(initialPrizes);
  const [error, setError] = useState("");
  const [saveToast, setSaveToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [saveButtonInView, setSaveButtonInView] = useState(true);
  const saveButtonBarRef = useRef<HTMLDivElement>(null);

  const raffle = adminRaffle?.raffle;
  const locked = raffle?.status === "drawn" || raffle?.status === "published";

  useEffect(() => {
    setSessionToken(getAdminSessionToken());
  }, []);

  useEffect(() => {
    if (!adminRaffle) return;
    setTitle(adminRaffle.raffle.title);
    setNumberMin(adminRaffle.raffle.numberMin);
    setNumberMax(adminRaffle.raffle.numberMax);
    setExcludedNumbers(adminRaffle.raffle.excludedNumbers.join(", "));
    setShowPublicWinners(adminRaffle.raffle.showPublicWinners);
    setAllowNumberLookup(adminRaffle.raffle.allowNumberLookup);
    const loadedPrizes = adminRaffle.prizes.map((prize) => ({
      name: prize.name,
      emoji: prize.emoji ?? defaultPrizeEmoji,
      description: prize.description ?? "",
      position: prize.position
    }));
    setPrizes(loadedPrizes);
    setSavedSnapshot(
      serializeRaffleDraft({
        title: adminRaffle.raffle.title,
        numberMin: adminRaffle.raffle.numberMin,
        numberMax: adminRaffle.raffle.numberMax,
        excludedNumbers: adminRaffle.raffle.excludedNumbers,
        showPublicWinners: adminRaffle.raffle.showPublicWinners,
        allowNumberLookup: adminRaffle.raffle.allowNumberLookup,
        prizes: loadedPrizes
      })
    );
  }, [adminRaffle]);

  useEffect(() => {
    if (locked) {
      setSaveButtonInView(true);
      return;
    }
    const saveButtonBar = saveButtonBarRef.current;
    if (!saveButtonBar || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setSaveButtonInView(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );
    observer.observe(saveButtonBar);
    return () => observer.disconnect();
  }, [adminRaffle, locked]);

  const availableNumbersCount = useMemo(() => {
    const excluded = new Set(parseExcludedNumbers(excludedNumbers));
    let count = 0;
    for (let value = numberMin; value <= numberMax; value += 1) {
      if (!excluded.has(value)) count += 1;
    }
    return Math.max(0, count);
  }, [excludedNumbers, numberMax, numberMin]);
  const excludedNumbersList = useMemo(() => parseExcludedNumbers(excludedNumbers), [excludedNumbers]);
  const currentSnapshot = useMemo(
    () =>
      serializeRaffleDraft({
        title,
        numberMin,
        numberMax,
        excludedNumbers: excludedNumbersList,
        showPublicWinners,
        allowNumberLookup,
        prizes
      }),
    [allowNumberLookup, excludedNumbersList, numberMax, numberMin, prizes, showPublicWinners, title]
  );
  const hasUnsavedChanges = savedSnapshot === null || currentSnapshot !== savedSnapshot;
  const saveDisabled = saving || (savedSnapshot !== null && !hasUnsavedChanges);
  const saveButtonLabel = saving ? "Enregistrement…" : saveDisabled ? "✓ Enregistré" : "Enregistrer";

  useEffect(() => {
    if (hasUnsavedChanges) setSaveToast("");
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!saveToast) return;
    const timeout = window.setTimeout(() => setSaveToast(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [saveToast]);

  function updatePrize(index: number, patch: Partial<PrizeDraft>) {
    setPrizes((current) => current.map((prize, itemIndex) => (itemIndex === index ? { ...prize, ...patch } : prize)));
  }

  function addPrize() {
    setPrizes((current) => [...current, { name: "", emoji: defaultPrizeEmoji, description: "", position: current.length + 1 }]);
  }

  function removePrize(index: number) {
    setPrizes((current) => current.filter((_, itemIndex) => itemIndex !== index).map((prize, itemIndex) => ({ ...prize, position: itemIndex + 1 })));
  }

  function removeExcludedNumber(numberToRemove: number) {
    setExcludedNumbers(excludedNumbersList.filter((value) => value !== numberToRemove).join(", "));
  }

  function movePrize(index: number, direction: -1 | 1) {
    setPrizes((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next.map((prize, itemIndex) => ({ ...prize, position: itemIndex + 1 }));
    });
  }

  async function importPrizes(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const importedPrizes = parsePrizeCsv(await file.text());
      if (importedPrizes.length === 0) {
        setError("Le fichier ne contient aucun lot valide.");
        return;
      }
      setPrizes(importedPrizes);
      setError("");
    } catch {
      setError("Impossible de lire le fichier d’import. Utilisez le template CSV.");
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saveDisabled) return;
    setError("");
    setSaveToast("");
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
        sessionToken: getAdminSessionToken(),
        title,
        numberMin,
        numberMax,
        excludedNumbers: parseExcludedNumbers(excludedNumbers),
        showPublicWinners,
        allowNumberLookup,
        prizes: prizes.map((prize, index) => ({
          name: prize.name,
          emoji: prize.emoji || defaultPrizeEmoji,
          description: prize.description || undefined,
          position: index + 1
        }))
      };
      if (mode === "create") {
        const result = await createRaffle(payload);
        router.push(`/admin/raffles/${result.raffleId}/draw`);
      } else if (raffleId) {
        await updateRaffle({ raffleId: raffleId as Id<"raffles">, ...payload });
        setSavedSnapshot(currentSnapshot);
        setSaveToast("Paramètres enregistrés.");
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
          <h1 className="page-title title-with-back">
            <Link className="back-arrow" href="/admin/raffles" aria-label="Retour">
              ←
            </Link>
            <span>{mode === "create" ? "Créer une tombola" : title || "Modifier la tombola"}</span>
          </h1>
          <p className="muted">Configurez les paramètres et les lots de votre tombola.</p>
          {raffle ? <span className={`badge ${raffle.status}`}>{statusLabel(raffle.status)}</span> : null}
        </div>
        {raffleId ? (
          <div className="admin-header-actions">
            <Link className="button secondary" href={`/admin/raffles/${raffleId}/draw`}>
              Tirage
            </Link>
          </div>
        ) : null}
      </div>

      {locked ? (
        <div className="notice">Cette tombola a déjà été tirée. Les paramètres ne peuvent plus être modifiés.</div>
      ) : null}
      {error ? <div className="error">{error}</div> : null}
      {saveToast ? (
        <div className="success toast" role="status">
          {saveToast}
        </div>
      ) : null}

      {raffle ? <PublicQrShare publicSlug={raffle.publicSlug} title={title} /> : null}

      <form className="stack" onSubmit={save}>
        <section className="card stack settings-card">
          <div className="form-grid">
            <label className="field full">
              <span className="label">Nom de la tombola</span>
              <input className="input" disabled={locked} value={title} onChange={(event) => setTitle(event.target.value)} required />
            </label>
            <label className="field">
              <span className="label">Numéro minimum</span>
              <input
                className="input"
                disabled={locked}
                inputMode="numeric"
                type="number"
                value={numberMin}
                onChange={(event) => setNumberMin(Number(event.target.value))}
              />
            </label>
            <label className="field">
              <span className="label">Numéro maximum</span>
              <input
                className="input"
                disabled={locked}
                inputMode="numeric"
                type="number"
                value={numberMax}
                onChange={(event) => setNumberMax(Number(event.target.value))}
              />
            </label>
            <label className="field full">
              <span className="label">Numéros exclus</span>
              <span className="field-help">Ajoutez les numéros à retirer du tirage, séparés par une virgule ou un espace.</span>
              <input
                className="input"
                disabled={locked}
                inputMode="decimal"
                value={excludedNumbers}
                onChange={(event) => setExcludedNumbers(event.target.value)}
                placeholder="Exemple : 12, 24, 108"
              />
              <div className="excluded-chip-row" aria-label="Numéros exclus saisis">
                {excludedNumbersList.length > 0 ? (
                  excludedNumbersList.map((value) => (
                    <span className="chip" key={value}>
                      {value}
                      {!locked ? (
                        <button
                          aria-label={`Retirer le numéro ${value}`}
                          className="chip-remove"
                          type="button"
                          onClick={() => removeExcludedNumber(value)}
                        >
                          ×
                        </button>
                      ) : null}
                    </span>
                  ))
                ) : (
                  <span className="muted empty-chip-copy">Aucun numéro exclu pour le moment.</span>
                )}
              </div>
            </label>
          </div>
          <h2 className="section-title">Affichage public</h2>
          <label className="toggle-row">
            <span className="soft-icon">♙</span>
            <span>
              <strong>Afficher tous les gagnants</strong>
              <br />
              <span className="muted">Rendre la liste des gagnants visible publiquement</span>
            </span>
            <input className="switch" disabled={locked} type="checkbox" checked={showPublicWinners} onChange={(event) => setShowPublicWinners(event.target.checked)} />
          </label>
          <label className="toggle-row">
            <span className="soft-icon">⌕</span>
            <span>
              <strong>Recherche par numéro</strong>
              <br />
              <span className="muted">Permettre aux participants de vérifier leur numéro</span>
            </span>
            <input className="switch" disabled={locked} type="checkbox" checked={allowNumberLookup} onChange={(event) => setAllowNumberLookup(event.target.checked)} />
          </label>
        </section>

        <section className="card stack">
          <div className="card-header">
            <div>
              <h2 className="section-title">Lots</h2>
              <p className="muted">L’ordre d’attribution suit la position de chaque lot.</p>
            </div>
          </div>
          <div className="import-actions">
            <button
              className="button secondary"
              disabled={locked}
              type="button"
              onClick={() =>
                downloadCsv(
                  "template-lots-tombola.csv",
                  `${prizeCsvHeader}\n1,🎁,Nom du lot,Description optionnelle\n2,🎁,Autre lot,Description optionnelle`
                )
              }
            >
              Télécharger le template
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={() => downloadCsv("lots-tombola.csv", serializePrizes(prizes))}
            >
              Exporter les lots
            </button>
            <label className={`button secondary ${locked ? "disabled" : ""}`}>
              Importer un CSV
              <input accept=".csv,text/csv" disabled={locked} onChange={importPrizes} style={{ display: "none" }} type="file" />
            </label>
          </div>
          <div className="lot-list">
            {prizes.map((prize, index) => (
              <div className="lot-row" key={index}>
                <span className={`rank-dot ${index === 1 ? "silver" : index === 2 ? "bronze" : ""}`}>{index + 1}</span>
                <div className="lot-order-controls" aria-label={`Changer l’ordre du lot ${index + 1}`}>
                  <button
                    aria-label={`Monter le lot ${index + 1}`}
                    className="icon-button order-button"
                    disabled={locked || index === 0}
                    type="button"
                    onClick={() => movePrize(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    aria-label={`Descendre le lot ${index + 1}`}
                    className="icon-button order-button"
                    disabled={locked || index === prizes.length - 1}
                    type="button"
                    onClick={() => movePrize(index, 1)}
                  >
                    ↓
                  </button>
                </div>
                <label className="emoji-picker" aria-label={`Emoji du lot ${index + 1}`}>
                  <span className="prize-icon emoji">{prize.emoji || defaultPrizeEmoji}</span>
                  <select
                    disabled={locked}
                    value={prize.emoji || defaultPrizeEmoji}
                    onChange={(event) => updatePrize(index, { emoji: event.target.value })}
                  >
                    {emojiChoices.map((emoji) => (
                      <option key={emoji} value={emoji}>
                        {emoji}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field" style={{ gap: 4 }}>
                  <input
                    aria-label={`Nom du lot ${index + 1}`}
                    className="input"
                    disabled={locked}
                    value={prize.name}
                    onChange={(event) => updatePrize(index, { name: event.target.value })}
                    required
                  />
                  <input
                    aria-label={`Description du lot ${index + 1}`}
                    className="input"
                    disabled={locked}
                    value={prize.description}
                    onChange={(event) => updatePrize(index, { description: event.target.value })}
                    placeholder="Description optionnelle"
                  />
                </label>
                {!locked ? (
                  <button className="icon-button delete-prize" aria-label={`Supprimer le lot ${index + 1}`} type="button" onClick={() => removePrize(index)}>
                    🗑
                  </button>
                ) : (
                  <span className="delete-prize-placeholder" aria-hidden="true">
                    🗑
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="add-prize-row">
            <button className="button secondary" disabled={locked} type="button" onClick={addPrize}>
              <span aria-hidden="true">+</span>
              Ajouter un lot
            </button>
          </div>
        </section>

        {!locked ? (
          <div className="sticky-save-bar" ref={saveButtonBarRef}>
            <button className="button primary" disabled={saveDisabled} type="submit">
              {saveButtonLabel}
            </button>
          </div>
        ) : null}

        {!locked && !saveButtonInView ? (
          <button className="button primary floating-save-button" disabled={saveDisabled} type="submit">
            {saveButtonLabel}
          </button>
        ) : null}
      </form>
    </main>
  );
}
