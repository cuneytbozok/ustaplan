"use client";

import { useRouter } from "next/navigation";
import { INVALID_LINK_MESSAGE } from "@/components/public/invalid-link";
import { AddNote, EditableNote, NoteStamp } from "@/components/notes/job-notes";
import type { ActionResult } from "@/lib/action-result";
import type { CustomerJobView } from "@/lib/public-job";

type Note = CustomerJobView["notes"][number];

/** POST/PATCH/DELETE to the customer notes API; siz-tone error on failure. */
async function send(url: string, method: "POST" | "PATCH" | "DELETE", body?: string): Promise<ActionResult> {
  try {
    const response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify({ body }),
    });
    if (response.status === 404 && !response.headers.get("content-type")?.includes("json")) return { ok: false, error: INVALID_LINK_MESSAGE };
    const result = (await response.json()) as { ok: boolean; error?: string };
    return result.ok ? { ok: true, data: undefined } : { ok: false, error: result.error ?? "İşlem tamamlanamadı. Lütfen tekrar deneyin." };
  } catch {
    return { ok: false, error: "Bağlantı kurulamadı. Lütfen tekrar deneyin." };
  }
}

/**
 * The customer's own written notes (plan N-1, siz tone): add, edit, delete
 * with confirmation while the job is open; read-only afterwards. The list
 * refreshes only after the server confirmed.
 */
export function CustomerNotes({ token, notes, canWrite }: { token: string; notes: Note[]; canWrite: boolean }) {
  const router = useRouter();
  const done = async (result: Promise<ActionResult>) => {
    const outcome = await result;
    if (outcome.ok) router.refresh();
    return outcome;
  };

  if (!notes.length && !canWrite) return null;

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-sm font-medium text-muted-foreground">Notlarınız</h2>
      <p className="mb-3 text-xs text-muted-foreground">Ustanız bu notları görür. Örneğin kapı kodu veya uygun olduğunuz saatler.</p>
      {notes.length ? (
        <ul className="mb-3 flex flex-col gap-2">
          {notes.map((note) =>
            canWrite ? (
              <EditableNote
                key={note.id}
                body={note.body}
                stamp={<NoteStamp note={note} />}
                question="Notunuz silinsin mi? Ustanızdan da kaldırılır."
                maxLength={1000}
                onUpdate={(text) => done(send(`/api/t/${token}/notes/${note.id}`, "PATCH", text))}
                onDelete={() => done(send(`/api/t/${token}/notes/${note.id}`, "DELETE"))}
              />
            ) : (
              <li key={note.id} className="rounded-xl border border-border p-3">
                <p className="text-xs text-muted-foreground">
                  <NoteStamp note={note} />
                </p>
                <p className="mt-1 text-sm break-words whitespace-pre-line text-ink">{note.body}</p>
              </li>
            ),
          )}
        </ul>
      ) : null}
      {canWrite ? <AddNote maxLength={1000} onSave={(text) => done(send(`/api/t/${token}/notes`, "POST", text))} /> : null}
    </section>
  );
}
