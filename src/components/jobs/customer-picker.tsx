"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Search, UserPlus, X } from "lucide-react";
import { inputClassName } from "@/components/common/form-field";
import { foldTr } from "@/lib/domain/search-fold";
import { formatPhone } from "@/lib/domain/phone";
import { cn } from "@/lib/utils";

export type PickerCustomer = { id: string; name: string; phone?: string | null };

const MAX_RESULTS = 6;

/** "0532 123", "532-123" and "+90 532 123" all search the stored +90532123… number. */
function phoneDigits(query: string) {
  const digits = query.replace(/\D/g, "").replace(/^(90|0)/, "");
  return digits.length >= 3 ? digits : "";
}

/**
 * Yeni iş customer selector: search by name or phone (Turkish-folded), up to
 * six results in a scrollable list; with an empty query the recent customers
 * are offered, so an existing customer is still two taps away. "Yeni müşteri"
 * stays visible, and an empty result offers to create the searched name.
 */
export function CustomerPicker({
  customers,
  recentIds,
  selected,
  onSelect,
  onCreateNew,
}: {
  customers: PickerCustomer[];
  recentIds: string[];
  selected: PickerCustomer | undefined;
  onSelect: (id: string) => void;
  onCreateNew: (prefill: { name: string; phone: string }) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  const results = useMemo(() => {
    const text = query.trim();
    if (!text) {
      const byId = new Map(customers.map((c) => [c.id, c]));
      return recentIds.flatMap((id) => byId.get(id) ?? []).slice(0, MAX_RESULTS);
    }
    const folded = foldTr(text);
    const digits = phoneDigits(text);
    return customers
      .filter((c) => foldTr(c.name).includes(folded) || (digits && c.phone?.replace(/\D/g, "").includes(digits)))
      .slice(0, MAX_RESULTS);
  }, [customers, recentIds, query]);

  if (selected) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex min-h-14 items-center gap-3 rounded-xl border border-primary bg-primary-soft px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-ink">{selected.name}</p>
            {selected.phone ? <p className="text-sm text-muted-foreground">{formatPhone(selected.phone)}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => {
              onSelect("");
              setOpen(true);
              // The search field mounts on the next render.
              requestAnimationFrame(() => input.current?.focus());
            }}
            className="flex h-11 shrink-0 items-center gap-1 rounded-xl px-2 text-sm font-semibold text-primary hover:bg-surface"
          >
            <X className="size-4" aria-hidden />
            Değiştir
          </button>
        </div>
        {/* "Yeni müşteri" stays one tap away even with a customer chosen. */}
        <button
          type="button"
          onClick={() => onCreateNew({ name: "", phone: "" })}
          className="flex h-11 w-fit items-center gap-1.5 rounded-xl px-1 text-sm font-semibold text-primary hover:bg-primary-soft"
        >
          <UserPlus className="size-4" aria-hidden />
          Yeni müşteri
        </button>
      </div>
    );
  }

  const text = query.trim();
  const looksLikePhone = phoneDigits(text) !== "" && !/[a-zçğıöşü]/i.test(text);
  // Keep the input focused while a result is tapped (iOS doesn't focus buttons).
  const keepFocus = (event: React.PointerEvent) => event.preventDefault();

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          ref={input}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label="Müşteri ara"
          placeholder="İsim veya telefon ara"
          autoComplete="off"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => event.key === "Escape" && setOpen(false)}
          className={cn(inputClassName, "pl-10")}
        />
      </div>

      {open ? (
        <ul id={listId} role="listbox" aria-label="Müşteriler" className="max-h-72 overflow-y-auto rounded-xl border border-border bg-surface p-1">
          {!text && results.length ? <li className="px-3 pt-1 pb-0.5 text-xs font-medium text-muted-foreground">Son müşteriler</li> : null}
          {results.map((customer) => (
            <li key={customer.id} role="option" aria-selected={false}>
              <button
                type="button"
                onPointerDown={keepFocus}
                onClick={() => {
                  onSelect(customer.id);
                  setQuery("");
                  setOpen(false);
                }}
                className="flex min-h-12 w-full flex-col justify-center rounded-lg px-3 py-1.5 text-left hover:bg-muted"
              >
                <span className="truncate text-sm font-medium text-ink">{customer.name}</span>
                {customer.phone ? <span className="text-xs text-muted-foreground">{formatPhone(customer.phone)}</span> : null}
              </button>
            </li>
          ))}
          {text && results.length === 0 ? (
            <li className="flex flex-col gap-1 p-2">
              <p className="text-sm text-muted-foreground">Bu aramaya uyan müşteri yok.</p>
              <button
                type="button"
                onPointerDown={keepFocus}
                onClick={() => onCreateNew(looksLikePhone ? { name: "", phone: text } : { name: text, phone: "" })}
                className="flex min-h-11 items-center gap-2 rounded-lg px-1 text-left text-sm font-semibold text-primary hover:bg-primary-soft"
              >
                <UserPlus className="size-4 shrink-0" aria-hidden />
                <span className="min-w-0 truncate">“{text}” için yeni müşteri ekle</span>
              </button>
            </li>
          ) : null}
          {!text && results.length === 0 ? <li className="p-2 text-sm text-muted-foreground">Henüz müşteri yok.</li> : null}
        </ul>
      ) : null}

      <button
        type="button"
        onClick={() => onCreateNew({ name: looksLikePhone ? "" : text, phone: looksLikePhone ? text : "" })}
        className="flex h-11 items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm font-medium text-ink hover:bg-muted"
      >
        <UserPlus className="size-4" aria-hidden />
        Yeni müşteri
      </button>
    </div>
  );
}
