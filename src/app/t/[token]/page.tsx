import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, MessageCircle, Phone } from "lucide-react";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { loadCustomerJob } from "@/lib/customer-link";
import { whatsappHref } from "@/lib/domain/links";
import { formatTRY } from "@/lib/domain/money";
import { telHref } from "@/lib/domain/phone";
import { formatDate, formatTime } from "@/lib/domain/time";

// Generic title, no description or OG data: WhatsApp previews show nothing about the job.
export const metadata: Metadata = { title: { absolute: "UstaPlan" }, description: null, referrer: "no-referrer" };

// Blocking route on purpose: the link is verified before any byte is sent, so
// invalid links get a real 404 instead of a streamed 200 (plan §5).
export const instant = false;

const cardClass = "rounded-2xl border border-border bg-surface p-4";
const contactClass =
  "flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-surface text-base font-semibold text-ink hover:bg-muted";

/**
 * Customer page (spec §5.1, siz tone). Read-only GET: it never writes. The token
 * is checked before anything renders, so every invalid link gets the same real 404.
 */
export default async function CustomerJobPage({ params }: PageProps<"/t/[token]">) {
  const { token } = await params;
  const view = await loadCustomerJob(token);
  if (!view) notFound();
  const { artisan, job, nextAppointment, agreedPrice, photos } = view;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header>
        <p className="text-xs font-medium text-muted-foreground">Ustanız</p>
        <p className="text-base font-semibold text-ink">{artisan.name}</p>
      </header>

      <section className={cardClass}>
        <JobStatusBadge status={job.status} />
        <h1 className="mt-2 text-2xl font-bold tracking-tight break-words text-ink">{job.title}</h1>
      </section>

      <section className={cardClass}>
        <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <CalendarClock className="size-4" aria-hidden />
          Randevu
        </h2>
        {nextAppointment ? (
          <p className="mt-1 text-lg font-semibold text-ink">
            {formatDate(nextAppointment.startsAt)}, {formatTime(nextAppointment.startsAt)}–{formatTime(nextAppointment.endsAt)}
          </p>
        ) : (
          <p className="mt-1 text-base text-ink">Henüz planlı bir randevu yok.</p>
        )}
      </section>

      {agreedPrice !== null ? (
        <section className={cardClass}>
          <h2 className="text-sm font-medium text-muted-foreground">Anlaşılan ücret</h2>
          <p className="mt-1 text-2xl font-bold text-ink">{formatTRY(agreedPrice)}</p>
        </section>
      ) : null}

      {photos.length ? (
        <section className={cardClass}>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Fotoğraflar</h2>
          <ul className="grid grid-cols-3 gap-2">
            {photos.map((photo) => (
              <li key={photo.id}>
                <a href={photo.url} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-xl border border-border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element -- token-verified media proxy */}
                  <img src={photo.url} alt={photo.fromCustomer ? "Sizin eklediğiniz fotoğraf" : "Ustanızın paylaştığı fotoğraf"} loading="lazy" className="size-full object-cover" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {artisan.phone ? (
        <section className="grid grid-cols-2 gap-2" aria-label="Ustanızla iletişim">
          <a href={telHref(artisan.phone)} className={contactClass}>
            <Phone className="size-5" aria-hidden />
            Ara
          </a>
          <a href={whatsappHref(artisan.phone)} target="_blank" rel="noreferrer" className={contactClass}>
            <MessageCircle className="size-5" aria-hidden />
            WhatsApp
          </a>
        </section>
      ) : null}

      <footer className="mt-auto pt-6 text-center text-xs text-muted-foreground">
        <Link href="/gizlilik" className="underline underline-offset-2">
          Kişisel verileriniz
        </Link>
        <p className="mt-1">UstaPlan ile hazırlandı</p>
      </footer>
    </main>
  );
}
