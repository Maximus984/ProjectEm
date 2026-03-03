import { useMutation, useQuery } from "@tanstack/react-query";
import { type BookingCreateInput, projectTiers } from "@projectm/contracts";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuthStore } from "../store/auth-store";

type AvailabilityResponse = {
  date: string;
  tier: keyof typeof projectTiers;
  slots: Array<{ startTime: string; endTime: string; available: boolean }>;
};

type BookingResponse = {
  bookingId: string;
  status: string;
  verificationCode: string;
  qr: {
    token: string;
    imageDataUrl: string;
    singleUse: boolean;
  };
};

type FamilyProfileResponse = {
  familyId: string;
  name: string;
  children: Array<{ id: string; firstName: string; lastName: string; gradeLevel?: string | null }>;
  members: Array<{ userId: string; firstName: string; lastName: string; role: string; billingRole: string }>;
};

type AddChildPayload = {
  firstName: string;
  lastName: string;
  dob?: string;
  gradeLevel?: string;
};

export function BookPage() {
  const token = useAuthStore((state) => state.accessToken);
  const [searchParams] = useSearchParams();
  const action = searchParams.get("action");

  const [form, setForm] = useState<BookingCreateInput>({
    familyId: "",
    childId: "",
    tier: "PREMIUM_GENIUS",
    timezone: "America/Los_Angeles",
    date: new Date().toISOString().slice(0, 10),
    startTime: "10:00",
    endTime: "11:00",
    mode: "IN_PERSON",
    notes: "",
    requiresHardware: true,
    parentOptOutZoomIntro: false,
    couponCode: ""
  });

  const [statusLookup, setStatusLookup] = useState({ bookingId: "", code: "" });
  const [childDraft, setChildDraft] = useState({
    firstName: "",
    lastName: "",
    dob: "",
    gradeLevel: ""
  });

  const familyQuery = useQuery({
    queryKey: ["family-me", token],
    queryFn: () => api<FamilyProfileResponse>("/families/me", { token: token ?? undefined }),
    enabled: Boolean(token)
  });

  useEffect(() => {
    if (!familyQuery.data) {
      return;
    }

    setForm((prev) => ({
      ...prev,
      familyId: familyQuery.data!.familyId,
      childId: prev.childId || familyQuery.data!.children[0]?.id || ""
    }));
  }, [familyQuery.data]);

  const availabilityQuery = useQuery({
    queryKey: ["availability", form.date, form.tier, form.timezone],
    queryFn: () =>
      api<AvailabilityResponse>(
        `/availability?date=${encodeURIComponent(form.date)}&tier=${encodeURIComponent(form.tier)}&timezone=${encodeURIComponent(form.timezone)}`
      )
  });

  const addChildMutation = useMutation({
    mutationFn: (payload: AddChildPayload) =>
      api<{ childId: string }>(`/families/${form.familyId}/add-child`, {
        method: "POST",
        token: token ?? undefined,
        body: JSON.stringify(payload)
      }),
    onSuccess: () => {
      setChildDraft({ firstName: "", lastName: "", dob: "", gradeLevel: "" });
      void familyQuery.refetch();
    }
  });

  const bookingMutation = useMutation({
    mutationFn: (payload: BookingCreateInput) =>
      api<BookingResponse>("/bookings", {
        method: "POST",
        token: token ?? undefined,
        body: JSON.stringify(payload)
      })
  });

  const statusMutation = useMutation({
    mutationFn: ({ bookingId, code }: { bookingId: string; code: string }) =>
      api<{ status: string; checkedInAt: string | null }>(
        `/bookings/${bookingId}/status?code=${encodeURIComponent(code)}`
      )
  });

  const priceEstimate = useMemo(() => {
    const tierPrice = projectTiers[form.tier].pricePerHour;
    const start = Number.parseInt(form.startTime.slice(0, 2), 10);
    const end = Number.parseInt(form.endTime.slice(0, 2), 10);
    const hours = Math.max(1, end - start);
    return tierPrice * hours;
  }, [form.endTime, form.startTime, form.tier]);

  const actionContext = useMemo(() => {
    switch (action) {
      case "reschedule":
        return {
          title: "Reschedule Request",
          message: "Enter the new date/time below, then include your original booking ID in notes."
        };
      case "cancel":
        return {
          title: "Cancellation Request",
          message: "Use the status tracker with your booking ID and verification code, then submit cancellation details in notes."
        };
      case "duplicate":
        return {
          title: "Duplicate Booking Request",
          message: "Use this form to create a new booking that mirrors a previous session."
        };
      default:
        return null;
    }
  }, [action]);

  const hasChildren = (familyQuery.data?.children.length ?? 0) > 0;

  return (
    <section className="space-y-8">
      <header>
        <h1 className="font-display text-3xl text-white md:text-4xl">Family Booking Workspace</h1>
        <p className="mt-2 text-mist">
          Your family account is linked automatically. Choose a child profile and submit a mentorship booking request.
        </p>
      </header>

      {actionContext ? (
        <div className="rounded-xl border border-aurora/35 bg-aurora/10 p-4">
          <p className="text-sm font-semibold text-aurora">{actionContext.title}</p>
          <p className="mt-1 text-xs text-mist">{actionContext.message}</p>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-3">
        <article className="panel rounded-2xl p-5 xl:col-span-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl text-white">Quick Booking Widget</h2>
            <Link to="/parent" className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-mist">
              Open Parent Workspace
            </Link>
          </div>

          {familyQuery.isLoading ? <p className="text-sm text-mist">Loading family profile...</p> : null}
          {familyQuery.error ? <p className="text-sm text-red-300">{familyQuery.error.message}</p> : null}

          {!hasChildren && familyQuery.data ? (
            <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-white">No child profiles found yet. Add a child to unlock booking.</p>
              <form
                className="mt-3 grid gap-2 md:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  addChildMutation.mutate({
                    firstName: childDraft.firstName,
                    lastName: childDraft.lastName,
                    dob: childDraft.dob || undefined,
                    gradeLevel: childDraft.gradeLevel || undefined
                  });
                }}
              >
                <input
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
                  placeholder="Child first name"
                  value={childDraft.firstName}
                  onChange={(event) => setChildDraft((prev) => ({ ...prev, firstName: event.target.value }))}
                  required
                />
                <input
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
                  placeholder="Child last name"
                  value={childDraft.lastName}
                  onChange={(event) => setChildDraft((prev) => ({ ...prev, lastName: event.target.value }))}
                  required
                />
                <input
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
                  type="date"
                  value={childDraft.dob}
                  onChange={(event) => setChildDraft((prev) => ({ ...prev, dob: event.target.value }))}
                />
                <input
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
                  placeholder="Grade level"
                  value={childDraft.gradeLevel}
                  onChange={(event) => setChildDraft((prev) => ({ ...prev, gradeLevel: event.target.value }))}
                />
                <button type="submit" className="rounded-full bg-aurora px-4 py-2 text-sm font-semibold text-ink md:col-span-2">
                  {addChildMutation.isPending ? "Adding child..." : "Add Child Profile"}
                </button>
              </form>
              {addChildMutation.error ? <p className="mt-2 text-xs text-red-300">{addChildMutation.error.message}</p> : null}
            </div>
          ) : null}

          <form
            className="mt-4 grid gap-3 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              bookingMutation.mutate({
                ...form,
                couponCode: form.couponCode || undefined,
                notes: form.notes || undefined
              });
            }}
          >
            <input
              placeholder="Family ID"
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
              value={form.familyId}
              onChange={(event) => setForm((prev) => ({ ...prev, familyId: event.target.value }))}
              required
              readOnly
            />
            <select
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
              value={form.childId}
              onChange={(event) => setForm((prev) => ({ ...prev, childId: event.target.value }))}
              required
              disabled={!hasChildren}
            >
              <option value="">Select child profile</option>
              {familyQuery.data?.children.map((child) => (
                <option value={child.id} key={child.id}>
                  {child.firstName} {child.lastName}
                </option>
              ))}
            </select>

            <select
              value={form.tier}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  tier: event.target.value as BookingCreateInput["tier"],
                  requiresHardware: event.target.value === "PREMIUM_GENIUS"
                }))
              }
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
            >
              <option value="PREMIUM_GENIUS">Premium Genius ($45/hr)</option>
              <option value="BYOD_MENTORSHIP">BYOD Mentorship ($40/hr)</option>
              <option value="STANDARD_CARE">Standard Care ($32/hr)</option>
            </select>

            <select
              value={form.mode}
              onChange={(event) => setForm((prev) => ({ ...prev, mode: event.target.value as BookingCreateInput["mode"] }))}
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
            >
              <option value="IN_PERSON">In Person</option>
              <option value="VIRTUAL">Virtual</option>
            </select>

            <input
              type="date"
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
              value={form.date}
              onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
              required
            />
            <input
              placeholder="Timezone"
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
              value={form.timezone}
              onChange={(event) => setForm((prev) => ({ ...prev, timezone: event.target.value }))}
              required
            />

            <input
              type="time"
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
              value={form.startTime}
              onChange={(event) => setForm((prev) => ({ ...prev, startTime: event.target.value }))}
              required
            />
            <input
              type="time"
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
              value={form.endTime}
              onChange={(event) => setForm((prev) => ({ ...prev, endTime: event.target.value }))}
              required
            />

            <input
              placeholder="Coupon (optional)"
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
              value={form.couponCode ?? ""}
              onChange={(event) => setForm((prev) => ({ ...prev, couponCode: event.target.value }))}
            />

            <textarea
              placeholder="Session goal / notes"
              className="md:col-span-2 min-h-24 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
              value={form.notes ?? ""}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
            />

            <label className="flex items-center gap-2 text-xs text-mist">
              <input
                type="checkbox"
                checked={form.parentOptOutZoomIntro}
                onChange={(event) => setForm((prev) => ({ ...prev, parentOptOutZoomIntro: event.target.checked }))}
              />
              Opt out of intro Zoom (if policy allows)
            </label>

            <div className="md:col-span-2 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
              <span>Estimated total</span>
              <strong className="text-flare">${priceEstimate.toFixed(2)}</strong>
            </div>

            <button
              type="submit"
              className="rounded-full bg-aurora px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50"
              disabled={bookingMutation.isPending || !hasChildren}
            >
              {bookingMutation.isPending ? "Submitting..." : "Submit Booking"}
            </button>
          </form>

          {bookingMutation.isSuccess ? (
            <div className="mt-4 rounded-xl border border-aurora/40 bg-aurora/10 p-4 text-sm">
              <p>
                Booking created: <strong>{bookingMutation.data.bookingId}</strong>
              </p>
              <p className="mt-1">Verification code: {bookingMutation.data.verificationCode}</p>
              <img
                src={bookingMutation.data.qr.imageDataUrl}
                alt="Check-in QR"
                className="mt-3 h-36 w-36 rounded-md border border-white/15 bg-white p-1"
              />
            </div>
          ) : null}

          {bookingMutation.error ? <p className="mt-3 text-sm text-red-300">{bookingMutation.error.message}</p> : null}
        </article>

        <aside className="space-y-4">
          <article className="panel rounded-2xl p-5">
            <h3 className="font-display text-lg text-white">Instant Availability</h3>
            <div className="mt-3 space-y-2">
              {availabilityQuery.isLoading ? <p className="text-sm text-mist">Checking slots...</p> : null}
              {availabilityQuery.data?.slots.map((slot) => (
                <div key={slot.startTime} className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-xs">
                  <span>
                    {slot.startTime} - {slot.endTime}
                  </span>
                  <span className={slot.available ? "text-aurora" : "text-red-300"}>
                    {slot.available ? "Available" : "Booked"}
                  </span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel rounded-2xl p-5">
            <h3 className="font-display text-lg text-white">Booking Status Tracker</h3>
            <form
              className="mt-3 space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                statusMutation.mutate(statusLookup);
              }}
            >
              <input
                placeholder="Booking ID"
                className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
                value={statusLookup.bookingId}
                onChange={(event) => setStatusLookup((prev) => ({ ...prev, bookingId: event.target.value }))}
                required
              />
              <input
                placeholder="6-digit verification code"
                className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
                value={statusLookup.code}
                onChange={(event) => setStatusLookup((prev) => ({ ...prev, code: event.target.value }))}
                required
              />
              <button type="submit" className="rounded-full border border-white/25 px-4 py-2 text-xs">
                Check Status
              </button>
            </form>
            {statusMutation.data ? <p className="mt-3 text-sm text-aurora">Current status: {statusMutation.data.status}</p> : null}
            {statusMutation.error ? <p className="mt-3 text-sm text-red-300">{statusMutation.error.message}</p> : null}
          </article>
        </aside>
      </div>
    </section>
  );
}
