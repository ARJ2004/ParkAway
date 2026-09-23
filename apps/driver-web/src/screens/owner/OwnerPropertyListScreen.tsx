import { Button, Card, EmptyState } from "@parkaway/ui-web";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { listProperties } from "../../api/properties";
import { OwnerAppShell } from "../../components/OwnerAppShell";

export function OwnerPropertyListScreen() {
  const navigate = useNavigate();
  const { data } = useQuery({ queryKey: ["properties"], queryFn: listProperties });
  const properties = data?.properties ?? [];

  return (
    <OwnerAppShell>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Your properties</h1>
        <Button onClick={() => navigate("/owner/properties/new")}>Add property</Button>
      </div>
      {properties.length === 0 ? (
        <EmptyState title="No properties yet" description="Add the property your space is in — one property, then its spaces." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {properties.map((p) => (
            <Card key={p.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
                    {p.addressLine1}, {p.locality}, {p.city}
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => navigate(`/owner/listings?propertyId=${p.id}`)}>
                  View spaces
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </OwnerAppShell>
  );
}
