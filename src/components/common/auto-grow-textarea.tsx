"use client";

import { useLayoutEffect, useRef } from "react";
import { inputClassName } from "@/components/common/form-field";
import { cn } from "@/lib/utils";

/** Starts at two lines and grows with the text (no inner scrollbar while typing). */
export function AutoGrowTextarea({ className, value, ...props }: React.ComponentProps<"textarea"> & { value: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight + 2}px`;
  }, [value]);
  return <textarea ref={ref} rows={2} value={value} className={cn(inputClassName, "h-auto resize-none overflow-hidden py-2.5", className)} {...props} />;
}
