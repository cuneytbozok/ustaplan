"use server";

import { refresh } from "next/cache";
import { addDays } from "date-fns";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { actionContext, SESSION_EXPIRED } from "@/lib/auth-action";
import { findConflicts, istanbulDateKey, istanbulDateTime, readAppointmentFields, suggestSlot } from "@/lib/domain/scheduling";
import { hasNotEnded } from "@/lib/domain/time";

const uuid = z.uuid();

export type ScheduleCheck = {
  conflicts: { id: string; starts_at: string; ends_at: string; jobTitle: string }[];
  suggestion: { start: string; end: string } | null;
};

const checkSchema = z.object({ start: z.iso.datetime({ offset: true }), end: z.iso.datetime({ offset: true }), excludeId: z.uuid().optional() });

/**
 * Conflict lookup (plan §8): an ordinary RLS-scoped select of the artisan's
 * scheduled appointments around the candidate, plus a suggested free slot.
 * Read-only; saving is never blocked by it.
 */
export async function checkSchedule(input: { start: string; end: string; excludeId?: string }): Promise<ActionResult<ScheduleCheck>> {
  const parsed = checkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Tarih ve saati kontrol et." };
  const candidate = { start: new Date(parsed.data.start), end: new Date(parsed.data.end) };
  if (candidate.end <= candidate.start) return { ok: false, error: "Tarih ve saati kontrol et." };

  const { supabase, userId } = await actionContext();
  if (!userId) return { ok: false, error: SESSION_EXPIRED };

  // The candidate's Istanbul day and the next one cover both the clash and the suggestion.
  const from = istanbulDateTime(istanbulDateKey(candidate.start), "00:00")!;
  const until = new Date(Math.max(addDays(from, 2).getTime(), candidate.end.getTime()));
  const { data, error } = await supabase
    .from("appointments")
    .select("id, starts_at, ends_at, jobs(title)")
    .eq("status", "scheduled")
    .lt("starts_at", until.toISOString())
    .gt("ends_at", from.toISOString())
    .limit(200);
  if (error) return { ok: false, error: "Takvim kontrol edilemedi." };

  const conflicts = findConflicts(candidate, data, parsed.data.excludeId).map((a) => ({
    id: a.id,
    starts_at: a.starts_at,
    ends_at: a.ends_at,
    jobTitle: a.jobs?.title ?? "",
  }));
  const slot = conflicts.length ? suggestSlot(candidate, data, { excludeId: parsed.data.excludeId }) : null;
  return { ok: true, data: { conflicts, suggestion: slot && { start: slot.start.toISOString(), end: slot.end.toISOString() } } };
}

/** Add a visit (appointmentId null) or reschedule one (save_appointment, J2). */
export async function saveAppointment(jobId: string, appointmentId: string | null, formData: FormData): Promise<ActionResult> {
  if (!uuid.safeParse(jobId).success || (appointmentId !== null && !uuid.safeParse(appointmentId).success)) {
    return { ok: false, error: "Randevu bulunamadı." };
  }
  const fields = readAppointmentFields(formData);
  if ("error" in fields) return { ok: false, error: fields.error };

  const { supabase, userId } = await actionContext();
  if (!userId) return { ok: false, error: SESSION_EXPIRED };

  const { data, error } = await supabase.rpc("save_appointment", {
    p_job_id: jobId,
    p_appointment_id: appointmentId ?? undefined,
    p_starts_at: fields.start.toISOString(),
    p_ends_at: fields.end.toISOString(),
  });
  if (error) return { ok: false, error: "Randevu kaydedilemedi. Tekrar dene." };
  const result = (data as { result: string }).result;
  if (result === "not_found") return { ok: false, error: "Randevu bulunamadı." };
  if (result === "invalid_transition") return { ok: false, error: "Bu randevu değişmiş ya da iş kapalı. Sayfayı yenileyip tekrar dene." };
  if (result !== "ok") return { ok: false, error: "Tarih ve saati kontrol et." };
  refresh();
  return { ok: true, data: undefined };
}

/** Mark a visit completed or cancelled (close_appointment, J3). */
export async function closeAppointment(appointmentId: string, outcome: "completed" | "cancelled"): Promise<ActionResult> {
  if (!uuid.safeParse(appointmentId).success || !["completed", "cancelled"].includes(outcome)) {
    return { ok: false, error: "Randevu bulunamadı." };
  }
  const { supabase, userId } = await actionContext();
  if (!userId) return { ok: false, error: SESSION_EXPIRED };

  const { data, error } = await supabase.rpc("close_appointment", { p_appointment_id: appointmentId, p_outcome: outcome });
  if (error) return { ok: false, error: "Randevu güncellenemedi. Tekrar dene." };
  const result = (data as { result: string }).result;
  if (result === "not_found") return { ok: false, error: "Randevu bulunamadı." };
  if (result === "invalid_transition") return { ok: false, error: "Bu randevu zaten kapanmış. Sayfayı yenile." };
  if (result !== "ok") return { ok: false, error: "Bilgileri kontrol et." };
  refresh();
  return { ok: true, data: undefined };
}

/**
 * Answer a customer's date request (respond_to_request, plan §8): approve swaps
 * to the requested time, reject keeps the visit, counter offers the picker's
 * time (formData) and waits for the customer.
 */
export async function respondToRequest(requestId: string, action: "approve" | "reject" | "counter", formData?: FormData): Promise<ActionResult> {
  if (!uuid.safeParse(requestId).success || !["approve", "reject", "counter"].includes(action)) {
    return { ok: false, error: "Talep bulunamadı." };
  }
  let counter: { start: Date; end: Date } | null = null;
  if (action === "counter") {
    const fields = formData ? readAppointmentFields(formData) : { error: "Randevu için tarih ve saati seç." };
    if ("error" in fields) return { ok: false, error: fields.error };
    if (!hasNotEnded(fields.start)) return { ok: false, error: "İleri bir tarih ve saat seç." };
    counter = fields;
  }

  const { supabase, userId } = await actionContext();
  if (!userId) return { ok: false, error: SESSION_EXPIRED };

  const { data, error } = await supabase.rpc("respond_to_request", {
    p_request_id: requestId,
    p_action: action,
    p_counter_starts_at: counter?.start.toISOString(),
    p_counter_ends_at: counter?.end.toISOString(),
  });
  if (error) return { ok: false, error: "Kaydedilemedi. Tekrar dene." };
  const result = (data as { result: string }).result;
  if (result === "not_found") return { ok: false, error: "Talep bulunamadı." };
  if (result === "invalid_transition") return { ok: false, error: "Bu talep değişmiş ya da kapanmış. Sayfayı yenile." };
  if (result === "expired") return { ok: false, error: "İstenen saat geçti. Başka bir tarih öner." };
  if (result !== "ok") return { ok: false, error: "Tarih ve saati kontrol et." };
  refresh();
  return { ok: true, data: undefined };
}
