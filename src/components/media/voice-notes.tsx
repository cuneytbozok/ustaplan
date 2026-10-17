"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { Mic, Square, Trash2 } from "lucide-react";
import { deleteMedia, registerVoiceNote } from "@/actions/media";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { formatShortDate, formatTime } from "@/lib/domain/time";

export type VoiceNote = { id: string; url: string; durationSeconds: number; createdAt: string };

const MAX_SECONDS = 60;
// iPhone records MP4/AAC; Chrome and Firefox record Opus in WebM or Ogg.
const FORMATS = [
  { recorder: "audio/mp4", upload: "audio/mp4", ext: "m4a" },
  { recorder: "audio/webm;codecs=opus", upload: "audio/webm", ext: "webm" },
  { recorder: "audio/webm", upload: "audio/webm", ext: "webm" },
  { recorder: "audio/ogg;codecs=opus", upload: "audio/ogg", ext: "ogg" },
] as const;

function pickFormat() {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) return null;
  return FORMATS.find((f) => MediaRecorder.isTypeSupported(f.recorder)) ?? null;
}
const noopSubscribe = () => () => {};

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

function Recorder({ jobId, ownerId }: { jobId: string; ownerId: string }) {
  // Support is only known in the browser; the server renders nothing for it.
  const format = useSyncExternalStore(noopSubscribe, pickFormat, () => undefined);
  const [state, setState] = useState<"idle" | "recording" | "saving">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const discardRef = useRef(false);

  // Release the microphone if the page is left mid-recording.
  useEffect(() => () => recorder.current?.stream.getTracks().forEach((t) => t.stop()), []);

  if (format === undefined) return null;
  if (format === null) {
    return (
      <p className="rounded-xl bg-muted px-3 py-2.5 text-sm text-muted-foreground">
        Bu tarayıcı ses kaydını desteklemiyor. iPhone&apos;da güncel Safari, Android&apos;de güncel Chrome kullan.
      </p>
    );
  }
  const chosen = format;

  async function start() {
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Mikrofon izni verilmedi. Tarayıcı ayarlarından mikrofona izin ver.");
      return;
    }
    const chunks: Blob[] = [];
    const media = new MediaRecorder(stream, { mimeType: chosen.recorder });
    const startedAt = Date.now();
    discardRef.current = false;
    recorder.current = media;

    media.ondataavailable = (event) => event.data.size && chunks.push(event.data);
    media.onstop = async () => {
      clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
      recorder.current = null;
      const seconds = Math.min(MAX_SECONDS, (Date.now() - startedAt) / 1000);
      if (discardRef.current) {
        setState("idle");
        return;
      }
      if (seconds < 1) {
        setError("Kayıt çok kısa.");
        setState("idle");
        return;
      }
      setState("saving");
      try {
        const blob = new Blob(chunks, { type: chosen.upload });
        const mediaId = crypto.randomUUID();
        const { error: uploadError } = await createBrowserSupabase()
          .storage.from("job-audio")
          .upload(`${ownerId}/${jobId}/${mediaId}.${chosen.ext}`, blob, { contentType: chosen.upload, upsert: false });
        if (uploadError) throw new Error("Ses notu yüklenemedi. Bağlantını kontrol edip tekrar dene.");
        const result = await registerVoiceNote(jobId, mediaId, chosen.ext, seconds);
        if (!result.ok) throw new Error(result.error);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ses notu kaydedilemedi.");
      } finally {
        setState("idle");
      }
    };

    media.start();
    setElapsed(0);
    setState("recording");
    // onstop (above) only runs after this, so it always sees the interval.
    const timer = setInterval(() => {
      const seconds = (Date.now() - startedAt) / 1000;
      setElapsed(seconds);
      if (seconds >= MAX_SECONDS && media.state === "recording") media.stop(); // 60 s cap
    }, 250);
  }

  function stop(discard: boolean) {
    discardRef.current = discard;
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  return (
    <div className="flex flex-col gap-2">
      {state === "recording" ? (
        <div className="rounded-xl border border-danger/30 bg-danger/5 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-danger" role="status">
            <span className="size-2.5 animate-pulse rounded-full bg-danger" aria-hidden />
            Kaydediliyor {clock(elapsed)} / {clock(MAX_SECONDS)}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => stop(true)} className="h-11 rounded-xl border border-border bg-surface text-sm font-medium text-ink hover:bg-muted">
              Vazgeç
            </button>
            <button
              type="button"
              onClick={() => stop(false)}
              className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Square className="size-4" aria-hidden />
              Durdur ve kaydet
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={state === "saving"}
          onClick={start}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm font-medium text-ink hover:bg-muted disabled:opacity-60"
        >
          <Mic className="size-4" aria-hidden />
          {state === "saving" ? "Kaydediliyor…" : "Ses notu kaydet (en fazla 60 sn)"}
        </button>
      )}
      {error ? (
        <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2.5 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function NoteRow({ note }: { note: VoiceNote }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <li className="rounded-xl border border-border p-3">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {formatShortDate(note.createdAt)} {formatTime(note.createdAt)} · {clock(note.durationSeconds)}
        </span>
        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label="Ses notunu sil"
            className="flex size-11 items-center justify-center rounded-xl text-danger hover:bg-danger/10"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>
      <audio controls preload="metadata" src={note.url} className="mt-1 w-full">
        Tarayıcın ses oynatmayı desteklemiyor.
      </audio>
      {confirming ? (
        <div role="alertdialog" aria-label="Ses notu silinsin mi?" className="mt-2 rounded-xl border border-danger/30 bg-danger/5 p-3">
          <p className="text-sm text-ink">Ses notu silinsin mi? Bu işlem geri alınamaz.</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" disabled={pending} onClick={() => setConfirming(false)} className="h-11 rounded-xl border border-border bg-surface text-sm font-medium text-ink hover:bg-muted">
              Vazgeç
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteMedia(note.id);
                  if (!result.ok) {
                    setError(result.error);
                    setConfirming(false);
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
        <p role="alert" className="mt-2 rounded-xl bg-danger/10 px-3 py-2.5 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </li>
  );
}

/** Private voice notes of a job (plan §6): record up to 60 s, play, delete. */
export function VoiceNotes({ notes, jobId, ownerId }: { notes: VoiceNote[]; jobId: string; ownerId: string }) {
  return (
    <div className="flex flex-col gap-3">
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Henüz ses notu yok.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notes.map((note) => (
            <NoteRow key={note.id} note={note} />
          ))}
        </ul>
      )}
      <Recorder jobId={jobId} ownerId={ownerId} />
    </div>
  );
}
