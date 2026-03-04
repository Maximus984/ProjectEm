import { motion } from "framer-motion";

type QGatePageProps = {
  message: string;
};

export function QGatePage({ message }: QGatePageProps) {
  return (
    <section className="relative min-h-screen overflow-hidden bg-[#05070f] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,60,120,0.2),transparent_35%),radial-gradient(circle_at_80%_12%,rgba(34,211,238,0.17),transparent_35%),radial-gradient(circle_at_50%_80%,rgba(132,204,22,0.1),transparent_40%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-25 [background:repeating-linear-gradient(0deg,rgba(255,255,255,0.12)_0px,rgba(255,255,255,0.12)_1px,transparent_1px,transparent_3px)]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center gap-6 px-6 text-center">
        <motion.p
          className="rounded-full border border-cyan-300/40 bg-cyan-300/10 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-cyan-200"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
        >
          Q Gate Active
        </motion.p>

        <div className="relative">
          <motion.h1
            className="font-display text-5xl font-semibold uppercase tracking-[0.12em] text-white md:text-7xl"
            animate={{
              x: [0, 1, -1, 0],
              opacity: [1, 0.95, 1]
            }}
            transition={{ duration: 0.24, repeat: Infinity, repeatDelay: 1.8 }}
          >
            SYSTEM GLITCH
          </motion.h1>
          <motion.h1
            aria-hidden
            className="pointer-events-none absolute inset-0 font-display text-5xl font-semibold uppercase tracking-[0.12em] text-cyan-300/70 md:text-7xl"
            animate={{ x: [-2, 3, -1], y: [0, -1, 1], opacity: [0, 0.8, 0] }}
            transition={{ duration: 0.22, repeat: Infinity, repeatDelay: 2.4 }}
          >
            SYSTEM GLITCH
          </motion.h1>
          <motion.h1
            aria-hidden
            className="pointer-events-none absolute inset-0 font-display text-5xl font-semibold uppercase tracking-[0.12em] text-rose-400/70 md:text-7xl"
            animate={{ x: [2, -3, 1], y: [0, 1, -1], opacity: [0, 0.7, 0] }}
            transition={{ duration: 0.2, repeat: Infinity, repeatDelay: 2.6 }}
          >
            SYSTEM GLITCH
          </motion.h1>
        </div>

        <motion.p
          className="max-w-2xl rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-sm text-slate-100/95 md:text-base"
          initial={{ opacity: 0.5 }}
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          {message}
        </motion.p>

        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          Owner maintenance mode. Please check back soon.
        </p>
      </div>
    </section>
  );
}
