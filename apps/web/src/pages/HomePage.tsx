import { isAdminRole, isFamilyRole, supportContacts } from "@projectm/contracts";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useUiSound } from "../hooks/use-ui-sound";
import { useAuthStore } from "../store/auth-store";

const benefits = [
  "Mentor-first learning: One-on-one mentorship focused on tech, logic, and leadership, not babysitting.",
  "Project-based progression: Structured modules plus portfolio building show measurable growth.",
  "Secure family accounts: Multi-parent support, passkeys, and strict privacy safeguards.",
  "Flexible modes: Studio hardware sessions, BYOD mentorship, or virtual Zoom learning.",
  "Transparent tracking: Attendance, grades, and progress charts stay visible to parents.",
  "Trust and safety: Verified mentors, background checks, waivers, and secure messaging."
];

const workModes = [
  {
    key: "studio",
    title: "Premium Genius",
    summary: "Hardware-ready, in-person studio mentorship with guided outcomes.",
    points: ["$45/hr", "Hardware reservation", "Best for deep build sessions"]
  },
  {
    key: "byod",
    title: "BYOD Mentorship",
    summary: "Bring-your-own-device path for project continuity and focused coaching.",
    points: ["$40/hr", "No hardware checkout", "Flexible and efficient"]
  },
  {
    key: "virtual",
    title: "Virtual Learning",
    summary: "Remote sessions with optional intro Zoom and progress tracking.",
    points: ["$32/hr", "Parent-friendly scheduling", "Anywhere access"]
  }
] as const;

const onboardingSteps = [
  {
    title: "Create Family Account",
    detail: "Parent signs up first and creates family identity with secure credentials."
  },
  {
    title: "Add Children",
    detail: "Create child profiles during onboarding so booking data is tied to real family records."
  },
  {
    title: "Book Session",
    detail: "Choose mentorship tier, date/time, and submit a tracked booking request."
  },
  {
    title: "Track Progress",
    detail: "Use parent workspace for attendance, outcomes, and communication."
  }
];

const surfaceCards = [
  {
    label: "Parent Surface",
    description: "Children, bookings, attendance, and progress view in one place."
  },
  {
    label: "Owner Surface",
    description: "Coupons, role controls, workspace-hours policy, and IP ban management."
  },
  {
    label: "Client Surface",
    description: "Shared project visibility and support channels for partner stakeholders."
  }
];

const trustSignals = [
  "Paige founded by a mentor from The Hidden Genius Project.",
  "Verified mentor badges and background-check workflow.",
  "Insurance-backed operations and secure parent communication."
];

const featureHighlights = [
  "Quick booking widget with instant availability.",
  "One-click attendance and gradebook (PowerSchool-style).",
  "Child portfolio and mini-site builder.",
  "Mentor live tracking (DoorDash-inspired timeline).",
  "Secure messaging and in-app support tickets."
];

const faqs = [
  {
    question: "Why does booking require signup first?",
    answer: "Booking now requires a parent family account so each request is linked to verified family and child records."
  },
  {
    question: "Where do I open my workspace?",
    answer: "Use /workspaces or the top navigation. Then pick Owner, Client, or Parent workspace access."
  },
  {
    question: "Can I add more than one child?",
    answer: "Yes. Family onboarding supports up to 5 children and optional co-parent creation."
  }
];

const firstTimeTourSteps = [
  {
    title: "Welcome to Project Paige",
    detail:
      "This platform combines elite mentorship, childcare, diagnostics, attendance, assignments, and parent transparency in one secure workspace."
  },
  {
    title: "Family Account Required",
    detail:
      "Families must create a family account first. This unlocks booking, diagnostics, child profiles, messaging, and progress tracking."
  },
  {
    title: "Payment Policy",
    detail:
      "Payment is captured after services are provided. Parents can review session details first, then complete billing in the workspace."
  },
  {
    title: "Your Next Step",
    detail:
      "Use Create Family Account to begin onboarding. After setup, use Book and Workspace to manage sessions and learning outcomes."
  }
];

const firstTimeTourStorageKey = "projectm_first_time_tour_complete_v2";

