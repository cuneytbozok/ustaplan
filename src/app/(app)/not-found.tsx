import { NotFoundState } from "@/components/common/not-found-state";

/** Boundary for notFound() calls made before streaming starts. */
export default function AppNotFound() {
  return <NotFoundState />;
}
