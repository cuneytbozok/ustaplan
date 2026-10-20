"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { clock, VoiceRecorder, type Recording } from "@/components/media/voice-notes";
import { AddNote, DeleteConfirm, EditableNote } from "@/components/notes/job-notes";

export type NoteDraft = { id: string; body: string };
export type VoiceDraft = { id: string; recording: Recording; url: string };

const MAX_NOTES = 10;
const ok = { ok: true, data: undefined } as const;

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

/**
 * Notes written or recorded before the job exists (plan N-1). Everything stays
 * in this page's memory: written notes go with the form, recordings are
 * uploaded once the job is saved. Leaving the page discards both.
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
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-medium text-ink">Notlar</legend>
      <p className="-mt-1 text-xs text-muted-foreground">Yazılı ve sesli notlar. Sadece sen görürsün.</p>
      {notes.length || recordings.length ? (
        <ul className="flex flex-col gap-2">
          {notes.map((note) =>
            locked ? (
              <li key={note.id} className="rounded-xl border border-border p-3 text-sm break-words whitespace-pre-line text-ink">
                {note.body}
              </li>
            ) : (
              <EditableNote
                key={note.id}
                body={note.body}
                stamp={<span>Yazılı not</span>}
                question="Not silinsin mi?"
                onUpdate={async (text) => {
                  onNotesChange(notes.map((n) => (n.id === note.id ? { ...n, body: text.trim() } : n)));
                  return ok;
                }}
                onDelete={async () => {
                  onNotesChange(notes.filter((n) => n.id !== note.id));
                  return ok;
                }}
              />
            ),
          )}
          {recordings.map((draft) => (
            <VoiceDraftRow key={draft.id} draft={draft} locked={locked} onDelete={() => onRemoveRecording(draft.id)} />
          ))}
        </ul>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {locked ? null : notes.length < MAX_NOTES ? (
        <AddNote
          onSave={async (text) => {
            onNotesChange([...notes, { id: crypto.randomUUID(), body: text.trim() }]);
            return ok;
          }}
        />
      ) : null}
      {locked ? null : (
        <VoiceRecorder
          onRecorded={async (recording) => {
            onRecord(recording);
            return null;
          }}
        />
      )}
    </fieldset>
  );
}
