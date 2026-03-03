import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";

export type ConversationType = "PARENT_MENTOR" | "PARENT_ADMIN" | "CHILD_MENTOR" | "SUPPORT";

type ConversationItem = {
  id: string;
  type: ConversationType;
  familyId: string | null;
  childId: string | null;
  mentorId: string | null;
  updatedAt: string;
  unreadCount: number;
  lastMessage: {
    id: string;
    body: string;
    createdAt: string;
    senderId: string;
    senderName: string;
    senderRole: string;
  } | null;
};

type MessageItem = {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  body: string;
  attachments: unknown;
  isRead: boolean;
  readAt: string | null;
  flagged: boolean;
  createdAt: string;
};

type ChildOption = {
  id: string;
  label: string;
};

type FamilyScopeOption = {
  familyId: string;
  familyName: string;
  children: ChildOption[];
};

type MessagingPanelProps = {
  token: string | null;
  role: string | null;
  title?: string;
  initialFamilyId?: string | null;
  childOptions?: ChildOption[];
  adminFamilyScopes?: FamilyScopeOption[];
  allowedTypes?: ConversationType[];
  defaultConversationType?: ConversationType;
};

const conversationTypeOptions: Array<{ value: ConversationType; label: string }> = [
  { value: "PARENT_ADMIN", label: "Parent <> Admin" },
  { value: "PARENT_MENTOR", label: "Parent <> Mentor" },
  { value: "CHILD_MENTOR", label: "Child <> Mentor" },
  { value: "SUPPORT", label: "Support" }
];

const conversationTypeLabel: Record<ConversationType, string> = {
  PARENT_ADMIN: "Parent <> Admin",
  PARENT_MENTOR: "Parent <> Mentor",
  CHILD_MENTOR: "Child <> Mentor",
  SUPPORT: "Support"
};

