export function PrivacyPage() {
  return (
    <section className="space-y-4">
      <h1 className="font-display text-3xl text-white md:text-4xl">Privacy & Data Rights</h1>
      <p className="max-w-3xl text-sm leading-7 text-mist">
        We protect your family's data with end-to-end best practices: encryption, passkeys, audit logs,
        strict role isolation, and monitored infrastructure. ProjectM supports GDPR/CCPA-style export/delete
        request flows and logs all privileged access for traceability.
      </p>
      <div className="panel rounded-2xl p-5 text-sm text-mist">
        <p>Data controls available in the platform:</p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>Request data export for family records and progress artifacts.</li>
          <li>Request deletion subject to legal and billing retention policies.</li>
          <li>Review login history and authorized devices.</li>
          <li>Control child page public visibility and publishing approvals.</li>
        </ul>
      </div>
    </section>
  );
}
