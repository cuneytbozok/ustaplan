"use client";

import { ErrorState } from "@/components/common/error-state";

export default function AdminError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorState onRetry={() => retry()} />;
}
