/**
 * Admin panel checks for scripts/security-check.ts (plan §4.1, M6.2–M6.3).
 * Sessions are real @supabase/ssr cookies sent to the running app, so the
 * proxy and the server gate are exercised exactly as in a browser. A
 * temporary fake admin (role + TOTP enrolled here) and a temporary fake
 * artisan are created and deleted. M6.3: the panel's account actions are
 * called over HTTP with their real action ids (from the production build's
 * manifest): they work for an aal2 admin and change nothing for anyone else.
 */
import { createHmac, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

type RecordFn = (name: string, ok: boolean, detail?: string) => void;

export type AdminCheckContext = {
  url: string;
  publishableKey: string;
  admin: SupabaseClient;
  base: string;
  tag: string;
  record: RecordFn;
  artisanA: { email: string; password: string; id: string };
};

/** RFC 6238 code (SHA-1, 30 s, 6 digits) for a base32 secret. */
export function totpCode(secret: string, at = Date.now()) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of secret.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((byte) => parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const hmac = createHmac("sha1", key).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 15;
  return String((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

/** A browser-like session: an ssr client whose cookies we can send to the app. */
export function cookieSession(url: string, publishableKey: string) {
  const jar = new Map<string, string>();
  const client = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => cookies.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
    },
  });
  const cookie = () => [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
  return { client, cookie };
}

export async function get(base: string, path: string, cookie?: string) {
  const response = await fetch(`${base}${path}`, { redirect: "manual", cache: "no-store", headers: cookie ? { Cookie: cookie } : {} });
  const body = await response.text();
  const location = response.headers.get("location");
  return { status: response.status, body, location: location ? new URL(location, base).pathname : null, headers: response.headers };
}

/** Action id of an exported server action, from the local production build (the app under test). */
function actionId(filename: string, exportedName: string) {
  const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8")) as {
    node: Record<string, { filename?: string; exportedName?: string }>;
  };
  const entry = Object.entries(manifest.node).find(([, value]) => value.filename === filename && value.exportedName === exportedName);
  if (!entry) throw new Error(`No action ${exportedName} in ${filename}; rebuild (npm run build) before the security check`);
  return entry[0];
}

/** Calls a server action the way the browser does (plain JSON args, same-origin). */
async function callAction(base: string, page: string, id: string, args: unknown[], cookie?: string) {
  const response = await fetch(`${base}${page}`, {
    method: "POST",
    redirect: "manual",
    headers: { "Next-Action": id, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component", Origin: base, ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(args),
  });
  return { status: response.status, body: await response.text() };
}

async function canSignIn(url: string, publishableKey: string, email: string, password: string) {
  const c = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (!error) await c.auth.signOut({ scope: "local" });
  return error ? (error.code ?? "error") : "ok";
}

export async function adminPanelChecks(ctx: AdminCheckContext) {
  const { url, publishableKey, admin, base, tag, record, artisanA } = ctx;
  const panelPaths = ["/admin", "/admin/ustalar", "/admin/mfa"];

  // ---- Anonymous ----
  for (const path of panelPaths) {
    const response = await get(base, path);
    record(`admin: anon GET ${path} → login redirect, no panel content`,
      response.status === 307 && response.location === "/giris" && !response.body.includes("Yönetim"), `${response.status} ${response.location}`);
  }

  // ---- Landing page (owner request, plan L-1): public for signed-out visitors, never for sessions ----
  const landing = await get(base, "/");
  record("landing: anon GET / → 200 public page linking to login",
    landing.status === 200 && landing.body.includes("İşlerini ve verdiğin sözleri unutma") && landing.body.includes('href="/giris"'), `${landing.status}`);
  const appPage = await get(base, "/giris");
  record("app pages stay noindex (login page)", /<meta name="robots" content="noindex, nofollow"/.test(appPage.body), "no noindex meta");

  // app_settings (plan L-2): service role only.
  const anonClient = createClient(url, publishableKey, { auth: { persistSession: false } });
  const anonRead = await anonClient.from("app_settings").select("key");
  record("app_settings: anon can't read", Boolean(anonRead.error) || !anonRead.data?.length, "rows visible");

  // ---- Artisan A ----
  const signInArtisan = async () => {
    const session = cookieSession(url, publishableKey);
    const { error } = await session.client.auth.signInWithPassword({ email: artisanA.email, password: artisanA.password });
    if (error) throw new Error(`Artisan A could not sign in for admin checks (${error.code})`);
    return session;
  };
  const artisan = await signInArtisan();
  for (const path of panelPaths) {
    const response = await get(base, path, artisan.cookie());
    record(`admin: artisan GET ${path} → 404, nothing about the panel`,
      response.status === 404 && !response.body.includes("Yönetim"), `${response.status}`);
  }
  const artisanRead = await artisan.client.from("app_settings").select("key");
  const artisanWrite = await artisan.client.from("app_settings").upsert({ key: "search_visibility", value: { visible: true } });
  record("app_settings: artisan can't read or write", (Boolean(artisanRead.error) || !artisanRead.data?.length) && Boolean(artisanWrite.error), "accessible");
  const artisanHome = await get(base, "/", artisan.cookie());
  record("landing: signed-in artisan GET / → /bugun", artisanHome.status === 307 && artisanHome.location === "/bugun", `${artisanHome.status} ${artisanHome.location}`);
  await artisan.client.auth.updateUser({ data: { role: "admin" } });
  await artisan.client.auth.refreshSession();
  const afterSelfGrant = await admin.auth.admin.getUserById(artisanA.id);
  const stillArtisan = await get(base, "/admin", artisan.cookie());
  record("admin: artisan can't grant itself the role (user_metadata only; still 404)",
    afterSelfGrant.data.user?.app_metadata?.role !== "admin" && stillArtisan.status === 404, `${stillArtisan.status}`);
  await artisan.client.auth.updateUser({ data: { role: null } });
  await artisan.client.auth.signOut({ scope: "local" });

  // ---- Temporary admin ----
  const email = `${tag}-admin@ustaplan.test`;
  const password = randomBytes(18).toString("base64url");
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { role: "admin" } });
  if (created.error || !created.data.user) throw new Error(`Temporary admin not created: ${created.error?.message}`);
  const adminId = created.data.user.id;
  try {
    const session = cookieSession(url, publishableKey);
    const adminSignIn = await session.client.auth.signInWithPassword({ email, password });
    if (adminSignIn.error) throw new Error(`Temporary admin could not sign in (${adminSignIn.error.code})`);

    for (const path of ["/admin", "/admin/ustalar", "/bugun", "/"]) {
      const response = await get(base, path, session.cookie());
      record(`admin: aal1 admin GET ${path} → code page redirect`, response.status === 307 && response.location === "/admin/mfa", `${response.status} ${response.location}`);
    }
    const mfaPage = await get(base, "/admin/mfa", session.cookie());
    record("admin: aal1 admin sees only the enrollment step", mfaPage.status === 200 && mfaPage.body.includes("İki adımlı doğrulama") && !mfaPage.body.includes("Genel bakış"), `${mfaPage.status}`);

    const enrolled = await session.client.auth.mfa.enroll({ factorType: "totp", friendlyName: tag });
    if (enrolled.error || !enrolled.data) throw new Error(`TOTP enrollment failed: ${enrolled.error?.message}`);
    const factorId = enrolled.data.id;
    const secret = enrolled.data.totp.secret;
    const wrong = await session.client.auth.mfa.challengeAndVerify({ factorId, code: totpCode(secret) === "000000" ? "111111" : "000000" });
    record("admin: wrong TOTP code refused", Boolean(wrong.error), "accepted");
    const stillAal1 = await get(base, "/admin", session.cookie());
    record("admin: after a wrong code the panel is still closed", stillAal1.status === 307 && stillAal1.location === "/admin/mfa", `${stillAal1.status}`);

    const verified = await session.client.auth.mfa.challengeAndVerify({ factorId, code: totpCode(secret) });
    if (verified.error) throw new Error(`TOTP verification failed: ${verified.error.message}`);
    const panel = await get(base, "/admin", session.cookie());
    record("admin: aal2 admin opens the panel", panel.status === 200 && panel.body.includes("Genel bakış"), `${panel.status}`);
    record("admin: panel responses are no-store + noindex",
      (panel.headers.get("cache-control") ?? "").includes("no-store") && (panel.headers.get("x-robots-tag") ?? "").includes("noindex"),
      `${panel.headers.get("cache-control")} / ${panel.headers.get("x-robots-tag")}`);
    const artisanRoute = await get(base, "/bugun", session.cookie());
    record("admin: artisan routes send the admin to the panel", artisanRoute.status === 307 && artisanRoute.location === "/admin", `${artisanRoute.status} ${artisanRoute.location}`);

    // The admin has no profile: RLS gives its own session no artisan data at all.
    const leaks = await Promise.all(
      ["customers", "jobs", "job_media", "notifications", "profiles"].map(async (table) => (await session.client.from(table).select("id").limit(1)).data?.length ?? 0),
    );
    record("admin: its user-scoped session sees no artisan rows (RLS)", leaks.every((n) => n === 0), JSON.stringify(leaks));

    await searchVisibilityChecks(ctx, { cookie: session.cookie(), adminEmail: email, adminPassword: password, artisanSession: signInArtisan });
    await accountActionChecks(ctx, { cookie: session.cookie(), adminId, adminEmail: email, adminPassword: password, artisanSession: signInArtisan });
    await session.client.auth.signOut({ scope: "local" });
  } finally {
    await admin.auth.admin.deleteUser(adminId);
  }
}

