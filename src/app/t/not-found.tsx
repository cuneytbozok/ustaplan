import type { Metadata } from "next";
import { InvalidLink } from "@/components/public/invalid-link";

export const metadata: Metadata = { title: { absolute: "UstaPlan" }, description: null, referrer: "no-referrer" };

export default function InvalidLinkPage() {
  return <InvalidLink />;
}
