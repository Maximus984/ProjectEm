import { useMutation } from "@tanstack/react-query";
import { supportContacts, type SupportTicketInput } from "@projectm/contracts";
import { useState } from "react";
import { api } from "../lib/api";

export function SupportPage() {
  const [form, setForm] = useState<SupportTicketInput>({
    subject: "",
    category: "ACCOUNT",
    message: "",
    contactEmail: ""
  });

  const mutation = useMutation({
    mutationFn: (payload: SupportTicketInput) =>
      api<{ ticketId: string }>("/support/tickets", {
        method: "POST",
        body: JSON.stringify(payload)
      })
  });

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-white md:text-4xl">Support</h1>
        <p className="mt-2 text-mist">Account-specific help belongs here, not in public channels.</p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <article className="panel rounded-2xl p-5">
          <h2 className="font-display text-xl text-white">Contact Channels</h2>
          <ul className="mt-4 space-y-2 text-sm text-mist">
            <li>Phone: {supportContacts.phone}</li>
            <li>
              Instagram: <a href={supportContacts.instagramUrl}>@{supportContacts.instagramHandle}</a>
            </li>
            <li>
              Discord: <a href={supportContacts.discordUrl}>Community channel</a> (external)
            </li>
          </ul>
          <p className="mt-4 text-xs text-mist">
            External community channels are not for account-specific issues.
          </p>
        </article>

        <article className="panel rounded-2xl p-5">
          <h2 className="font-display text-xl text-white">Contact Support</h2>
          <form
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              mutation.mutate(form);
            }}
          >
            <input
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
              placeholder="Subject"
              value={form.subject}
              onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))}
              required
            />
            <select
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
              value={form.category}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  category: event.target.value as SupportTicketInput["category"]
                }))
              }
            >
              <option value="ACCOUNT">Account</option>
              <option value="BOOKING">Booking</option>
              <option value="BILLING">Billing</option>
              <option value="TECHNICAL">Technical</option>
              <option value="OTHER">Other</option>
            </select>
            <input
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
              placeholder="Contact email"
              type="email"
              value={form.contactEmail}
              onChange={(event) => setForm((prev) => ({ ...prev, contactEmail: event.target.value }))}
              required
            />
            <textarea
              className="min-h-28 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
              placeholder="Describe your issue"
              value={form.message}
              onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
              required
            />
            <button
              type="submit"
              className="rounded-full bg-aurora px-4 py-2 text-sm font-semibold text-ink"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Submitting..." : "Submit Ticket"}
            </button>
            {mutation.isSuccess ? <p className="text-xs text-aurora">Ticket submitted successfully.</p> : null}
            {mutation.error ? <p className="text-xs text-red-300">{mutation.error.message}</p> : null}
          </form>
        </article>
      </div>
    </section>
  );
}