/** M6.3: deactivate / reactivate / reset password over HTTP, with positive and negative controls. */
async function accountActionChecks(
  ctx: AdminCheckContext,
  who: { cookie: string; adminId: string; adminEmail: string; adminPassword: string; artisanSession: () => Promise<ReturnType<typeof cookieSession>> },
) {
  const { url, publishableKey, admin, base, tag, record } = ctx;
  const setActive = actionId("src/actions/admin.ts", "setArtisanActive");
  const resetPassword = actionId("src/actions/admin.ts", "resetArtisanPassword");
  const page = "/admin/ustalar";

  // Temporary fake artisan with a profile and one (fake) push device.
  const email = `${tag}-artisan@ustaplan.test`;
  const password = randomBytes(18).toString("base64url");
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw new Error(`Fixture artisan not created: ${created.error?.message}`);
  const id = created.data.user.id;
  try {
    const profile = await admin.from("profiles").insert({ id, display_name: `${tag} usta` });
    if (profile.error) throw new Error(`Fixture profile: ${profile.error.message}`);
    await admin.from("push_subscriptions").insert({ owner_user_id: id, endpoint: `https://push.invalid/${tag}-admin`, p256dh: "x", auth: "y" });
    const banned = async () => {
      const { data } = await admin.auth.admin.getUserById(id);
      return Boolean(data.user?.banned_until && Date.parse(data.user.banned_until) > Date.now());
    };

    // Session the fixture artisan holds before being deactivated.
    const held = cookieSession(url, publishableKey);
    await held.client.auth.signInWithPassword({ email, password });

    // Negative controls: anon, an artisan, an admin without aal2.
    const artisan = await who.artisanSession();
    const aal1 = cookieSession(url, publishableKey);
    await aal1.client.auth.signInWithPassword({ email: who.adminEmail, password: who.adminPassword });
    for (const [label, cookie] of [["anon", undefined], ["artisan", artisan.cookie()], ["aal1 admin", aal1.cookie()]] as const) {
      await callAction(base, page, setActive, [id, false], cookie);
      await callAction(base, page, resetPassword, [id], cookie);
      record(`admin actions: ${label} can't deactivate or reset an artisan`,
        !(await banned()) && (await canSignIn(url, publishableKey, email, password)) === "ok", "account changed");
    }
    await artisan.client.auth.signOut({ scope: "local" });
    await aal1.client.auth.signOut({ scope: "local" });

    // Positive: aal2 admin deactivates.
    const off = await callAction(base, page, setActive, [id, false], who.cookie);
    const devices = await admin.from("push_subscriptions").select("id").eq("owner_user_id", id);
    record("admin actions: aal2 admin deactivates (banned, push devices removed)", off.status === 200 && (await banned()) && devices.data?.length === 0, `${off.status}`);
    record("deactivated artisan can't sign in", (await canSignIn(url, publishableKey, email, password)) === "user_banned", "signed in");
    const refreshed = await held.client.auth.refreshSession();
    record("deactivated artisan's open session can't be refreshed", Boolean(refreshed.error), "refreshed");
    const stillValid = await held.client.auth.getUser();
    console.log(`INFO  deactivated artisan's existing access token on getUser(): ${stillValid.error ? `refused (${stillValid.error.code})` : "still accepted until it expires (≤ JWT lifetime)"}`);

    // Admin account itself is not an artisan: actions refuse it.
    await callAction(base, page, setActive, [who.adminId, false], who.cookie);
    await callAction(base, page, resetPassword, [who.adminId], who.cookie);
    const adminUser = (await admin.auth.admin.getUserById(who.adminId)).data.user;
    record("admin actions: the admin account itself can't be deactivated or reset",
      !adminUser?.banned_until || Date.parse(adminUser.banned_until) <= Date.now(), "admin banned");
    record("admin actions: admin password unchanged by a reset attempt on itself",
      (await canSignIn(url, publishableKey, who.adminEmail, who.adminPassword)) === "ok", "admin password changed");

    // Reactivate, then reset the password.
    const on = await callAction(base, page, setActive, [id, true], who.cookie);
    record("admin actions: reactivation restores sign-in", on.status === 200 && !(await banned()) && (await canSignIn(url, publishableKey, email, password)) === "ok", `${on.status}`);
    const reset = await callAction(base, page, resetPassword, [id], who.cookie);
    const newPassword = reset.body.match(/"password":"([A-Za-z0-9_-]{18})"/)?.[1];
    record("admin actions: reset returns a new 18-character temporary password", Boolean(newPassword), `${reset.status}`);
    record("after reset: old password refused, new password works",
      (await canSignIn(url, publishableKey, email, password)) === "invalid_credentials" && Boolean(newPassword) && (await canSignIn(url, publishableKey, email, newPassword ?? "")) === "ok",
      "unexpected sign-in result");
    const unknown = await callAction(base, page, setActive, ["not-a-uuid", false], who.cookie);
    record("admin actions: malformed id refused without error page", unknown.status === 200 && unknown.body.includes("Usta bulunamadı"), `${unknown.status}`);
  } finally {
    await admin.from("push_subscriptions").delete().eq("owner_user_id", id);
    await admin.auth.admin.deleteUser(id);
  }
}

