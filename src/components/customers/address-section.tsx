"use client";

import { useCallback, useState } from "react";
import { MapPin, Navigation, Pencil, Plus } from "lucide-react";
import { createAddress, deleteAddress, updateAddress } from "@/actions/customers";
import { ConfirmAction } from "@/components/common/confirm-action";
import { mapHref } from "@/lib/domain/links";
import { AddressForm } from "./address-form";

export type AddressItem = { id: string; label: string | null; address_text: string };

export function AddressSection({ customerId, addresses }: { customerId: string; addresses: AddressItem[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const close = useCallback(() => setEditing(null), []);

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="mb-3 text-base font-semibold text-ink">Adresler</h2>

      {addresses.length === 0 && editing !== "new" ? (
        <p className="mb-3 text-sm text-muted-foreground">Kayıtlı adres yok. İşlerde seçebilmek için adres ekle.</p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {addresses.map((address) =>
          editing === address.id ? (
            <li key={address.id} className="rounded-xl border border-border p-3">
              <AddressForm
                action={updateAddress.bind(null, address.id)}
                initial={{ label: address.label ?? "", addressText: address.address_text }}
                idPrefix={`address-${address.id}`}
                submitLabel="Kaydet"
                onDone={close}
                onCancel={close}
              />
              <ConfirmAction
                className="mt-2"
                action={deleteAddress.bind(null, address.id)}
                label="Adresi sil"
                confirmLabel="Sil"
                question="Bu adres silinsin mi? Bu adresi kullanan işlerde adres boş kalır."
              />
            </li>
          ) : (
            <li key={address.id} className="flex items-start gap-3 rounded-xl border border-border p-3">
              <MapPin className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                {address.label ? <p className="text-sm font-semibold text-ink">{address.label}</p> : null}
                <p className="text-sm break-words whitespace-pre-line text-ink">{address.address_text}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <a
                  href={mapHref(address.address_text)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Haritada aç"
                  className="flex size-11 items-center justify-center rounded-xl text-primary hover:bg-primary-soft"
                >
                  <Navigation className="size-5" aria-hidden />
                </a>
                <button
                  type="button"
                  onClick={() => setEditing(address.id)}
                  aria-label="Adresi düzenle"
                  className="flex size-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-ink"
                >
                  <Pencil className="size-5" aria-hidden />
                </button>
              </div>
            </li>
          ),
        )}
      </ul>

      {editing === "new" ? (
        <div className="mt-3 rounded-xl border border-border p-3">
          <AddressForm
            action={createAddress.bind(null, customerId)}
            idPrefix="address-new"
            submitLabel="Adresi kaydet"
            onDone={close}
            onCancel={close}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm font-medium text-ink hover:bg-muted"
        >
          <Plus className="size-4" aria-hidden />
          Adres ekle
        </button>
      )}
    </section>
  );
}
