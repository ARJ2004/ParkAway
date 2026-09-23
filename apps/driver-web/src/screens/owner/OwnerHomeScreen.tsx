import { Badge, Card } from "@parkaway/ui-web";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { listOwnListings } from "../../api/listings";
import { listProperties } from "../../api/properties";
import { OwnerAppShell } from "../../components/OwnerAppShell";
import styles from "./OwnerHomeScreen.module.css";

/**
 * Before onboarding is complete this is a checklist, not a dashboard —
 * modelled on the Airbnb host "what's required to get paid" pattern
 * (05-sprint-2-detailed-plan.md, Group F UX flow): separates what blocks
 * *publishing* (a property, a space) from what blocks *money* (payout
 * details) — AC-5.
 */
export function OwnerHomeScreen() {
  const navigate = useNavigate();
  const { data: propertiesData } = useQuery({ queryKey: ["properties"], queryFn: listProperties });
  const { data: listingsData } = useQuery({ queryKey: ["ownListings"], queryFn: listOwnListings });

  const hasProperty = (propertiesData?.properties.length ?? 0) > 0;
  const hasListing = (listingsData?.listings.length ?? 0) > 0;
  const publishedCount = listingsData?.listings.filter((l) => l.status === "published").length ?? 0;

  return (
    <OwnerAppShell>
      <h1>Welcome, host</h1>
      {publishedCount > 0 && (
        <Card>
          <span className={styles.earnLabel}>Live spaces</span>
          <div className={styles.earnValue}>{publishedCount}</div>
          <p className={styles.earnHint}>Published and visible to drivers once search launches (Sprint 3).</p>
        </Card>
      )}
      <div className={styles.checklist}>
        <ChecklistItem
          title="Add your space"
          body="Register the property, then describe the parking space you're renting out."
          done={hasListing}
          onClick={() => navigate(hasProperty ? "/owner/listings" : "/owner/properties")}
        />
        <ChecklistItem title="Verify your identity" body="Submit ID and ownership evidence — required to get paid, not required to publish." onClick={() => navigate("/owner/kyc")} />
        <ChecklistItem title="Add payout details" body="So you can receive earnings once bookings start." onClick={() => navigate("/owner/payout")} />
      </div>
    </OwnerAppShell>
  );
}

function ChecklistItem({ title, body, done, onClick }: { title: string; body: string; done?: boolean; onClick: () => void }) {
  return (
    <Card>
      <button type="button" className={styles.itemButton} onClick={onClick}>
        <div className={styles.itemText}>
          <span className={styles.itemTitle}>{title}</span>
          <span className={styles.itemBody}>{body}</span>
        </div>
        {done ? <Badge label="Done" variant="success" /> : <Badge label="Start" variant="neutral" />}
      </button>
    </Card>
  );
}
