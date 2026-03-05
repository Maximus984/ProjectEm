import { isAdminRole, isFamilyRole, supportContacts } from "@projectm/contracts";
import { Link, NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { useUiSound } from "../hooks/use-ui-sound";
import { SUPPORT_CONTEXT_EVENT, type SupportContextPayload } from "../lib/support-context";
import { useAuthStore } from "../store/auth-store";

const links = [
  ["/", "Home"],
  ["/workspaces", "Workspaces"],
  ["/diagnostic", "Diagnostic"],
  ["/classroom", "Classroom"],
  ["/book", "Book"],
  ["/tiers", "Tiers"],
  ["/support", "Support"],
  ["/community", "Community"]
] as const;

const BASE_URL = import.meta.env.BASE_URL;

type DeferredPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type SupportContextState = {
  title: string;
  message: string;
  source: "api" | "runtime";
  endpoint?: string;
  status?: number;
  timestamp: string;
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const role = useAuthStore((state) => state.role);
  const clearSession = useAuthStore((state) => state.clear);
  const location = useLocation();
  const { enabled: soundEnabled, toggle: toggleSound, playTap, playRoute } = useUiSound();
  const [installPrompt, setInstallPrompt] = useState<DeferredPromptEvent | null>(null);
  const [supportContext, setSupportContext] = useState<SupportContextState | null>(null);
  const hasPlayedRouteSoundRef = useRef(false);
  const lastSupportSignatureRef = useRef<{ signature: string; at: number } | null>(null);

  const showSupportContext = useCallback((payload: SupportContextPayload) => {
    const normalized: SupportContextState = {
      title: payload.title?.trim() || "Support Needed",
      message: payload.message?.trim() || "An unexpected error occurred.",
      source: payload.source ?? "runtime",
      endpoint: payload.endpoint,
      status: payload.status,
      timestamp: payload.timestamp ?? new Date().toISOString()
    };

    const signature = `${normalized.source}|${normalized.endpoint ?? ""}|${normalized.status ?? ""}|${normalized.message}`;
    const now = Date.now();
    if (lastSupportSignatureRef.current && lastSupportSignatureRef.current.signature === signature && now - lastSupportSignatureRef.current.at < 4000) {
      return;
    }

    lastSupportSignatureRef.current = { signature, at: now };
    setSupportContext(normalized);
  }, []);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as DeferredPromptEvent);
    };
    const onAppInstalled = () => {
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt as EventListener);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt as EventListener);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (!hasPlayedRouteSoundRef.current) {
      hasPlayedRouteSoundRef.current = true;
      return;
    }
    playRoute();
  }, [location.pathname, location.search, playRoute]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target) {
        return;
      }
      const actionable = target.closest("button,a,[role='button'],input[type='submit']");
      if (actionable) {
        playTap();
      }
    };

    window.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("click", onClick, true);
    };
  }, [playTap]);

  useEffect(() => {
    const onSupportContext = (event: Event) => {
      const customEvent = event as CustomEvent<SupportContextPayload>;
      if (!customEvent.detail) {
        return;
      }
      showSupportContext(customEvent.detail);
    };

    window.addEventListener(SUPPORT_CONTEXT_EVENT, onSupportContext as EventListener);
    return () => {
      window.removeEventListener(SUPPORT_CONTEXT_EVENT, onSupportContext as EventListener);
    };
  }, [showSupportContext]);

  useEffect(() => {
    const onWindowError = (event: ErrorEvent) => {
      if (!event.message) {
        return;
      }
      showSupportContext({
        title: "Runtime Error",
        message: event.message,
        source: "runtime"
      });
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "An unexpected async error occurred.";
      showSupportContext({
        title: "Unhandled Promise Error",
        message,
        source: "runtime"
      });
    };

    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, [showSupportContext]);

  useEffect(() => {
    if (!supportContext) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSupportContext(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [supportContext]);

  const portalHref = role
      ? isAdminRole(role)
        ? "/workspace"
        : role === "CLIENT"
          ? "/client"
        : isFamilyRole(role)
          ? "/parent"
          : "/dashboard"
    : null;
  const supportPhoneHref = `tel:${supportContacts.phone.replace(/[^\d+]/g, "")}`;

  return (
    <div className="relative min-h-screen overflow-hidden">
      <video
        className="bg-video"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
      >
        <source src={`${BASE_URL}media/galaxy-loop.mp4`} type="video/mp4" />
      </video>
      <div className="bg-video-overlay" />
      <div className="grid-stars" />
      <div className="twinkle-layer" />

      <header className="sticky top-0 z-30 border-b border-white/10 bg-ink/80 backdrop-blur-xl">
        <nav className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold tracking-wide text-white md:gap-3">
            <img
              src={`${BASE_URL}branding/maxx-forge-logo.png`}
              alt="Project Paige by MAXX Forge Studio logo"
              className="h-11 w-11 rounded-xl border border-white/20 bg-black/30 object-contain p-1 shadow-glow md:h-12 md:w-12"
            />
            <span className="flex flex-col leading-tight">
              <span className="font-display text-sm text-white md:text-base">Project Paige</span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-aurora/90">
                Elite Mentorship Childcare • ProjectM Framework
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-2 overflow-x-auto md:gap-3">
            {links.map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-full px-3 py-1.5 text-xs md:text-sm ${
                    isActive ? "bg-nova text-white shadow-[0_0_0_1px_rgba(142,165,196,.25)]" : "text-mist hover:bg-white/10"
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
            {portalHref ? (
              <Link className="button-secondary whitespace-nowrap px-3 py-1.5 text-xs text-white" to={portalHref}>
                Workspace
              </Link>
            ) : null}
            <button
              className="button-secondary whitespace-nowrap border-white/30 px-3 py-1.5 text-xs text-mist"
              type="button"
              onClick={toggleSound}
            >
              {soundEnabled ? "Sound On" : "Sound Off"}
            </button>
            {installPrompt ? (
              <button
                className="button-secondary whitespace-nowrap border-flare/50 px-3 py-1.5 text-xs text-flare"
                type="button"
                onClick={async () => {
                  await installPrompt.prompt();
                  await installPrompt.userChoice;
                  setInstallPrompt(null);
                }}
              >
                Install App
              </button>
            ) : null}
            {role ? (
              <button
                className="button-secondary whitespace-nowrap border-aurora/60 px-3 py-1.5 text-xs text-aurora"
                onClick={clearSession}
                type="button"
              >
                Logout
              </button>
            ) : (
              <Link className="button-secondary whitespace-nowrap border-aurora/60 px-3 py-1.5 text-xs text-aurora" to="/login">
                Login
              </Link>
            )}
          </div>
        </nav>
      </header>

      <motion.main
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-10"
      >
        {children}
      </motion.main>

      <footer className="mx-auto mt-10 w-full max-w-6xl border-t border-white/10 px-4 py-6 text-xs text-mist md:px-6">
        <p>
          External community channels - <a href={supportContacts.discordUrl}>Discord</a> and{" "}
          <a href={supportContacts.instagramUrl}>Instagram</a>. Use in-app support for account-specific help.
        </p>
        <p className="mt-2">Project Paige by MAXX FORGE STUDIO | Support: {supportContacts.phone} | @{supportContacts.instagramHandle}</p>
      </footer>

      {supportContext ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 px-4 py-6 backdrop-blur-md">
          <section className="panel w-full max-w-2xl rounded-2xl border border-red-300/35 p-5 md:p-6">
            <p className="text-[11px] uppercase tracking-[0.2em] text-red-200/90">Context Support Screen</p>
            <h2 className="mt-2 font-display text-2xl text-white">{supportContext.title}</h2>
            <p className="mt-3 text-sm text-mist">{supportContext.message}</p>

            <div className="mt-4 rounded-xl border border-white/15 bg-black/25 p-3 text-xs text-mist">
              <p>Source: {supportContext.source}</p>
              {supportContext.endpoint ? <p className="break-all">Endpoint: {supportContext.endpoint}</p> : null}
              {supportContext.status ? <p>Status: {supportContext.status}</p> : null}
              <p>Detected: {new Date(supportContext.timestamp).toLocaleString()}</p>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <a href={supportPhoneHref} className="button-secondary border-aurora/50 px-3 py-2 text-center text-xs text-aurora">
                Call {supportContacts.phone}
              </a>
              <a
                href={supportContacts.instagramUrl}
                target="_blank"
                rel="noreferrer"
                className="button-secondary border-white/25 px-3 py-2 text-center text-xs text-white"
              >
                Instagram @{supportContacts.instagramHandle}
              </a>
              <a
                href={supportContacts.discordUrl}
                target="_blank"
                rel="noreferrer"
                className="button-secondary border-white/25 px-3 py-2 text-center text-xs text-white"
              >
                Discord Channel
              </a>
              <Link
                to="/support"
                onClick={() => setSupportContext(null)}
                className="button-secondary border-flare/40 px-3 py-2 text-center text-xs text-flare"
              >
                Open Support Center
              </Link>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="button-secondary border-white/30 px-3 py-1.5 text-xs text-mist"
                onClick={() => setSupportContext(null)}
              >
                Close
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
