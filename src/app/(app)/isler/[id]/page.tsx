import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MessageCircle, Navigation, Pencil, Phone } from "lucide-react";
import { RequestCard } from "@/components/appointments/request-card";
import { AppointmentsSection } from "@/components/appointments/appointments-section";
import { BackLink } from "@/components/common/back-link";
import { PhotoGallery } from "@/components/media/photo-gallery";
import { VoiceNotes } from "@/components/media/voice-notes";
import { NotFoundState } from "@/components/common/not-found-state";
import { ListSkeleton } from "@/components/common/skeleton";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { JobStatusSheet, ReopenJobButton } from "@/components/jobs/job-status-sheet";
import { ShareSheet } from "@/components/jobs/share-sheet";
import { shareUrl } from "@/lib/customer-link";
import { describeEvent, JobTimeline } from "@/components/jobs/job-timeline";
import { loadPhotos } from "@/lib/media/photos";
import { loadVoiceNotes } from "@/lib/media/voice-notes";
import { createClient } from "@/lib/supabase/server";
import { CANCEL_REASON_LABELS, OPEN_JOB_STATUSES } from "@/lib/domain/labels";
import { mapHref, shareMessage, whatsappHref } from "@/lib/domain/links";
import { DEFAULT_DURATION_MINUTES, pickerDefaults } from "@/lib/domain/scheduling";
import { formatTRY } from "@/lib/domain/money";
import { formatPhone, telHref } from "@/lib/domain/phone";
import { formatDate, formatShortDate, hasNotEnded } from "@/lib/domain/time";