/** Plan L-2: the admin switch drives the landing page robots meta, robots.txt and sitemap; nobody else can flip it. */
async function searchVisibilityChecks(
  ctx: AdminCheckContext,
  who: { cookie: string; adminEmail: string; adminPassword: string; artisanSession: () => Promise<ReturnType<typeof cookieSession>> },
) {
  const { url, publishableKey, admin, base, record } = ctx;
  const toggle = actionId("src/actions/admin.ts", "setSearchVisibility");
  const stored = async () => {
    const { data } = await admin.from("app_settings").select("value").eq("key", "search_visibility").maybeSingle();
    return (data?.value as { visible?: unknown } | null)?.visible === true;
  };
  const original = await stored();
  const state = async () => {
    const page = await get(base, "/");
    const robots = await get(base, "/robots.txt");
    const sitemap = await get(base, "/sitemap.xml");
    return {
      index: /<meta name="robots" content="index, follow"/.test(page.body),
      noindex: /<meta name="robots" content="noindex, nofollow"/.test(page.body),
      robotsAll: /Disallow: \/\s*$/m.test(robots.body),
      robotsPrivate: robots.body.includes("Disallow: /admin") && robots.body.includes("Allow: /"),
      sitemapHasHome: sitemap.body.includes("<loc>"),
    };
  };
  try {
    // Negative controls: anon, artisan and an aal1 admin try to open it.
    const artisan = await who.artisanSession();
    const aal1 = cookieSession(url, publishableKey);
    await aal1.client.auth.signInWithPassword({ email: who.adminEmail, password: who.adminPassword });
    await callAction(base, "/admin/site", toggle, [!original]);
    await callAction(base, "/admin/site", toggle, [!original], artisan.cookie());
    await callAction(base, "/admin/site", toggle, [!original], aal1.cookie());
    record("search visibility: anon / artisan / aal1 admin can't change it", (await stored()) === original, "changed");
    await artisan.client.auth.signOut({ scope: "local" });
    await aal1.client.auth.signOut({ scope: "local" });

    const sitePage = await get(base, "/admin/site", who.cookie);
    record("search visibility: /admin/site shows the switch to the admin",
      sitePage.status === 200 && sitePage.body.includes("Arama motorlarında görünürlük") && sitePage.body.includes(original ? "Görünür" : "Gizli"), `${sitePage.status}`);
    const off = await callAction(base, "/admin/site", toggle, [false], who.cookie);
    const hidden = await state();
    record("search visibility hidden: / noindex, robots.txt disallows everything, empty sitemap",
      off.status === 200 && hidden.noindex && hidden.robotsAll && !hidden.sitemapHasHome, JSON.stringify(hidden));
    const on = await callAction(base, "/admin/site", toggle, [true], who.cookie);
    const shown = await state();
    record("search visibility open: / index, robots.txt allows / but not app paths, sitemap lists /",
      on.status === 200 && shown.index && shown.robotsPrivate && !shown.robotsAll && shown.sitemapHasHome, JSON.stringify(shown));
  } finally {
    await callAction(base, "/admin/site", toggle, [original], who.cookie);
    record("search visibility restored to its previous value", (await stored()) === original, "not restored");
  }
}
