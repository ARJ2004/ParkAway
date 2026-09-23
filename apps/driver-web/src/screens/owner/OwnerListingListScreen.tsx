import { Badge, Button, Card, EmptyState, Select } from "@parkaway/ui-web";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createListing, listOwnListings } from "../../api/listings";
import { listProperties } from "../../api/properties";
import { OwnerAppShell } from "../../components/OwnerAppShell";

const STATUS_VARIANT: Record<string, "success" | "neutral" | "warning" | "danger"> = {
  draft: "neutral",
  pending_verification: "warning",
  published: "success",
  paused: "neutral",
  suspended: "danger",
  archived: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_verification: "In review",
  published: "Live",
  paused: "Paused",
  suspended: "Suspended",
  archived: "Archived",
};

export function OwnerListingListScreen() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const propertyIdFromUrl = searchParams.get("propertyId");

  const { data: propertiesData } = useQuery({ queryKey: ["properties"], queryFn: listProperties });
  const properties = propertiesData?.properties ?? [];
  const [addingForProperty, setAddingForProperty] = useState<string>(propertyIdFromUrl ?? "");

  const { data: listingsData } = useQuery({ queryKey: ["ownListings"], queryFn: listOwnListings });
  const listings = listingsData?.listings ?? [];

  const createMutation = useMutation({
    mutationFn: () => createListing({ propertyId: addingForProperty, spaceLabel: "New space" }),
    onSuccess: (listing) => {
      queryClient.invalidateQueries({ queryKey: ["ownListings"] });
      navigate(`/owner/listings/${listing.id}/edit/fit`);
    },
  });

  return (
    <OwnerAppShell>
      <h1>Your spaces</h1>
      {properties.length === 0 ? (
        <EmptyState title="Add a property first" description="A space always belongs to a property — add yours, then come back here." action={<Button onClick={() => navigate("/owner/properties/new")}>Add property</Button>} />
      ) : (
        <>
          <Card>
            <div style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <Select
                  label="Add a space to"
                  placeholder="Choose a property"
                  options={properties.map((p) => ({ value: p.id, label: p.name }))}
                  value={addingForProperty}
                  onChange={(e) => setAddingForProperty(e.target.value)}
                />
              </div>
              <Button onClick={() => createMutation.mutate()} disabled={!addingForProperty} loading={createMutation.isPending}>
                Add a space
              </Button>
            </div>
          </Card>

          {listings.length === 0 ? (
            <EmptyState title="No spaces yet" description="Add your first parking space above." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {listings.map((listing) => (
                <Card key={listing.id}>
                  <button
                    type="button"
                    onClick={() => navigate(listing.status === "draft" ? `/owner/listings/${listing.id}/edit/fit` : `/owner/listings/${listing.id}`)}
                    style={{ all: "unset", display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", cursor: "pointer" }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{listing.spaceLabel}</div>
                      {listing.statusReason && <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>{listing.statusReason}</div>}
                    </div>
                    <Badge label={STATUS_LABEL[listing.status] ?? listing.status} variant={STATUS_VARIANT[listing.status] ?? "neutral"} />
                  </button>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </OwnerAppShell>
  );
}
