import { useRef, useState, type ChangeEvent } from "react";
import styles from "./FileUpload.module.css";

export interface RequestedUpload {
  uploadId: string;
  uploadUrl: string;
  requiredHeaders?: Record<string, string>;
}

export interface FileUploadProps {
  label?: string;
  accept?: string;
  hint?: string;
  /** Server generates the object key — this only asks it for a presigned URL, never picks a key itself. */
  requestUploadUrl: (file: File) => Promise<RequestedUpload>;
  completeUpload: (uploadId: string) => Promise<void>;
  onUploaded?: (uploadId: string) => void;
  disabled?: boolean;
}

type UploadState = "idle" | "uploading" | "error" | "done";

/**
 * Owns presign → direct PUT → complete end to end (photos/document uploads
 * never pass through Fastify — non-negotiable rule 8). A failed PUT retries
 * that one file alone rather than restarting the whole flow — the flaky-
 * connection case Sprint 2's host onboarding UX explicitly designs around.
 */
export function FileUpload({ label, accept, hint, requestUploadUrl, completeUpload, onUploaded, disabled }: FileUploadProps) {
  const [state, setState] = useState<UploadState>("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function doUpload(file: File) {
    setState("uploading");
    setPendingFile(file);
    setFileName(file.name);
    setError(null);
    try {
      const { uploadId, uploadUrl, requiredHeaders } = await requestUploadUrl(file);
      const putRes = await fetch(uploadUrl, { method: "PUT", headers: requiredHeaders ?? { "Content-Type": file.type }, body: file });
      if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);
      await completeUpload(uploadId);
      setState("done");
      onUploaded?.(uploadId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setState("error");
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void doUpload(file);
  }

  function retry() {
    if (pendingFile) void doUpload(pendingFile);
  }

  return (
    <div className={styles.wrapper}>
      {label && <span className={styles.label}>{label}</span>}
      <input ref={inputRef} type="file" accept={accept} className={styles.hiddenInput} onChange={handleFileChange} disabled={disabled || state === "uploading"} />

      {state === "idle" && (
        <button type="button" className={styles.dropzone} onClick={() => inputRef.current?.click()} disabled={disabled}>
          Choose a file
        </button>
      )}
      {state === "uploading" && <div className={styles.status}>Uploading {fileName}…</div>}
      {state === "done" && (
        <div className={styles.statusDone}>
          <span>{fileName}</span>
          <button type="button" className={styles.link} onClick={() => inputRef.current?.click()}>
            Change
          </button>
        </div>
      )}
      {state === "error" && (
        <div className={styles.statusError}>
          <span>{error ?? "Upload failed"}</span>
          <button type="button" className={styles.link} onClick={retry}>
            Retry
          </button>
        </div>
      )}
      {hint && state === "idle" && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}
