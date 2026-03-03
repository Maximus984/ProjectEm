import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const workspaceCards = [
  {
    title: "Owner Workspace",
    description: "Pricing, coupons, IP bans, workspace-hours policy, and full admin operations.",
    href: "/login?next=%2Fworkspace",
    cta: "Open Owner Workspace"
  },
  {
    title: "Client Workspace",
    description: "Client-side status visibility, support pathways, and shared project outcomes.",
    href: "/login?next=%2Fclient",
    cta: "Open Client Workspace"
  },
  {
    title: "Parent Workspace",
    description: "Family dashboard for children, bookings, progress, attendance, and messaging.",
    href: "/login?next=%2Fparent",
    cta: "Open Parent Workspace"
  }
];

export function WorkspacesPage() {
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.25em] text-aurora">Workspace Access</p>
        <h1 className="font-display text-3xl text-white md:text-4xl">Choose Your Workspace</h1>
        <p className="max-w-2xl text-sm text-mist">
          Each role has dedicated permissions and a separate workflow surface. Sign in with the account type that
          matches your role.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        {workspaceCards.map((card, index) => (
          <motion.article
            key={card.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: index * 0.05 }}
            className="panel rounded-2xl p-5"
          >
            <h2 className="font-display text-xl text-white">{card.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-mist">{card.description}</p>
            <Link
              to={card.href}
              className="mt-4 inline-flex rounded-full border border-aurora/50 px-4 py-2 text-xs font-semibold text-aurora hover:bg-aurora/10"
            >
              {card.cta}
            </Link>
          </motion.article>
        ))}
      </div>

      <article className="panel rounded-2xl p-5">
        <h3 className="font-display text-lg text-white">Need a new family account first?</h3>
        <p className="mt-2 text-sm text-mist">
          Create a family account with your child profiles in one flow, then proceed directly to booking.
        </p>
        <Link
          to="/register?next=%2Fbook"
          className="mt-4 inline-flex rounded-full bg-aurora px-4 py-2 text-xs font-semibold text-ink hover:brightness-110"
        >
          Create Family & Book
        </Link>
      </article>
    </section>
  );
}
