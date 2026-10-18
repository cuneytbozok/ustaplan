import { notFound } from "next/navigation";

/**
 * Target of proxy.ts for every rejected customer link. Calling notFound() while
 * prerendering makes this a static page served with a real 404; the UI comes
 * from app/t/not-found.tsx.
 */
export default function InvalidLinkPage() {
  notFound();
}
