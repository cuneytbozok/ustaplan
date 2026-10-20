"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { addJobNote, deleteJobNote, updateJobNote } from "@/actions/notes";
import { AutoGrowTextarea } from "@/components/common/auto-grow-textarea";
import type { ActionResult } from "@/lib/action-result";
import { formatShortDate, formatTime } from "@/lib/domain/time";

export type JobNote = { id: string; body: string; createdAt: string; editedAt: string | null };

const MAX_LENGTH = 4000;
export const NOTE_PLACEHOLDER = "Ölçüler, gereken malzemeler, hatırlatmalar…";
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
export function NoteEditor({
  initial,
  label,
  onSave,
  onCancel,
  maxLength = MAX_LENGTH,
  placeholder = NOTE_PLACEHOLDER,
}: {
  initial: string;
  label: string;
  onSave: (text: string) => Promise<ActionResult>;
  onCancel: () => void;
  maxLength?: number;
  placeholder?: string;
}) {
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <AutoGrowTextarea
        aria-label={label}
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        autoFocus
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

/** Inline "really delete?" box under an item (CLAUDE.md: deleting asks first). */
export function DeleteConfirm({ question, pending, onCancel, onConfirm }: { question: string; pending: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div role="alertdialog" aria-label={question} className="mt-2 rounded-xl border border-danger/30 bg-danger/5 p-3">
      <p className="text-sm text-ink">{question}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button type="button" disabled={pending} onClick={onCancel} className={secondaryButton}>
          Vazgeç
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onConfirm}
          className="h-11 rounded-xl bg-danger text-sm font-semibold text-white hover:bg-danger/90 disabled:opacity-70"
        >
          {pending ? "Siliniyor…" : "Sil"}
        </button>
      </div>
    </div>
  );
}

/** One written note with edit and delete (both ask the caller, which may be a server action or local state). */
export function EditableNote({
  body,
  stamp,
  question,
  onUpdate,
  onDelete,
  maxLength,
}: {
  body: string;
  stamp: React.ReactNode;
  question: string;
  onUpdate: (text: string) => Promise<ActionResult>;
  onDelete: () => Promise<ActionResult>;
  maxLength?: number;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "confirm">("view");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (mode === "edit") {
    return (
      <li className="rounded-xl border border-border p-3">
        <NoteEditor initial={body} label="Notu düzenle" onSave={onUpdate} onCancel={() => setMode("view")} maxLength={maxLength} />
      </li>
    );
  }
  return (
    <li className="rounded-xl border border-border p-3">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        {stamp}
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
      <p className="mt-1 text-sm break-words whitespace-pre-line text-ink">{body}</p>
      {mode === "confirm" ? (
        <DeleteConfirm
          question={question}
          pending={pending}
          onCancel={() => setMode("view")}
          onConfirm={() =>
            startTransition(async () => {
              const result = await onDelete();
              if (!result.ok) {
                setError(result.error);
                setMode("view");
              }
            })
          }
        />
      ) : null}
      {error ? (
        <div className="mt-2">
          <ErrorText error={error} />
        </div>
      ) : null}
    </li>
  );
}

/** Dashed "+ Not ekle" button that opens an editor. */
export function AddNote({ onSave, maxLength, placeholder }: { onSave: (text: string) => Promise<ActionResult>; maxLength?: number; placeholder?: string }) {
  const [adding, setAdding] = useState(false);
  return adding ? (
    <NoteEditor initial="" label="Yeni not" onSave={onSave} onCancel={() => setAdding(false)} maxLength={maxLength} placeholder={placeholder} />
  ) : (
    <button
      type="button"
      onClick={() => setAdding(true)}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm font-medium text-ink hover:bg-muted"
    >
      <Plus className="size-4" aria-hidden />
      Not ekle
    </button>
  );
}

/** The artisan's private written notes of a job (plan N-1): add, edit, delete. */
export function JobNotes({ jobId, notes }: { jobId: string; notes: JobNote[] }) {
  return (
    <div className="flex flex-col gap-3">
      {notes.length === 0 ? <p className="text-sm text-muted-foreground">Henüz yazılı not yok.</p> : null}
      {notes.length ? (
        <ul className="flex flex-col gap-2">
          {notes.map((note) => (
            <EditableNote
              key={note.id}
              body={note.body}
              stamp={<NoteStamp note={note} />}
              question="Not silinsin mi? Bu işlem geri alınamaz."
              onUpdate={(text) => updateJobNote(note.id, text)}
              onDelete={() => deleteJobNote(note.id)}
            />
          ))}
        </ul>
      ) : null}
      <AddNote onSave={(text) => addJobNote(jobId, text)} />
    </div>
  );
}
