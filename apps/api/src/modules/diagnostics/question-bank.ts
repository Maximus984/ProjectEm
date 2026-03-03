import type { DiagnosticQuestion, DiagnosticTool } from "@projectm/contracts";

export type DiagnosticQuestionRecord = DiagnosticQuestion & {
  adminAnswer: string;
  rubricKeywords?: string[];
  numericAnswer?: number;
  numericTolerance?: number;
};

const subjects = ["Technology", "Coding", "Law", "Business", "Math", "Reading", "History"] as const;
const typesByIndex = ["mcq", "short_answer", "problem", "mcq", "short_answer"] as const;

function expectedTime(grade: number, type: "mcq" | "short_answer" | "problem", difficulty: number): number {
  if (type === "mcq") {
    return Math.min(70, 18 + (grade - 7) * 2 + difficulty * 4);
  }
  if (type === "short_answer") {
    return Math.min(160, 35 + (grade - 7) * 8 + difficulty * 8);
  }
  return Math.min(300, 70 + (grade - 7) * 14 + difficulty * 16);
}

const mcqChoiceBank = {
  Technology: [
    {
      stem: "Which security practice best protects account access?",
      choices: ["Use unique passphrases with 2FA", "Reuse one password everywhere", "Share passwords in chat", "Disable updates"],
      answer: "Use unique passphrases with 2FA"
    },
    {
      stem: "HTTPS primarily provides:",
      choices: ["Encrypted web transport", "Unlimited storage", "Offline browsing", "CPU overclocking"],
      answer: "Encrypted web transport"
    }
  ],
  Coding: [
    {
      stem: "Which structure repeats while a condition is true?",
      choices: ["while loop", "import", "array literal", "return type"],
      answer: "while loop"
    },
    {
      stem: "Version control is mainly used to:",
      choices: ["Track and manage code changes", "Render videos", "Create passwords", "Optimize battery life"],
      answer: "Track and manage code changes"
    }
  ],
  Law: [
    {
      stem: "FERPA in U.S. schools primarily protects:",
      choices: ["Student education record privacy", "Road traffic rules", "Tax return filing", "Voting age policy"],
      answer: "Student education record privacy"
    },
    {
      stem: "Due process refers to:",
      choices: ["Fair legal procedures", "Automatic conviction", "No right to appeal", "Private voting only"],
      answer: "Fair legal procedures"
    }
  ],
  Business: [
    {
      stem: "Opportunity cost is best defined as:",
      choices: ["The next best alternative forgone", "Any purchase receipt", "Guaranteed profit", "A fixed tax"],
      answer: "The next best alternative forgone"
    },
    {
      stem: "A fixed cost is usually:",
      choices: ["Monthly rent", "Per-unit shipping", "Hourly commission only", "Transaction fee only"],
      answer: "Monthly rent"
    }
  ],
  Math: [
    {
      stem: "In y = mx + b, m represents:",
      choices: ["Slope", "Intercept", "Area", "Median"],
      answer: "Slope"
    },
    {
      stem: "If a probability is 0.25, that equals:",
      choices: ["25%", "2.5%", "250%", "0.025%"],
      answer: "25%"
    }
  ],
  Reading: [
    {
      stem: "Strong evidence in an argument is used to:",
      choices: ["Support a claim", "Replace logic", "Hide assumptions", "Avoid citations"],
      answer: "Support a claim"
    },
    {
      stem: "The main idea of a paragraph is:",
      choices: ["The central point the author makes", "Any random detail", "A citation format", "Only the final sentence"],
      answer: "The central point the author makes"
    }
  ],
  History: [
    {
      stem: "A primary source is:",
      choices: ["An original record from the time period", "A modern summary blog", "A textbook review", "An anonymous post"],
      answer: "An original record from the time period"
    },
    {
      stem: "Checks and balances are designed to:",
      choices: ["Limit concentration of government power", "Eliminate courts", "Replace elections", "Ban state laws"],
      answer: "Limit concentration of government power"
    }
  ]
} as const;

