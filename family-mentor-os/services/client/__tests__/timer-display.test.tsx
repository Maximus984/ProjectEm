import { render, screen } from "@testing-library/react";
import { TimerDisplay } from "../components/TimerDisplay";

describe("TimerDisplay", () => {
  it("updates timer text when seconds change", () => {
    const view = render(<TimerDisplay seconds={120} />);
    expect(screen.getByTestId("timer-display")).toHaveTextContent("02:00");

    view.rerender(<TimerDisplay seconds={95} />);
    expect(screen.getByTestId("timer-display")).toHaveTextContent("01:35");
  });
});
