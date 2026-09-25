import { render, waitFor } from "@testing-library/react-native";
import { listListingPhotos } from "../../api/listings";
import type { Listing } from "../../api/listings";
import { ReviewStep } from "./ListingWizardScreen";

jest.mock("../../api/listings", () => ({
  listListingPhotos: jest.fn(),
  submitListing: jest.fn(),
}));

const mockedListPhotos = listListingPhotos as jest.Mock;

function baseListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: "listing-1",
    propertyId: "property-1",
    hostUserId: "host-1",
    spaceLabel: "B2-14",
    spaceType: "exclusive",
    capacity: 1,
    vehicleTypes: ["hatchback"],
    lengthCm: 500,
    widthCm: 250,
    heightCm: 200,
    covered: false,
    amenities: null,
    accessMethod: "open",
    rules: null,
    status: "draft",
    statusReason: null,
    publishedAt: null,
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

describe("ListingWizardScreen's ReviewStep — regression for the re-submit bug (PROGRESS.md 2026-09-24, bug #4)", () => {
  beforeEach(() => {
    mockedListPhotos.mockResolvedValue({ photos: [] });
  });

  it("a draft listing shows the Submit-for-review action", async () => {
    const { getByText, queryByText } = await render(
      <ReviewStep listingId="listing-1" listing={baseListing({ status: "draft" })} onSubmitted={jest.fn()} onBack={jest.fn()} />
    );

    await waitFor(() => expect(getByText("Submit for review")).toBeTruthy());
    expect(queryByText("Status")).toBeNull(); // the read-only status row only appears once already submitted
  });

  it("an already-submitted listing (pending_verification) has NO submit button — resubmitting would just 409", async () => {
    const { getByText, queryByText } = await render(
      <ReviewStep listingId="listing-1" listing={baseListing({ status: "pending_verification" })} onSubmitted={jest.fn()} onBack={jest.fn()} />
    );

    await waitFor(() => expect(getByText("Status")).toBeTruthy());
    expect(queryByText("Submit for review")).toBeNull();
    expect(getByText("pending verification")).toBeTruthy();
  });

  it("a published listing shows its status read-only, not a submit action", async () => {
    const { getByText, queryByText } = await render(
      <ReviewStep listingId="listing-1" listing={baseListing({ status: "published" })} onSubmitted={jest.fn()} onBack={jest.fn()} />
    );

    await waitFor(() => expect(getByText("Status")).toBeTruthy());
    expect(queryByText("Submit for review")).toBeNull();
    expect(getByText("published")).toBeTruthy();
  });

  it("a suspended listing shows its status reason alongside the status", async () => {
    const { getByText } = await render(
      <ReviewStep
        listingId="listing-1"
        listing={baseListing({ status: "suspended", statusReason: "verification_expired" })}
        onSubmitted={jest.fn()}
        onBack={jest.fn()}
      />
    );

    await waitFor(() => expect(getByText(/suspended.*verification_expired/)).toBeTruthy());
  });
});
