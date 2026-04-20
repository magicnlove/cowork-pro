"use client";

import clsx from "clsx";
import dayjs from "dayjs";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { AttachmentList } from "@/components/files/attachment-list";
import { fetchJson } from "@/lib/fetch-json";
import type { ChatMessageDTO, PinnedMessageDTO } from "@/types/chat";

type Me = {
  id: string;
  email: string;
  name: string;
  role: string;
  departmentId?: string | null;
  departmentName?: string | null;
};

type ChannelListItem = {
  id: string;
  slug: string;
  kind: "dm" | "company_wide" | "department" | "cross_team" | "group_dm";
  name: string;
  displayName: string;
  unreadCount: number;
};

type OrgUser = {
  id: string;
  name: string;
  email: string;
  departmentName?: string | null;
  departmentPath?: string | null;
};

type ChannelMember = OrgUser & { role: "host" | "member" };

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🎉"] as const;

function notifyStorageKey(channelId: string) {
  return `chat:notify:${channelId}`;
}

function readNotifyEnabled(channelId: string): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  return window.localStorage.getItem(notifyStorageKey(channelId)) !== "off";
}

function setNotifyEnabled(channelId: string, enabled: boolean) {
  window.localStorage.setItem(notifyStorageKey(channelId), enabled ? "on" : "off");
}

const SLASH_COMMANDS: { id: string; label: string; description: string; apply: () => string }[] = [
  {
    id: "help",
    label: "/help",
    description: "사용 가능한 슬래시 커맨드 안내",
    apply: () => "/help"
  },
  {
    id: "who",
    label: "/who",
    description: "이 채널 참여자 보기(예정)",
    apply: () => "/who"
  },
  {
    id: "shrug",
    label: "/shrug",
    description: "어깨를 으쓱하는 이모티콘 삽입",
    apply: () => "¯\\_(ツ)_/¯"
  }
];

function normalizeMsg(m: ChatMessageDTO): ChatMessageDTO {
  return {
    ...m,
    attachments: m.attachments ?? [],
    reactions: m.reactions ?? []
  };
}

