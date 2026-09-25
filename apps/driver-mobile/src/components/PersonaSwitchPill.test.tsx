import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { useAuth } from "../navigation/AuthContext";
import { PersonaSwitchPill } from "./PersonaSwitchPill";

jest.mock("../navigation/AuthContext", () => ({ useAuth: jest.fn() }));

const mockedUseAuth = useAuth as jest.Mock;

describe("PersonaSwitchPill (Group D, AC-4/AC-8)", () => {
  it("shows both segments when the user holds both driver and owner", async () => {
    mockedUseAuth.mockReturnValue({ selectPersona: jest.fn(), availablePersonas: ["driver", "owner"] });
    const { getByText } = await render(<PersonaSwitchPill active="driver" />);
    expect(getByText("Driver")).toBeTruthy();
    expect(getByText(/Owner/)).toBeTruthy();
  });

  it("AC-8: renders nothing once the host role is revoked (owner no longer available) — no orphaned entry point", async () => {
    mockedUseAuth.mockReturnValue({ selectPersona: jest.fn(), availablePersonas: ["driver"] });
    const { queryByText, toJSON } = await render(<PersonaSwitchPill active="driver" />);
    expect(queryByText("Driver")).toBeNull();
    expect(queryByText(/Owner/)).toBeNull();
    expect(toJSON()).toBeNull();
  });

  it("a driver-only user who never held the host role also sees no switcher (design note: one entry point, in Profile)", async () => {
    mockedUseAuth.mockReturnValue({ selectPersona: jest.fn(), availablePersonas: ["driver"] });
    const { toJSON } = await render(<PersonaSwitchPill active="driver" />);
    expect(toJSON()).toBeNull();
  });

  it("tapping the inactive segment calls selectPersona with that persona", async () => {
    const selectPersona = jest.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue({ selectPersona, availablePersonas: ["driver", "owner"] });
    const { getByText } = await render(<PersonaSwitchPill active="driver" />);

    fireEvent.press(getByText(/Owner/));

    await waitFor(() => expect(selectPersona).toHaveBeenCalledWith("owner"));
  });

  it("tapping the already-active segment is a no-op", async () => {
    const selectPersona = jest.fn();
    mockedUseAuth.mockReturnValue({ selectPersona, availablePersonas: ["driver", "owner"] });
    const { getByText } = await render(<PersonaSwitchPill active="driver" />);

    fireEvent.press(getByText("Driver"));

    expect(selectPersona).not.toHaveBeenCalled();
  });
});