function decodeTokenUserId(token: string | null): string | null {
  if (!token) {
    return null;
  }

  try {
    const parts = token.split(".");
    if (parts.length < 2) {
      return null;
    }
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

export function MessagingPanel({
  token,
  role,
  title = "Direct Messages",
  initialFamilyId = null,
  childOptions = [],
  adminFamilyScopes = [],
  allowedTypes,
  defaultConversationType
}: MessagingPanelProps) {
  const queryClient = useQueryClient();
  const currentUserId = useMemo(() => decodeTokenUserId(token), [token]);
  const notificationSupported = typeof window !== "undefined" && "Notification" in window;
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    notificationSupported ? Notification.permission : "denied"
  );

  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [composer, setComposer] = useState("");
  const [newConversationType, setNewConversationType] = useState<ConversationType>(
    defaultConversationType ?? "PARENT_ADMIN"
  );
  const [conversationFamilyId, setConversationFamilyId] = useState(initialFamilyId ?? "");
  const [conversationChildId, setConversationChildId] = useState("");
  const lastSeenMessageIdRef = useRef<Record<string, string>>({});

  const isAdminScope = (role ?? "") === "OWNER" || (role ?? "") === "MANAGER" || (role ?? "") === "MEDIUM" || (role ?? "") === "MONITOR" || (role ?? "") === "ADMIN";
  const allowedTypeSet = useMemo(
    () =>
      new Set<ConversationType>(
        (allowedTypes?.length ? allowedTypes : conversationTypeOptions.map((item) => item.value)) as ConversationType[]
      ),
    [allowedTypes]
  );
  const selectableTypeOptions = useMemo(
    () => conversationTypeOptions.filter((item) => allowedTypeSet.has(item.value)),
    [allowedTypeSet]
  );
  const activeChildOptions = useMemo(() => {
    if (!isAdminScope) {
      return childOptions;
    }
    const family = adminFamilyScopes.find((item) => item.familyId === conversationFamilyId);
    return family?.children ?? [];
  }, [adminFamilyScopes, childOptions, conversationFamilyId, isAdminScope]);

  const conversationsQuery = useQuery({
    queryKey: ["dm-conversations", token],
    queryFn: () => api<{ conversations: ConversationItem[] }>("/conversations", { token: token ?? undefined }),
    enabled: Boolean(token),
    refetchInterval: 3000
  });
  const selectedConversation = useMemo(
    () => conversationsQuery.data?.conversations.find((item) => item.id === selectedConversationId) ?? null,
    [conversationsQuery.data?.conversations, selectedConversationId]
  );

  useEffect(() => {
    if (allowedTypeSet.has(newConversationType)) {
      return;
    }
    setNewConversationType(selectableTypeOptions[0]?.value ?? "SUPPORT");
  }, [allowedTypeSet, newConversationType, selectableTypeOptions]);

  useEffect(() => {
    if (!selectedConversationId && conversationsQuery.data?.conversations.length) {
      setSelectedConversationId(conversationsQuery.data.conversations[0].id);
    }
  }, [conversationsQuery.data, selectedConversationId]);

  const messagesQuery = useQuery({
    queryKey: ["dm-messages", selectedConversationId, token],
    queryFn: () =>
      api<{ conversationId: string; messages: MessageItem[] }>(`/conversations/${selectedConversationId}/messages`, {
        token: token ?? undefined
      }),
    enabled: Boolean(token && selectedConversationId),
    refetchInterval: 2000
  });

  const createConversationMutation = useMutation({
    mutationFn: () =>
      api<ConversationItem>("/conversations", {
        method: "POST",
        token: token ?? undefined,
        body: JSON.stringify({
          type: newConversationType,
          familyId: conversationFamilyId || undefined,
          childId: conversationChildId || undefined
        })
      }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["dm-conversations"] });
      setSelectedConversationId(created.id);
      setComposer("");
    }
  });

  const sendMessageMutation = useMutation({
    mutationFn: () =>
      api<MessageItem>(`/conversations/${selectedConversationId}/messages`, {
        method: "POST",
        token: token ?? undefined,
        body: JSON.stringify({
          body: composer.trim(),
          attachments: []
        })
      }),
    onSuccess: async () => {
      setComposer("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dm-conversations"] }),
        queryClient.invalidateQueries({ queryKey: ["dm-messages", selectedConversationId] })
      ]);
    }
  });

  const markReadMutation = useMutation({
    mutationFn: () =>
      api<{ ok: boolean }>(`/conversations/${selectedConversationId}/read`, {
        method: "POST",
        token: token ?? undefined,
        body: JSON.stringify({})
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dm-conversations"] });
    }
  });

  useEffect(() => {
    if (!selectedConversationId || !messagesQuery.data?.messages.length || !currentUserId) {
      return;
    }

    const hasUnreadIncoming = messagesQuery.data.messages.some(
      (message) => !message.isRead && message.senderId !== currentUserId
    );

    if (hasUnreadIncoming && !markReadMutation.isPending) {
      markReadMutation.mutate();
    }
  }, [currentUserId, markReadMutation, messagesQuery.data, selectedConversationId]);

  useEffect(() => {
    if (!notificationSupported || notificationPermission !== "granted" || !selectedConversationId) {
      return;
    }

    const latest = messagesQuery.data?.messages[messagesQuery.data.messages.length - 1];
    if (!latest) {
      return;
    }

    const previous = lastSeenMessageIdRef.current[selectedConversationId];
    if (!previous) {
      lastSeenMessageIdRef.current[selectedConversationId] = latest.id;
      return;
    }

    if (previous !== latest.id && latest.senderId !== currentUserId) {
      new Notification(`New DM from ${latest.senderName}`, {
        body: latest.body.slice(0, 120)
      });
    }

    lastSeenMessageIdRef.current[selectedConversationId] = latest.id;
  }, [currentUserId, messagesQuery.data, notificationPermission, notificationSupported, selectedConversationId]);

  return (
    <article className="panel rounded-2xl p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="section-heading">{title}</h3>
          <p className="section-subtitle">Realtime direct messaging and notifications</p>
        </div>
        <button
          type="button"
          className="button-secondary px-3 py-1 text-xs text-mist disabled:opacity-50"
          onClick={async () => {
            if (!notificationSupported) {
              return;
            }
            const permission = await Notification.requestPermission();
            setNotificationPermission(permission);
          }}
          disabled={!notificationSupported || notificationPermission === "granted"}
        >
          {notificationPermission === "granted" ? "Notifications On" : "Enable Notifications"}
        </button>
      </div>

      <div className="grid gap-3 rounded-xl border border-white/10 bg-white/5 p-3 md:grid-cols-4">
        <select
          className="input-shell px-3 py-2 text-xs"
          value={newConversationType}
          onChange={(event) => setNewConversationType(event.target.value as ConversationType)}
          disabled={selectableTypeOptions.length <= 1}
        >
          {selectableTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          className="input-shell px-3 py-2 text-xs"
          value={conversationFamilyId}
          onChange={(event) => {
            setConversationFamilyId(event.target.value);
            setConversationChildId("");
          }}
          disabled={!isAdminScope && !initialFamilyId}
        >
          {isAdminScope ? <option value="">No family scope</option> : null}
          {isAdminScope
            ? adminFamilyScopes.map((family) => (
                <option key={family.familyId} value={family.familyId}>
                  {family.familyName}
                </option>
              ))
            : initialFamilyId
              ? [
                  <option key={initialFamilyId} value={initialFamilyId}>
                    Current Family
                  </option>
                ]
              : [<option key="none" value="">No family</option>]}
        </select>

        <select
          className="input-shell px-3 py-2 text-xs"
          value={conversationChildId}
          onChange={(event) => setConversationChildId(event.target.value)}
        >
          <option value="">No child scope</option>
          {activeChildOptions.map((child) => (
            <option key={child.id} value={child.id}>
              {child.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="button-primary px-3 py-2 text-xs disabled:opacity-50"
          onClick={() => createConversationMutation.mutate()}
          disabled={createConversationMutation.isPending}
        >
          {createConversationMutation.isPending ? "Creating..." : "New Conversation"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="panel-scroll max-h-[22rem] space-y-2 overflow-y-auto pr-1 md:col-span-1">
          {conversationsQuery.data?.conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              className={`w-full rounded-xl border px-3 py-2 text-left text-xs ${
                selectedConversationId === conversation.id
                  ? "border-aurora/50 bg-aurora/10"
                  : "border-white/10 bg-white/5"
              }`}
              onClick={() => setSelectedConversationId(conversation.id)}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-white">{conversationTypeLabel[conversation.type]}</p>
                {conversation.unreadCount ? <span className="chip text-aurora">{conversation.unreadCount} new</span> : null}
              </div>
              <p className="mt-1 truncate text-mist">{conversation.lastMessage?.body || "No messages yet."}</p>
              <p className="mt-1 text-[10px] text-mist">{formatMessageTime(conversation.updatedAt)}</p>
            </button>
          ))}
          {!conversationsQuery.data?.conversations.length ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-mist">
              No conversations yet. Start one using the controls above.
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-3 md:col-span-2">
          <div className="mb-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-mist">
            {selectedConversation
              ? `${conversationTypeLabel[selectedConversation.type]} ${
                  selectedConversation.unreadCount ? `• ${selectedConversation.unreadCount} unread` : "• up to date"
                }`
              : "Select a conversation to open messages"}
          </div>

          <div className="panel-scroll max-h-64 space-y-2 overflow-y-auto pr-1">
            {messagesQuery.data?.messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-lg border px-3 py-2 text-xs ${
                  message.senderId === currentUserId ? "border-aurora/40 bg-aurora/10" : "border-white/10 bg-white/5"
                }`}
              >
                <p className="text-[10px] uppercase tracking-[0.12em] text-aurora">
                  {message.senderName} • {message.senderRole}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-mist">{message.body}</p>
                <p className="mt-1 text-[10px] text-mist/80">{formatMessageTime(message.createdAt)}</p>
              </div>
            ))}
            {!messagesQuery.data?.messages.length ? <p className="text-xs text-mist">No messages yet.</p> : null}
          </div>

          <div className="mt-3 flex gap-2">
            <input
              className="input-shell w-full px-3 py-2 text-xs"
              placeholder="Type a direct message..."
              value={composer}
              onChange={(event) => setComposer(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (composer.trim() && selectedConversationId) {
                    sendMessageMutation.mutate();
                  }
                }
              }}
              disabled={!selectedConversationId}
            />
            <button
              type="button"
              className="button-primary px-4 py-2 text-xs disabled:opacity-50"
              onClick={() => sendMessageMutation.mutate()}
              disabled={!selectedConversationId || !composer.trim() || sendMessageMutation.isPending}
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {createConversationMutation.error ? <p className="mt-3 text-xs text-red-300">{createConversationMutation.error.message}</p> : null}
      {sendMessageMutation.error ? <p className="mt-2 text-xs text-red-300">{sendMessageMutation.error.message}</p> : null}
      {conversationsQuery.error ? <p className="mt-2 text-xs text-red-300">{conversationsQuery.error.message}</p> : null}
      {messagesQuery.error ? <p className="mt-2 text-xs text-red-300">{messagesQuery.error.message}</p> : null}
    </article>
  );
}
