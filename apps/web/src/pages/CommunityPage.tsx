import { supportContacts } from "@projectm/contracts";

export function CommunityPage() {
  return (
    <section className="space-y-4">
      <h1 className="font-display text-3xl text-white md:text-4xl">Community</h1>
      <p className="max-w-2xl text-sm text-mist">
        External community channels are for inspiration and announcements. Use in-app support tickets for
        account-specific help.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <a href={supportContacts.discordUrl} className="panel rounded-2xl p-5">
          <h2 className="font-display text-xl text-white">Discord (External)</h2>
          <p className="mt-2 text-sm text-mist">Community conversations and shared wins.</p>
        </a>
        <a href={supportContacts.instagramUrl} className="panel rounded-2xl p-5">
          <h2 className="font-display text-xl text-white">Instagram (External)</h2>
          <p className="mt-2 text-sm text-mist">Visual highlights from mentorship outcomes and events.</p>
        </a>
      </div>
    </section>
  );
}
