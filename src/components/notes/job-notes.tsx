"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { addJobNote, deleteJobNote, updateJobNote } from "@/actions/notes";
import { inputClassName } from "@/components/common/form-field";
import type { ActionResult } from "@/lib/action-result";
import { formatShortDate, formatTime } from "@/lib/domain/time";
import { cn } from "@/lib/utils";

export type JobNote = { id: string; body: string; createdAt: string; editedAt: string | null };

const MAX_LENGTH = 4000;
const secondaryButton = "h-11 rounded-xl border border-border bg-surface text-sm font-medium text-ink hover:bg-muted";
const primaryButton = "h-11 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-70";

/** "20 Eki 14:05 · Düzenlendi" */
export function NoteStamp({ note }: { note: Pick<JobNote, "createdAt" | "editedAt"> }) {
  return (
    <span>
      {formatShortDate(note.createdAt)} {formatTime(note.createdAt)}
      {note.editedAt ? " · Düzenlendi" : null}
    </span>
  );
}

function ErrorText({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2.5 text-sm text-danger">
      {error}
    </p>
  ) : null;
}

/** Textarea + Vazgeç / Kaydet. Closes only after the write has persisted. */
function NoteEditor({
  initial,
  label,
  onSave,
  onCancel,
}: {
  initial: string;
  label: string;
  onSave: (text: string) => Promise<ActionResult>;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <textarea
        aria-label={label}
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={3}
        maxLength={MAX_LENGTH}
        autoFocus
        className={cn(inputClassName, "h-auto py-2.5")}
      />
      <ErrorText error={error} />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={pending} onClick={onCancel} className={secondaryButton}>
          Vazgeç
        </button>
        <button
          type="button"
          disabled={pending || !text.trim()}
          onClick={() =>
            startTransition(async () => {
              const result = await onSave(text);
              if (result.ok) onCancel();
              else setError(result.error);
            })
          }
          className={primaryButton}
        >
          {pending ? "Kaydediliyor…" : "Kaydet"}
        </button>
      </div>
    </div>
  );
}

function NoteRow({ note }: { note: JobNote }) {
  const [mode, setMode] = useState<"view" | "edit" | "confirm">("view");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (mode === "edit") {
    return (
      <li className="rounded-xl border border-border p-3">
        <NoteEditor initial={note.body} label="Notu düzenle" onSave={(text) => updateJobNote(note.id, text)} onCancel={() => setMode("view")} />
      </li>
    );
  }
  return (
    <li className="rounded-xl border border-border p-3">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <NoteStamp note={note} />
        {mode === "view" ? (
          <div className="-my-2 -mr-2 flex">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setMode("edit");
              }}
              aria-label="Notu düzenle"
              className="flex size-11 items-center justify-center rounded-xl text-ink hover:bg-muted"
            >
              <Pencil className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setMode("confirm");
              }}
              aria-label="Notu sil"
              className="flex size-11 items-center justify-center rounded-xl text-danger hover:bg-danger/10"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </div>
        ) : null}
      </div>
      <p className="mt-1 text-sm break-words whitespace-pre-line text-ink">{note.body}</p>
      {mode === "confirm" ? (
        <div role="alertdialog" aria-label="Not silinsin mi?" className="mt-2 rounded-xl border border-danger/30 bg-danger/5 p-3">
          <p className="text-sm text-ink">Not silinsin mi? Bu işlem geri alınamaz.</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" disabled={pending} onClick={() => setMode("view")} className={secondaryButton}>
              Vazgeç
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteJobNote(note.id);
                  if (!result.ok) {
                    setError(result.error);
                    setMode("view");
                  }
                })
              }
              className="h-11 rounded-xl bg-danger text-sm font-semibold text-white hover:bg-danger/90 disabled:opacity-70"
            >
              {pending ? "Siliniyor…" : "Sil"}
            </button>
          </div>
        </div>
      ) : null}
      {error ? (
        <div className="mt-2">
          <ErrorText error={error} />
        </div>
      ) : null}
    </li>
  );
}

/** The artisan's private written notes of a job (plan N-1): add, edit, delete. */
export function JobNotes({ jobId, notes }: { jobId: string; notes: JobNote[] }) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      {notes.length === 0 && !adding ? <p className="text-sm text-muted-foreground">Henüz yazılı not yok.</p> : null}
      {notes.length ? (
        <ul className="flex flex-col gap-2">
          {notes.map((note) => (
            <NoteRow key={note.id} note={note} />
          ))}
        </ul>
      ) : null}
      {adding ? (
        <NoteEditor initial="" label="Yeni not" onSave={(text) => addJobNote(jobId, text)} onCancel={() => setAdding(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm font-medium text-ink hover:bg-muted"
        >
          <Plus className="size-4" aria-hidden />
          Not ekle
        </button>
      )}
    </div>
  );
}
