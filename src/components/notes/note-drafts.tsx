"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { AutoGrowTextarea } from "@/components/common/auto-grow-textarea";
import { clock, VoiceRecorder, type Recording } from "@/components/media/voice-notes";
import { DeleteConfirm, NOTE_PLACEHOLDER } from "@/components/notes/job-notes";

export type NoteDraft = { id: string; body: string };
export type VoiceDraft = { id: string; recording: Recording; url: string };

const MAX_NOTES = 10;

export const emptyDraft = (): NoteDraft => ({ id: crypto.randomUUID(), body: "" });

function VoiceDraftRow({ draft, locked, onDelete }: { draft: VoiceDraft; locked: boolean; onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <li className="rounded-xl border border-border p-3">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>Ses kaydı · {clock(draft.recording.seconds)}</span>
        {!confirming && !locked ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label="Ses kaydını sil"
            className="-my-2 -mr-2 flex size-11 items-center justify-center rounded-xl text-danger hover:bg-danger/10"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>
      <audio controls preload="metadata" src={draft.url} className="mt-1 w-full">
        Tarayıcın ses oynatmayı desteklemiyor.
      </audio>
      {confirming ? <DeleteConfirm question="Ses kaydı silinsin mi?" pending={false} onCancel={() => setConfirming(false)} onConfirm={onDelete} /> : null}
    </li>
  );
}

function NoteField({
  draft,
  index,
  locked,
  removable,
  onChange,
  onRemove,
}: {
  draft: NoteDraft;
  index: number;
  locked: boolean;
  removable: boolean;
  onChange: (body: string) => void;
  onRemove: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div>
      <div className="flex items-start gap-1">
        {/* Saved with the job (name="notes"): there's no separate save step to forget. */}
        <AutoGrowTextarea
          name="notes"
          aria-label={index ? `Not ${index + 1}` : "Not"}
          value={draft.body}
          onChange={(event) => onChange(event.target.value)}
          maxLength={4000}
          placeholder={NOTE_PLACEHOLDER}
          readOnly={locked}
        />
        {removable && !locked && !confirming ? (
          <button
            type="button"
            // An empty note goes at once; a written one asks first.
            onClick={() => (draft.body.trim() ? setConfirming(true) : onRemove())}
            aria-label="Notu kaldır"
            className="flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>
      {confirming ? <DeleteConfirm question="Not silinsin mi?" pending={false} onCancel={() => setConfirming(false)} onConfirm={onRemove} /> : null}
    </div>
  );
}

/**
 * Notes written or recorded before the job exists (plan N-1). Written notes
 * are plain fields of the job form; recordings stay in this page's memory and
 * are uploaded once the job is saved. Leaving the page discards both.
 */
export function NoteDrafts({
  notes,
  onNotesChange,
  recordings,
  onRecord,
  onRemoveRecording,
  error,
  locked,
}: {
  notes: NoteDraft[];
  onNotesChange: (notes: NoteDraft[]) => void;
  recordings: VoiceDraft[];
  onRecord: (recording: Recording) => void;
  onRemoveRecording: (id: string) => void;
  error?: string;
  /** The job is saved: the drafts are in it, so they can't change any more. */
  locked: boolean;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium text-ink">Özel notlar</legend>
      {notes.map((note, index) => (
        <NoteField
          key={note.id}
          draft={note}
          index={index}
          locked={locked}
          removable={notes.length > 1}
          onChange={(body) => onNotesChange(notes.map((n) => (n.id === note.id ? { ...n, body } : n)))}
          onRemove={() => onNotesChange(notes.filter((n) => n.id !== note.id))}
        />
      ))}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {!locked && notes.length < MAX_NOTES ? (
        <button
          type="button"
          onClick={() => onNotesChange([...notes, emptyDraft()])}
          className="flex h-11 w-fit items-center gap-1.5 rounded-xl px-1 text-sm font-semibold text-primary hover:bg-primary-soft"
        >
          <Plus className="size-4" aria-hidden />
          Başka not ekle
        </button>
      ) : null}
      {recordings.length ? (
        <ul className="flex flex-col gap-2">
          {recordings.map((draft) => (
            <VoiceDraftRow key={draft.id} draft={draft} locked={locked} onDelete={() => onRemoveRecording(draft.id)} />
          ))}
        </ul>
      ) : null}
      {locked ? null : (
        <VoiceRecorder
          onRecorded={async (recording) => {
            onRecord(recording);
            return null;
          }}
        />
      )}
      <p className="text-xs text-muted-foreground">Sadece sen görürsün.</p>
    </fieldset>
  );
}
