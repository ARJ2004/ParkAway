import { useTheme } from "@parkaway/ui-native";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export interface PickedPhoto {
  id: string;
  url: string;
  isCover: boolean;
}

export interface PhotoPickerProps {
  photos: PickedPhoto[];
  minPhotos?: number;
  requestUploadUrl: (contentType: string, byteSize: number) => Promise<{ uploadId: string; uploadUrl: string; requiredHeaders?: Record<string, string> }>;
  completeUpload: (uploadId: string) => Promise<void>;
  onUploaded: () => void;
  onSetCover: (photoId: string) => void;
  onDelete: (photoId: string) => void;
}

/**
 * A photo isn't uploaded to Fastify — it's fetched back into a Blob from its
 * local `file://` uri and PUT directly to the presigned URL (non-negotiable
 * rule 8), same contract as ui-web's `PhotoManager`. Reorder isn't built here
 * either (same deliberate scope bound as the web version) — cover selection
 * and delete are the two actions a host actually needs on a phone.
 */
export function PhotoPicker({ photos, minPhotos = 3, requestUploadUrl, completeUpload, onUploaded, onSetCover, onDelete }: PhotoPickerProps) {
  const theme = useTheme();
  const c = theme.colors;
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAddPhoto() {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Photo library permission denied.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const contentType = asset.mimeType ?? "image/jpeg";
    const byteSize = asset.fileSize ?? 1_000_000; // best-effort — server re-validates regardless

    setUploading(true);
    try {
      const { uploadId, uploadUrl, requiredHeaders } = await requestUploadUrl(contentType, byteSize);
      const fileResponse = await fetch(asset.uri);
      const blob = await fileResponse.blob();
      const putRes = await fetch(uploadUrl, { method: "PUT", headers: requiredHeaders ?? { "Content-Type": contentType }, body: blob });
      if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);
      await completeUpload(uploadId);
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed — try again");
    } finally {
      setUploading(false);
    }
  }

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.minCount, { color: c.textSecondary }]}>
        At least {minPhotos} photos required — {photos.length} added
      </Text>
      <View style={styles.grid}>
        {photos.map((photo) => (
          <View key={photo.id} style={[styles.tile, { borderColor: c.border }]}>
            <Image source={{ uri: photo.url }} style={styles.image} />
            {photo.isCover && (
              <View style={[styles.coverBadge, { backgroundColor: c.accent }]}>
                <Text style={styles.coverBadgeText}>Cover</Text>
              </View>
            )}
            <View style={styles.actions}>
              {!photo.isCover && (
                <TouchableOpacity onPress={() => onSetCover(photo.id)} style={styles.actionButton}>
                  <Text style={styles.actionButtonText}>Make cover</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => onDelete(photo.id)} style={styles.actionButton}>
                <Text style={[styles.actionButtonText, { color: c.danger }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        <TouchableOpacity onPress={handleAddPhoto} disabled={uploading} style={[styles.addTile, { borderColor: c.borderStrong, backgroundColor: c.surfaceRaised }]}>
          <Text style={[styles.addTileText, { color: c.textSecondary }]}>{uploading ? "Uploading…" : "+ Add photo"}</Text>
        </TouchableOpacity>
      </View>
      {error && <Text style={[styles.error, { color: c.danger }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 10 },
  minCount: { fontSize: 13 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { width: 104, height: 104, borderRadius: 12, borderWidth: 1, overflow: "hidden", position: "relative" },
  image: { width: "100%", height: "100%" },
  coverBadge: { position: "absolute", top: 6, left: 6, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  coverBadgeText: { fontSize: 9, fontWeight: "700", color: "#FFFFFF" },
  actions: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", flexWrap: "wrap", gap: 4, padding: 4, backgroundColor: "rgba(10,10,10,0.55)" },
  actionButton: { backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  actionButtonText: { fontSize: 10, fontWeight: "700" },
  addTile: { width: 104, height: 104, borderRadius: 12, borderWidth: 1.5, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  addTileText: { fontSize: 12, fontWeight: "600", textAlign: "center", paddingHorizontal: 8 },
  error: { fontSize: 12 },
});
