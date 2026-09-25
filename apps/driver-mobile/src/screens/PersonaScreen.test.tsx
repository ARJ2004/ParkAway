import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { useAuth } from "../navigation/AuthContext";
import { PersonaScreen } from "./PersonaScreen";

jest.mock("../navigation/AuthContext", () => ({ useAuth: jest.fn() }));

const mockedUseAuth = useAuth as jest.Mock;

describe("PersonaScreen (Group D, AC-1/AC-2)", () => {
  it("renders both persona cards with equal weight and no pre-selected default", async () => {
    mockedUseAuth.mockReturnValue({ selectPersona: jest.fn() });
    const { getByText } = await render(<PersonaScreen />);
    expect(getByText("Park a vehicle")).toBeTruthy();
    expect(getByText("Rent out my space")).toBeTruthy();
  });

  it("tapping the owner card calls selectPersona('owner'), not a hardcoded driver default", async () => {
    const selectPersona = jest.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue({ selectPersona });
    const { getByText } = await render(<PersonaScreen />);

    fireEvent.press(getByText("Rent out my space"));

    await waitFor(() => expect(selectPersona).toHaveBeenCalledWith("owner"));
    expect(selectPersona).not.toHaveBeenCalledWith("driver");
  });

  it("tapping the driver card calls selectPersona('driver')", async () => {
    const selectPersona = jest.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue({ selectPersona });
    const { getByText } = await render(<PersonaScreen />);

    fireEvent.press(getByText("Park a vehicle"));

    await waitFor(() => expect(selectPersona).toHaveBeenCalledWith("driver"));
  });

  it("marks both cards disabled while a selection is in flight, so a real double-tap can't fire a second call", async () => {
    // fireEvent.press in this RNTL version calls onPress directly and doesn't
    // simulate RN's own responder-level disabled check, so the guard against a
    // double-tap has to be asserted on the `disabled` prop itself, not by firing
    // a second press and expecting it to be swallowed.
    let resolveSelect!: () => void;
    const selectPersona = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSelect = resolve;
        })
    );
    mockedUseAuth.mockReturnValue({ selectPersona });
    const { getByTestId } = await render(<PersonaScreen />);

    expect(getByTestId("persona-card-driver").props.accessibilityState.disabled).toBe(false);
    expect(getByTestId("persona-card-owner").props.accessibilityState.disabled).toBe(false);

    fireEvent.press(getByTestId("persona-card-owner"));

    await waitFor(() => {
      expect(getByTestId("persona-card-driver").props.accessibilityState.disabled).toBe(true);
      expect(getByTestId("persona-card-owner").props.accessibilityState.disabled).toBe(true);
    });

    resolveSelect();
    await waitFor(() => expect(getByTestId("persona-card-driver").props.accessibilityState.disabled).toBe(false));
  });
});
