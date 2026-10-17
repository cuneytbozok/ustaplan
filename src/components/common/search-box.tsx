"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { inputClassName } from "@/components/common/form-field";
import { cn } from "@/lib/utils";

/**
 * Search box that keeps the query in ?q= (debounced) so the server list
 * filters it. Other query parameters (e.g. a filter) are kept.
 * Render inside <Suspense>: it reads the URL.
 */
export function SearchBox({ label, placeholder }: { label: string; placeholder: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const [pending, startTransition] = useTransition();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      const query = value.trim();
      if (query) params.set("q", query);
      else params.delete("q");
      const search = params.toString();
      startTransition(() => router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false }));
    }, 250);
    return () => clearTimeout(timer);
    // searchParams is read when the timer fires; re-running on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, pathname, router]);

  return (
    <div className="relative" role="search">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        type="search"
        inputMode="search"
        enterKeyHint="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className={cn(inputClassName, "pl-10", pending && "opacity-80")}
      />
    </div>
  );
}