export function HomePage() {
  const role = useAuthStore((state) => state.role);
  const { playTap, playSuccess } = useUiSound();
  const [selectedMode, setSelectedMode] = useState<(typeof workModes)[number]["key"]>("studio");
  const [activeStep, setActiveStep] = useState(0);
  const [openFaq, setOpenFaq] = useState<number>(0);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);

  const selectedModeCard = useMemo(
    () => workModes.find((mode) => mode.key === selectedMode) ?? workModes[0],
    [selectedMode]
  );

  const createFamilyHref = "/register?next=%2Fbook";
  const primaryActionHref = role && isFamilyRole(role) ? "/book" : createFamilyHref;
  const primaryActionLabel = "Book a Free Intro Session";
  const workspaceHref = role
    ? isAdminRole(role)
      ? "/workspace"
      : role === "CLIENT"
        ? "/client"
        : isFamilyRole(role)
          ? "/parent"
          : "/dashboard"
    : "/workspaces";

  useEffect(() => {
    const completed = window.localStorage.getItem(firstTimeTourStorageKey);
    if (!completed) {
      setTourOpen(true);
    }
  }, []);

  const completeTour = () => {
    window.localStorage.setItem(firstTimeTourStorageKey, "true");
    setTourOpen(false);
    playSuccess();
  };

  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-cosmic/80 to-ink p-8 shadow-glow md:p-12">
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-aurora/20 blur-3xl" />
        <div className="absolute -bottom-28 left-24 h-72 w-72 rounded-full bg-flare/15 blur-3xl" />
        <motion.div
          className="pointer-events-none absolute -top-24 right-10 h-64 w-64 rounded-full border border-aurora/25"
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="pointer-events-none absolute -bottom-28 left-12 h-72 w-72 rounded-full border border-flare/20"
          animate={{ rotate: -360 }}
          transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
        />

        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          <img
            src="/branding/maxx-forge-logo.png"
            alt="MAXX Forge Studio"
            className="w-40 drop-shadow-[0_0_26px_rgba(106,245,255,0.35)] md:w-52"
          />
          <p className="mt-3 text-xs uppercase tracking-[0.28em] text-aurora">
            Project Paige • Elite Mentorship Childcare • ProjectM Framework
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl leading-tight text-white md:text-6xl">
            Forge Geniuses - Elite Mentorship-Based Childcare
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-mist md:text-lg">
            Hands-on technology, business logic, and legal mentorship woven into childcare. Project-based learning,
            measurable progress, and trusted in-person and virtual sessions.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to={primaryActionHref}
              className="rounded-full bg-aurora px-5 py-2.5 text-sm font-semibold text-ink transition hover:scale-[1.02] hover:brightness-110"
            >
              {primaryActionLabel}
            </Link>
            <Link
              to="/tiers"
              className="rounded-full border border-aurora/50 px-5 py-2.5 text-sm font-semibold text-aurora transition hover:bg-aurora/10"
            >
              View ProjectM Tiers
            </Link>
            <Link
              to={createFamilyHref}
              className="rounded-full border border-flare/40 px-5 py-2.5 text-sm text-flare transition hover:bg-flare/10"
            >
              Create Family Account
            </Link>
            <Link to={workspaceHref} className="rounded-full border border-white/25 px-5 py-2.5 text-sm text-white transition hover:bg-white/10">
              Open Workspace
            </Link>
          </div>
          <div className="mt-5 rounded-2xl border border-aurora/30 bg-aurora/10 p-4 text-xs text-mist">
            <p className="font-semibold text-aurora">Start Policy</p>
            <p className="mt-1">
              A family account is required before booking, diagnostics, messaging, or child tracking. Payment is processed after services are
              provided.
            </p>
          </div>
        </motion.div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {benefits.map((item, index) => (
          <motion.article
            key={item}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-30px" }}
            transition={{ delay: index * 0.03, duration: 0.3 }}
            whileHover={{ y: -4, scale: 1.01 }}
            className="panel rounded-2xl p-5"
          >
            <p className="text-sm leading-relaxed text-mist">{item}</p>
          </motion.article>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="panel rounded-2xl p-6">
          <h2 className="font-display text-2xl text-white">Trust and Social Proof</h2>
          <div className="mt-4 space-y-2">
            {trustSignals.map((signal) => (
              <div key={signal} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-mist">
                {signal}
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-mist">
            Contact and support: {supportContacts.phone} • @{supportContacts.instagramHandle} •{" "}
            <a href={supportContacts.discordUrl}>Discord (external)</a>
          </p>
        </article>

        <article className="panel rounded-2xl p-6">
          <h2 className="font-display text-2xl text-white">Feature Highlights</h2>
          <div className="mt-4 space-y-2">
            {featureHighlights.map((feature, index) => (
              <motion.div
                key={feature}
                initial={{ opacity: 0, x: 12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.04, duration: 0.25 }}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-mist"
              >
                {feature}
              </motion.div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <article className="panel rounded-2xl p-6 lg:col-span-2">
          <h2 className="font-display text-2xl text-white">Interactive Tier Preview</h2>
          <p className="mt-2 text-sm text-mist">Switch tracks to preview your mentorship mode and pacing.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {workModes.map((mode) => (
              <button
                key={mode.key}
                type="button"
                className={`rounded-full px-4 py-2 text-xs transition ${
                  mode.key === selectedMode ? "bg-aurora text-ink" : "border border-white/20 text-mist hover:bg-white/10"
                }`}
                onClick={() => setSelectedMode(mode.key)}
              >
                {mode.title}
              </button>
            ))}
          </div>
          <motion.div
            key={selectedModeCard.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4"
          >
            <p className="font-display text-lg text-white">{selectedModeCard.title}</p>
            <p className="mt-2 text-sm text-mist">{selectedModeCard.summary}</p>
            <ul className="mt-3 space-y-1 text-xs text-mist">
              {selectedModeCard.points.map((point) => (
                <li key={point}>• {point}</li>
              ))}
            </ul>
            <Link to={primaryActionHref} className="mt-4 inline-flex rounded-full bg-aurora px-4 py-2 text-xs font-semibold text-ink">
              Continue
            </Link>
          </motion.div>
        </article>

        <article className="panel rounded-2xl p-6">
          <h3 className="font-display text-xl text-white">Workspace Surfaces</h3>
          <div className="mt-3 space-y-2">
            {surfaceCards.map((card, index) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, x: 14 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05, duration: 0.25 }}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"
              >
                <p className="text-xs font-semibold text-white">{card.label}</p>
                <p className="mt-1 text-xs text-mist">{card.description}</p>
              </motion.div>
            ))}
          </div>
          <Link to="/workspaces" className="mt-4 inline-flex rounded-full border border-aurora/45 px-4 py-2 text-xs font-semibold text-aurora">
            View Workspace Guide
          </Link>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="panel rounded-2xl p-6">
          <h2 className="font-display text-2xl text-white">Family Onboarding Timeline</h2>
          <p className="mt-2 text-sm text-mist">Click each phase to preview what happens.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {onboardingSteps.map((step, index) => (
              <button
                key={step.title}
                type="button"
                className={`rounded-xl border px-3 py-3 text-left text-xs transition ${
                  activeStep === index
                    ? "border-aurora/60 bg-aurora/10 text-white"
                    : "border-white/10 bg-white/5 text-mist hover:bg-white/10"
                }`}
                onClick={() => setActiveStep(index)}
              >
                <p className="font-semibold">{step.title}</p>
                <p className="mt-1 text-[11px] leading-relaxed">{step.detail}</p>
              </button>
            ))}
          </div>
        </article>

        <article className="panel rounded-2xl p-6">
          <h2 className="font-display text-2xl text-white">Questions</h2>
          <div className="mt-4 space-y-2">
            {faqs.map((item, index) => (
              <div key={item.question} className="rounded-xl border border-white/10 bg-white/5">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-white"
                  onClick={() => setOpenFaq((current) => (current === index ? -1 : index))}
                >
                  {item.question}
                  <span className="text-aurora">{openFaq === index ? "−" : "+"}</span>
                </button>
                {openFaq === index ? <p className="px-4 pb-4 text-xs text-mist">{item.answer}</p> : null}
              </div>
            ))}
          </div>
        </article>
      </section>

      {tourOpen ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 grid place-items-center bg-ink/85 px-4"
        >
          <motion.article
            key={tourStepIndex}
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="panel w-full max-w-lg rounded-2xl p-6"
          >
            <p className="text-xs uppercase tracking-[0.22em] text-aurora">First-Time Tour</p>
            <h3 className="mt-2 font-display text-2xl text-white">{firstTimeTourSteps[tourStepIndex].title}</h3>
            <p className="mt-3 text-sm text-mist">{firstTimeTourSteps[tourStepIndex].detail}</p>

            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full bg-aurora"
                initial={{ width: 0 }}
                animate={{ width: `${((tourStepIndex + 1) / firstTimeTourSteps.length) * 100}%` }}
                transition={{ duration: 0.2 }}
              />
            </div>

            <div className="mt-5 flex items-center justify-between gap-2">
              <button
                type="button"
                className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-mist"
                onClick={completeTour}
              >
                Skip
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-full border border-white/20 px-3 py-1.5 text-xs"
                  onClick={() => {
                    playTap();
                    setTourStepIndex((value) => Math.max(0, value - 1));
                  }}
                  disabled={tourStepIndex === 0}
                >
                  Back
                </button>
                {tourStepIndex === firstTimeTourSteps.length - 1 ? (
                  <button type="button" className="rounded-full bg-aurora px-3 py-1.5 text-xs font-semibold text-ink" onClick={completeTour}>
                    Finish
                  </button>
                ) : (
                  <button
                    type="button"
                    className="rounded-full bg-aurora px-3 py-1.5 text-xs font-semibold text-ink"
                    onClick={() => {
                      playTap();
                      setTourStepIndex((value) => Math.min(firstTimeTourSteps.length - 1, value + 1));
                    }}
                  >
                    Next
                  </button>
                )}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                to={createFamilyHref}
                className="rounded-full border border-aurora/40 bg-aurora/10 px-3 py-1.5 text-xs font-semibold text-aurora"
                onClick={completeTour}
              >
                Create Family Account
              </Link>
              <Link to="/support" className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-mist" onClick={completeTour}>
                Contact Support
              </Link>
            </div>
          </motion.article>
        </motion.div>
      ) : null}
    </div>
  );
}
