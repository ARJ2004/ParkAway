import { Button, Card, EmptyState } from "@parkaway/ui-web";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { listProperties } from "../../api/properties";
import { PropertyManagerShell } from "../../components/PropertyManagerShell";

/**
 * A manager at pilot scale has one to three properties — this is a list,
 * not a dashboard (§2.5's Property Manager Console UX flow).
 */
export function ManagePropertyListScreen() {
  const navigate = useNavigate();
  const { data } = useQuery({ queryKey: ["properties"], queryFn: listProperties });
  const properties = data?.properties ?? [];

  return (
    <PropertyManagerShell>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Your properties</h1>
        <Button onClick={() => navigate("/manage/properties/new")}>Add property</Button>
      </div>
      {properties.length === 0 ? (
        <EmptyState title="No properties yet" description="Add the property you manage to start authorizing and listing spaces in it." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {properties.map((p) => (
            <Card key={p.id}>
              <button
                type="button"
                onClick={() => navigate(`/manage/properties/${p.id}`)}
                style={{ all: "unset", display: "flex", justifyContent: "space-between", width: "100%", cursor: "pointer" }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
                    {p.addressLine1}, {p.locality}, {p.city}
                  </div>
                </div>
                <span style={{ fontSize: "13px", color: "var(--color-text-muted)", textTransform: "capitalize" }}>{p.propertyType}</span>
              </button>
            </Card>
          ))}
        </div>
      )}
    </PropertyManagerShell>
  );
}
