/**
 * Security check against the DEV project (IMPLEMENTATION_PLAN §12).
 * v1 (M1.7): RLS isolation for every table, anon denial, storage isolation,
 * workflow-column denial. M2.1: job RPCs reject foreign data and anon.
 * Extended in M4.5 (links, exposure) and M5.9.
 *
 *   npm run security-check
 *
 * Needs in .env.local: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
 * SUPABASE_SECRET_KEY and TEST_ARTISAN_{A,B}_{EMAIL,PASSWORD} (fake dev accounts).
 * Creates tagged fake fixtures for A with the admin client, checks what B, anon
 * and A can do, then deletes the fixtures. Prints PASS/FAIL; exits 1 on any FAIL.
 * Never prints keys, passwords or tokens.
 */
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { adminEnv, supabaseEnv } from "@/lib/env";

type Client = SupabaseClient;
type Result = { data: unknown; error: { code?: string; message: string } | null };

const results: { name: string; ok: boolean; detail?: string }[] = [];

function record(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? `  (${detail})` : ""}`);
}

function rows(result: Result) {
  return Array.isArray(result.data) ? result.data.length : result.data ? 1 : 0;
}

/** Read must succeed technically but return nothing (RLS filter) or be refused outright. */
function expectNoRows(name: string, result: Result) {
  record(name, rows(result) === 0, result.error ? undefined : `${rows(result)} row(s) visible`);
}

/** Write must be refused (error) or affect zero rows. */
function expectNoEffect(name: string, result: Result) {
  record(name, Boolean(result.error) || rows(result) === 0, `${rows(result)} row(s) affected`);
}

/** Write must be refused with an error (privilege, RLS check or FK). */
function expectRefused(name: string, result: Result) {
  record(name, Boolean(result.error), "accepted");
}

function expectPermissionDenied(name: string, result: Result) {
  record(name, result.error?.code === "42501", result.error ? `got ${result.error.code}` : "accepted");
}

function client(url: string, key: string): Client {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

async function signedIn(url: string, key: string, role: "A" | "B") {
  const email = process.env[`TEST_ARTISAN_${role}_EMAIL`];
  const password = process.env[`TEST_ARTISAN_${role}_PASSWORD`];
  if (!email || !password) throw new Error(`Missing TEST_ARTISAN_${role}_EMAIL / _PASSWORD in .env.local`);
  const c = client(url, key);
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(`Test artisan ${role} could not sign in (${error?.code ?? "no user"})`);
  return { client: c, id: data.user.id };
}

async function must<T>(label: string, promise: PromiseLike<{ data: T; error: { message: string } | null }>) {
  const { data, error } = await promise;
  if (error) throw new Error(`Fixture ${label} failed: ${error.message}`);
  return data;
}

async function main() {
  const { url, publishableKey } = supabaseEnv();
  const admin = client(url, adminEnv().secretKey);
  const anon = client(url, publishableKey);
  const a = await signedIn(url, publishableKey, "A");
  const b = await signedIn(url, publishableKey, "B");
  if (a.id === b.id) throw new Error("TEST_ARTISAN_A and _B are the same user");

  const tag = `sec-${Date.now()}`;
  const ids = {
    customer: randomUUID(),
    address: randomUUID(),
    job: randomUUID(),
    appointment: randomUUID(),
    request: randomUUID(),
    media: randomUUID(),
    event: randomUUID(),
    notification: randomUUID(),
    subscription: randomUUID(),
    bJob: randomUUID(),
    bCustomer: randomUUID(),
  };
  const objectPath = `${a.id}/${ids.job}/${ids.media}.jpg`;
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 0xff, 0xd9]);

  console.log(`Security check v1 against ${new URL(url).host} (fixtures tagged ${tag})\n`);

  try {
    // ---- Fixtures: one row of A's in every table, plus one job of B's ----
    const start = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    const end = new Date(start.getTime() + 3600 * 1000);
    await must("customer", admin.from("customers").insert({ id: ids.customer, owner_user_id: a.id, name: `${tag} müşteri`, phone: "+905550000099" }));
    await must("address", admin.from("customer_addresses").insert({ id: ids.address, owner_user_id: a.id, customer_id: ids.customer, address_text: `${tag} adres` }));
    await must("job", admin.from("jobs").insert({ id: ids.job, owner_user_id: a.id, customer_id: ids.customer, address_id: ids.address, title: `${tag} iş`, status: "scheduled", estimated_price: 1000, private_note: "gizli" }));
    await must("appointment", admin.from("appointments").insert({ id: ids.appointment, owner_user_id: a.id, job_id: ids.job, starts_at: start.toISOString(), ends_at: end.toISOString() }));
    await must("request", admin.from("appointment_requests").insert({ id: ids.request, owner_user_id: a.id, job_id: ids.job, appointment_id: ids.appointment, requested_starts_at: end.toISOString(), requested_ends_at: new Date(end.getTime() + 3600 * 1000).toISOString() }));
    await must("storage object", admin.storage.from("job-images").upload(objectPath, jpeg, { contentType: "image/jpeg" }));
    await must("media", admin.from("job_media").insert({ id: ids.media, owner_user_id: a.id, job_id: ids.job, kind: "image", origin: "artisan", visibility: "private", storage_bucket: "job-images", storage_path: objectPath, mime_type: "image/jpeg", size_bytes: jpeg.length }));
    await must("event", admin.from("job_events").insert({ id: ids.event, owner_user_id: a.id, job_id: ids.job, event_type: "job_created", actor_type: "artisan" }));
    await must("notification", admin.from("notifications").insert({ id: ids.notification, owner_user_id: a.id, job_id: ids.job, category: "customer_cancelled", dedupe_key: `${tag}:cancel`, payload: { title: tag } }));
    await must("push subscription", admin.from("push_subscriptions").insert({ id: ids.subscription, owner_user_id: a.id, endpoint: `https://push.invalid/${tag}`, p256dh: "x", auth: "y" }));
    await must("B customer", admin.from("customers").insert({ id: ids.bCustomer, owner_user_id: b.id, name: `${tag} B müşteri` }));
    await must("B job", admin.from("jobs").insert({ id: ids.bJob, owner_user_id: b.id, customer_id: ids.bCustomer, title: `${tag} B iş` }));

    // ---- Positive controls: A sees its own rows (otherwise the checks prove nothing) ----
    console.log("Controls");
    const own: [string, string][] = [
      ["profiles", a.id], ["customers", ids.customer], ["customer_addresses", ids.address], ["jobs", ids.job],
      ["appointments", ids.appointment], ["appointment_requests", ids.request], ["job_media", ids.media],
      ["job_events", ids.event], ["notifications", ids.notification], ["push_subscriptions", ids.subscription],
    ];
    for (const [table, id] of own) {
      const r = await a.client.from(table).select("id").eq("id", id);
      record(`A sees own ${table}`, rows(r) === 1, r.error?.message ?? `${rows(r)} rows`);
    }
    const ownObject = await a.client.storage.from("job-images").download(objectPath);
    record("A downloads own storage object", !ownObject.error, ownObject.error?.message);

    // ---- RLS: B against A's rows in every table ----
    console.log("\nRLS isolation (B → A)");
    for (const [table, id] of own) {
      expectNoRows(`B cannot select A's ${table}`, await b.client.from(table).select("*").eq("id", id));
    }
    expectNoRows("B cannot list A's rows via unfiltered selects", await b.client.from("customers").select("id").eq("owner_user_id", a.id));

    const aProfile = await must("A profile", admin.from("profiles").select("display_name").eq("id", a.id).single());
    const updates: [string, string, Record<string, unknown>][] = [
      ["profiles", a.id, { display_name: (aProfile as { display_name: string }).display_name }],
      ["customers", ids.customer, { name: "hack" }],
      ["customer_addresses", ids.address, { address_text: "hack" }],
      ["jobs", ids.job, { title: "hack" }],
      ["job_media", ids.media, { visibility: "shared" }],
      ["notifications", ids.notification, { read_at: new Date().toISOString() }],
    ];
    for (const [table, id, patch] of updates) {
      expectNoEffect(`B cannot update A's ${table}`, await b.client.from(table).update(patch).eq("id", id).select("id"));
    }
    for (const table of ["customers", "customer_addresses", "push_subscriptions", "jobs", "job_media", "job_events", "notifications"]) {
      const id = Object.fromEntries(own)[table];
      expectNoEffect(`B cannot delete A's ${table}`, await b.client.from(table).delete().eq("id", id).select("id"));
    }

    // Write controls: the same statements succeed for the owner, so B's zero
    // results come from RLS and not from a broken statement.
    for (const [table, id, patch] of updates) {
      const r = await a.client.from(table).update(patch).eq("id", id).select("id");
      record(`control: A can run the same update on own ${table}`, rows(r) === 1, r.error?.message ?? `${rows(r)} rows`);
    }
    const ctlAddress = await a.client.from("customer_addresses").insert({ customer_id: ids.customer, address_text: `${tag} control` }).select("id");
    record("control: A can add an address to own customer", rows(ctlAddress) === 1, ctlAddress.error?.message);
    const ctlMedia = await a.client.from("job_media").insert({ job_id: ids.job, kind: "image", origin: "artisan", visibility: "private", storage_bucket: "job-images", storage_path: `${a.id}/${ids.job}/ctl.jpg`, mime_type: "image/jpeg", size_bytes: 10 }).select("id");
    record("control: A can add media to own job", rows(ctlMedia) === 1, ctlMedia.error?.message);
    const ctlJob = await a.client.from("jobs").update({ customer_id: ids.customer }).eq("id", ids.job).select("id");
    record("control: A can point own job at own customer", rows(ctlJob) === 1, ctlJob.error?.message);
    const ctlUpload = await a.client.storage.from("job-images").upload(`${a.id}/${ids.job}/ctl.jpg`, jpeg, { contentType: "image/jpeg" });
    record("control: A can upload into own job folder", !ctlUpload.error, ctlUpload.error?.message);

    expectRefused("B cannot insert a customer owned by A", await b.client.from("customers").insert({ owner_user_id: a.id, name: "x" }));
    expectRefused("B cannot add an address to A's customer", await b.client.from("customer_addresses").insert({ customer_id: ids.customer, address_text: "x" }));
    expectRefused("B cannot add media to A's job", await b.client.from("job_media").insert({ job_id: ids.job, kind: "image", origin: "artisan", visibility: "private", storage_bucket: "job-images", storage_path: `${b.id}/${ids.job}/x.jpg`, mime_type: "image/jpeg", size_bytes: 10 }));
    expectRefused("B cannot subscribe push for A", await b.client.from("push_subscriptions").insert({ owner_user_id: a.id, endpoint: `https://push.invalid/${tag}-b`, p256dh: "x", auth: "y" }));
    expectRefused("B cannot point its job at A's customer", await b.client.from("jobs").update({ customer_id: ids.customer }).eq("id", ids.bJob).select("id"));

    // ---- Anon (signed-out visitor) ----
    console.log("\nAnon denial");
    for (const [table] of own) {
      expectPermissionDenied(`anon cannot select ${table}`, await anon.from(table).select("id").limit(1));
    }
    expectPermissionDenied("anon cannot insert customers", await anon.from("customers").insert({ owner_user_id: a.id, name: "x" }));
    expectPermissionDenied("anon cannot update jobs", await anon.from("jobs").update({ title: "x" }).eq("id", ids.job));
    expectPermissionDenied("anon cannot delete customers", await anon.from("customers").delete().eq("id", ids.customer));
    expectPermissionDenied("anon cannot execute fold_tr", await anon.rpc("fold_tr", { input: "x" }));

    // ---- Workflow columns: even the owner can't write them directly ----
    console.log("\nWorkflow-column denial (A on own rows)");
    expectPermissionDenied("A cannot insert jobs directly (create_job RPC only)", await a.client.from("jobs").insert({ owner_user_id: a.id, customer_id: ids.customer, title: "x" }));
    expectPermissionDenied("A cannot set jobs.status", await a.client.from("jobs").update({ status: "completed" }).eq("id", ids.job));
    expectPermissionDenied("A cannot set jobs.completed_at", await a.client.from("jobs").update({ completed_at: new Date().toISOString() }).eq("id", ids.job));
    expectPermissionDenied("A cannot set jobs.cancelled_*", await a.client.from("jobs").update({ cancelled_by: "artisan", cancelled_reason: "other" }).eq("id", ids.job));
    expectPermissionDenied("A cannot change jobs.owner_user_id", await a.client.from("jobs").update({ owner_user_id: b.id }).eq("id", ids.job));
    expectPermissionDenied("A cannot delete jobs", await a.client.from("jobs").delete().eq("id", ids.job));
    expectPermissionDenied("A cannot insert appointments", await a.client.from("appointments").insert({ owner_user_id: a.id, job_id: ids.job, starts_at: start.toISOString(), ends_at: end.toISOString() }));
    expectPermissionDenied("A cannot update appointments", await a.client.from("appointments").update({ status: "cancelled" }).eq("id", ids.appointment));
    expectPermissionDenied("A cannot update appointment_requests", await a.client.from("appointment_requests").update({ status: "accepted" }).eq("id", ids.request));
    expectPermissionDenied("A cannot insert job_events", await a.client.from("job_events").insert({ owner_user_id: a.id, job_id: ids.job, event_type: "job_created", actor_type: "artisan" }));
    expectPermissionDenied("A cannot insert notifications", await a.client.from("notifications").insert({ owner_user_id: a.id, category: "daily_digest", dedupe_key: `${tag}:x` }));
    expectPermissionDenied("A cannot change notifications.payload", await a.client.from("notifications").update({ payload: {} }).eq("id", ids.notification));
    expectPermissionDenied("A cannot change job_media.origin", await a.client.from("job_media").update({ origin: "customer" }).eq("id", ids.media));
    expectRefused("A cannot insert customer-origin media", await a.client.from("job_media").insert({ job_id: ids.job, kind: "image", origin: "customer", visibility: "shared", storage_bucket: "job-images", storage_path: `${a.id}/${ids.job}/c.jpg`, mime_type: "image/jpeg", size_bytes: 10 }));
    expectRefused("A cannot show an estimate-only price", await a.client.from("jobs").update({ agreed_price: null, show_price_to_customer: true }).eq("id", ids.job).select("id"));

    // ---- Job RPCs (M2.1): owner-only, never anon ----
    console.log("\nJob RPCs");
    const rpcResult = (r: Result) => (r.data as { result?: string } | null)?.result;
    const bStatus = await b.client.rpc("change_job_status", { p_job_id: ids.job, p_action: "cancel" });
    record("B change_job_status on A's job → not_found", rpcResult(bStatus) === "not_found", bStatus.error?.message ?? rpcResult(bStatus));
    const afterB = await admin.from("jobs").select("status").eq("id", ids.job).single();
    record("A's job status unchanged after B's call", (afterB.data as { status: string } | null)?.status === "scheduled", (afterB.data as { status: string } | null)?.status);
    const bCreate = await b.client.rpc("create_job", { p_job_id: randomUUID(), p_title: "x", p_customer_id: ids.customer });
    record("B create_job with A's customer → customer_not_found", rpcResult(bCreate) === "customer_not_found", bCreate.error?.message ?? rpcResult(bCreate));
    const bReuse = await b.client.rpc("create_job", { p_job_id: ids.job, p_title: "x", p_new_customer_name: "x" });
    record("B create_job reusing A's job id → invalid_input", rpcResult(bReuse) === "invalid_input", bReuse.error?.message ?? rpcResult(bReuse));
    expectPermissionDenied("anon cannot execute create_job", await anon.rpc("create_job", { p_job_id: randomUUID(), p_title: "x", p_new_customer_name: "x" }));
    expectPermissionDenied("anon cannot execute change_job_status", await anon.rpc("change_job_status", { p_job_id: ids.job, p_action: "cancel" }));
    // PostgREST doesn't expose trigger functions at all (PGRST202); either way it must not run.
    const triggerCall = await a.client.rpc("jobs_log_changes");
    record("signed-in users cannot call the trigger function", ["42501", "PGRST202"].includes(triggerCall.error?.code ?? ""), triggerCall.error?.code ?? "accepted");

    // ---- Appointment RPCs (M3.1): owner-only, never anon ----
    console.log("\nAppointment RPCs");
    const later = (h: number) => new Date(start.getTime() + h * 3_600_000).toISOString();
    const countAppointments = async () => (await admin.from("appointments").select("id", { count: "exact", head: true }).eq("job_id", ids.job)).count;
    const before = await countAppointments();
    const bNew = await b.client.rpc("save_appointment", { p_job_id: ids.job, p_starts_at: later(3), p_ends_at: later(4) });
    record("B save_appointment on A's job → not_found", rpcResult(bNew) === "not_found", bNew.error?.message ?? rpcResult(bNew));
    const bMove = await b.client.rpc("save_appointment", { p_job_id: ids.bJob, p_appointment_id: ids.appointment, p_starts_at: later(3), p_ends_at: later(4) });
    record("B rescheduling A's appointment via own job → not_found", rpcResult(bMove) === "not_found", bMove.error?.message ?? rpcResult(bMove));
    const bClose = await b.client.rpc("close_appointment", { p_appointment_id: ids.appointment, p_outcome: "cancelled" });
    record("B close_appointment on A's appointment → not_found", rpcResult(bClose) === "not_found", bClose.error?.message ?? rpcResult(bClose));
    const apptAfterB = await admin.from("appointments").select("status").eq("id", ids.appointment).single();
    record("A's appointments unchanged after B's calls", (await countAppointments()) === before && (apptAfterB.data as { status: string } | null)?.status === "scheduled", `${await countAppointments()} rows`);
    expectPermissionDenied("anon cannot execute save_appointment", await anon.rpc("save_appointment", { p_job_id: ids.job, p_starts_at: later(3), p_ends_at: later(4) }));
    expectPermissionDenied("anon cannot execute close_appointment", await anon.rpc("close_appointment", { p_appointment_id: ids.appointment, p_outcome: "cancelled" }));
    const aNew = await a.client.rpc("save_appointment", { p_job_id: ids.job, p_starts_at: later(3), p_ends_at: later(4) });
    record("control: A save_appointment on own job → ok", rpcResult(aNew) === "ok", aNew.error?.message ?? rpcResult(aNew));

    const aStatus = await a.client.rpc("change_job_status", { p_job_id: ids.job, p_action: "start" });
    record("control: A change_job_status on own job → ok", rpcResult(aStatus) === "ok", aStatus.error?.message ?? rpcResult(aStatus));
    const lowerVersion = await a.client.from("jobs").update({ share_version: 0 }).eq("id", ids.job).select("id");
    record("share_version cannot be lowered", Boolean(lowerVersion.error), "accepted");

    // ---- Storage ----
    console.log("\nStorage isolation");
    const bDownload = await b.client.storage.from("job-images").download(objectPath);
    record("B cannot download A's object", Boolean(bDownload.error), "downloaded");
    const bList = await b.client.storage.from("job-images").list(`${a.id}/${ids.job}`);
    record("B cannot list A's folder", (bList.data ?? []).length === 0, `${bList.data?.length} item(s)`);
    const bUploadA = await b.client.storage.from("job-images").upload(`${a.id}/${ids.job}/b.jpg`, jpeg, { contentType: "image/jpeg" });
    record("B cannot upload into A's folder", Boolean(bUploadA.error), "uploaded");
    const bUploadJob = await b.client.storage.from("job-images").upload(`${b.id}/${ids.job}/b.jpg`, jpeg, { contentType: "image/jpeg" });
    record("B cannot upload under its folder for A's job", Boolean(bUploadJob.error), "uploaded");
    await b.client.storage.from("job-images").remove([objectPath]);
    const stillThere = await admin.storage.from("job-images").list(`${a.id}/${ids.job}`);
    record("B cannot delete A's object", (stillThere.data ?? []).some((o) => o.name === `${ids.media}.jpg`), "object gone");
    const anonDownload = await anon.storage.from("job-images").download(objectPath);
    record("anon cannot download objects", Boolean(anonDownload.error), "downloaded");
    const anonList = await anon.storage.from("job-images").list(`${a.id}/${ids.job}`);
    record("anon cannot list objects", (anonList.data ?? []).length === 0, `${anonList.data?.length} item(s)`);
    const anonUpload = await anon.storage.from("job-images").upload(`${a.id}/${ids.job}/anon.jpg`, jpeg, { contentType: "image/jpeg" });
    record("anon cannot upload", Boolean(anonUpload.error), "uploaded");
    const overwrite = await a.client.storage.from("job-images").upload(objectPath, jpeg, { contentType: "image/jpeg", upsert: true });
    record("A cannot overwrite an object (no update policy)", Boolean(overwrite.error), "overwritten");
    const publicBucket = await admin.storage.getBucket("job-images");
    const publicAudio = await admin.storage.getBucket("job-audio");
    record("media buckets are private", publicBucket.data?.public === false && publicAudio.data?.public === false, "a bucket is public");
  } finally {
    // ---- Cleanup (cascades remove appointments, requests, media rows, events, notifications) ----
    await admin.storage.from("job-images").remove([objectPath, `${a.id}/${ids.job}/ctl.jpg`, `${a.id}/${ids.job}/b.jpg`, `${b.id}/${ids.job}/b.jpg`, `${a.id}/${ids.job}/anon.jpg`]);
    await admin.from("push_subscriptions").delete().like("endpoint", `https://push.invalid/${tag}%`);
    await admin.from("jobs").delete().in("id", [ids.job, ids.bJob]);
    await admin.from("customers").delete().in("id", [ids.customer, ids.bCustomer]);
    const leftovers = await admin.from("customers").select("id").like("name", `${tag}%`);
    const leftoverObjects = await admin.storage.from("job-images").list(`${a.id}/${ids.job}`);
    const clean = !leftovers.data?.length && !leftoverObjects.data?.length;
    console.log(`\nCleanup: ${clean ? "fixtures removed" : "LEFTOVER fixtures found"}`);
    await Promise.all([a.client.auth.signOut({ scope: "local" }), b.client.auth.signOut({ scope: "local" })]);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed${failed.length ? `, ${failed.length} FAILED` : ""}.`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((error: unknown) => {
  console.error(`Security check could not run: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
});
