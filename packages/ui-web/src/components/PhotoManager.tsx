import { useRef, useState, type ChangeEvent } from "react";
import type { RequestedUpload } from "./FileUpload";
import styles from "./PhotoManager.module.css";

export interface PhotoManagerPhoto {
  id: string;
  url: string;
  isCover: boolean;
}

export interface PhotoManagerProps {
  photos: PhotoManagerPhoto[];
  minPhotos?: number;
  requestUploadUrl: (file: File) => Promise<RequestedUpload>;
  completeUpload: (photoId: string) => Promise<void>;
  onUploaded: () => void;
  onSetCover: (photoId: string) => void;
  onMove: (photoId: string, direction: "left" | "right") => void;
  onDelete: (photoId: string) => void;
  disabled?: boolean;
}

/**
 * Grid with a per-photo menu (make cover, move, delete) and an "add photo"
 * tile that runs the same presign → PUT → complete path as `FileUpload`.
 * Reorder is left/right move buttons rather than pointer drag — a deliberate
 * scope bound for this sprint; the underlying `position` field is fully
 * drag-order-capable server-side whenever a drag interaction is added.
 */
export function PhotoManager({ photos, minPhotos = 3, requestUploadUrl, completeUpload, onUploaded, onSetCover, onMove, onDelete, disabled }: PhotoManagerProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const { uploadId, uploadUrl, requiredHeaders } = await requestUploadUrl(file);
      const putRes = await fetch(uploadUrl, { method: "PUT", headers: requiredHeaders ?? { "Content-Type": file.type }, body: file });
      if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);
      await completeUpload(uploadId);
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed — try again");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className={styles.wrapper}>
      <p className={styles.minCount}>
        At least {minPhotos} photos required — {photos.length} added
      </p>
      <div className={styles.grid}>
        {photos.map((photo, i) => (
          <div key={photo.id} className={styles.tile}>
            <img src={photo.url} alt="" className={styles.image} />
            {photo.isCover && <span className={styles.coverBadge}>Cover</span>}
            <div className={styles.actions}>
              {!photo.isCover && (
                <button type="button" className={styles.actionButton} onClick={() => onSetCover(photo.id)} disabled={disabled}>
                  Make cover
                </button>
              )}
              <button type="button" className={styles.actionButton} onClick={() => onMove(photo.id, "left")} disabled={disabled || i === 0}>
                ←
              </button>
              <button type="button" className={styles.actionButton} onClick={() => onMove(photo.id, "right")} disabled={disabled || i === photos.length - 1}>
                →
              </button>
              <button type="button" className={styles.deleteButton} onClick={() => onDelete(photo.id)} disabled={disabled}>
                Delete
              </button>
            </div>
          </div>
        ))}
        <button type="button" className={styles.addTile} onClick={() => inputRef.current?.click()} disabled={disabled || uploading}>
          {uploading ? "Uploading…" : "+ Add photo"}
        </button>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className={styles.hiddenInput} onChange={handleFileChange} />
      </div>
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}