function mergeMessage(list: ChatMessageDTO[], incoming: ChatMessageDTO): ChatMessageDTO[] {
  const inc = normalizeMsg(incoming);
  const idx = list.findIndex((m) => m.id === inc.id);
  if (idx === -1) {
    return [...list, inc].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  const next = list.slice();
  next[idx] = inc;
  return next;
}

function bodyDisplayText(body: string): string {
  return body.replace(/\u200b/g, "").trim();
}

function formatOrgUserLabel(u: OrgUser): string {
  const path = u.departmentPath || u.departmentName || "미지정 조직";
  return `${path}  ${u.name}`;
}

function buildUserLookupUrl(query: string, departmentId?: string | null): string {
  const q = query.trim();
  if (q) {
    return `/api/users?q=${encodeURIComponent(q)}`;
  }
  if (departmentId) {
    return `/api/users?departmentId=${encodeURIComponent(departmentId)}`;
  }
  return "/api/users";
}

function MessageBubble({
  message,
  isMine,
  continuedFromPrev,
  focused,
  onOpenThread,
  showThreadCta,
  canThread,
  editing,
  editDraft,
  onEditDraft,
  onSaveEdit,
  onCancelEdit,
  showActions,
  onToggleReaction,
  onDelete,
  onStartEdit,
  onOpenCalendar,
  onPin,
  isPinned,
  showPinInMenu,
  menuOpen,
  onToggleMenu
}: {
  message: ChatMessageDTO;
  isMine: boolean;
  continuedFromPrev: boolean;
  focused: boolean;
  onOpenThread: () => void;
  showThreadCta: boolean;
  canThread: boolean;
  editing: boolean;
  editDraft: string;
  onEditDraft: (v: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  showActions: boolean;
  onToggleReaction: (emoji: string) => void;
  onDelete: () => void;
  onStartEdit: () => void;
  onOpenCalendar: () => void;
  onPin: () => void;
  isPinned: boolean;
  showPinInMenu: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
}) {
  const time = dayjs(message.createdAt).format("A h:mm");
  const deleted = Boolean(message.deletedAt);
  const showIdentity = !continuedFromPrev;

  return (
    <div
      data-message-id={message.id}
      className={clsx(
        "group relative flex gap-3 px-4 hover:bg-black/[0.03]",
        showIdentity ? "py-1.5" : "py-0.5",
        isMine && "flex-row-reverse",
        focused && "bg-amber-50/70 ring-2 ring-amber-300"
      )}
    >
      {showIdentity ? (
        <div
          className={clsx(
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white",
            isMine ? "bg-brand-600" : "bg-slate-400"
          )}
        >
          {message.userName.slice(0, 2)}
        </div>
      ) : (
        <div className="h-0 w-9 shrink-0" />
      )}
      <div className={clsx("min-w-0 max-w-[min(640px,100%)]", isMine && "text-right")}>
        {editing ? (
          <div className="mt-1 flex flex-col gap-2 text-left">
            <textarea
              value={editDraft}
              onChange={(e) => onEditDraft(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-brand-200 focus:border-brand-500 focus:ring-2"
            />
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-md bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700"
                onClick={onSaveEdit}
              >
                저장
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-200 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
                onClick={onCancelEdit}
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          <>
            <div
              className={clsx(
                "relative inline-block max-w-full whitespace-pre-wrap break-words text-[16px] leading-relaxed",
                showIdentity ? "mt-1.5" : "mt-0.5",
                deleted
                  ? "italic text-slate-400"
                  : isMine
                    ? "rounded-2xl border border-brand-300/55 bg-brand-100 px-3 py-2 text-slate-900 shadow-sm"
                    : "rounded-2xl border border-slate-200/95 bg-white px-3 py-2 text-slate-900 shadow-sm"
              )}
            >
              {!deleted ? (
                <span
                  className={clsx(
                    "mb-1 block text-[10px] font-medium text-slate-500",
                    isMine ? "text-right" : "text-left"
                  )}
                >
                  {showIdentity ? `${message.userName} · ${time}` : time}
                  {message.editedAt ? " · 편집됨" : ""}
                </span>
              ) : null}
              {deleted
                ? "삭제된 메시지입니다"
                : bodyDisplayText(message.body) || (message.attachments?.length ? null : message.body)}
            </div>
            {!deleted && (message.attachments?.length ?? 0) > 0 ? (
              <div className={clsx(isMine && "flex justify-end")}>
                <AttachmentList attachments={message.attachments ?? []} compact />
              </div>
            ) : null}
          </>
        )}

        {!deleted && !editing && (message.reactions ?? []).length > 0 ? (
          <div className={clsx("mt-1 flex flex-wrap gap-1", isMine && "justify-end")}>
            {(message.reactions ?? []).map((r) => (
              <button
                key={r.emoji}
                type="button"
                onClick={() => onToggleReaction(r.emoji)}
                className={clsx(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition",
                  r.self
                    ? "border-brand-300 bg-brand-50 text-brand-800"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                )}
              >
                <span>{r.emoji}</span>
                <span>{r.count}</span>
              </button>
            ))}
          </div>
        ) : null}

        {!message.parentMessageId && canThread && showThreadCta && !deleted && !editing ? (
          <button
            type="button"
            onClick={onOpenThread}
            className="mt-1 text-xs font-medium text-brand-600 opacity-80 hover:underline group-hover:opacity-100"
          >
            스레드에 답글
          </button>
        ) : null}
      </div>

      {showActions && !editing ? (
        <div
          data-chat-msg-menu
          className={clsx(
            "pointer-events-none absolute top-1 flex gap-0.5 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100",
            isMine ? "left-4" : "right-4"
          )}
        >
          {!deleted ? (
            <>
              <button
                type="button"
                title="일정에 추가"
                onClick={onOpenCalendar}
                className="rounded-md border border-slate-200 bg-white p-1 text-sm shadow-sm hover:bg-slate-50"
              >
                📅
              </button>
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  title={`${emoji} 반응`}
                  onClick={() => onToggleReaction(emoji)}
                  className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-sm shadow-sm hover:bg-slate-50"
                >
                  {emoji}
                </button>
              ))}
              {isMine || showPinInMenu ? (
                <div className="relative">
                  <button
                    type="button"
                    title="더보기"
                    className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleMenu();
                    }}
                    data-chat-msg-menu
                  >
                    ⋮
                  </button>
                  {menuOpen ? (
                    <div className="absolute right-0 z-20 mt-1 min-w-[140px] rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                      {showPinInMenu ? (
                        <button
                          type="button"
                          className="block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-50"
                          onClick={() => {
                            onPin();
                            onToggleMenu();
                          }}
                        >
                          {isPinned ? "고정 해제" : "고정"}
                        </button>
                      ) : null}
                      {isMine ? (
                        <>
                          <button
                            type="button"
                            className="block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-50"
                            onClick={() => {
                              onStartEdit();
                              onToggleMenu();
                            }}
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            className="block w-full px-3 py-1.5 text-left text-xs text-rose-600 hover:bg-rose-50"
                            onClick={() => {
                              onDelete();
                              onToggleMenu();
                            }}
                          >
                            삭제
                          </button>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function ChatWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [me, setMe] = useState<Me | null>(null);
  const [channels, setChannels] = useState<ChannelListItem[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [focusedMessageId, setFocusedMessageId] = useState<string | null>(null);
  const [mainMessages, setMainMessages] = useState<ChatMessageDTO[]>([]);
  const [threadRoot, setThreadRoot] = useState<ChatMessageDTO | null>(null);
  const [threadMessages, setThreadMessages] = useState<ChatMessageDTO[]>([]);

  const [mainDraft, setMainDraft] = useState("");
  const [threadDraft, setThreadDraft] = useState("");
  const [mainFiles, setMainFiles] = useState<File[]>([]);
  const [threadFiles, setThreadFiles] = useState<File[]>([]);
  const mainFileInputRef = useRef<HTMLInputElement | null>(null);
  const threadFileInputRef = useRef<HTMLInputElement | null>(null);
  const [slashOpen, setSlashOpen] = useState(false);
  const [socketError, setSocketError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const [pins, setPins] = useState<PinnedMessageDTO[]>([]);
  const [pinIdsByMessage, setPinIdsByMessage] = useState<Record<string, string>>({});

  const [notifyMap, setNotifyMap] = useState<Record<string, boolean>>({});

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchHits, setSearchHits] = useState<
    { id: string; body: string; createdAt: string; userName: string }[]
  >([]);

  const [calModal, setCalModal] = useState<ChatMessageDTO | null>(null);
  const [calTitle, setCalTitle] = useState("");
  const [calStart, setCalStart] = useState("");
  const [calEnd, setCalEnd] = useState("");
  const [calAttendeeQuery, setCalAttendeeQuery] = useState("");
  const [calAttendeeCandidates, setCalAttendeeCandidates] = useState<OrgUser[]>([]);
  const [calSelectedAttendees, setCalSelectedAttendees] = useState<OrgUser[]>([]);

  const [dmOpen, setDmOpen] = useState(false);
  const [dmName, setDmName] = useState("");
  const [dmQuery, setDmQuery] = useState("");
  const [dmUsers, setDmUsers] = useState<OrgUser[]>([]);
  const [dmSelected, setDmSelected] = useState<OrgUser[]>([]);

  const [xtOpen, setXtOpen] = useState(false);
  const [xtName, setXtName] = useState("");
  const [xtQuery, setXtQuery] = useState("");
  const [xtUsers, setXtUsers] = useState<OrgUser[]>([]);
  const [xtSelected, setXtSelected] = useState<OrgUser[]>([]);

  const [membersOpen, setMembersOpen] = useState(false);
  const [channelMembers, setChannelMembers] = useState<ChannelMember[]>([]);
  const [memberQuery, setMemberQuery] = useState("");
  const [memberPick, setMemberPick] = useState<OrgUser[]>([]);
  const [memberSelected, setMemberSelected] = useState<OrgUser[]>([]);

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; channelId: string } | null>(null);
  const [openMessageMenuId, setOpenMessageMenuId] = useState<string | null>(null);

  const mainInputRef = useRef<HTMLTextAreaElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const threadListRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const selectedChannelIdRef = useRef<string | null>(null);
  const threadRootRef = useRef<ChatMessageDTO | null>(null);
  const prevJoinedChannelRef = useRef<string | null>(null);
  const pendingFocusRef = useRef<{ channelId: string; messageId: string } | null>(null);

  useEffect(() => {
    selectedChannelIdRef.current = selectedChannelId;
  }, [selectedChannelId]);

  useEffect(() => {
    const channelId = searchParams.get("channelId");
    const focusMessageId = searchParams.get("focusMessageId");
    if (channelId) {
      pendingFocusRef.current = focusMessageId ? { channelId, messageId: focusMessageId } : null;
      setSelectedChannelId(channelId);
    }
  }, [searchParams]);

  useEffect(() => {
    threadRootRef.current = threadRoot;
  }, [threadRoot]);

  const loadChannels = useCallback(async () => {
    const data = await fetchJson<{ channels: ChannelListItem[] }>("/api/chat/channels");
    setChannels(data.channels);
    const nm: Record<string, boolean> = {};
    for (const c of data.channels) {
      nm[c.id] = readNotifyEnabled(c.id);
    }
    setNotifyMap(nm);
    return data.channels;
  }, []);

  const loadChannelsRef = useRef(loadChannels);
  loadChannelsRef.current = loadChannels;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchJson<{ user: Me }>("/api/chat/me");
        if (!cancelled) {
          setMe(data.user);
        }
      } catch {
        void 0;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const chs = await loadChannels();
        if (!cancelled && chs.length > 0) {
          setSelectedChannelId((prev) => prev ?? chs[0].id);
        }
      } catch {
        void 0;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadChannels]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const el = e.target;
      if (!(el instanceof Element)) {
        return;
      }
      if (el.closest("[data-chat-msg-menu]")) {
        return;
      }
      setOpenMessageMenuId(null);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  useEffect(() => {
    const socket = io({
      path: "/socket.io/",
      withCredentials: true,
      transports: ["websocket", "polling"]
    });
    socketRef.current = socket;

    socket.on("connect", () => setSocketError(null));
    socket.on("connect_error", () => {
      setSocketError("실시간 연결에 실패했습니다. 로그인 후 다시 시도해주세요.");
    });

    socket.on("chat:message", (raw: ChatMessageDTO) => {
      const message = normalizeMsg(raw);
      const current = selectedChannelIdRef.current;
      if (message.channelId !== current) {
        setChannels((prev) =>
          prev.map((c) => {
            if (c.id !== message.channelId) {
              return c;
            }
            if (typeof window !== "undefined" && localStorage.getItem(notifyStorageKey(c.id)) === "off") {
              return c;
            }
            return { ...c, unreadCount: c.unreadCount + 1 };
          })
        );
        return;
      }

      if (message.parentMessageId) {
        const root = threadRootRef.current;
        if (root && message.parentMessageId === root.id) {
          setThreadMessages((prev) => mergeMessage(prev, message));
        }
        return;
      }

      setMainMessages((prev) => mergeMessage(prev, message));
    });

    socket.on("chat:message:update", (raw: ChatMessageDTO) => {
      const message = normalizeMsg(raw);
      if (message.channelId !== selectedChannelIdRef.current) {
        return;
      }
      if (message.parentMessageId) {
        const root = threadRootRef.current;
        if (root && message.parentMessageId === root.id) {
          setThreadMessages((prev) => mergeMessage(prev, message));
        }
        return;
      }
      setMainMessages((prev) => mergeMessage(prev, message));
    });

    /** 다른 채널은 소켓 룸에 조인되어 있지 않아 `chat:message`를 못 받음 — 서버가 브로드캐스트하는 `chat:notify`로 목록·미읽음 동기화 */
    socket.on("chat:notify", () => {
      void loadChannelsRef.current();
    });

    return () => {
      socket.removeAllListeners();
      socket.close();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    const socket = socketRef.current;
    const channelId = selectedChannelId;
    if (!socket || !channelId) {
      return;
    }

    setMainMessages([]);
    setEditingId(null);
    setPins([]);
    setPinIdsByMessage({});

    const prev = prevJoinedChannelRef.current;
    if (prev && prev !== channelId) {
      socket.emit("chat:leave", prev);
    }

    socket.emit("chat:join", channelId, () => {});
    prevJoinedChannelRef.current = channelId;

    let cancelled = false;
    void (async () => {
      try {
        await fetchJson(`/api/chat/channels/${encodeURIComponent(channelId)}/read`, {
          method: "POST"
        });
        await loadChannels();
        if (cancelled) {
          return;
        }
        const pending = pendingFocusRef.current;
        const around =
          pending && pending.channelId === channelId
            ? `&aroundMessageId=${encodeURIComponent(pending.messageId)}`
            : "";
        const data = await fetchJson<{ messages: ChatMessageDTO[]; focusMessageId?: string }>(
          `/api/chat/messages?channelId=${encodeURIComponent(channelId)}${around}`
        );
        const pinsData = await fetchJson<{ pins: PinnedMessageDTO[] }>(
          `/api/chat/channels/${encodeURIComponent(channelId)}/pins`
        );
        if (!cancelled) {
          setMainMessages(data.messages);
          setPins(pinsData.pins);
          const map: Record<string, string> = {};
          for (const p of pinsData.pins) {
            map[p.messageId] = p.pinId;
          }
          setPinIdsByMessage(map);

          if (pending && pending.channelId === channelId) {
            pendingFocusRef.current = null;
            setFocusedMessageId(pending.messageId);
            requestAnimationFrame(() => scrollToMessage(pending.messageId));
            window.setTimeout(() => setFocusedMessageId(null), 2500);
          }
        }
      } catch {
        void 0;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedChannelId, loadChannels]);

  useEffect(() => {
    setThreadRoot(null);
    setThreadMessages([]);
    setThreadDraft("");
    setThreadFiles([]);
  }, [selectedChannelId]);

  useEffect(() => {
    const root = threadRoot;
    const channelId = selectedChannelId;
    if (!root || !channelId) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchJson<{ messages: ChatMessageDTO[] }>(
          `/api/chat/messages?channelId=${encodeURIComponent(channelId)}&threadRootId=${encodeURIComponent(root.id)}`
        );
        if (!cancelled) {
          setThreadMessages(data.messages);
        }
      } catch {
        void 0;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [threadRoot, selectedChannelId]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) {
      return;
    }
    if (pendingFocusRef.current) {
      return;
    }
    if (focusedMessageId) {
      return;
    }
    el.scrollTop = el.scrollHeight;
  }, [mainMessages, selectedChannelId]);

  useEffect(() => {
    const el = threadListRef.current;
    if (!el) {
      return;
    }
    el.scrollTop = el.scrollHeight;
  }, [threadMessages, threadRoot]);

  const selectedChannel = useMemo(
    () => channels.find((c) => c.id === selectedChannelId) ?? null,
    [channels, selectedChannelId]
  );

  const isHostOrElevated = useMemo(() => {
    if (!me) {
      return false;
    }
    if (me.role === "admin" || me.role === "manager") {
      return true;
    }
    if (!selectedChannel || (selectedChannel.kind !== "group_dm" && selectedChannel.kind !== "cross_team")) {
      return false;
    }
    return channelMembers.some((m) => m.id === me.id && m.role === "host");
  }, [me, selectedChannel, channelMembers]);

  const canCreateCrossTeam = useMemo(
    () => Boolean(me && (me.role === "admin" || me.role === "manager")),
    [me]
  );

  const canPin = useMemo(() => {
    if (!me || !selectedChannel) {
      return false;
    }
    if (me.role === "admin" || me.role === "manager") {
      return true;
    }
    if (selectedChannel.kind === "cross_team" || selectedChannel.kind === "group_dm") {
      return channelMembers.some((m) => m.id === me.id && m.role === "host");
    }
    return false;
  }, [me, selectedChannel, channelMembers]);

  useEffect(() => {
    const ch = selectedChannel;
    if (!ch || (ch.kind !== "group_dm" && ch.kind !== "cross_team")) {
      setChannelMembers([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchJson<{ members: ChannelMember[] }>(
          `/api/chat/channels/${encodeURIComponent(ch.id)}/members`
        );
        if (!cancelled) {
          setChannelMembers(data.members);
        }
      } catch {
        void 0;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedChannel]);

  const filteredSlash = useMemo(() => {
    if (!slashOpen) {
      return [];
    }
    const q = mainDraft.slice(1).toLowerCase();
    return SLASH_COMMANDS.filter((c) => c.label.toLowerCase().startsWith(`/${q}`) || `/${q}` === c.label);
  }, [mainDraft, slashOpen]);

  const updateMainDraft = useCallback((value: string) => {
    setMainDraft(value);
    const show =
      value.startsWith("/") && !value.slice(1).includes(" ") && value.indexOf("\n") === -1;
    setSlashOpen(show);
  }, []);

  const sendViaSocket = useCallback(
    (body: string, parentMessageId: string | null) => {
      const cid = selectedChannelIdRef.current;
      const socket = socketRef.current;
      if (!cid || !socket) {
        return;
      }
      const trimmed = body.trim();
      if (!trimmed) {
        return;
      }

      socket.emit(
        "chat:message",
        { channelId: cid, body: trimmed, parentMessageId },
        (ack: { ok?: boolean; code?: string } | undefined) => {
          if (ack && ack.ok === false) {
            setSocketError("메시지 전송에 실패했습니다.");
          }
        }
      );
    },
    []
  );

  const handleSendMain = useCallback(async () => {
    const cid = selectedChannelIdRef.current;
    if (!cid) {
      return;
    }
    const text = mainDraft.trim();
    if (!text && mainFiles.length === 0) {
      return;
    }
    if (mainFiles.length > 0) {
      const fd = new FormData();
      fd.append("channelId", cid);
      fd.append("body", text);
      for (const f of mainFiles) {
        fd.append("files", f);
      }
      try {
        const res = await fetch("/api/chat/messages", {
          method: "POST",
          body: fd,
          credentials: "include"
        });
        const data = (await res.json()) as { message: unknown };
        if (res.status === 401) {
          window.location.assign("/");
          return;
        }
        if (!res.ok) {
          setSocketError(
            typeof data.message === "string" ? data.message : "전송에 실패했습니다."
          );
          return;
        }
        const msg = data.message as ChatMessageDTO;
        setMainMessages((prev) => mergeMessage(prev, msg));
        setMainFiles([]);
        setMainDraft("");
        setSlashOpen(false);
      } catch {
        setSocketError("전송에 실패했습니다.");
      }
      return;
    }
    sendViaSocket(mainDraft, null);
    setMainDraft("");
    setSlashOpen(false);
  }, [mainDraft, mainFiles, sendViaSocket]);

  const handleSendThread = useCallback(async () => {
    const root = threadRootRef.current;
    if (!root) {
      return;
    }
    const cid = selectedChannelIdRef.current;
    if (!cid) {
      return;
    }
    const text = threadDraft.trim();
    if (!text && threadFiles.length === 0) {
      return;
    }
    if (threadFiles.length > 0) {
      const fd = new FormData();
      fd.append("channelId", cid);
      fd.append("body", text);
      fd.append("parentMessageId", root.id);
      for (const f of threadFiles) {
        fd.append("files", f);
      }
      try {
        const res = await fetch("/api/chat/messages", {
          method: "POST",
          body: fd,
          credentials: "include"
        });
        const data = (await res.json()) as { message: unknown };
        if (res.status === 401) {
          window.location.assign("/");
          return;
        }
        if (!res.ok) {
          setSocketError(
            typeof data.message === "string" ? data.message : "전송에 실패했습니다."
          );
          return;
        }
        const msg = data.message as ChatMessageDTO;
        setThreadMessages((prev) => mergeMessage(prev, msg));
        setThreadFiles([]);
        setThreadDraft("");
      } catch {
        setSocketError("전송에 실패했습니다.");
      }
      return;
    }
    sendViaSocket(threadDraft, root.id);
    setThreadDraft("");
  }, [threadDraft, threadFiles, sendViaSocket]);

  const onToggleReaction = useCallback(
    async (message: ChatMessageDTO, emoji: string) => {
      try {
        const { message: updated } = await fetchJson<{ message: ChatMessageDTO }>(
          `/api/chat/messages/${encodeURIComponent(message.id)}/reactions`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ emoji })
          }
        );
        if (updated.parentMessageId) {
          setThreadMessages((prev) => mergeMessage(prev, updated));
        } else {
          setMainMessages((prev) => mergeMessage(prev, updated));
        }
      } catch (e) {
        setSocketError(e instanceof Error ? e.message : "반응 처리에 실패했습니다.");
      }
    },
    []
  );

  const onDeleteMessage = useCallback(async (message: ChatMessageDTO) => {
    if (!window.confirm("이 메시지를 삭제할까요?")) {
      return;
    }
    try {
      const { message: updated } = await fetchJson<{ message: ChatMessageDTO }>(
        `/api/chat/messages/${encodeURIComponent(message.id)}`,
        { method: "DELETE" }
      );
      if (updated.parentMessageId) {
        setThreadMessages((prev) => mergeMessage(prev, updated));
      } else {
        setMainMessages((prev) => mergeMessage(prev, updated));
      }
    } catch (e) {
      setSocketError(e instanceof Error ? e.message : "삭제에 실패했습니다.");
    }
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId) {
      return;
    }
    const body = editDraft.trim();
    if (!body) {
      return;
    }
    try {
      const { message: updated } = await fetchJson<{ message: ChatMessageDTO }>(
        `/api/chat/messages/${encodeURIComponent(editingId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body })
        }
      );
      setEditingId(null);
      if (updated.parentMessageId) {
        setThreadMessages((prev) => mergeMessage(prev, updated));
      } else {
        setMainMessages((prev) => mergeMessage(prev, updated));
      }
    } catch (e) {
      setSocketError(e instanceof Error ? e.message : "수정에 실패했습니다.");
    }
  }, [editingId, editDraft]);

  const togglePin = useCallback(
    async (message: ChatMessageDTO) => {
      const pid = pinIdsByMessage[message.id];
      try {
        if (pid) {
          await fetchJson(`/api/chat/pins/${encodeURIComponent(pid)}`, { method: "DELETE" });
        } else {
          const res = await fetchJson<{ pinId: string | null }>(
            `/api/chat/messages/${encodeURIComponent(message.id)}/pin`,
            { method: "POST" }
          );
          if (res.pinId) {
            setPinIdsByMessage((prev) => ({ ...prev, [message.id]: res.pinId! }));
          }
        }
        if (!selectedChannelId) {
          return;
        }
        const pinsData = await fetchJson<{ pins: PinnedMessageDTO[] }>(
          `/api/chat/channels/${encodeURIComponent(selectedChannelId)}/pins`
        );
        setPins(pinsData.pins);
        const map: Record<string, string> = {};
        for (const p of pinsData.pins) {
          map[p.messageId] = p.pinId;
        }
        setPinIdsByMessage(map);
      } catch (e) {
        setSocketError(e instanceof Error ? e.message : "고정 처리에 실패했습니다.");
      }
    },
    [pinIdsByMessage, selectedChannelId]
  );

  const openCalendar = useCallback((message: ChatMessageDTO) => {
    const start = dayjs().add(1, "hour").startOf("hour");
    const end = start.add(1, "hour");
    setCalTitle(message.deletedAt ? "" : message.body.slice(0, 500));
    setCalStart(start.format("YYYY-MM-DDTHH:mm"));
    setCalEnd(end.format("YYYY-MM-DDTHH:mm"));
    setCalAttendeeQuery("");
    setCalSelectedAttendees([]);
    setCalAttendeeCandidates([]);
    setCalModal(message);
  }, []);

  const saveCalendar = useCallback(async () => {
    if (!calModal || !calTitle.trim()) {
      return;
    }
    const attendeeIds = calSelectedAttendees.map((u) => u.id);
    try {
      await fetchJson("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: calTitle.trim(),
          description: null,
          startsAt: new Date(calStart).toISOString(),
          endsAt: new Date(calEnd).toISOString(),
          kind: "personal",
          attendeeUserIds: attendeeIds
        })
      });
      setCalModal(null);
      router.refresh();
    } catch (e) {
      setSocketError(e instanceof Error ? e.message : "일정 저장에 실패했습니다.");
    }
  }, [calModal, calTitle, calStart, calEnd, calSelectedAttendees, router]);

  const runSearch = useCallback(async () => {
    if (!selectedChannelId || !searchQ.trim()) {
      return;
    }
    setSearchLoading(true);
    try {
      const data = await fetchJson<{
        results: { id: string; body: string; createdAt: string; userName: string }[];
      }>(
        `/api/chat/search?channelId=${encodeURIComponent(selectedChannelId)}&q=${encodeURIComponent(searchQ.trim())}`
      );
      setSearchHits(data.results);
    } catch (e) {
      setSocketError(e instanceof Error ? e.message : "검색에 실패했습니다.");
    } finally {
      setSearchLoading(false);
    }
  }, [selectedChannelId, searchQ]);

  const scrollToMessage = useCallback((id: string) => {
    const el = document.querySelector(`[data-message-id="${id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setSearchOpen(false);
  }, []);

  useEffect(() => {
    if (!dmOpen) {
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        try {
          const q = dmQuery.trim();
          const data = await fetchJson<{ users: OrgUser[] }>(buildUserLookupUrl(q, me?.departmentId));
          setDmUsers(data.users.filter((u) => u.id !== me?.id));
        } catch {
          void 0;
        }
      })();
    }, 200);
    return () => clearTimeout(t);
  }, [dmQuery, dmOpen, me?.id]);

  useEffect(() => {
    if (!xtOpen) {
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        try {
          const q = xtQuery.trim();
          const data = await fetchJson<{ users: OrgUser[] }>(buildUserLookupUrl(q, me?.departmentId));
          setXtUsers(data.users.filter((u) => u.id !== me?.id));
        } catch {
          void 0;
        }
      })();
    }, 200);
    return () => clearTimeout(t);
  }, [xtQuery, xtOpen, me?.id]);

  useEffect(() => {
    if (!membersOpen) {
      setMemberSelected([]);
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        try {
          const q = memberQuery.trim();
          const data = await fetchJson<{ users: OrgUser[] }>(buildUserLookupUrl(q, me?.departmentId));
          setMemberPick(data.users.filter((u) => u.id !== me?.id));
        } catch {
          void 0;
        }
      })();
    }, 350);
    return () => clearTimeout(t);
  }, [memberQuery, membersOpen, me?.id]);

  const selectableMemberPick = useMemo(
    () => memberPick.filter((u) => !channelMembers.some((m) => m.id === u.id)),
    [memberPick, channelMembers]
  );
  const allVisibleMembersSelected =
    selectableMemberPick.length > 0 &&
    selectableMemberPick.every((u) => memberSelected.some((p) => p.id === u.id));

  useEffect(() => {
    if (!calModal) {
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        try {
          const q = calAttendeeQuery.trim();
          const data = await fetchJson<{ users: OrgUser[] }>(buildUserLookupUrl(q, me?.departmentId));
          setCalAttendeeCandidates(data.users.filter((u) => u.id !== me?.id));
        } catch {
          void 0;
        }
      })();
    }, 200);
    return () => clearTimeout(t);
  }, [calAttendeeQuery, calModal, me?.id]);

  const createDm = useCallback(async () => {
    if (dmSelected.length === 0) {
      return;
    }
    try {
      const res = await fetchJson<{ channelId: string }>("/api/chat/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: dmName.trim() || undefined,
          memberUserIds: dmSelected.map((u) => u.id)
        })
      });
      setDmOpen(false);
      setDmName("");
      setDmSelected([]);
      const chs = await loadChannels();
      setSelectedChannelId(res.channelId);
      if (chs.every((c) => c.id !== res.channelId)) {
        await loadChannels();
      }
    } catch (e) {
      setSocketError(e instanceof Error ? e.message : "채팅방을 만들지 못했습니다.");
    }
  }, [dmName, dmSelected, loadChannels]);

  const createXt = useCallback(async () => {
    if (!xtName.trim()) {
      return;
    }
    try {
      const res = await fetchJson<{ channelId: string }>("/api/chat/cross-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: xtName.trim(),
          memberUserIds: xtSelected.map((u) => u.id)
        })
      });
      setXtOpen(false);
      setXtName("");
      setXtSelected([]);
      await loadChannels();
      setSelectedChannelId(res.channelId);
    } catch (e) {
      setSocketError(e instanceof Error ? e.message : "채널을 만들지 못했습니다.");
    }
  }, [xtName, xtSelected, loadChannels]);

  const patchMembers = useCallback(
    async (add: string[], remove: string[]) => {
      if (!selectedChannelId) {
        return;
      }
      try {
        await fetchJson(`/api/chat/channels/${encodeURIComponent(selectedChannelId)}/members`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ addUserIds: add, removeUserIds: remove })
        });
        const data = await fetchJson<{ members: ChannelMember[] }>(
          `/api/chat/channels/${encodeURIComponent(selectedChannelId)}/members`
        );
        setChannelMembers(data.members);
      } catch (e) {
        setSocketError(e instanceof Error ? e.message : "멤버를 변경하지 못했습니다.");
      }
    },
    [selectedChannelId]
  );

  const leaveChannel = useCallback(async () => {
    if (!selectedChannelId || !selectedChannel) {
      return;
    }
    if (!window.confirm("이 채팅방에서 나갈까요?")) {
      return;
    }
    try {
      await fetchJson(`/api/chat/channels/${encodeURIComponent(selectedChannelId)}/leave`, {
        method: "POST"
      });
      const chs = await loadChannels();
      setSelectedChannelId(chs[0]?.id ?? null);
    } catch (e) {
      setSocketError(e instanceof Error ? e.message : "나가기에 실패했습니다.");
    }
  }, [selectedChannel, selectedChannelId, loadChannels]);

  const deleteChannel = useCallback(async () => {
    if (!selectedChannelId) {
      return;
    }
    if (!window.confirm("채널을 삭제할까요? 되돌릴 수 없습니다.")) {
      return;
    }
    try {
      await fetchJson(`/api/chat/channels/${encodeURIComponent(selectedChannelId)}`, {
        method: "DELETE"
      });
      const chs = await loadChannels();
      setSelectedChannelId(chs[0]?.id ?? null);
    } catch (e) {
      setSocketError(e instanceof Error ? e.message : "삭제에 실패했습니다.");
    }
  }, [selectedChannelId, loadChannels]);

  const toggleNotify = useCallback((channelId: string) => {
    const next = !(notifyMap[channelId] ?? readNotifyEnabled(channelId));
    setNotifyEnabled(channelId, next);
    setNotifyMap((prev) => ({ ...prev, [channelId]: next }));
    setCtxMenu(null);
  }, [notifyMap]);

  const channelGroups = useMemo(() => {
    const company = channels.filter((c) => c.kind === "company_wide");
    const dept = channels.filter((c) => c.kind === "department");
    const cross = channels.filter((c) => c.kind === "cross_team");
    const dms = channels.filter((c) => c.kind === "dm" || c.kind === "group_dm");
    return { company, dept, cross, dms };
  }, [channels]);

  const renderChannelButton = (ch: ChannelListItem) => {
    const active = ch.id === selectedChannelId;
    const notifyOn = notifyMap[ch.id] ?? readNotifyEnabled(ch.id);
    const badge =
      notifyOn && ch.unreadCount > 0 ? (
        <span className="ml-auto min-w-[1.1rem] rounded-full bg-rose-500 px-1.5 text-center text-[10px] font-bold text-white">
          {ch.unreadCount > 99 ? "99+" : ch.unreadCount}
        </span>
      ) : null;
    return (
      <div key={ch.id} className="flex w-full items-center gap-1">
        <button
          type="button"
          onClick={() => setSelectedChannelId(ch.id)}
          onContextMenu={(e) => {
            e.preventDefault();
            setCtxMenu({ x: e.clientX, y: e.clientY, channelId: ch.id });
          }}
          className={clsx(
            "flex min-w-0 flex-1 items-center rounded-md px-2 py-1.5 text-left text-sm transition",
            active
              ? "bg-white font-semibold text-slate-900 shadow-sm"
              : "text-slate-700 hover:bg-white/80"
          )}
        >
          <span className="mr-2 shrink-0 text-slate-400">{ch.kind === "dm" || ch.kind === "group_dm" ? "●" : "#"}</span>
          <span className="truncate">{ch.displayName}</span>
          {badge}
        </button>
        <button
          type="button"
          title="채널 설정"
          className="shrink-0 rounded px-1 text-xs text-slate-400 hover:bg-slate-200"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const r = e.currentTarget.getBoundingClientRect();
            setCtxMenu({ x: r.left, y: r.bottom + 4, channelId: ch.id });
          }}
        >
          ⚙
        </button>
      </div>
    );
  };

  return (
    <div className="card-brand flex min-h-0 min-w-0 flex-1 gap-0 rounded-2xl">
      {ctxMenu ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30 cursor-default bg-transparent"
            aria-label="닫기"
            onClick={() => setCtxMenu(null)}
          />
          <div
            className="fixed z-40 min-w-[180px] rounded-md border border-slate-200 bg-white py-1 shadow-lg"
            style={{
              left: Math.min(ctxMenu.x, (typeof window !== "undefined" ? window.innerWidth : 400) - 200),
              top: ctxMenu.y
            }}
          >
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-xs hover:bg-slate-50"
              onClick={() => toggleNotify(ctxMenu.channelId)}
            >
              {notifyMap[ctxMenu.channelId] ?? readNotifyEnabled(ctxMenu.channelId) ? "알림 끄기" : "알림 켜기"}
            </button>
          </div>
        </>
      ) : null}

      <aside className="flex w-[280px] shrink-0 flex-col border-r border-slate-200 bg-[#fafbfa]">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">채널</p>
          {canCreateCrossTeam ? (
            <div className="flex gap-1">
              <button
                type="button"
                className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => setXtOpen(true)}
              >
                크로스팀 +
              </button>
            </div>
          ) : null}
        </div>
        <nav className="flex-1 space-y-3 overflow-y-auto px-2 py-3">
          {channelGroups.company.length > 0 ? (
            <div>
              <p className="mb-1 px-2 text-[11px] font-semibold text-slate-400">전사</p>
              <div className="space-y-1">{channelGroups.company.map(renderChannelButton)}</div>
            </div>
          ) : null}
          {channelGroups.dept.length > 0 ? (
            <div>
              <p className="mb-1 px-2 text-[11px] font-semibold text-slate-400">부서</p>
              <div className="space-y-1">{channelGroups.dept.map(renderChannelButton)}</div>
            </div>
          ) : null}
          {channelGroups.cross.length > 0 ? (
            <div>
              <p className="mb-1 px-2 text-[11px] font-semibold text-slate-400">크로스팀</p>
              <div className="space-y-1">{channelGroups.cross.map(renderChannelButton)}</div>
            </div>
          ) : null}
        </nav>

        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">메시지</p>
          <button
            type="button"
            className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => setDmOpen(true)}
          >
            새 채팅
          </button>
        </div>
        <nav className="max-h-[40vh] space-y-1 overflow-y-auto px-2 pb-4">
          {channelGroups.dms.map(renderChannelButton)}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-white">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {selectedChannel?.kind === "dm" || selectedChannel?.kind === "group_dm"
                ? "다이렉트 · 그룹"
                : "채널"}
            </p>
            <h2 className="truncate text-lg font-bold text-slate-900">
              {selectedChannel
                ? selectedChannel.kind === "dm" || selectedChannel.kind === "group_dm"
                  ? selectedChannel.displayName
                  : selectedChannel.displayName
                : "채널 선택"}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selectedChannel &&
            (selectedChannel.kind === "group_dm" || selectedChannel.kind === "cross_team") ? (
              <>
                {isHostOrElevated ? (
                  <button
                    type="button"
                    className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    onClick={() => setMembersOpen(true)}
                  >
                    멤버 관리
                  </button>
                ) : null}
                {!channelMembers.some((m) => m.id === me?.id && m.role === "host") ? (
                  <button
                    type="button"
                    className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    onClick={leaveChannel}
                  >
                    나가기
                  </button>
                ) : null}
                {isHostOrElevated ? (
                  <button
                    type="button"
                    className="rounded-md border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                    onClick={deleteChannel}
                  >
                    삭제
                  </button>
                ) : null}
              </>
            ) : null}
            <button
              type="button"
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => setSearchOpen(true)}
            >
              검색
            </button>
          </div>
        </header>

        {pins.length > 0 ? (
          <div className="border-b border-amber-100 bg-amber-50/80 px-6 py-2">
            <p className="mb-1 text-[11px] font-semibold text-amber-900">고정됨</p>
            <ul className="space-y-1">
              {pins.map((p) => (
                <li key={p.pinId}>
                  <button
                    type="button"
                    className="w-full truncate text-left text-xs text-amber-950 hover:underline"
                    onClick={() => scrollToMessage(p.messageId)}
                  >
                    <span className="font-medium">{p.userName}</span> — {p.body}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {socketError ? (
          <div className="mx-4 mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {socketError}
            <button type="button" className="ml-2 underline" onClick={() => setSocketError(null)}>
              닫기
            </button>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto py-4">
              {mainMessages.map((m, idx) => {
                const prev = idx > 0 ? mainMessages[idx - 1] : null;
                const continuedFromPrev = Boolean(prev && prev.userId === m.userId);
                return (
                <MessageBubble
                  key={m.id}
                  message={m}
                  isMine={me?.id === m.userId}
                  continuedFromPrev={continuedFromPrev}
                  focused={focusedMessageId === m.id}
                  showThreadCta
                  canThread={!m.parentMessageId}
                  editing={editingId === m.id}
                  editDraft={editDraft}
                  onEditDraft={setEditDraft}
                  onSaveEdit={() => void saveEdit()}
                  onCancelEdit={() => {
                    setEditingId(null);
                  }}
                  showActions={Boolean(me)}
                  onOpenThread={() => setThreadRoot(m)}
                  onToggleReaction={(emoji) => void onToggleReaction(m, emoji)}
                  onDelete={() => void onDeleteMessage(m)}
                  onStartEdit={() => {
                    setEditingId(m.id);
                    setEditDraft(m.body);
                  }}
                  onOpenCalendar={() => openCalendar(m)}
                  onPin={() => void togglePin(m)}
                  isPinned={Boolean(pinIdsByMessage[m.id])}
                  showPinInMenu={canPin}
                  menuOpen={openMessageMenuId === m.id}
                  onToggleMenu={() =>
                    setOpenMessageMenuId((prev) => (prev === m.id ? null : m.id))
                  }
                />
                );
              })}
              {mainMessages.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-500">아직 메시지가 없습니다.</p>
              ) : null}
            </div>

            <div className="relative shrink-0 border-t border-slate-200 bg-[#fafbfa] px-4 py-3">
              {slashOpen && filteredSlash.length > 0 ? (
                <div className="absolute bottom-full left-4 right-4 mb-2 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                  {filteredSlash.map((cmd) => (
                    <button
                      key={cmd.id}
                      type="button"
                      className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-brand-50"
                      onClick={() => {
                        const text = cmd.apply();
                        setMainDraft(text);
                        setSlashOpen(false);
                        requestAnimationFrame(() => mainInputRef.current?.focus());
                      }}
                    >
                      <span className="font-semibold text-slate-900">{cmd.label}</span>
                      <span className="text-xs text-slate-500">{cmd.description}</span>
                    </button>
                  ))}
                </div>
              ) : null}

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleSendMain();
                }}
                className="flex flex-col gap-2"
              >
                <input
                  ref={mainFileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  accept=".pdf,.docx,.xlsx,.pptx,.jpg,.jpeg,.png,.zip"
                  onChange={(e) => {
                    const fs = Array.from(e.target.files ?? []);
                    setMainFiles((p) => [...p, ...fs]);
                    e.target.value = "";
                  }}
                />
                {mainFiles.length > 0 ? (
                  <ul className="flex flex-wrap gap-1 text-[11px] text-slate-700">
                    {mainFiles.map((f, i) => (
                      <li
                        key={`${f.name}-${i}`}
                        className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5"
                      >
                        <span className="max-w-[180px] truncate">{f.name}</span>
                        <button
                          type="button"
                          className="text-slate-400 hover:text-rose-600"
                          onClick={() => setMainFiles((p) => p.filter((_, j) => j !== i))}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="flex items-start gap-2">
                  <textarea
                    ref={mainInputRef}
                    rows={2}
                    value={mainDraft}
                    onChange={(e) => updateMainDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setSlashOpen(false);
                      }
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSendMain();
                      }
                    }}
                    placeholder={selectedChannel ? "메시지를 입력하세요" : "메시지를 입력하세요"}
                    className="min-w-0 flex-1 resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-brand-200 transition focus:border-brand-500 focus:ring-2"
                  />
                  <button
                    type="button"
                    title="파일 첨부"
                    className="mt-1 shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-lg leading-none text-slate-600 hover:bg-slate-50"
                    onClick={() => mainFileInputRef.current?.click()}
                  >
                    📎
                  </button>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>
                    <kbd className="rounded border border-slate-200 bg-white px-1">/</kbd> 슬래시 커맨드 ·{" "}
                    <kbd className="rounded border border-slate-200 bg-white px-1">Enter</kbd> 전송 ·{" "}
                    <kbd className="rounded border border-slate-200 bg-white px-1">Shift+Enter</kbd> 줄바꿈
                  </span>
                </div>
              </form>
            </div>
          </div>

          {threadRoot ? (
            <aside className="flex min-h-0 w-[360px] shrink-0 flex-col border-l border-slate-200 bg-[#fbfbfa]">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">스레드</p>
                  <p className="truncate text-sm font-medium text-slate-800">{threadRoot.userName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setThreadRoot(null)}
                  className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
                >
                  닫기
                </button>
              </div>
              <div ref={threadListRef} className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
                {threadMessages.map((m, idx) => {
                  const prev = idx > 0 ? threadMessages[idx - 1] : null;
                  const continuedFromPrev = Boolean(prev && prev.userId === m.userId);
                  return (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    isMine={me?.id === m.userId}
                    continuedFromPrev={continuedFromPrev}
                    focused={focusedMessageId === m.id}
                    showThreadCta={false}
                    canThread={false}
                    editing={editingId === m.id}
                    editDraft={editDraft}
                    onEditDraft={setEditDraft}
                    onSaveEdit={() => void saveEdit()}
                    onCancelEdit={() => setEditingId(null)}
                    showActions={Boolean(me)}
                    onOpenThread={() => {}}
                    onToggleReaction={(emoji) => void onToggleReaction(m, emoji)}
                    onDelete={() => void onDeleteMessage(m)}
                    onStartEdit={() => {
                      setEditingId(m.id);
                      setEditDraft(m.body);
                    }}
                    onOpenCalendar={() => openCalendar(m)}
                    onPin={() => {}}
                    isPinned={false}
                    showPinInMenu={false}
                    menuOpen={openMessageMenuId === m.id}
                    onToggleMenu={() =>
                      setOpenMessageMenuId((prev) => (prev === m.id ? null : m.id))
                    }
                  />
                  );
                })}
              </div>
              <div className="shrink-0 border-t border-slate-200 p-3">
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleSendThread();
                  }}
                  className="flex flex-col gap-2"
                >
                  <input
                    ref={threadFileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    accept=".pdf,.docx,.xlsx,.pptx,.jpg,.jpeg,.png,.zip"
                    onChange={(e) => {
                      const fs = Array.from(e.target.files ?? []);
                      setThreadFiles((p) => [...p, ...fs]);
                      e.target.value = "";
                    }}
                  />
                  {threadFiles.length > 0 ? (
                    <ul className="flex flex-wrap gap-1 text-[11px] text-slate-700">
                      {threadFiles.map((f, i) => (
                        <li
                          key={`${f.name}-${i}`}
                          className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5"
                        >
                          <span className="max-w-[160px] truncate">{f.name}</span>
                          <button
                            type="button"
                            className="text-slate-400 hover:text-rose-600"
                            onClick={() => setThreadFiles((p) => p.filter((_, j) => j !== i))}
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="flex items-start gap-2">
                    <textarea
                      rows={3}
                      value={threadDraft}
                      onChange={(e) => setThreadDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void handleSendThread();
                        }
                      }}
                      placeholder="답글을 입력하세요"
                      className="min-w-0 flex-1 resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-brand-200 transition focus:border-brand-500 focus:ring-2"
                    />
                    <button
                      type="button"
                      title="파일 첨부"
                      className="mt-1 shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-lg leading-none text-slate-600 hover:bg-slate-50"
                      onClick={() => threadFileInputRef.current?.click()}
                    >
                      📎
                    </button>
                  </div>
                </form>
              </div>
            </aside>
          ) : null}
        </div>
      </div>

      {dmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold">새 메시지</h3>
            <p className="mt-1 text-sm text-slate-600">직원을 검색해 1:1 또는 그룹 채팅을 만듭니다.</p>
            <label className="mt-4 block text-xs font-medium text-slate-600">방 이름 (선택, 그룹)</label>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={dmName}
              onChange={(e) => setDmName(e.target.value)}
              placeholder="예: 프로젝트 A"
            />
            <label className="mt-3 block text-xs font-medium text-slate-600">직원 검색</label>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={dmQuery}
              onChange={(e) => setDmQuery(e.target.value)}
              placeholder="이름 또는 이메일"
            />
            <div className="mt-2 max-h-32 overflow-y-auto rounded border border-slate-200">
              {dmUsers.map((u) => (
                <label key={u.id} className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={dmSelected.some((p) => p.id === u.id)}
                    onChange={(e) =>
                      setDmSelected((prev) =>
                        e.target.checked ? (prev.some((p) => p.id === u.id) ? prev : [...prev, u]) : prev.filter((x) => x.id !== u.id)
                      )
                    }
                  />
                  <span className="truncate">{formatOrgUserLabel(u)}</span>
                </label>
              ))}
            </div>
            {dmSelected.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {dmSelected.map((u) => (
                  <span
                    key={u.id}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs"
                  >
                    {formatOrgUserLabel(u)}
                    <button type="button" onClick={() => setDmSelected((p) => p.filter((x) => x.id !== u.id))}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                onClick={() => setDmOpen(false)}
              >
                취소
              </button>
              <button
                type="button"
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40"
                disabled={dmSelected.length === 0}
                onClick={() => void createDm()}
              >
                만들기
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {xtOpen && canCreateCrossTeam ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold">크로스팀 채널 만들기</h3>
            <label className="mt-4 block text-xs font-medium text-slate-600">채널 이름</label>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={xtName}
              onChange={(e) => setXtName(e.target.value)}
              placeholder="채널 이름"
            />
            <label className="mt-3 block text-xs font-medium text-slate-600">다른 부서 직원 검색·초대</label>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={xtQuery}
              onChange={(e) => setXtQuery(e.target.value)}
            />
            <div className="mt-2 max-h-32 overflow-y-auto rounded border border-slate-200">
              {xtUsers.map((u) => (
                <label key={u.id} className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={xtSelected.some((p) => p.id === u.id)}
                    onChange={(e) =>
                      setXtSelected((prev) =>
                        e.target.checked ? (prev.some((p) => p.id === u.id) ? prev : [...prev, u]) : prev.filter((x) => x.id !== u.id)
                      )
                    }
                  />
                  <span className="truncate">{formatOrgUserLabel(u)}</span>
                </label>
              ))}
            </div>
            {xtSelected.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {xtSelected.map((u) => (
                  <span key={u.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                    {formatOrgUserLabel(u)}
                    <button type="button" onClick={() => setXtSelected((p) => p.filter((x) => x.id !== u.id))}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                onClick={() => setXtOpen(false)}
              >
                취소
              </button>
              <button
                type="button"
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40"
                disabled={!xtName.trim()}
                onClick={() => void createXt()}
              >
                만들기
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {searchOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold">메시지 검색</h3>
            <div className="mt-3 flex gap-2">
              <input
                className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="키워드"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    void runSearch();
                  }
                }}
              />
              <button
                type="button"
                className="rounded-md bg-brand-600 px-3 py-2 text-sm text-white hover:bg-brand-700"
                onClick={() => void runSearch()}
                disabled={searchLoading}
              >
                검색
              </button>
            </div>
            <ul className="mt-4 max-h-64 overflow-y-auto divide-y divide-slate-100">
              {searchHits.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    className="w-full px-2 py-2 text-left text-sm hover:bg-slate-50"
                    onClick={() => scrollToMessage(h.id)}
                  >
                    <span className="font-medium text-slate-800">{h.userName}</span>
                    <span className="text-slate-400"> · {dayjs(h.createdAt).format("M/D HH:mm")}</span>
                    <p className="line-clamp-2 text-slate-600">{h.body}</p>
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="text-sm text-slate-600 hover:underline"
                onClick={() => setSearchOpen(false)}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {calModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold">캘린더에 추가</h3>
            <label className="mt-3 block text-xs font-medium text-slate-600">제목</label>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={calTitle}
              onChange={(e) => setCalTitle(e.target.value)}
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-slate-600">시작</label>
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  value={calStart}
                  onChange={(e) => setCalStart(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">종료</label>
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  value={calEnd}
                  onChange={(e) => setCalEnd(e.target.value)}
                />
              </div>
            </div>
            <label className="mt-3 block text-xs font-semibold text-slate-600">
              참석자 (이름/조직 검색)
            </label>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={calAttendeeQuery}
              onChange={(e) => setCalAttendeeQuery(e.target.value)}
              placeholder="예: 홍길동, 혁신지원실"
            />
            <div className="mt-2 max-h-32 overflow-y-auto rounded border border-slate-200">
              {calAttendeeCandidates.map((u) => (
                <label key={u.id} className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={calSelectedAttendees.some((p) => p.id === u.id)}
                    onChange={(e) =>
                      setCalSelectedAttendees((prev) =>
                        e.target.checked ? (prev.some((p) => p.id === u.id) ? prev : [...prev, u]) : prev.filter((x) => x.id !== u.id)
                      )
                    }
                  />
                  <span className="truncate">{formatOrgUserLabel(u)}</span>
                </label>
              ))}
            </div>
            {calSelectedAttendees.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {calSelectedAttendees.map((u) => (
                  <span
                    key={u.id}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs"
                  >
                    {formatOrgUserLabel(u)}
                    <button
                      type="button"
                      onClick={() =>
                        setCalSelectedAttendees((prev) => prev.filter((x) => x.id !== u.id))
                      }
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="text-sm text-slate-600" onClick={() => setCalModal(null)}>
                취소
              </button>
              <button
                type="button"
                className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700"
                onClick={() => void saveCalendar()}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {membersOpen && selectedChannel ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold">멤버 관리</h3>
            <ul className="mt-3 divide-y divide-slate-100">
              {channelMembers.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    {m.name}{" "}
                    <span className="text-slate-400">
                      ({m.role === "host" ? "호스트" : "멤버"})
                    </span>
                  </span>
                  {isHostOrElevated && m.role !== "host" ? (
                    <button
                      type="button"
                      className="text-xs text-rose-600 hover:underline"
                      onClick={() => void patchMembers([], [m.id])}
                    >
                      내보내기
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
            <label className="mt-4 block text-xs font-semibold text-slate-600">직원 검색·추가</label>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={memberQuery}
              onChange={(e) => setMemberQuery(e.target.value)}
              placeholder="이름/이메일/조직 검색"
            />
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                현재 결과 {selectableMemberPick.length}명
              </p>
              <button
                type="button"
                className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                disabled={selectableMemberPick.length === 0}
                onClick={() =>
                  setMemberSelected((prev) => {
                    if (allVisibleMembersSelected) {
                      return prev.filter((picked) => !selectableMemberPick.some((u) => u.id === picked.id));
                    }
                    const next = [...prev];
                    for (const user of selectableMemberPick) {
                      if (!next.some((picked) => picked.id === user.id)) {
                        next.push(user);
                      }
                    }
                    return next;
                  })
                }
              >
                {allVisibleMembersSelected ? "전체 해제" : "전체 선택"}
              </button>
            </div>
            {memberSelected.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {memberSelected.map((u) => (
                  <span key={u.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                    {formatOrgUserLabel(u)}
                    <button
                      type="button"
                      onClick={() => setMemberSelected((prev) => prev.filter((x) => x.id !== u.id))}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <div className="mt-2 max-h-56 overflow-y-auto rounded border border-slate-200">
              {memberPick.map((u) => (
                <label key={u.id} className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={memberSelected.some((p) => p.id === u.id)}
                    disabled={channelMembers.some((m) => m.id === u.id)}
                    onChange={(e) =>
                      setMemberSelected((prev) =>
                        e.target.checked
                          ? prev.some((p) => p.id === u.id)
                            ? prev
                            : [...prev, u]
                          : prev.filter((x) => x.id !== u.id)
                      )
                    }
                  />
                  <span
                    className={clsx(
                      "truncate",
                      channelMembers.some((m) => m.id === u.id) && "text-slate-400 line-through"
                    )}
                  >
                    {formatOrgUserLabel(u)}
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40"
                disabled={memberSelected.length === 0}
                onClick={async () => {
                  const addIds = memberSelected
                    .map((u) => u.id)
                    .filter((id) => !channelMembers.some((m) => m.id === id));
                  if (addIds.length === 0) {
                    setMemberSelected([]);
                    return;
                  }
                  await patchMembers(addIds, []);
                  setMemberSelected([]);
                }}
              >
                선택 인원 추가
              </button>
              <button type="button" className="text-sm text-slate-600" onClick={() => setMembersOpen(false)}>
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
