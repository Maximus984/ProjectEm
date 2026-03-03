import { isAdminRole, isFamilyRole, supportContacts } from "@projectm/contracts";
import { Link, NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useUiSound } from "../hooks/use-ui-sound";
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

type DeferredPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const role = useAuthStore((state) => state.role);
  const clearSession = useAuthStore((state) => state.clear);
  const location = useLocation();
  const { enabled: soundEnabled, toggle: toggleSound, playTap, playRoute } = useUiSound();
  const [installPrompt, setInstallPrompt] = useState<DeferredPromptEvent | null>(null);
  const hasPlayedRouteSoundRef = useRef(false);

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

  const portalHref = role
      ? isAdminRole(role)
        ? "/workspace"
        : role === "CLIENT"
          ? "/client"
        : isFamilyRole(role)
          ? "/parent"
          : "/dashboard"
    : null;

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
        <source src="/media/galaxy-loop.mp4" type="video/mp4" />
      </video>
      <div className="bg-video-overlay" />
      <div className="grid-stars" />
      <div className="twinkle-layer" />

      <header className="sticky top-0 z-30 border-b border-white/10 bg-ink/80 backdrop-blur-xl">
        <nav className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold tracking-wide text-white md:gap-3">
            <img
              src="/branding/maxx-forge-logo.png"
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
    </div>
  );
}
