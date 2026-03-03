import { render, screen } from "@testing-library/react";
import { ResultsTable } from "../components/ResultsTable";

describe("ResultsTable", () => {
  it("renders correct and incorrect statuses", () => {
    render(
      <ResultsTable
        sections={[
          {
            sectionId: "s1",
            title: "Section 1",
            correctCount: 1,
            total: 2,
            items: [
              {
                itemId: "i1",
                prompt: "Q1",
                answer: "A",
                correctAnswer: "A",
                isCorrect: true,
                timeSpentSec: 12
              },
              {
                itemId: "i2",
                prompt: "Q2",
                answer: "B",
                correctAnswer: "C",
                isCorrect: false,
                timeSpentSec: 8
              }
            ]
          }
        ]}
      />
    );

    expect(screen.getByTestId("result-i1")).toHaveTextContent("Correct");
    expect(screen.getByTestId("result-i2")).toHaveTextContent("Incorrect");
  });
});
