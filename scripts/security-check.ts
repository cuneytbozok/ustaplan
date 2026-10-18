/**
 * Security check against the DEV project (IMPLEMENTATION_PLAN §12).
 * v1 (M1.7): RLS isolation for every table, anon denial, storage isolation,
 * workflow-column denial. M2.1: job RPCs reject foreign data and anon.
 * v2 (M4.5): customer links over HTTP (identical 404s, revocation, rotation),
 * page exposure, read-only GETs, media proxy restrictions. M5.1: customer
 * cancel (RPC privileges, Origin, link checks, cascade, idempotency). M5.2:
 * customer photo upload/delete (Origin, bytes, size, limits, ownership, job
 * state, events, daily notification). M5.3: reschedule (RPC privileges,
 * Origin, link checks, request → counter → accept swap, withdraw, idempotency,
 * cross-user respond). Extended in M5.9.
 *
 *   npm run security-check
 *
 * Needs in .env.local: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
 * SUPABASE_SECRET_KEY, SHARE_LINK_SECRET and TEST_ARTISAN_{A,B}_{EMAIL,PASSWORD}
 * (fake dev accounts). The link checks call the running app at
 * SECURITY_CHECK_BASE_URL (default http://localhost:3000). Run them against a
 * production build (`npm run build && npm run start`): `next dev` adds debug
 * output to error pages, so "identical invalid pages" fails there. An
 * unreachable app is a FAIL, never a skip.
 * Creates tagged fake fixtures for A with the admin client, checks what B, anon
 * and A can do, then deletes the fixtures. Prints PASS/FAIL; exits 1 on any FAIL.
 * Never prints keys, passwords or tokens.
 */
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { adminEnv, appEnv, shareLinkEnv, supabaseEnv } from "@/lib/env";
import { createShareToken, signJobLink } from "@/lib/share-link";
import { istanbulDateKey } from "@/lib/domain/scheduling";

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
    sharedMedia: randomUUID(),
    audio: randomUUID(),
    bMedia: randomUUID(),
  };
  const objectPath = `${a.id}/${ids.job}/${ids.media}.jpg`;
  const sharedPath = `${a.id}/${ids.job}/${ids.sharedMedia}.jpg`;
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 0xff, 0xd9]);

  console.log(`Security check v2 against ${new URL(url).host} (fixtures tagged ${tag})\n`);

  try {
    // ---- Fixtures: one row of A's in every table, plus one job of B's ----
    const start = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    const end = new Date(start.getTime() + 3600 * 1000);
    await must("customer", admin.from("customers").insert({ id: ids.customer, owner_user_id: a.id, name: `${tag} müşteri`, phone: "+905550000099" }));
    await must("address", admin.from("customer_addresses").insert({ id: ids.address, owner_user_id: a.id, customer_id: ids.customer, address_text: `${tag} adres` }));
    await must("job", admin.from("jobs").insert({ id: ids.job, owner_user_id: a.id, customer_id: ids.customer, address_id: ids.address, title: `${tag} iş`, status: "scheduled", estimated_price: 4321.99, private_note: `${tag} gizlinot` }));
    await must("appointment", admin.from("appointments").insert({ id: ids.appointment, owner_user_id: a.id, job_id: ids.job, starts_at: start.toISOString(), ends_at: end.toISOString() }));
    await must("request", admin.from("appointment_requests").insert({ id: ids.request, owner_user_id: a.id, job_id: ids.job, appointment_id: ids.appointment, requested_starts_at: end.toISOString(), requested_ends_at: new Date(end.getTime() + 3600 * 1000).toISOString() }));
    await must("storage object", admin.storage.from("job-images").upload(objectPath, jpeg, { contentType: "image/jpeg" }));
    await must("media", admin.from("job_media").insert({ id: ids.media, owner_user_id: a.id, job_id: ids.job, kind: "image", origin: "artisan", visibility: "private", storage_bucket: "job-images", storage_path: objectPath, mime_type: "image/jpeg", size_bytes: jpeg.length }));
    await must("event", admin.from("job_events").insert({ id: ids.event, owner_user_id: a.id, job_id: ids.job, event_type: "job_created", actor_type: "artisan" }));
    await must("notification", admin.from("notifications").insert({ id: ids.notification, owner_user_id: a.id, job_id: ids.job, category: "customer_cancelled", dedupe_key: `${tag}:cancel`, payload: { title: tag } }));
    await must("push subscription", admin.from("push_subscriptions").insert({ id: ids.subscription, owner_user_id: a.id, endpoint: `https://push.invalid/${tag}`, p256dh: "x", auth: "y" }));
    await must("shared object", admin.storage.from("job-images").upload(sharedPath, jpeg, { contentType: "image/jpeg" }));
    await must("shared media", admin.from("job_media").insert({ id: ids.sharedMedia, owner_user_id: a.id, job_id: ids.job, kind: "image", origin: "artisan", visibility: "shared", storage_bucket: "job-images", storage_path: sharedPath, mime_type: "image/jpeg", size_bytes: jpeg.length }));
    await must("audio media", admin.from("job_media").insert({ id: ids.audio, owner_user_id: a.id, job_id: ids.job, kind: "audio", origin: "artisan", visibility: "private", storage_bucket: "job-audio", storage_path: `${a.id}/${ids.job}/${ids.audio}.m4a`, mime_type: "audio/mp4", size_bytes: 10, duration_seconds: 1 }));
    await must("B customer", admin.from("customers").insert({ id: ids.bCustomer, owner_user_id: b.id, name: `${tag} B müşteri` }));
    await must("B job", admin.from("jobs").insert({ id: ids.bJob, owner_user_id: b.id, customer_id: ids.bCustomer, title: `${tag} B iş` }));
    await must("B shared media", admin.from("job_media").insert({ id: ids.bMedia, owner_user_id: b.id, job_id: ids.bJob, kind: "image", origin: "artisan", visibility: "shared", storage_bucket: "job-images", storage_path: `${b.id}/${ids.bJob}/${ids.bMedia}.jpg`, mime_type: "image/jpeg", size_bytes: jpeg.length }));

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
    const cancelArgs = { p_job_id: ids.job, p_share_version: 1, p_reason: "changed_mind" };
    expectPermissionDenied("anon cannot execute public_cancel_job", await anon.rpc("public_cancel_job", cancelArgs));
    expectPermissionDenied("A (owner) cannot execute public_cancel_job", await a.client.rpc("public_cancel_job", cancelArgs));
    expectPermissionDenied("B cannot execute public_cancel_job", await b.client.rpc("public_cancel_job", cancelArgs));
    for (const [name, args] of [
      ["public_request_reschedule", { p_job_id: ids.job, p_share_version: 1, p_starts_at: later(48) }],
      ["public_withdraw_request", { p_job_id: ids.job, p_share_version: 1, p_request_id: ids.request }],
      ["public_accept_counter", { p_job_id: ids.job, p_share_version: 1, p_request_id: ids.request }],
    ] as const) {
      expectPermissionDenied(`anon cannot execute ${name}`, await anon.rpc(name, args));
      expectPermissionDenied(`A (owner) cannot execute ${name}`, await a.client.rpc(name, args));
    }
    const swapArgs = { p_request_id: ids.request, p_starts_at: later(48), p_ends_at: later(49), p_actor: "artisan" };
    expectPermissionDenied("anon cannot execute reschedule_swap", await anon.rpc("reschedule_swap", swapArgs));
    expectPermissionDenied("A cannot execute reschedule_swap", await a.client.rpc("reschedule_swap", swapArgs));
    expectPermissionDenied("service_role cannot execute reschedule_swap", await admin.rpc("reschedule_swap", swapArgs));
    expectPermissionDenied("anon cannot execute respond_to_request", await anon.rpc("respond_to_request", { p_request_id: ids.request, p_action: "reject" }));
    const bRespond = await b.client.rpc("respond_to_request", { p_request_id: ids.request, p_action: "approve" });
    record("B respond_to_request on A's request → not_found", rpcResult(bRespond) === "not_found", bRespond.error?.message ?? rpcResult(bRespond));
    const fixtureRequest = await admin.from("appointment_requests").select("status").eq("id", ids.request).single();
    record("A's request unchanged after B's call", (fixtureRequest.data as { status: string } | null)?.status === "pending_artisan", JSON.stringify(fixtureRequest.data));
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

    // ---- Customer links (M4.5): over HTTP against the running app ----
    console.log("\nCustomer links");
    const base = (process.env.SECURITY_CHECK_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
    const secret = shareLinkEnv().secret;
    const get = async (path: string) => {
      const response = await fetch(`${base}${path}`, { redirect: "manual", cache: "no-store" });
      return { status: response.status, headers: response.headers, body: await response.text() };
    };
    const reachable = await get("/gizlilik").then((r) => r.status === 200, () => false);
    record(`app reachable at ${new URL(base).host}`, reachable, "start a production build (npm run build && npm run start) or set SECURITY_CHECK_BASE_URL");
    if (reachable) {
      // The RLS write controls above made the private photo "shared"; make it private again.
      await must("reset private photo", admin.from("job_media").update({ visibility: "private" }).eq("id", ids.media));
      const valid = createShareToken(secret, ids.job, 1);
      const signature = signJobLink(secret, ids.job, 1);
      const counts = async () => {
        const [events, media, notifications] = await Promise.all([
          admin.from("job_events").select("id", { count: "exact", head: true }).eq("job_id", ids.job),
          admin.from("job_media").select("id", { count: "exact", head: true }).eq("job_id", ids.job),
          admin.from("notifications").select("id", { count: "exact", head: true }).eq("job_id", ids.job),
        ]);
        return `${events.count}/${media.count}/${notifications.count}`;
      };
      const before = await counts();

      const page = await get(`/t/${valid}`);
      record("valid link → 200", page.status === 200, `status ${page.status}`);
      record("customer page sends no-store, no-referrer, noindex",
        /no-store/.test(page.headers.get("cache-control") ?? "") && page.headers.get("referrer-policy") === "no-referrer" && /noindex/.test(page.headers.get("x-robots-tag") ?? ""),
        `${page.headers.get("cache-control")} | ${page.headers.get("referrer-policy")} | ${page.headers.get("x-robots-tag")}`);

      // Exposure: nothing of the customer's, no private data, no ids of hidden media.
      const leaks = [
        ["customer phone", "5550000099"], ["customer name", `${tag} müşteri`], ["address", `${tag} adres`], ["private note", `${tag} gizlinot`],
        ["estimate", "4321.99"], ["formatted estimate", "4.321"], ["private photo id", ids.media], ["voice note id", ids.audio], ["owner id", a.id], ["storage path", `${a.id}/`], ["og tags", "og:"],
      ] as const;
      for (const [label, needle] of leaks) record(`customer page contains no ${label}`, !page.body.includes(needle), "found in HTML");
      record("customer page lists the shared photo through the proxy", page.body.includes(`/api/t/${valid}/media/${ids.sharedMedia}`), "shared photo missing");

      // Every invalid form looks the same: real 404, same page.
      const flipped = (signature[0] === "A" ? "B" : "A") + signature.slice(1);
      const invalid = {
        tampered: `${ids.job}.${flipped}`,
        "old version": createShareToken(secret, ids.job, 7),
        unknown: createShareToken(secret, randomUUID(), 1),
        "other job's signature": `${ids.bJob}.${signature}`,
        malformed: "not-a-token",
      };
      const invalidPages: Record<string, { status: number; body: string }> = {};
      for (const [label, token] of Object.entries(invalid)) {
        const r = await get(`/t/${token}`);
        invalidPages[label] = { status: r.status, body: r.body.split(token).join("TOKEN") };
        record(`${label} link → 404`, r.status === 404 && r.body.includes("Bu bağlantı geçersiz veya kapatılmış."), `status ${r.status}`);
        record(`${label} link shows nothing of the job`, !r.body.includes(`${tag} iş`) && !r.body.includes("hack"), "job data in HTML");
      }
      const bodies = new Set(Object.values(invalidPages).map((p) => p.body));
      record("all invalid links return an identical page", bodies.size === 1, `${bodies.size} different bodies (next dev adds debug output: run against npm run start)`);

      // Media proxy: only shared/customer images of this job.
      const media = (id: string, token = valid) => get(`/api/t/${token}/media/${id}`);
      const shared = await media(ids.sharedMedia);
      record("shared photo via proxy → 200 image", shared.status === 200 && (shared.headers.get("content-type") ?? "").startsWith("image/jpeg"), `status ${shared.status}`);
      record("media proxy sends no-store and nosniff", /no-store/.test(shared.headers.get("cache-control") ?? "") && shared.headers.get("x-content-type-options") === "nosniff", "headers missing");
      record("private photo via proxy → 404", (await media(ids.media)).status === 404, "served");
      record("voice note via proxy → 404", (await media(ids.audio)).status === 404, "served");
      record("another artisan's photo via this link → 404", (await media(ids.bMedia)).status === 404, "served");
      record("shared photo with an invalid link → 404", (await media(ids.sharedMedia, invalid.tampered)).status === 404, "served");
      record("malformed media id → 404", (await media("x")).status === 404, "served");

      record("customer GETs wrote nothing (events/media/notifications)", (await counts()) === before, `${before} → ${await counts()}`);

      // B can't change A's link settings.
      expectNoEffect("B cannot disable A's link", await b.client.from("jobs").update({ share_enabled: false }).eq("id", ids.job).select("id"));
      expectNoEffect("B cannot rotate A's link", await b.client.from("jobs").update({ share_version: 99 }).eq("id", ids.job).select("id"));

      // Revocation and rotation take effect on the very next request.
      await must("disable link", admin.from("jobs").update({ share_enabled: false }).eq("id", ids.job));
      record("disabled link: page → 404", (await get(`/t/${valid}`)).status === 404, "still served");
      record("disabled link: media → 404", (await media(ids.sharedMedia)).status === 404, "still served");
      await must("enable link", admin.from("jobs").update({ share_enabled: true }).eq("id", ids.job));
      record("re-enabled link → 200", (await get(`/t/${valid}`)).status === 200, "not served");
      await must("rotate link", admin.from("jobs").update({ share_version: 2 }).eq("id", ids.job));
      record("after regenerate: old link → 404", (await get(`/t/${valid}`)).status === 404, "old link works");
      record("after regenerate: old media URL → 404", (await media(ids.sharedMedia)).status === 404, "old media works");
      record("after regenerate: new link → 200", (await get(`/t/${createShareToken(secret, ids.job, 2)}`)).status === 200, "new link fails");
      const lowered = await admin.from("jobs").update({ share_version: 1 }).eq("id", ids.job).select("id");
      record("a regenerated link can't be revived (version can't go down)", Boolean(lowered.error), "version lowered");

      // Customer photos (M5.2): upload and delete through the link.
      const current = createShareToken(secret, ids.job, 2);
      const origin = appEnv().baseUrl;
      const upload = async (token: string, bytes: Uint8Array, from: string | null = origin) => {
        const body = new FormData();
        body.append("photo", new Blob([bytes as BlobPart], { type: "image/jpeg" }), "photo.jpg");
        const response = await fetch(`${base}/api/t/${token}/photos`, { method: "POST", redirect: "manual", body, headers: from ? { Origin: from } : {} });
        return { status: response.status, body: await response.text() };
      };
      const remove = async (token: string, id: string, from: string | null = origin) => {
        const response = await fetch(`${base}/api/t/${token}/photos/${id}`, { method: "DELETE", redirect: "manual", headers: from ? { Origin: from } : {} });
        return { status: response.status, body: await response.text() };
      };
      const customerRows = async () =>
        ((await admin.from("job_media").select("id, owner_user_id, storage_path, visibility, deleted_at, deleted_by, created_at").eq("job_id", ids.job).eq("origin", "customer").order("created_at")).data ?? []) as
          { id: string; owner_user_id: string; storage_path: string; visibility: string; deleted_at: string | null; deleted_by: string | null }[];
      const mediaEvents = async (type: string) =>
        ((await admin.from("job_events").select("actor_type").eq("job_id", ids.job).eq("event_type", type)).data ?? []) as { actor_type: string }[];
      const photoNotifications = async () =>
        ((await admin.from("notifications").select("payload, read_at, push_status").eq("job_id", ids.job).eq("category", "customer_photo_added")).data ?? []) as
          { payload: { count?: number }; read_at: string | null; push_status: string }[];
      const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
      const big = new Uint8Array(2 * 1024 * 1024 + 1);
      big.set(jpeg.slice(0, 3));

      record("photo GET on the upload route is not allowed", (await get(`/api/t/${current}/photos`)).status === 405, "GET accepted");
      record("upload from a foreign Origin → 403", (await upload(current, jpeg, "https://evil.example")).status === 403, "accepted");
      record("upload without Origin → 403", (await upload(current, jpeg, null)).status === 403, "accepted");
      record("upload through the old link → 404", (await upload(valid, jpeg)).status === 404, "accepted");
      record("upload of non-JPEG bytes → 400", (await upload(current, png)).status === 400, "accepted");
      record("upload over 2 MB → 413", (await upload(current, big)).status === 413, "accepted");
      record("refused uploads stored nothing", (await customerRows()).length === 0, `${(await customerRows()).length} rows`);

      const first = await upload(current, jpeg);
      record("customer upload → 200", first.status === 200, `status ${first.status} ${first.body.slice(0, 80)}`);
      const [row] = await customerRows();
      record("customer photo row: shared, owned by A, under A's job folder",
        Boolean(row) && row.visibility === "shared" && row.owner_user_id === a.id && row.storage_path.startsWith(`${a.id}/${ids.job}/`), JSON.stringify(row));
      const stored = row ? await admin.storage.from("job-images").download(row.storage_path) : null;
      record("customer photo object stored", Boolean(stored?.data), "object missing");
      record("media_added event by link_holder", (await mediaEvents("media_added")).some((e) => e.actor_type === "link_holder"), "no event");
      await upload(current, jpeg);
      const notes = await photoNotifications();
      record("two uploads → one inbox item with count 2, unread, no push",
        notes.length === 1 && notes[0].payload.count === 2 && notes[0].read_at === null && notes[0].push_status === "none", JSON.stringify(notes));
      const photoPage = await get(`/t/${current}`);
      record("customer page shows the customer photos via the proxy", (await customerRows()).every((r) => photoPage.body.includes(`/api/t/${current}/media/${r.id}`)), "photo missing");

      record("delete of an artisan photo through the link → 404", (await remove(current, ids.sharedMedia)).status === 404, "accepted");
      const sharedStill = await admin.from("job_media").select("deleted_at").eq("id", ids.sharedMedia).single();
      record("artisan photo untouched", (sharedStill.data as { deleted_at: string | null } | null)?.deleted_at === null, "deleted");
      record("delete of B's photo through A's link → 404", (await remove(current, ids.bMedia)).status === 404, "accepted");
      record("delete from a foreign Origin → 403", (await remove(current, row.id, "https://evil.example")).status === 403, "accepted");
      record("delete through the old link → 404", (await remove(valid, row.id)).status === 404, "accepted");
      const deleted = await remove(current, row.id);
      record("customer deletes own photo → 200", deleted.status === 200, `status ${deleted.status}`);
      const afterDelete = (await customerRows()).find((r) => r.id === row.id);
      record("row soft-deleted by link_holder", Boolean(afterDelete?.deleted_at) && afterDelete?.deleted_by === "link_holder", JSON.stringify(afterDelete));
      const gone = await admin.storage.from("job-images").download(row.storage_path);
      record("object removed from storage", Boolean(gone.error), "object still there");
      record("repeat delete → 200, one media_deleted event", (await remove(current, row.id)).status === 200 && (await mediaEvents("media_deleted")).length === 1, "duplicated");
      record("deleted photo via proxy → 404", (await media(row.id, current)).status === 404, "served");

      // Limits: ≤ 10 uploads per hour, ≤ 20 active customer photos (rows only; no objects needed).
      const fakeRows = (n: number, createdAt: string) =>
        Array.from({ length: n }, () => {
          const id = randomUUID();
          return { id, owner_user_id: a.id, job_id: ids.job, kind: "image", origin: "customer", visibility: "shared", storage_bucket: "job-images", storage_path: `${a.id}/${ids.job}/${id}.jpg`, mime_type: "image/jpeg", size_bytes: 10, created_at: createdAt };
        });
      await must("recent fake photos", admin.from("job_media").insert(fakeRows(8, new Date().toISOString())));
      const hourly = await upload(current, jpeg);
      record("11th upload within an hour → 429", hourly.status === 429, `status ${hourly.status}`);
      await must("age fake photos", admin.from("job_media").update({ created_at: new Date(Date.now() - 7_200_000).toISOString() }).eq("job_id", ids.job).eq("origin", "customer"));
      await must("old fake photos", admin.from("job_media").insert(fakeRows(12, new Date(Date.now() - 7_200_000).toISOString())));
      const tooMany = await upload(current, jpeg);
      record("upload with 20+ active customer photos → 429", tooMany.status === 429, `status ${tooMany.status}`);

      // Reschedule (M5.3): request → counter → accept, withdraw.
      const json = async (path: string, method: "POST" | "DELETE", body: unknown, from: string | null = origin) => {
        const response = await fetch(`${base}${path}`, {
          method,
          redirect: "manual",
          headers: { "Content-Type": "application/json", ...(from ? { Origin: from } : {}) },
          body: JSON.stringify(body),
        });
        return { status: response.status, body: await response.text() };
      };
      const ask = { date: istanbulDateKey(new Date(), 3), time: "10:15", note: "sec-check" };
      const openRequests = async () =>
        ((await admin.from("appointment_requests").select("id, status, appointment_id, counter_starts_at").eq("job_id", ids.job).in("status", ["pending_artisan", "pending_customer"])).data ?? []) as
          { id: string; status: string; appointment_id: string; counter_starts_at: string | null }[];
      const scheduledVisits = async () =>
        ((await admin.from("appointments").select("id, starts_at").eq("job_id", ids.job).eq("status", "scheduled").order("starts_at")).data ?? []) as { id: string; starts_at: string }[];
      const before3 = await scheduledVisits();

      record("reschedule from a foreign Origin → 403", (await json(`/api/t/${current}/reschedule`, "POST", ask, "https://evil.example")).status === 403, "accepted");
      record("reschedule through the old link → 404", (await json(`/api/t/${valid}/reschedule`, "POST", ask)).status === 404, "accepted");
      record("reschedule with a malformed date → 400", (await json(`/api/t/${current}/reschedule`, "POST", { date: "yarın", time: "10:15" })).status === 400, "accepted");
      record("reschedule to a past time → 400", (await json(`/api/t/${current}/reschedule`, "POST", { date: istanbulDateKey(new Date(), -1), time: "10:15" })).status === 400, "accepted");
      const asked = await json(`/api/t/${current}/reschedule`, "POST", ask);
      record("customer reschedule request → 200", asked.status === 200, `status ${asked.status} ${asked.body.slice(0, 80)}`);
      let open = await openRequests();
      record("one open request (the fixture request was replaced)", open.length === 1 && open[0].status === "pending_artisan" && open[0].id !== ids.request, JSON.stringify(open));
      record("current visit untouched by the request", JSON.stringify(await scheduledVisits()) === JSON.stringify(before3), "visits changed");
      const requested = await admin.from("notifications").select("push_status").eq("job_id", ids.job).eq("category", "reschedule_requested");
      record("reschedule_requested notification with pending push", requested.data?.length === 1 && requested.data[0].push_status === "pending", JSON.stringify(requested.data));
      record("request_created event by link_holder", ((await admin.from("job_events").select("actor_type").eq("job_id", ids.job).eq("event_type", "request_created")).data ?? []).some((e) => e.actor_type === "link_holder"), "no event");
      record("customer page shows the pending request", (await get(`/t/${current}`)).body.includes("isteğiniz ustanıza iletildi"), "not shown");
      record("repeat request → 200, still one open", (await json(`/api/t/${current}/reschedule`, "POST", ask)).status === 200 && (await openRequests()).length === 1, "duplicated");

      const pendingId = open[0].id;
      const bCounter = await b.client.rpc("respond_to_request", { p_request_id: pendingId, p_action: "counter", p_counter_starts_at: later(72), p_counter_ends_at: later(73) });
      record("B cannot counter A's customer request", rpcResult(bCounter) === "not_found", bCounter.error?.message ?? rpcResult(bCounter));
      const aCounter = await a.client.rpc("respond_to_request", { p_request_id: pendingId, p_action: "counter", p_counter_starts_at: later(72), p_counter_ends_at: later(73) });
      record("control: A counters → ok", rpcResult(aCounter) === "ok", aCounter.error?.message ?? rpcResult(aCounter));
      record("customer page shows the counter-offer", (await get(`/t/${current}`)).body.includes("Ustanız yeni bir saat önerdi"), "not shown");
      record("accept from a foreign Origin → 403", (await json(`/api/t/${current}/reschedule/accept`, "POST", { requestId: pendingId }, "https://evil.example")).status === 403, "accepted");
      record("accept through the old link → 404", (await json(`/api/t/${valid}/reschedule/accept`, "POST", { requestId: pendingId })).status === 404, "accepted");
      record("accept of an unknown request → 409", (await json(`/api/t/${current}/reschedule/accept`, "POST", { requestId: randomUUID() })).status === 409, "accepted");
      record("old visit still scheduled before accept", (await scheduledVisits()).some((v) => v.id === open[0].appointment_id), "changed early");
      const accepted = await json(`/api/t/${current}/reschedule/accept`, "POST", { requestId: pendingId });
      record("customer accepts the counter → 200", accepted.status === 200, `status ${accepted.status} ${accepted.body.slice(0, 80)}`);
      const swapped = await admin.from("appointments").select("status, replaced_by_id").eq("id", open[0].appointment_id).single();
      const replacement = (swapped.data as { replaced_by_id: string | null } | null)?.replaced_by_id;
      const newVisit = replacement ? await admin.from("appointments").select("status, starts_at").eq("id", replacement).single() : null;
      record("swap: old visit superseded, new one scheduled at the counter time",
        (swapped.data as { status: string } | null)?.status === "superseded" && (newVisit?.data as { status: string; starts_at: string } | null)?.status === "scheduled" &&
          Date.parse((newVisit?.data as { starts_at: string }).starts_at) === Date.parse(later(72)), JSON.stringify({ swapped: swapped.data, newVisit: newVisit?.data }));
      const countAccepted = async () => (await admin.from("notifications").select("id", { count: "exact", head: true }).eq("job_id", ids.job).eq("category", "counter_accepted")).count;
      record("counter_accepted notification once", (await countAccepted()) === 1, `${await countAccepted()}`);
      record("repeat accept → 200, nothing duplicated", (await json(`/api/t/${current}/reschedule/accept`, "POST", { requestId: pendingId })).status === 200 && (await countAccepted()) === 1, "duplicated");

      record("second request → 200", (await json(`/api/t/${current}/reschedule`, "POST", { ...ask, time: "11:30" })).status === 200, "refused");
      open = await openRequests();
      record("withdraw from a foreign Origin → 403", (await json(`/api/t/${current}/reschedule`, "DELETE", { requestId: open[0]?.id }, "https://evil.example")).status === 403, "accepted");
      record("customer withdraws → 200", (await json(`/api/t/${current}/reschedule`, "DELETE", { requestId: open[0]?.id })).status === 200 && (await openRequests()).length === 0, "still open");
      record("repeat withdraw → 200", (await json(`/api/t/${current}/reschedule`, "DELETE", { requestId: open[0]?.id })).status === 200, "refused");
      // Left open on purpose: the customer cancel below must close it (J6).
      await json(`/api/t/${current}/reschedule`, "POST", { ...ask, time: "12:45" });

      // Customer cancel (M5.1): POST only from our origin, through a valid link.
      const post = async (token: string, body: unknown, origin: string | null = appEnv().baseUrl) => {
        const response = await fetch(`${base}/api/t/${token}/cancel`, {
          method: "POST",
          redirect: "manual",
          headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) },
          body: JSON.stringify(body),
        });
        return { status: response.status, headers: response.headers, body: await response.text() };
      };
      const jobState = async () =>
        (await admin.from("jobs").select("status, cancelled_by, cancelled_reason").eq("id", ids.job).single()).data as
          { status: string; cancelled_by: string | null; cancelled_reason: string | null };
      const cancelNotifications = async () =>
        (await admin.from("notifications").select("id", { count: "exact", head: true }).eq("job_id", ids.job).eq("dedupe_key", `cancel:${ids.job}`)).count;
      const ok = { reason: "date_unsuitable", note: "" };
      record("cancel GET is not allowed", (await get(`/api/t/${current}/cancel`)).status === 405, "GET accepted");
      record("cancel from a foreign Origin → 403", (await post(current, ok, "https://evil.example")).status === 403, "accepted");
      record("cancel without Origin → 403", (await post(current, ok, null)).status === 403, "accepted");
      const oldLinkCancel = await post(valid, ok);
      record("cancel through the regenerated (old) link → 404", oldLinkCancel.status === 404 && oldLinkCancel.body.includes("Bu bağlantı geçersiz"), `status ${oldLinkCancel.status}`);
      record("cancel through a tampered link → 404", (await post(invalid.tampered, ok)).status === 404, "accepted");
      record("cancel without a reason → 400", (await post(current, { note: "x" })).status === 400, "accepted");
      record("cancel with 'Diğer' and no note → 400", (await post(current, { reason: "other", note: "  " })).status === 400, "accepted");
      record("refused cancels changed nothing", (await jobState()).status !== "cancelled" && (await cancelNotifications()) === 0, JSON.stringify(await jobState()));
      const done = await post(current, ok);
      record("customer cancel → 200 with no-store", done.status === 200 && /no-store/.test(done.headers.get("cache-control") ?? ""), `status ${done.status}`);
      const cancelled = await jobState();
      record("job cancelled by customer with reason", cancelled.status === "cancelled" && cancelled.cancelled_by === "customer" && cancelled.cancelled_reason === "date_unsuitable", JSON.stringify(cancelled));
      const futureLeft = await admin.from("appointments").select("id", { count: "exact", head: true }).eq("job_id", ids.job).eq("status", "scheduled").gt("ends_at", new Date().toISOString());
      record("cascade: no future scheduled visit left", futureLeft.count === 0, `${futureLeft.count} left`);
      const event = await admin.from("job_events").select("actor_type").eq("job_id", ids.job).eq("event_type", "job_cancelled");
      record("one job_cancelled event by link_holder", event.data?.length === 1 && event.data[0].actor_type === "link_holder", JSON.stringify(event.data));
      record("artisan got one customer_cancelled notification", (await cancelNotifications()) === 1, `${await cancelNotifications()}`);
      record("repeat cancel → 200, nothing duplicated", (await post(current, ok)).status === 200 && (await cancelNotifications()) === 1, "duplicated");
      const bSees = await b.client.from("notifications").select("id").eq("job_id", ids.job);
      expectNoRows("B cannot see A's cancel notification", bSees);
      const page2 = await get(`/t/${current}`);
      record("cancel closed the open reschedule request", (await openRequests()).length === 0, "request still open");
      record("reschedule on a cancelled job → 409", (await json(`/api/t/${current}/reschedule`, "POST", ask)).status === 409, "accepted");
      record("cancelled job page offers no cancel button", page2.status === 200 && !page2.body.includes("İşi iptal et"), "button still shown");
      record("upload on a cancelled job → 409", (await upload(current, jpeg)).status === 409, "accepted");
      const live = (await customerRows()).find((r) => !r.deleted_at);
      record("customer can still delete own photo on a cancelled job", Boolean(live) && (await remove(current, live!.id)).status === 200, "refused");
    }
  } finally {
    // ---- Cleanup (cascades remove appointments, requests, media rows, events, notifications) ----
    const customerObjects = await admin.storage.from("job-images").list(`${a.id}/${ids.job}`);
    await admin.storage.from("job-images").remove((customerObjects.data ?? []).map((o) => `${a.id}/${ids.job}/${o.name}`));
    await admin.storage.from("job-images").remove([objectPath, sharedPath, `${a.id}/${ids.job}/ctl.jpg`, `${a.id}/${ids.job}/b.jpg`, `${b.id}/${ids.job}/b.jpg`, `${a.id}/${ids.job}/anon.jpg`]);
    await admin.from("push_subscriptions").delete().like("endpoint", `https://push.invalid/${tag}%`);
    // A's job has accepted reschedules by now; it must still cascade-delete (account deletion).
    const deletedJobs = await admin.from("jobs").delete().in("id", [ids.job, ids.bJob]).select("id");
    record("jobs with accepted reschedules can be deleted (cascade)", deletedJobs.data?.length === 2, deletedJobs.error?.message ?? `${deletedJobs.data?.length} deleted`);
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
