"use client";

import { useActionState, useState } from "react";
import { Check } from "lucide-react";
import type { EditJobState, EditJobValues } from "@/actions/jobs";
import { describedBy, FormField, inputClassName } from "@/components/common/form-field";
import { FormStatus } from "@/components/common/form-status";
import { cn } from "@/lib/utils";
import type { CustomerOption } from "./new-job-form";

type Action = (previous: EditJobState, formData: FormData) => Promise<EditJobState>;

/** Edit form for an existing job. Success navigates back to the job, so only errors render here. */
export function EditJobForm({ action, customers, initial }: { action: Action; customers: CustomerOption[]; initial: EditJobValues }) {
  const [state, formAction, pending] = useActionState(action, null);
  const values = state?.values ?? initial;
  const errors = state?.fieldErrors ?? {};
  const key = JSON.stringify(values);
  const [customerId, setCustomerId] = useState(values.customerId);
  const [addressId, setAddressId] = useState(values.addressId);
  const [agreed, setAgreed] = useState(values.agreedPrice);
  const addresses = customers.find((c) => c.id === customerId)?.addresses ?? [];

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <FormField id="title" label="Yapılacak iş" hint="Müşteri de görür." error={errors.title}>
        <textarea
          key={`t-${key}`}
          id="title"
          name="title"
          rows={2}
          maxLength={200}
          required
          defaultValue={values.title}
          aria-invalid={Boolean(errors.title)}
          aria-describedby={describedBy("title", errors.title, "Müşteri de görür.")}
          className={cn(inputClassName, "h-auto py-2.5")}
        />
      </FormField>

      <FormField id="customerId" label="Müşteri" error={errors.customer}>
        <select
          id="customerId"
          name="customerId"
          value={customerId}
          onChange={(event) => {
            setCustomerId(event.target.value);
            setAddressId(""); // addresses belong to one customer
          }}
          aria-invalid={Boolean(errors.customer)}
          aria-describedby={describedBy("customerId", errors.customer)}
          className={inputClassName}
        >
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
      </FormField>

      {addresses.length ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-ink">Adres</legend>
          {[{ id: "", label: null, address_text: "Adres yok" }, ...addresses].map((address) => (
            <label key={address.id || "none"} className="flex min-h-11 items-center gap-3 rounded-xl border border-border px-3 py-2 text-sm text-ink">
              <input
                type="radio"
                name="addressId"
                value={address.id}
                checked={addressId === address.id}
                onChange={() => setAddressId(address.id)}
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
      )}

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
          disabled={!agreed.trim()}
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
      <FormField id="privateNote" label="Özel not" hint="Sadece sen görürsün." error={errors.privateNote}>
        <textarea
          key={`o-${key}`}
          id="privateNote"
          name="privateNote"
          rows={3}
          maxLength={4000}
          defaultValue={values.privateNote}
          aria-invalid={Boolean(errors.privateNote)}
          aria-describedby={describedBy("privateNote", errors.privateNote, "Sadece sen görürsün.")}
          className={cn(inputClassName, "h-auto py-2.5")}
        />
      </FormField>

      {state ? <FormStatus state={state} success="" /> : null}

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 -mx-1 bg-background/95 px-1 pt-2 pb-1 backdrop-blur">
        <button
          type="submit"
          disabled={pending}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-70"
        >
          <Check className="size-5" aria-hidden />
          {pending ? "Kaydediliyor…" : "Değişiklikleri kaydet"}
        </button>
      </div>
    </form>
  );
}