function shortPrompt(subject: (typeof subjects)[number], grade: number, index: number): { stem: string; answer: string; keywords: string[] } {
  const promptBySubject: Record<(typeof subjects)[number], { stem: string; answer: string; keywords: string[] }> = {
    Technology: {
      stem: `Grade ${grade}: In 1-2 sentences, explain one safe data/privacy habit for students.`,
      answer: "Use strong unique passwords, enable 2FA, and avoid sharing private data.",
      keywords: ["password", "2fa", "private", "secure", "privacy"]
    },
    Coding: {
      stem: `Grade ${grade}: Explain what a function is and why reusing functions helps.`,
      answer: "A function is reusable code for a task; reuse improves clarity and reduces duplication.",
      keywords: ["function", "reusable", "code", "task", "duplicate"]
    },
    Law: {
      stem: `Grade ${grade}: Briefly explain one student right related to school records or fairness.`,
      answer: "Students/families have privacy and fairness rights under school policy/law.",
      keywords: ["right", "privacy", "fair", "records", "ferpa"]
    },
    Business: {
      stem: `Grade ${grade}: Give one KPI that could measure mentorship success and why.`,
      answer: "Example KPI: attendance completion or project milestone completion because it tracks outcomes.",
      keywords: ["kpi", "attendance", "outcome", "metric", "milestone"]
    },
    Math: {
      stem: `Grade ${grade}: Describe the difference between mean and median in one sentence.`,
      answer: "Mean is arithmetic average; median is middle value when sorted.",
      keywords: ["mean", "average", "median", "middle", "sorted"]
    },
    Reading: {
      stem: `Grade ${grade}: Summarize why citing evidence improves writing quality.`,
      answer: "Evidence supports claims and improves credibility and clarity.",
      keywords: ["evidence", "claim", "credible", "support", "clarity"]
    },
    History: {
      stem: `Grade ${grade}: Explain why historians cross-check multiple sources.`,
      answer: "Cross-checking reduces bias and improves reliability.",
      keywords: ["sources", "bias", "reliable", "cross-check", "evidence"]
    }
  };

  return promptBySubject[subject] ?? {
    stem: `Grade ${grade}: Provide a short response for item ${index}.`,
    answer: "Short structured response.",
    keywords: ["short", "response"]
  };
}

function problemPrompt(subject: (typeof subjects)[number], grade: number, index: number): {
  stem: string;
  answer: string;
  numeric?: number;
  tolerance?: number;
  keywords?: string[];
} {
  const base = 10 + grade + index;
  switch (subject) {
    case "Math": {
      const a = grade + (index % 7) + 5;
      const b = index + 9;
      const percent = 10 + (index % 5) * 5;
      const result = Number((a * (1 + percent / 100)).toFixed(2));
      return {
        stem: `A value is ${a}. It increases by ${percent}%. What is the new value?`,
        answer: `${result}`,
        numeric: result,
        tolerance: 0.02
      };
    }
    case "Business": {
      const fixed = 120 + grade * 10;
      const price = 35 + (index % 6) * 3;
      const variable = 15 + (index % 5) * 2;
      const breakEven = Math.ceil(fixed / (price - variable));
      return {
        stem: `A program has fixed cost $${fixed}, price $${price} per session, and variable cost $${variable}. How many sessions to break even?`,
        answer: `${breakEven} sessions`,
        numeric: breakEven,
        tolerance: 0
      };
    }
    case "Coding": {
      return {
        stem: `Write pseudocode to validate input, process ${base} records, and return a summary count.`,
        answer: "Pseudocode should include loop, validation, accumulator, and return summary.",
        keywords: ["loop", "validate", "count", "return", "summary"]
      };
    }
    case "Technology": {
      return {
        stem: `Design a 4-step incident response for a suspicious login detected at a school platform.`,
        answer: "Contain access, reset credentials, review logs, notify stakeholders.",
        keywords: ["contain", "reset", "logs", "notify", "incident"]
      };
    }
    case "Law": {
      return {
        stem: `A policy change affects student privacy. List two review steps leadership should take before rollout.`,
        answer: "Legal/policy review and stakeholder communication with safeguards.",
        keywords: ["policy", "review", "privacy", "compliance", "stakeholder"]
      };
    }
    case "Reading": {
      return {
        stem: `Read a claim and provide: claim summary, strongest evidence, and one counterpoint (3 bullets).`,
        answer: "Structured claim-evidence-counterpoint response.",
        keywords: ["claim", "evidence", "counterpoint", "summary"]
      };
    }
    case "History": {
      return {
        stem: `Given two historical sources about the same event, describe one agreement and one disagreement.`,
        answer: "Identify one consistent fact and one differing interpretation.",
        keywords: ["agreement", "disagreement", "source", "interpretation"]
      };
    }
    default:
      return {
        stem: "Solve the presented problem.",
        answer: "Provide a structured solution.",
        keywords: ["solution"]
      };
  }
}

