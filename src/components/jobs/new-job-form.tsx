"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Search, UserPlus } from "lucide-react";
import { createJob, type NewJobState, type NewJobValues } from "@/actions/jobs";
import { AppointmentPicker, type PickerValue } from "@/components/appointments/appointment-picker";
import { describedBy, FormField, inputClassName } from "@/components/common/form-field";
import { FormStatus } from "@/components/common/form-status";
import { uploadVoiceNote } from "@/components/media/voice-notes";
import { NoteDrafts, type NoteDraft, type VoiceDraft } from "@/components/notes/note-drafts";
import { foldTr } from "@/lib/domain/search-fold";
import { cn } from "@/lib/utils";

export type CustomerOption = {
  id: string;
  name: string;
  addresses: { id: string; label: string | null; address_text: string }[];
};

const chipClass =
  "flex h-11 max-w-full items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors";

export function NewJobForm({
  customers,
  recentIds,
  initialCustomerId,
  picker,
}: {
  customers: CustomerOption[];
  recentIds: string[];
  initialCustomerId?: string;
  picker: { today: string; tomorrow: string; initial: PickerValue };
}) {
  const [jobId] = useState(() => crypto.randomUUID());
  const router = useRouter();
  const [noteDrafts, setNoteDrafts] = useState<NoteDraft[]>([]);
  const [voiceDrafts, setVoiceDrafts] = useState<VoiceDraft[]>([]);
  // Recordings that failed to upload after the job was saved.
  const [failedUploads, setFailedUploads] = useState<string[]>([]);
  const uploaded = useRef(new Set<string>());
  const [retrying, startRetry] = useTransition();

  // Recordings live only in this page's memory: leaving the page frees them, nothing is uploaded.
  const voiceRef = useRef<VoiceDraft[]>([]);
  useEffect(() => {
    voiceRef.current = voiceDrafts;
  }, [voiceDrafts]);
  useEffect(() => () => voiceRef.current.forEach((draft) => URL.revokeObjectURL(draft.url)), []);

  /** Uploads every recording not stored yet; opens the job once all are in. */
  async function uploadRecordings(saved: { jobId: string; ownerId: string }) {
    const failed: string[] = [];
    for (const draft of voiceRef.current) {
      if (uploaded.current.has(draft.id)) continue;
      const result = await uploadVoiceNote(saved.ownerId, saved.jobId, draft.recording).catch(() => ({ ok: false as const }));
      if (result.ok) uploaded.current.add(draft.id);
      else failed.push(draft.id);
    }
    setFailedUploads(failed);
    if (!failed.length) router.replace(`/isler/${saved.jobId}?paylas=1`);
  }

  const [state, formAction, pending] = useActionState(async (previous: NewJobState, formData: FormData) => {
    const result = await createJob(previous, formData);
    // The job exists now (create_job is idempotent on jobId): upload the recordings into it.
    if (result?.ok) await uploadRecordings(result.data);
    return result;
  }, null);
  const saved = state?.ok ? state.data : null;
  const [mode, setMode] = useState<"existing" | "new">(customers.length ? "existing" : "new");
  const [customerId, setCustomerId] = useState(initialCustomerId ?? "");
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const [agreed, setAgreed] = useState("");
  const [schedule, setSchedule] = useState(false);
  const [conflict, setConflict] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  const byId = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const selected = mode === "existing" ? byId.get(customerId) : undefined;
  const chips = useMemo(() => {
    const ids = [...recentIds];
    if (customerId && !ids.includes(customerId)) ids.unshift(customerId);
    return ids.map((id) => byId.get(id)).filter((c): c is CustomerOption => Boolean(c));
  }, [recentIds, customerId, byId]);
  const matches = useMemo(() => {
    const folded = foldTr(query.trim());
    return customers.filter((c) => !folded || foldTr(c.name).includes(folded)).slice(0, 30);
  }, [customers, query]);

  const values: Partial<NewJobValues> = state?.values ?? {};
  const errors = (state && !state.ok && state.fieldErrors) || {};
  const key = JSON.stringify(values);
  const detailsHaveError = Boolean(errors.agreedPrice || errors.estimatedPrice || errors.notes);

  function choose(id: string) {
    setMode("existing");
    setCustomerId(id);
    setPicking(false);
    setQuery("");
    // Next step of the fast path: type "Yapılacak iş" right away.
    titleRef.current?.focus();
  }

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="customerMode" value={mode} />
      <input type="hidden" name="customerId" value={mode === "existing" ? customerId : ""} />
      {noteDrafts.map((note) => (
        <input key={note.id} type="hidden" name="notes" value={note.body} />
      ))}
      <input type="hidden" name="pendingAudio" value={voiceDrafts.length} />

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium text-ink">Müşteri</legend>
        <div className="flex flex-wrap gap-2">
          {chips.map((customer) => {
            const active = mode === "existing" && customer.id === customerId;
            return (
              <button
                key={customer.id}
                type="button"
                aria-pressed={active}
                onClick={() => choose(customer.id)}
                className={cn(
                  chipClass,
                  active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-ink hover:bg-muted",
                )}
              >
                {active ? <Check className="size-4 shrink-0" aria-hidden /> : null}
                <span className="truncate">{customer.name}</span>
              </button>
            );
          })}
          {customers.length > chips.length ? (
            <button
              type="button"
              aria-expanded={picking}
              onClick={() => setPicking((open) => !open)}
              className={cn(chipClass, "border-dashed border-border bg-surface text-ink hover:bg-muted")}
            >
              <Search className="size-4" aria-hidden />
              Diğer müşteri
            </button>
          ) : null}
          <button
            type="button"
            aria-pressed={mode === "new"}
            onClick={() => {
              setMode("new");
              setPicking(false);
            }}
            className={cn(
              chipClass,
              mode === "new" ? "border-primary bg-primary-soft text-primary" : "border-dashed border-border bg-surface text-ink hover:bg-muted",
            )}
          >
            <UserPlus className="size-4" aria-hidden />
            Yeni müşteri
          </button>
        </div>

        {picking ? (
          <div className="rounded-xl border border-border p-2">
            <input
              type="search"
              aria-label="Müşteri ara"
              placeholder="Müşteri ara"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={inputClassName}
              autoFocus
            />
            <ul className="mt-2 max-h-64 overflow-y-auto">
              {matches.map((customer) => (
                <li key={customer.id}>
                  <button
                    type="button"
                    onClick={() => choose(customer.id)}
                    className="flex h-11 w-full items-center rounded-lg px-3 text-left text-sm text-ink hover:bg-muted"
                  >
                    <span className="truncate">{customer.name}</span>
                  </button>
                </li>
              ))}
              {matches.length === 0 ? <li className="px-3 py-2 text-sm text-muted-foreground">Sonuç yok.</li> : null}
            </ul>
          </div>
        ) : null}

        {mode === "new" ? (
          <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
            <FormField id="newCustomerName" label="Müşterinin adı" error={errors.newCustomerName}>
              <input
                key={`n-${key}`}
                id="newCustomerName"
                name="newCustomerName"
                defaultValue={values.newCustomerName}
                autoCapitalize="words"
                autoComplete="off"
                maxLength={160}
                aria-invalid={Boolean(errors.newCustomerName)}
                aria-describedby={describedBy("newCustomerName", errors.newCustomerName)}
                className={inputClassName}
              />
            </FormField>
            <FormField
              id="newCustomerPhone"
              label="Telefon (isteğe bağlı)"
              hint="Telefon yoksa WhatsApp ile paylaşamazsın."
              error={errors.newCustomerPhone}
            >
              <input
                key={`p-${key}`}
                id="newCustomerPhone"
                name="newCustomerPhone"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                placeholder="0532 123 45 67"
                defaultValue={values.newCustomerPhone}
                aria-invalid={Boolean(errors.newCustomerPhone)}
                aria-describedby={describedBy("newCustomerPhone", errors.newCustomerPhone, "Telefon yoksa WhatsApp ile paylaşamazsın.")}
                className={inputClassName}
              />
            </FormField>
          </div>
        ) : null}
        {errors.customer ? <p className="text-sm text-danger">{errors.customer}</p> : null}
      </fieldset>

      <FormField id="title" label="Yapılacak iş" hint="Müşteri de görür." error={errors.title}>
        <textarea
          key={`t-${key}`}
          ref={titleRef}
          // Coming from a customer page the customer is already chosen: start typing.
          autoFocus={Boolean(initialCustomerId)}
          id="title"
          name="title"
          rows={2}
          maxLength={200}
          required
          placeholder="Örn. Mutfak musluğu değişecek"
          defaultValue={values.title}
          aria-invalid={Boolean(errors.title)}
          aria-describedby={describedBy("title", errors.title, "Müşteri de görür.")}
          className={cn(inputClassName, "h-auto py-2.5")}
        />
      </FormField>

      <div className="rounded-xl border border-border bg-surface">
        <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 text-sm font-semibold text-ink">
          Randevu planla
          <input
            type="checkbox"
            name="schedule"
            role="switch"
            checked={schedule}
            onChange={(event) => setSchedule(event.target.checked)}
            className="size-5 shrink-0 accent-primary"
          />
        </label>
        {schedule ? (
          <div className="border-t border-border p-4">
            <AppointmentPicker today={picker.today} tomorrow={picker.tomorrow} initial={picker.initial} onConflictChange={setConflict} />
            {errors.appointment ? <p className="mt-2 text-sm text-danger">{errors.appointment}</p> : null}
          </div>
        ) : null}
      </div>

      <details open={detailsHaveError || undefined} className="group rounded-xl border border-border bg-surface">
        <summary className="flex h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-semibold text-primary">
          <Plus className="size-4 transition-transform group-open:rotate-45" aria-hidden />
          Diğer detaylar (isteğe bağlı)
        </summary>
        <div className="flex flex-col gap-4 border-t border-border p-4">
          {mode === "existing" && selected ? (
            selected.addresses.length ? (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium text-ink">Adres</legend>
                <label className="flex min-h-11 items-center gap-3 rounded-xl border border-border px-3 text-sm text-ink">
                  <input type="radio" name="addressId" value="" defaultChecked={!values.addressId} className="size-4 accent-primary" />
                  Adres Seç
                </label>
                {selected.addresses.map((address) => (
                  <label key={address.id} className="flex min-h-11 items-center gap-3 rounded-xl border border-border px-3 py-2 text-sm text-ink">
                    <input
                      type="radio"
                      name="addressId"
                      value={address.id}
                      defaultChecked={values.addressId === address.id}
                      className="size-4 shrink-0 accent-primary"
                    />
                    <span className="min-w-0">
                      {address.label ? <span className="font-semibold">{address.label} · </span> : null}
                      {address.address_text}
                    </span>
                  </label>
                ))}
              </fieldset>
            ) : (
              <p className="text-sm text-muted-foreground">Bu müşterinin kayıtlı adresi yok. Müşteri sayfasından ekleyebilirsin.</p>
            )
          ) : mode === "new" ? (
            <p className="text-sm text-muted-foreground">Adresi işi kaydettikten sonra müşteri sayfasından ekleyebilirsin.</p>
          ) : null}

          <FormField id="agreedPrice" label="Anlaşılan fiyat (₺)" error={errors.agreedPrice}>
            <input
              key={`a-${key}`}
              id="agreedPrice"
              name="agreedPrice"
              inputMode="decimal"
              autoComplete="off"
              placeholder="2.500"
              defaultValue={values.agreedPrice}
              onChange={(event) => setAgreed(event.target.value)}
              aria-invalid={Boolean(errors.agreedPrice)}
              aria-describedby={describedBy("agreedPrice", errors.agreedPrice)}
              className={inputClassName}
            />
          </FormField>
          <label className="flex min-h-11 items-start gap-3 text-sm text-ink">
            <input
              key={`s-${key}`}
              type="checkbox"
              name="showPrice"
              defaultChecked={values.showPrice}
              disabled={!agreed.trim() && !values.agreedPrice}
              className="mt-0.5 size-5 shrink-0 accent-primary"
            />
            <span>
              Anlaşılan fiyatı müşteri görsün
              <span className="block text-xs text-muted-foreground">Tahmini fiyat müşteriye hiçbir zaman gösterilmez.</span>
            </span>
          </label>
          <FormField id="estimatedPrice" label="Tahmini fiyat (₺)" hint="Sadece sen görürsün." error={errors.estimatedPrice}>
            <input
              key={`e-${key}`}
              id="estimatedPrice"
              name="estimatedPrice"
              inputMode="decimal"
              autoComplete="off"
              placeholder="2.000"
              defaultValue={values.estimatedPrice}
              aria-invalid={Boolean(errors.estimatedPrice)}
              aria-describedby={describedBy("estimatedPrice", errors.estimatedPrice, "Sadece sen görürsün.")}
              className={inputClassName}
            />
          </FormField>
          <NoteDrafts
            notes={noteDrafts}
            onNotesChange={setNoteDrafts}
            recordings={voiceDrafts}
            onRecord={(recording) =>
              setVoiceDrafts((drafts) => [...drafts, { id: crypto.randomUUID(), recording, url: URL.createObjectURL(recording.blob) }])
            }
            onRemoveRecording={(id) => {
              const draft = voiceDrafts.find((d) => d.id === id);
              if (draft) URL.revokeObjectURL(draft.url);
              setVoiceDrafts((drafts) => drafts.filter((d) => d.id !== id));
            }}
            error={errors.notes}
            locked={Boolean(saved)}
          />
        </div>
      </details>

      {state && !state.ok ? <FormStatus state={state} success="" /> : null}

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 -mx-1 bg-background/95 px-1 pt-2 pb-1 backdrop-blur">
        {saved && failedUploads.length ? (
          // The job is saved; only recordings are missing. Never lose the job over them.
          <div role="alert" className="flex flex-col gap-2 rounded-xl border border-warning/40 bg-surface p-3">
            <p className="text-sm text-ink">İş kaydedildi. {failedUploads.length} ses notu yüklenemedi. Bağlantını kontrol edip tekrar dene.</p>
            <button
              type="button"
              disabled={retrying}
              onClick={() => startRetry(() => uploadRecordings(saved))}
              className="h-12 rounded-xl bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-70"
            >
              {retrying ? "Yükleniyor…" : "Tekrar dene"}
            </button>
            <button
              type="button"
              disabled={retrying}
              onClick={() => router.replace(`/isler/${saved.jobId}?paylas=1`)}
              className="h-11 rounded-xl border border-border bg-surface text-sm font-medium text-ink hover:bg-muted"
            >
              Ses notu olmadan devam et
            </button>
          </div>
        ) : (
          <button
            type="submit"
            disabled={pending || Boolean(saved)}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-70"
          >
            <Check className="size-5" aria-hidden />
            {pending || saved ? "Kaydediliyor…" : schedule && conflict ? "Yine de kaydet" : "İşi kaydet"}
          </button>
        )}
      </div>
    </form>
  );
}
