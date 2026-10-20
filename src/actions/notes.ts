"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { actionContext, SESSION_EXPIRED } from "@/lib/auth-action";

// The artisan's private written notes (plan N-1). Plain RLS CRUD: the policies
// only let the owner write rows with author 'artisan', so customer notes stay read-only.
const uuid = z.uuid();
const body = z.string().trim().min(1, "Notu yaz.").max(4000, "Not en fazla 4000 karakter olabilir.");

function parse(id: string, text: string, missing: string): { ok: true; body: string } | { ok: false; error: string } {
  if (!uuid.safeParse(id).success) return { ok: false, error: missing };
  const parsed = body.safeParse(text);
  return parsed.success ? { ok: true, body: parsed.data } : { ok: false, error: parsed.error.issues[0]?.message ?? "Notu kontrol et." };
}

export async function addJobNote(jobId: string, text: string): Promise<ActionResult> {
  const input = parse(jobId, text, "İş bulunamadı.");
  if (!input.ok) return input;
  const { supabase, userId } = await actionContext();
  if (!userId) return { ok: false, error: SESSION_EXPIRED };

  // RLS + the composite FK make sure the job is the caller's own.
  const { error } = await supabase.from("job_notes").insert({ job_id: jobId, body: input.body });
  if (error) return error.code === "23503" ? { ok: false, error: "İş bulunamadı." } : { ok: false, error: "Not kaydedilemedi. Tekrar dene." };
  refresh();
  return { ok: true, data: undefined };
}

export async function updateJobNote(noteId: string, text: string): Promise<ActionResult> {
  const input = parse(noteId, text, "Not bulunamadı.");
  if (!input.ok) return input;
  const { supabase, userId } = await actionContext();
  if (!userId) return { ok: false, error: SESSION_EXPIRED };

  const { data, error } = await supabase.from("job_notes").update({ body: input.body }).eq("id", noteId).eq("author", "artisan").select("id");
  if (error) return { ok: false, error: "Not kaydedilemedi. Tekrar dene." };
  if (!data.length) return { ok: false, error: "Not bulunamadı." };
  refresh();
  return { ok: true, data: undefined };
}

export async function deleteJobNote(noteId: string): Promise<ActionResult> {
  if (!uuid.safeParse(noteId).success) return { ok: false, error: "Not bulunamadı." };
  const { supabase, userId } = await actionContext();
  if (!userId) return { ok: false, error: SESSION_EXPIRED };

  const { data, error } = await supabase.from("job_notes").delete().eq("id", noteId).eq("author", "artisan").select("id");
  if (error) return { ok: false, error: "Silinemedi. Tekrar dene." };
  if (!data.length) return { ok: false, error: "Not bulunamadı." };
  refresh();
  return { ok: true, data: undefined };
}
