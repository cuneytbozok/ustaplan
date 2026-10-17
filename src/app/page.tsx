import { redirect } from "next/navigation";

// proxy.ts sends visitors to /bugun or /giris; this is only a fallback.
export default function Home() {
  redirect("/bugun");
}