function toolsForQuestion(subject: (typeof subjects)[number], type: "mcq" | "short_answer" | "problem"): DiagnosticTool[] {
  const toolSet = new Set<DiagnosticTool>();
  if (subject === "Math" || subject === "Business") {
    toolSet.add("calculator");
  }
  if (subject === "Math" && type === "problem") {
    toolSet.add("graph_grid");
    toolSet.add("ruler");
  }
  if (subject === "Reading" || subject === "Law" || subject === "History") {
    toolSet.add("scratchpad");
  }
  if (subject === "Coding" || subject === "Technology") {
    toolSet.add("scratchpad");
    if (type !== "mcq") {
      toolSet.add("formula_sheet");
    }
  }
  return [...toolSet];
}

function metadataTagsForQuestion(subject: (typeof subjects)[number], type: "mcq" | "short_answer" | "problem", grade: number): string[] {
  return [subject.toLowerCase(), type, `grade_${grade}`, "adaptive_diagnostic", "lhe_sovereign_apex"];
}

function makeQuestion(grade: number, index: number): DiagnosticQuestionRecord {
  const subject = subjects[(index - 1) % subjects.length];
  const type = typesByIndex[(index - 1) % typesByIndex.length];
  const difficulty = Math.min(10, Math.max(1, grade - 4 + (index % 4)));
  const questionId = `q${grade.toString().padStart(2, "0")}${index.toString().padStart(2, "0")}`;
  const requiredTools = toolsForQuestion(subject, type);
  const metadataTags = metadataTagsForQuestion(subject, type, grade);

  if (type === "mcq") {
    const set = mcqChoiceBank[subject][index % 2];
    return {
      question_id: questionId,
      grade,
      index,
      difficulty,
      subject,
      type,
      stem: set.stem,
      choices: [...set.choices],
      expected_time_seconds: expectedTime(grade, type, difficulty),
      required_tools: requiredTools,
      metadata_tags: metadataTags,
      adminAnswer: set.answer,
      rubricKeywords: set.answer.toLowerCase().split(/\s+/).slice(0, 4)
    };
  }

  if (type === "short_answer") {
    const short = shortPrompt(subject, grade, index);
    return {
      question_id: questionId,
      grade,
      index,
      difficulty,
      subject,
      type,
      stem: short.stem,
      expected_time_seconds: expectedTime(grade, type, difficulty),
      required_tools: requiredTools,
      metadata_tags: metadataTags,
      adminAnswer: short.answer,
      rubricKeywords: short.keywords
    };
  }

  const problem = problemPrompt(subject, grade, index);
  return {
    question_id: questionId,
    grade,
    index,
    difficulty,
    subject,
    type,
    stem: problem.stem,
    expected_time_seconds: expectedTime(grade, type, difficulty),
    required_tools: requiredTools,
    metadata_tags: metadataTags,
    adminAnswer: problem.answer,
    rubricKeywords: problem.keywords,
    numericAnswer: problem.numeric,
    numericTolerance: problem.tolerance
  };
}

export const QUESTION_BANK: DiagnosticQuestionRecord[] = Array.from({ length: 6 }, (_, offset) => 7 + offset)
  .flatMap((grade) => Array.from({ length: 20 }, (_, idx) => makeQuestion(grade, idx + 1)));

export type StudentQuestion = Omit<DiagnosticQuestionRecord, "adminAnswer" | "rubricKeywords" | "numericAnswer" | "numericTolerance">;

export function getQuestionsForGrade(grade: number): StudentQuestion[] {
  return QUESTION_BANK.filter((item) => item.grade === grade).map(
    ({ adminAnswer: _a, rubricKeywords: _k, numericAnswer: _n, numericTolerance: _t, ...studentQuestion }) => studentQuestion
  );
}

export function getAdminAnswersForGrade(grade: number) {
  return QUESTION_BANK.filter((item) => item.grade === grade).map((item) => ({
    question_id: item.question_id,
    type: item.type,
    subject: item.subject,
    answer: item.adminAnswer,
    rubric_keywords: item.rubricKeywords ?? []
  }));
}

export function getQuestionById(questionId: string): DiagnosticQuestionRecord | undefined {
  return QUESTION_BANK.find((item) => item.question_id === questionId);
}
