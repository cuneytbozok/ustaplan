"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";
import { createAddress } from "@/actions/customers";
import { createJob, type NewJobState, type NewJobValues } from "@/actions/jobs";
import { AppointmentPicker, type PickerValue } from "@/components/appointments/appointment-picker";
import { describedBy, FormField, inputClassName } from "@/components/common/form-field";
import { FormStatus } from "@/components/common/form-status";
import { AddressForm } from "@/components/customers/address-form";
import { AddAddressButton } from "@/components/customers/address-section";
import { CustomerPicker } from "@/components/jobs/customer-picker";
import { uploadVoiceNote } from "@/components/media/voice-notes";
import { emptyDraft, NoteDrafts, type NoteDraft, type VoiceDraft } from "@/components/notes/note-drafts";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PRICE_HINTS } from "@/lib/domain/labels";
import { cn } from "@/lib/utils";

export type CustomerOption = {
  id: string;
  name: string;
  phone?: string | null;
  addresses: { id: string; label: string | null; address_text: string }[];
};


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
  const [noteDrafts, setNoteDrafts] = useState<NoteDraft[]>(() => [emptyDraft()]);
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
  // Name/phone carried over from the search when "Yeni müşteri" is chosen.
  const [prefill, setPrefill] = useState({ name: "", phone: "" });
  const [addingAddress, setAddingAddress] = useState(false);
  const [agreed, setAgreed] = useState("");
  const [schedule, setSchedule] = useState(false);
  const [conflict, setConflict] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  const byId = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const selected = mode === "existing" ? byId.get(customerId) : undefined;

  const values: Partial<NewJobValues> = state?.values ?? {};
  const errors = (state && !state.ok && state.fieldErrors) || {};
  const key = JSON.stringify([values, prefill]);
  const detailsHaveError = Boolean(errors.agreedPrice || errors.estimatedPrice || errors.notes);

  const closeAddress = useCallback(() => setAddingAddress(false), []);

  function choose(id: string) {
    setMode("existing");
    setCustomerId(id);
    // Next step of the fast path: type "Yapılacak iş" right away.
    if (id) requestAnimationFrame(() => titleRef.current?.focus());
  }

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="customerMode" value={mode} />
      <input type="hidden" name="customerId" value={mode === "existing" ? customerId : ""} />
      <input type="hidden" name="pendingAudio" value={voiceDrafts.length} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium text-ink">Müşteri</legend>
        {mode === "existing" ? (
          <CustomerPicker
            customers={customers}
            recentIds={recentIds}
            selected={selected}
            onSelect={choose}
            onCreateNew={(next) => {
              setPrefill(next);
              setMode("new");
              requestAnimationFrame(() => document.getElementById(next.name ? "newCustomerPhone" : "newCustomerName")?.focus());
            }}
          />
        ) : null}

        {mode === "new" ? (
          <div className="flex flex-col gap-3 rounded-xl border border-primary p-3">
            <div className="-mt-1 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink">Yeni müşteri</p>
              {customers.length ? (
                <button
                  type="button"
                  onClick={() => setMode("existing")}
                  className="flex h-11 items-center rounded-xl px-2 text-sm font-semibold text-primary hover:bg-primary-soft"
                >
                  Kayıtlı müşteri seç
                </button>
              ) : null}
            </div>
            <FormField id="newCustomerName" label="Müşterinin adı" error={errors.newCustomerName}>
              <input
                key={`n-${key}`}
                id="newCustomerName"
                name="newCustomerName"
                defaultValue={values.newCustomerName ?? prefill.name}
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
                defaultValue={values.newCustomerPhone ?? prefill.phone}
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
        <summary className="flex h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 text-sm font-semibold text-primary">
          Diğer detaylar (isteğe bağlı)
          <ChevronDown className="size-5 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
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
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-ink">Adres</p>
                  <p className="text-sm text-muted-foreground">Kayıtlı adres yok</p>
                </div>
                <AddAddressButton onClick={() => setAddingAddress(true)} />
              </div>
            )
          ) : mode === "new" ? (
            <p className="text-sm text-muted-foreground">Adresi müşteri kaydedildikten sonra ekleyebilirsin.</p>
          ) : null}

          <FormField id="agreedPrice" label="Anlaşılan fiyat (₺)" hint={PRICE_HINTS.agreed} error={errors.agreedPrice}>
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
              aria-describedby={describedBy("agreedPrice", errors.agreedPrice, PRICE_HINTS.agreed)}
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
            <span>Anlaşılan fiyatı müşteri görsün</span>
          </label>
          <FormField id="estimatedPrice" label="Tahmini fiyat (₺)" hint={PRICE_HINTS.estimated} error={errors.estimatedPrice}>
            <input
              key={`e-${key}`}
              id="estimatedPrice"
              name="estimatedPrice"
              inputMode="decimal"
              autoComplete="off"
              placeholder="2.000"
              defaultValue={values.estimatedPrice}
              aria-invalid={Boolean(errors.estimatedPrice)}
              aria-describedby={describedBy("estimatedPrice", errors.estimatedPrice, PRICE_HINTS.estimated)}
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
      {/* The address form is its own <form>: the sheet renders it outside this one (portal). */}
      <Sheet open={addingAddress} onOpenChange={setAddingAddress}>
        <SheetContent side="bottom" className="max-h-[95dvh] rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetHeader className="pr-14">
            <SheetTitle className="text-lg font-semibold text-ink">Adres ekle</SheetTitle>
            <SheetDescription>{selected?.name}</SheetDescription>
          </SheetHeader>
          <div className="px-4">
            {selected ? (
              <AddressForm
                action={createAddress.bind(null, selected.id)}
                idPrefix="job-address-new"
                submitLabel="Adresi kaydet"
                onDone={closeAddress}
                onCancel={closeAddress}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </form>
  );
}
