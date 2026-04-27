import { ConvexHttpClient } from "convex/browser";
import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { api } from "../../convex/_generated/api";

const adminSecret = process.env.E2E_ADMIN_INVITE_SECRET ?? "admin";
const password = "admin-password-e2e";
const resetPassword = "admin-password-reset-e2e";

async function createAccount(page: Page) {
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL ?? "http://127.0.0.1:3210");
  const email = `admin-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
  const invite = await convex.mutation(api.auth.createInvite, {
    adminSecret,
    email,
    name: "Admin E2E",
    expiresInHours: 2
  });
  await page.goto(invite.signupPath);
  await page.getByLabel("Nom").fill("Admin E2E");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Créer le compte" }).click();
  await expect(page.getByRole("heading", { name: "Tombolas" })).toBeVisible();
  return { email };
}

async function login(page: Page) {
  await page.goto("/admin/raffles");
  if (await page.getByRole("heading", { name: "Connexion administrateur" }).isVisible().catch(() => false)) {
    await createAccount(page);
  }
  await expect(page.getByRole("heading", { name: "Tombolas" })).toBeVisible();
}

async function createRaffle(page: Page, title: string, numberMax = "4") {
  await login(page);
  await page.goto("/admin/raffles/new");
  await expect(page.getByRole("heading", { name: /Créer une tombola/ })).toBeVisible();
  await page.getByLabel("Nom de la tombola").fill(title);
  await page.getByLabel("Numéro minimum").fill("1");
  await page.getByLabel("Numéro maximum").fill(numberMax);
  await page.getByRole("button", { name: /^Enregistrer$/ }).first().click();
  await expect(page.getByRole("heading", { name: "Tirage au sort" })).toBeVisible();
  return page.url();
}

async function createPublishedRaffle(page: Page, title: string) {
  await createRaffle(page, title);
  await page.getByRole("button", { name: /Lancer le tirage/ }).click();
  await expect(page.getByRole("button", { name: /Publier les résultats/ })).toBeVisible();
  await page.getByRole("button", { name: /Publier les résultats/ }).click();
  await expect(page.getByText("Résultats publiés")).toBeVisible();
  const publicHref = await page.getByRole("link", { name: "Page publique" }).getAttribute("href");
  expect(publicHref).toBeTruthy();
  return publicHref!;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
});

test.describe("auth admin", () => {
  test("création de compte par lien d’invitation, déconnexion et reconnexion", async ({ page }) => {
    const account = await createAccount(page);
    await page.getByRole("button", { name: "Déconnexion" }).click();
    await expect(page.getByRole("heading", { name: "Connexion administrateur" })).toBeVisible();
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Mot de passe").fill(password);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByRole("heading", { name: "Tombolas" })).toBeVisible();
  });

  test("réinitialisation du mot de passe puis connexion avec le nouveau mot de passe", async ({ page }) => {
    const account = await createAccount(page);

    await page.goto("/admin/reset-password");
    await page.getByLabel("Secret admin").fill(adminSecret);
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Nouveau mot de passe").fill(resetPassword);
    await page.getByRole("button", { name: "Réinitialiser" }).click();
    await expect(page.getByRole("status")).toContainText("Mot de passe réinitialisé");

    await page.goto("/admin/raffles");
    await expect(page.getByRole("heading", { name: "Connexion administrateur" })).toBeVisible();
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Mot de passe").fill(password);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.locator(".error")).toContainText("Mot de passe incorrect ou email inconnu");

    await page.getByLabel("Mot de passe").fill(resetPassword);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByRole("heading", { name: "Tombolas" })).toBeVisible();
  });

  test("génération d’invitation depuis l’admin et historique visible", async ({ page }) => {
    await login(page);
    await page.getByRole("link", { name: "Invitations" }).click();
    await page.getByLabel(/Email de l’invité/).fill(`invite-${Date.now()}@example.test`);
    await page.getByRole("button", { name: "Générer le lien" }).click();
    await expect(page.locator("input[readonly]")).toHaveValue(/\/admin\/signup\?token=/);

    await page.getByRole("link", { name: "Historique" }).click();
    await expect(page.getByRole("heading", { name: "Historique" })).toBeVisible();
    await expect(page.getByText("admin_invite.created").first()).toBeVisible();
  });
});

test.describe("parcours admin", () => {
  test("connexion, création, sortie et retour dans une tombola brouillon", async ({ page }) => {
    const title = `E2E brouillon ${Date.now()}`;
    await createRaffle(page, title);

    await page.locator("a.button", { hasText: "Paramètres" }).click();
    await expect(page.getByRole("heading", { name: new RegExp(title) })).toBeVisible();

    await page.getByLabel("Retour").click();
    await expect(page.getByRole("heading", { name: "Tombolas" })).toBeVisible();

    const row = page.getByRole("row").filter({ hasText: title });
    await expect(row).toBeVisible();
    await row.getByRole("link", { name: "Ouvrir" }).click();
    await expect(page.getByRole("heading", { name: new RegExp(title) })).toBeVisible();
  });

  test("validation admin: range invalide et conflit lots/numéros", async ({ page }) => {
    await login(page);
    await page.getByRole("link", { name: "Créer une tombola" }).first().click();
    await page.getByLabel("Nom de la tombola").fill(`E2E validation ${Date.now()}`);
    await page.getByLabel("Numéro minimum").fill("10");
    await page.getByLabel("Numéro maximum").fill("3");
    await page.getByRole("button", { name: /^Enregistrer$/ }).first().click();
    await expect(page.getByText("Le range est invalide")).toBeVisible();

    await page.getByLabel("Numéro minimum").fill("1");
    await page.getByLabel("Numéro maximum").fill("2");
    await page.getByRole("button", { name: /^Enregistrer$/ }).first().click();
    await expect(page.getByText("Il n’y a pas assez de numéros disponibles")).toBeVisible();
  });

  test("ajout de numéros exclus, sauvegarde et exclusion du tirage", async ({ page }) => {
    const title = `E2E exclusions ${Date.now()}`;
    await login(page);
    await page.getByRole("link", { name: "Créer une tombola" }).first().click();
    await page.getByLabel("Nom de la tombola").fill(title);
    await page.getByLabel("Numéro minimum").fill("1");
    await page.getByLabel("Numéro maximum").fill("6");
    await expect(page.getByRole("textbox", { name: /Numéros exclus/ })).toHaveAttribute("inputmode", "decimal");
    await page.getByRole("textbox", { name: /Numéros exclus/ }).fill("1, 2, 3");
    await expect(page.getByRole("button", { name: "Retirer le numéro 1" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Retirer le numéro 2" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Retirer le numéro 3" })).toBeVisible();
    await page.getByRole("button", { name: /^Enregistrer$/ }).first().click();
    await expect(page.getByRole("heading", { name: "Tirage au sort" })).toBeVisible();

    await page.locator("a.button", { hasText: "Paramètres" }).click();
    await expect(page.getByRole("textbox", { name: /Numéros exclus/ })).toHaveValue("1, 2, 3");
    await page.getByRole("link", { name: "Tirage" }).click();
    await page.getByRole("button", { name: /Lancer le tirage/ }).click();
    await expect(page.locator(".result-row")).toHaveCount(3);

    const numbers = await page.locator(".result-row .number-strong").allInnerTexts();
    expect(numbers.map((value) => value.trim()).sort()).toEqual(["4", "5", "6"]);

    await page.getByRole("button", { name: /Publier les résultats/ }).click();
    await expect(page.getByText("Résultats publiés")).toBeVisible();
    const publicHref = await page.getByRole("link", { name: "Page publique" }).getAttribute("href");
    expect(publicHref).toBeTruthy();

    await page.goto(publicHref!);
    await page.getByPlaceholder("Entrez votre numéro").fill("2");
    await page.getByRole("button", { name: "Vérifier" }).click();
    await expect(page.getByText("Ce numéro n’est pas éligible pour cette tombola.")).toBeVisible();
  });

  test("import, export et sélection d'emoji pour les lots", async ({ page }, testInfo) => {
    const title = `E2E import ${Date.now()}`;
    const csvPath = path.join(testInfo.outputDir, "lots.csv");
    await import("node:fs/promises").then(async ({ mkdir, writeFile }) => {
      await mkdir(testInfo.outputDir, { recursive: true });
      await writeFile(csvPath, "position,emoji,name,description\n1,☕,Café premium,Arabica\n2,📚,Livre jeunesse,Album illustré\n");
    });

    await login(page);
    await page.getByRole("link", { name: "Créer une tombola" }).first().click();
    await page.getByLabel("Nom de la tombola").fill(title);
    await page.locator('input[type="file"]').setInputFiles(csvPath);
    await expect(page.getByLabel("Nom du lot 1")).toHaveValue("Café premium");
    await expect(page.locator(".prize-icon.emoji").filter({ hasText: "☕" })).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exporter les lots" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("lots-tombola.csv");

    await page.locator("select").first().selectOption("🎁");
    await expect(page.locator(".prize-icon.emoji").filter({ hasText: "🎁" })).toBeVisible();
    await page.getByLabel("Numéro minimum").fill("1");
    await page.getByLabel("Numéro maximum").fill("2");
    await page.getByRole("button", { name: /^Enregistrer$/ }).first().click();
    await expect(page.getByRole("heading", { name: "Tirage au sort" })).toBeVisible();
    await page.locator("a.button", { hasText: "Paramètres" }).click();
    await expect(page.getByLabel("Nom du lot 1")).toHaveValue("Café premium");
    await expect(page.locator(".prize-icon.emoji").filter({ hasText: "🎁" })).toBeVisible();
  });

  test("tirage, verrouillage, publication et audit", async ({ page }) => {
    const title = `E2E publication ${Date.now()}`;
    await createRaffle(page, title);
    await expect(page.getByText("Aucun résultat pour le moment.")).toBeVisible();

    await page.getByRole("button", { name: /Lancer le tirage/ }).click();
    await expect(page.getByRole("button", { name: /Publier les résultats/ })).toBeVisible();
    await expect(page.locator(".result-row")).toHaveCount(3);

    await page.locator("a.button", { hasText: "Paramètres" }).click();
    await expect(page.getByText("Cette tombola a déjà été tirée")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Enregistrer$/ })).toHaveCount(0);

    await page.getByRole("link", { name: "Tirage" }).click();
    await page.getByRole("button", { name: /Publier les résultats/ }).click();
    await expect(page.getByText("Résultats publiés")).toBeVisible();
    await expect(page.getByRole("button", { name: /Lancer le tirage/ })).toHaveCount(0);

    await page.getByRole("link", { name: "Historique" }).click();
    await expect(page.getByText("raffle.drawn").first()).toBeVisible();
    await expect(page.getByText("raffle.published").first()).toBeVisible();
  });
});

test.describe("parcours participant", () => {
  test("tombola non publiée: consultation publique bloquée", async ({ page }) => {
    const title = `E2E non publiée ${Date.now()}`;
    await createRaffle(page, title);
    const publicHref = await page.getByRole("link", { name: "Page publique" }).getAttribute("href");
    expect(publicHref).toBeTruthy();

    await page.goto(publicHref!);
    await expect(page.getByText("Les résultats ne sont pas encore publiés.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Vérifier" })).toHaveCount(0);
  });

  test("numéro gagnant, perdant, hors plage et navigation simple", async ({ page }) => {
    const title = `E2E public ${Date.now()}`;
    const publicHref = await createPublishedRaffle(page, title);

    await page.goto(publicHref);
    await expect(page.getByRole("heading", { name: "Vérifier mon numéro" })).toBeVisible();
    await expect(page.locator(".result-row")).toHaveCount(3);

    const winningNumber = (await page.locator(".result-row .number-strong").first().innerText()).trim();
    await page.getByPlaceholder("Entrez votre numéro").fill(winningNumber);
    await page.getByRole("button", { name: "Vérifier" }).click();
    await expect(page.getByText(`Bravo, le numéro ${winningNumber} gagne`)).toBeVisible();

    await page.getByPlaceholder("Entrez votre numéro").fill("99");
    await page.getByRole("button", { name: "Vérifier" }).click();
    await expect(page.getByText("Ce numéro ne fait pas partie de cette tombola.")).toBeVisible();

    await page.goto("/");
    await page.goBack();
    await expect(page.getByRole("heading", { name: "Vérifier mon numéro" })).toBeVisible();
  });
});