export const metadata: Metadata = { title: "İş" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function JobPage({ params, searchParams }: PageProps<"/isler/[id]">) {
  return (
    <>
      <BackLink href="/isler" />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <JobDetail params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const cardClass = "rounded-2xl border border-border bg-surface p-4";
const contactClass =
  "flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-surface text-base font-semibold text-ink hover:bg-muted";

async function JobDetail({
  params,
  searchParams,
}: {
  params: PageProps<"/isler/[id]">["params"];
  searchParams: PageProps<"/isler/[id]">["searchParams"];
}) {
  const [{ id }, { planla, paylas }] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) return <NotFoundState backHref="/isler" backLabel="İşlere dön" />;

  const supabase = await createClient();
  const [jobResult, eventsResult, requestsResult] = await Promise.all([
    supabase
      .from("jobs")
      .select(
        "id, owner_user_id, title, status, share_enabled, share_version, private_note, estimated_price, agreed_price, show_price_to_customer, cancelled_by, cancelled_reason, cancelled_note, cancelled_at, completed_at, created_at, customers(id, name, phone), customer_addresses(label, address_text), appointments(id, starts_at, ends_at, status)",
      )
      .eq("id", id)
      .order("starts_at", { referencedTable: "appointments" })
      .maybeSingle(),
    supabase.from("job_events").select("id, event_type, actor_type, payload, created_at").eq("job_id", id).order("created_at", { ascending: false }).limit(200),
    supabase
      .from("appointment_requests")
      .select("id, status, appointment_id, requested_starts_at, requested_ends_at, counter_starts_at, counter_ends_at, request_note")
      .eq("job_id", id)
      .in("status", ["pending_artisan", "pending_customer"])
      .order("created_at"),
  ]);
  if (jobResult.error) throw new Error(jobResult.error.message);
  if (eventsResult.error) throw new Error(eventsResult.error.message);
  if (requestsResult.error) throw new Error(requestsResult.error.message);
  const job = jobResult.data;
  if (!job) return <NotFoundState backHref="/isler" backLabel="İşlere dön" />; // includes other artisans' jobs (RLS hides them)
  const [photos, voiceNotes, profile] = await Promise.all([
    loadPhotos(supabase, [job.id]),
    loadVoiceNotes(supabase, job.id),
    supabase.from("profiles").select("display_name, business_name").eq("id", job.owner_user_id).single(),
  ]);
  if (profile.error) throw new Error(profile.error.message);
  // A missing SHARE_LINK_SECRET must not break the job page; the sheet explains it.
  let link: string | null = null;
  try {
    link = shareUrl(job.id, job.share_version);
  } catch {
    link = null;
  }
  const message =
    link && job.customers
      ? shareMessage({
          customerName: job.customers.name,
          jobTitle: job.title,
          url: link,
          artisanName: profile.data.business_name?.trim() || profile.data.display_name,
        })
      : null;
  const whatsapp = message ? (job.customers?.phone ? whatsappHref(job.customers.phone, message) : `https://wa.me/?text=${encodeURIComponent(message)}`) : null;

  const customer = job.customers;
  const address = job.customer_addresses;
  const isOpen = (OPEN_JOB_STATUSES as readonly string[]).includes(job.status);
  // J4/J6: the cascade cancels scheduled visits that haven't ended (P-2).
  const upcoming = job.appointments.filter((a) => a.status === "scheduled" && hasNotEnded(a.ends_at));
  const { today, tomorrow, date, time } = pickerDefaults();
  const openRequests = requestsResult.data.flatMap((r) => {
    const appointment = job.appointments.find((a) => a.id === r.appointment_id);
    return appointment ? [{ ...r, appointment }] : [];
  });
  const priceEvents = eventsResult.data.filter((e) => e.event_type === "price_changed" || e.event_type === "price_visibility_changed");

  return (
    <>
      <section className={cardClass}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <JobStatusBadge status={job.status} />
            <h1 className="mt-2 text-2xl font-bold tracking-tight break-words text-ink">{job.title}</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">Müşteri de görür · {formatShortDate(job.created_at)} tarihinde açıldı</p>
          </div>
          <Link
            href={`/isler/${job.id}/duzenle`}
            aria-label="İşi düzenle"
            className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border text-ink hover:bg-muted"
          >
            <Pencil className="size-5" aria-hidden />
          </Link>
        </div>

        {job.status === "cancelled" && job.cancelled_at ? (
          <div className="mt-3 rounded-xl bg-danger/10 px-3 py-2.5 text-sm text-ink">
            <p className="font-medium text-danger">
              {job.cancelled_by === "customer" ? "Müşteri iptal etti" : "İptal ettin"} · {formatShortDate(job.cancelled_at)}
            </p>
            {job.cancelled_reason ? <p>{CANCEL_REASON_LABELS[job.cancelled_reason as keyof typeof CANCEL_REASON_LABELS]}</p> : null}
            {job.cancelled_note ? <p className="break-words whitespace-pre-line">{job.cancelled_note}</p> : null}
          </div>
        ) : null}
        {job.status === "completed" && job.completed_at ? (
          <p className="mt-3 rounded-xl bg-muted px-3 py-2.5 text-sm text-ink">{formatDate(job.completed_at)} günü tamamlandı.</p>
        ) : null}

        <div className="mt-4 flex flex-col gap-2">
          {isOpen ? <JobStatusSheet jobId={job.id} status={job.status} upcoming={upcoming} /> : <ReopenJobButton jobId={job.id} />}
          <ShareSheet
            jobId={job.id}
            url={link}
            enabled={job.share_enabled}
            version={job.share_version}
            whatsapp={whatsapp}
            // Right after "İşi kaydet" (?paylas=1) the app offers to send the link (plan §10).
            defaultOpen={paylas === "1"}
          />
          {!job.share_enabled ? <p className="text-center text-xs text-muted-foreground">Müşteri bağlantısı kapalı.</p> : null}
        </div>
      </section>

      {customer ? (
        <section className={cardClass}>
          <h2 className="text-sm font-medium text-muted-foreground">Müşteri</h2>
          <Link href={`/musteriler/${customer.id}`} className="mt-1 block text-lg font-semibold break-words text-ink hover:underline">
            {customer.name}
          </Link>
          <p className="text-sm text-muted-foreground">{customer.phone ? formatPhone(customer.phone) : "Telefon kayıtlı değil"}</p>
          {customer.phone ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a href={telHref(customer.phone)} className={contactClass}>
                <Phone className="size-5" aria-hidden />
                Ara
              </a>
              <a href={whatsappHref(customer.phone)} target="_blank" rel="noreferrer" className={contactClass}>
                <MessageCircle className="size-5" aria-hidden />
                WhatsApp
              </a>
            </div>
          ) : null}
          <div className="mt-3 border-t border-border pt-3">
            {address ? (
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1 text-sm text-ink">
                  {address.label ? <p className="font-semibold">{address.label}</p> : null}
                  <p className="break-words whitespace-pre-line">{address.address_text}</p>
                </div>
                <a
                  href={mapHref(address.address_text)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Yol tarifi"
                  className="flex size-11 shrink-0 items-center justify-center rounded-xl text-primary hover:bg-primary-soft"
                >
                  <Navigation className="size-5" aria-hidden />
                </a>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Adres seçilmedi. Düzenle ile müşterinin adreslerinden seçebilirsin.</p>
            )}
          </div>
        </section>
      ) : null}

      {isOpen
        ? openRequests.map((request) => <RequestCard key={request.id} request={request} today={today} tomorrow={tomorrow} />)
        : null}

      <AppointmentsSection
        jobId={job.id}
        isOpen={isOpen}
        appointments={job.appointments.map((a) => ({ ...a, overdue: a.status === "scheduled" && !hasNotEnded(a.ends_at) }))}
        picker={{ today, tomorrow, initial: { date, time, duration: DEFAULT_DURATION_MINUTES } }}
        // ?planla=yeni or ?planla=<appointment id> (Bugün quick actions) opens that form.
        initialEditing={
          !isOpen ? null : planla === "yeni" ? "new" : job.appointments.find((a) => a.id === planla && a.status === "scheduled")?.id ?? null
        }
      />

      <section className={cardClass}>
        <h2 className="mb-3 text-base font-semibold text-ink">Fiyat</h2>
        <dl className="grid grid-cols-2 gap-3">
          <div>
            <dt className="text-xs text-muted-foreground">Anlaşılan fiyat</dt>
            <dd className="text-lg font-semibold text-ink">{job.agreed_price !== null ? formatTRY(job.agreed_price) : "—"}</dd>
            <dd className="text-xs text-muted-foreground">{job.show_price_to_customer ? "Müşteri görür" : "Müşteriye gösterilmiyor"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Tahmini fiyat</dt>
            <dd className="text-lg font-semibold text-ink">{job.estimated_price !== null ? formatTRY(job.estimated_price) : "—"}</dd>
            <dd className="text-xs text-muted-foreground">Sadece sen görürsün</dd>
          </div>
        </dl>
        {priceEvents.length ? (
          <div className="mt-4 border-t border-border pt-3">
            <h3 className="text-sm font-medium text-ink">Fiyat geçmişi</h3>
            <ul className="mt-1 flex flex-col">
              {priceEvents.map((event) => {
                const { title, detail } = describeEvent(event);
                return (
                  <li key={event.id} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                    <span className="min-w-0 text-ink">
                      {title}
                      {detail ? <span className="block text-muted-foreground">{detail}</span> : null}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatShortDate(event.created_at)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </section>

      <section className={cardClass}>
        <h2 className="mb-1 text-base font-semibold text-ink">Fotoğraflar</h2>
        <p className="mb-3 text-xs text-muted-foreground">Fotoğraflar sadece sen görürsün; istediğini müşteriyle paylaşabilirsin.</p>
        <PhotoGallery photos={photos} upload={{ jobId: job.id, ownerId: job.owner_user_id }} emptyText="Henüz fotoğraf yok." />
      </section>

      <section className={cardClass}>
        <h2 className="mb-1 text-base font-semibold text-ink">Ses notları</h2>
        <p className="mb-3 text-xs text-muted-foreground">Sadece sen görürsün.</p>
        <VoiceNotes notes={voiceNotes} jobId={job.id} ownerId={job.owner_user_id} />
      </section>

      {job.private_note ? (
        <section className={cardClass}>
          <h2 className="text-xs font-medium text-muted-foreground">Özel not · Sadece sen görürsün</h2>
          <p className="mt-1 text-sm break-words whitespace-pre-line text-ink">{job.private_note}</p>
        </section>
      ) : null}

      <section className={cardClass}>
        <h2 className="mb-2 text-base font-semibold text-ink">Geçmiş</h2>
        <JobTimeline events={eventsResult.data} />
      </section>
    </>
  );
}
