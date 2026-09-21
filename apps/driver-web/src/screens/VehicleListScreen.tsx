import { Button, EmptyState } from "@parkaway/ui-web";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { deactivateVehicle, listVehicles, setDefaultVehicle } from "../api/vehicles";
import { AppShell } from "../components/AppShell";
import styles from "./VehicleListScreen.module.css";

export function VehicleListScreen() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["vehicles"], queryFn: listVehicles });

  const setDefault = useMutation({
    mutationFn: setDefaultVehicle,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vehicles"] }),
  });
  const deactivate = useMutation({
    mutationFn: deactivateVehicle,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vehicles"] }),
  });

  const vehicles = (data?.vehicles ?? []).filter((v) => v.status === "active");

  return (
    <AppShell>
      <div className={styles.header}>
        <h1>Vehicles</h1>
        <Button size="sm" onClick={() => navigate("/vehicles/new")}>
          Add vehicle
        </Button>
      </div>

      {vehicles.length === 0 ? (
        <EmptyState
          icon="🚗"
          title="No vehicles yet"
          description="Add one to book faster."
          action={<Button onClick={() => navigate("/vehicles/new")}>Add your first vehicle</Button>}
        />
      ) : (
        <div className={styles.list}>
          {vehicles.map((v) => (
            <div className={styles.row} key={v.id}>
              <div className={styles.rowMain}>
                <span className={styles.reg}>{v.registrationNo}</span>
                <span className={styles.meta}>
                  {v.type}
                  {v.makeModel ? ` · ${v.makeModel}` : ""}
                </span>
                {v.isDefault && <span className={styles.defaultTag}>Default</span>}
              </div>
              <div className={styles.actions}>
                {!v.isDefault && (
                  <Button variant="secondary" size="sm" onClick={() => setDefault.mutate(v.id)} loading={setDefault.isPending}>
                    Set default
                  </Button>
                )}
                <Button variant="skip" size="sm" onClick={() => deactivate.mutate(v.id)} loading={deactivate.isPending}>
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
