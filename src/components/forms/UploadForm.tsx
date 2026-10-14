"use client";

import { motion } from "framer-motion";
import { SavedToast } from "@/components/motion/SavedToast";
import { ActionNote } from "@/components/ActionNote";
import { useActionRunner } from "@/components/use-action-runner";
import { useRef, useState } from "react";
import { saveDraft, submitTask } from "@/lib/actions/submissions";
import { IconUpload, IconX } from "@/components/icons";

type FileEntry = { name: string; dataUrl: string; caption: string };
const MAX_SIZE = 1.75 * 1024 * 1024;

export function UploadForm({
  taskId,
  maxFiles,
  label,
  captionLabel,
  initial,
}: {
  taskId: string;
  maxFiles: number;
  label: string;
  captionLabel?: string;
  initial?: { files?: FileEntry[] };
}) {
  const [files, setFiles] = useState<FileEntry[]>(initial?.files ?? []);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const { run, status, pending } = useActionRunner();
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function addFiles(list: FileList | null) {
    if (!list) return;
    setError(null);
    const room = maxFiles - files.length;
    const chosen = Array.from(list).slice(0, room);
    if (list.length > room) setError(`Only ${maxFiles} files allowed, kept the first ${room === 0 ? 0 : room}.`);
    const next: FileEntry[] = [];
    for (const f of chosen) {
      if (f.size > MAX_SIZE) {
        setError(`${f.name} is too large for this preview build (max 1.75MB).`);
        continue;
      }
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(f);
      });
      next.push({ name: f.name, dataUrl, caption: "" });
    }
    setFiles((f) => [...f, ...next]);
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="block text-sm font-medium text-ink">{label}</label>

      <button
        type="button"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`w-full flex cursor-pointer flex-col items-center justify-center rounded-sm2 border-2 border-dashed p-8 transition-colors ${
          dragOver ? "border-cognac bg-cognac/5" : "border-line-strong hover:border-ink-45"
        }`}
      >
        <IconUpload className="h-6 w-6 text-ink-45" />
        <p className="text-sm text-ink-60">
          Drop images or a PDF here, or <span className="text-cognac-deep">browse</span>
        </p>
        <p className="text-xs text-ink-45">
          Up to {maxFiles} files, 1.75MB each · {files.length}/{maxFiles} added
        </p>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,.pdf"
        className="hidden"
        onChange={(e) => addFiles(e.target.files)}
      />

      {error && <p className="text-xs text-cognac-deep">{error}</p>}

      {files.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {files.map((f, i) => (
            <div key={i} className="group relative overflow-hidden rounded-sm2 border border-line bg-paper">
              {f.dataUrl.startsWith("data:image") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.dataUrl} alt={f.name} className="h-28 w-full object-cover" />
              ) : (
                <div className="flex h-28 w-full items-center justify-center bg-canvas-2 text-xs text-ink-45">PDF</div>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFiles((fs) => fs.filter((_, j) => j !== i));
                }}
                className="absolute right-1.5 top-1.5 rounded-full bg-ink/70 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <IconX className="h-3 w-3" />
              </button>
              {captionLabel && (
                <input
                  className="w-full border-t border-line bg-paper px-2 py-1.5 text-xs outline-none placeholder:text-ink-45"
                  placeholder="Caption"
                  value={f.caption}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFiles((fs) => fs.map((x, j) => (j === i ? { ...x, caption: v } : x)));
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <ActionNote status={status} />

      <div className="flex items-center gap-3 border-t border-line pt-4">
        <motion.button
          whileTap={{ scale: 0.96 }}
          className="btn-primary"
          disabled={files.length === 0 || pending}
          onClick={() => run(() => submitTask(taskId, { files }))}
        >
          Submit
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.96 }}
          className="btn-ghost"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const r = await saveDraft(taskId, { files });
              if (r.ok) setSavedAt(new Date().toLocaleTimeString());
              return r;
            })
          }
        >
          Save draft
        </motion.button>
        <SavedToast at={savedAt} />
      </div>
    </div>
  );
}
