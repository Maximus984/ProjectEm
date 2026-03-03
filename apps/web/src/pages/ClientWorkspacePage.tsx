import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MessagingPanel } from "../components/MessagingPanel";
import { useUiSound } from "../hooks/use-ui-sound";
import { api } from "../lib/api";
import { useAuthStore } from "../store/auth-store";

type ConversationSummaryResponse = {
  conversations: Array<{
    id: string;
    unreadCount: number;
  }>;
};

type SupportTicket = {
  id: string;
  subject: string;
  category: string;
  status: string;
  createdAt: string;
};

type SupportTicketsResponse = {
  tickets: SupportTicket[];
};

type SupportStaffResponse = {
  staff: Array<{
    id: string;
    firstName: string;
    lastName: string;
    role: string;
    isActive: boolean;
  }>;
};

type SupportTicketPayload = {
  subject: string;
  category: "ACCOUNT" | "BOOKING" | "BILLING" | "TECHNICAL" | "OTHER";
  message: string;
  contactEmail: string;
};

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

export function ClientWorkspacePage() {
  const token = useAuthStore((state) => state.accessToken);
  const email = useAuthStore((state) => state.email);
  const { playSuccess } = useUiSound();
  const [ticketForm, setTicketForm] = useState<Omit<SupportTicketPayload, "contactEmail">>({
    subject: "",
    category: "TECHNICAL",
    message: ""
  });

  const conversationsQuery = useQuery({
    queryKey: ["client-conversations", token],
    queryFn: () => api<ConversationSummaryResponse>("/conversations", { token: token ?? undefined }),
    enabled: Boolean(token),
    refetchInterval: 4000
  });

  const ticketsQuery = useQuery({
    queryKey: ["client-support-tickets", token],
    queryFn: () => api<SupportTicketsResponse>("/support/tickets", { token: token ?? undefined }),
    enabled: Boolean(token),
    refetchInterval: 6000
  });

  const supportStaffQuery = useQuery({
    queryKey: ["client-support-staff", token],
    queryFn: () => api<SupportStaffResponse>("/support/staff", { token: token ?? undefined }),
    enabled: Boolean(token)
  });

  const createTicketMutation = useMutation({
    mutationFn: (payload: SupportTicketPayload) =>
      api<{ ticketId: string; status: string }>("/support/tickets", {
        method: "POST",
        token: token ?? undefined,
        body: JSON.stringify(payload)
      }),
    onSuccess: async () => {
      playSuccess();
      setTicketForm({ subject: "", category: "TECHNICAL", message: "" });
      await ticketsQuery.refetch();
    }
  });

  const conversationMetrics = useMemo(() => {
    const items = conversationsQuery.data?.conversations ?? [];
    return {
      total: items.length,
      unread: items.reduce((sum, item) => sum + item.unreadCount, 0)
    };
  }, [conversationsQuery.data?.conversations]);

  const openTickets = useMemo(
    () => (ticketsQuery.data?.tickets ?? []).filter((ticket) => ticket.status === "OPEN").length,
    [ticketsQuery.data?.tickets]
  );

  return (
    <section className="space-y-6">
      <header className="panel relative overflow-hidden rounded-3xl px-6 py-7">
        <div className="absolute -right-16 -top-20 h-44 w-44 rounded-full bg-aurora/20 blur-3xl" />
        <div className="absolute -bottom-16 left-14 h-40 w-40 rounded-full bg-flare/15 blur-3xl" />
        <p className="section-subtitle">Client Workspace</p>
        <h1 className="mt-1 font-display text-3xl text-white md:text-4xl">Client Operations Surface</h1>
        <p className="mt-3 max-w-3xl text-sm text-mist">
          Shared workspace for project visibility, fast support, and direct communication with the ProjectM team.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <motion.article whileHover={{ y: -3 }} className="stat-card">
          <p className="text-xs uppercase tracking-[0.18em] text-mist">DM Threads</p>
          <p className="mt-2 font-display text-3xl text-white">{conversationMetrics.total}</p>
        </motion.article>
        <motion.article whileHover={{ y: -3 }} className="stat-card">
          <p className="text-xs uppercase tracking-[0.18em] text-mist">Unread Messages</p>
          <p className="mt-2 font-display text-3xl text-aurora">{conversationMetrics.unread}</p>
        </motion.article>
        <motion.article whileHover={{ y: -3 }} className="stat-card">
          <p className="text-xs uppercase tracking-[0.18em] text-mist">Open Tickets</p>
          <p className="mt-2 font-display text-3xl text-flare">{openTickets}</p>
        </motion.article>
        <motion.article whileHover={{ y: -3 }} className="stat-card">
          <p className="text-xs uppercase tracking-[0.18em] text-mist">Active Staff</p>
          <p className="mt-2 font-display text-3xl text-white">
            {(supportStaffQuery.data?.staff ?? []).filter((member) => member.isActive).length}
          </p>
        </motion.article>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <article className="panel rounded-2xl p-5">
          <h2 className="section-heading">Client Quick Actions</h2>
          <p className="section-subtitle">Bookings, tiers, and support links</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Link to="/book" className="rounded-xl border border-aurora/35 bg-aurora/10 px-3 py-2 text-xs text-aurora">
              Submit Booking Request
            </Link>
            <Link to="/tiers" className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs text-white">
              Review Tier Pricing
            </Link>
            <Link to="/support" className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs text-white">
              Open Support Center
            </Link>
            <Link to="/community" className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs text-white">
              External Community Links
            </Link>
          </div>
        </article>

        <article className="panel rounded-2xl p-5">
          <h2 className="section-heading">Create Support Ticket</h2>
          <p className="section-subtitle">Secure account-specific issues in-app</p>
          <form
            className="mt-4 space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!email) {
                return;
              }
              createTicketMutation.mutate({
                ...ticketForm,
                contactEmail: email
              });
            }}
          >
            <input
              className="input-shell w-full px-3 py-2 text-sm"
              placeholder="Subject"
              value={ticketForm.subject}
              onChange={(event) => setTicketForm((prev) => ({ ...prev, subject: event.target.value }))}
              required
            />
            <select
              className="input-shell w-full px-3 py-2 text-sm"
              value={ticketForm.category}
              onChange={(event) =>
                setTicketForm((prev) => ({
                  ...prev,
                  category: event.target.value as SupportTicketPayload["category"]
                }))
              }
            >
              <option value="ACCOUNT">Account</option>
              <option value="BOOKING">Booking</option>
              <option value="BILLING">Billing</option>
              <option value="TECHNICAL">Technical</option>
              <option value="OTHER">Other</option>
            </select>
            <textarea
              className="input-shell min-h-28 w-full px-3 py-2 text-sm"
              placeholder="Describe your issue..."
              value={ticketForm.message}
              onChange={(event) => setTicketForm((prev) => ({ ...prev, message: event.target.value }))}
              required
            />
            <button
              className="button-primary px-4 py-2 text-xs disabled:opacity-40"
              type="submit"
              disabled={createTicketMutation.isPending || !email}
            >
              {createTicketMutation.isPending ? "Submitting..." : "Submit Ticket"}
            </button>
            {!email ? <p className="text-xs text-red-300">Account email missing. Please log in again.</p> : null}
            {createTicketMutation.error ? <p className="text-xs text-red-300">{createTicketMutation.error.message}</p> : null}
          </form>
        </article>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <article className="panel rounded-2xl p-5">
          <h2 className="section-heading">Recent Support Tickets</h2>
          <p className="section-subtitle">Status visibility for your client account</p>
          <div className="panel-scroll mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
            {(ticketsQuery.data?.tickets ?? []).slice(0, 8).map((ticket) => (
              <div key={ticket.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-white">{ticket.subject}</p>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] ${
                      ticket.status === "OPEN"
                        ? "border-aurora/40 bg-aurora/10 text-aurora"
                        : "border-white/20 bg-white/5 text-mist"
                    }`}
                  >
                    {ticket.status}
                  </span>
                </div>
                <p className="mt-1 text-mist">{ticket.category}</p>
                <p className="mt-1 text-[11px] text-mist">{formatShortDate(ticket.createdAt)}</p>
              </div>
            ))}
            {!ticketsQuery.data?.tickets.length ? <p className="text-xs text-mist">No tickets yet.</p> : null}
          </div>
        </article>

        <article className="panel rounded-2xl p-5">
          <h2 className="section-heading">Available Staff</h2>
          <p className="section-subtitle">Owner, managers, mentors, and support staff</p>
          <div className="panel-scroll mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
            {(supportStaffQuery.data?.staff ?? []).map((staff) => (
              <div key={staff.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs">
                <p className="font-semibold text-white">
                  {staff.firstName} {staff.lastName}
                </p>
                <p className="mt-1 text-mist">{staff.role}</p>
                <p className={`mt-1 text-[11px] ${staff.isActive ? "text-aurora" : "text-mist"}`}>
                  {staff.isActive ? "Active" : "Inactive"}
                </p>
              </div>
            ))}
            {!supportStaffQuery.data?.staff.length ? <p className="text-xs text-mist">No staff directory data yet.</p> : null}
          </div>
        </article>
      </div>

      <MessagingPanel
        token={token}
        role="CLIENT"
        title="Client Support Messages"
        allowedTypes={["SUPPORT"]}
        defaultConversationType="SUPPORT"
      />
    </section>
  );
}
