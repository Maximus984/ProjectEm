import { fireEvent, render, screen } from "@testing-library/react";
import { BreakControl } from "../components/BreakControl";

describe("BreakControl", () => {
  it("disables break button after use", () => {
    render(
      <BreakControl used={true} inBreak={false} breakRemaining={0} onRequestBreak={() => undefined} onResume={() => undefined} />
    );

    expect(screen.getByTestId("break-btn")).toBeDisabled();
  });

  it("calls request break when enabled", () => {
    const fn = jest.fn();
    render(
      <BreakControl used={false} inBreak={false} breakRemaining={0} onRequestBreak={fn} onResume={() => undefined} />
    );

    fireEvent.click(screen.getByTestId("break-btn"));
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
