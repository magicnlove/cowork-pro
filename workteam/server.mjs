import dotenv from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath, parse } from "node:url";
import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import pg from "pg";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
dotenv.config({ path: resolve(__dirname, ".env.local") });

const { Pool } = pg;

function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) {
    return out;
  }
  cookieHeader.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) {
      return;
    }
    const name = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    out[name] = decodeURIComponent(val);
  });
  return out;
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured.");
  }
  return secret;
}

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return databaseUrl;
}

const pool = new Pool({ connectionString: getDatabaseUrl() });

const RETENTION_FILES_DAYS = Math.max(
  1,
  Number.parseInt(process.env.RETENTION_FILES_DAYS ?? "30", 10) || 30
);

function chatAttachmentExpired(createdAt) {
  const cutoff = new Date(createdAt);
  cutoff.setDate(cutoff.getDate() + RETENTION_FILES_DAYS);
  return Date.now() > cutoff.getTime();
}

async function canAccessChannel(userId, channelId) {
  const res = await pool.query(
    `
    SELECT TRUE AS ok
    FROM channels c
    INNER JOIN users u ON u.id = $1::uuid
    WHERE c.id = $2::uuid
      AND (
        (c.kind = 'dm' AND $1::uuid IN (c.dm_user_a_id, c.dm_user_b_id))
        OR (c.kind = 'company_wide')
        OR (
          c.kind = 'department'
          AND (
            EXISTS (
              SELECT 1
              FROM user_departments ud
              WHERE ud.user_id = $1::uuid
                AND ud.department_id = c.department_id
            )
            OR EXISTS (
              WITH RECURSIVE managed AS (
                SELECT ud.department_id AS id
                FROM user_departments ud
                INNER JOIN users ux ON ux.id = ud.user_id
                WHERE ud.user_id = $1::uuid
                  AND ud.role = 'manager'
                  AND ux.role = 'manager'
                UNION ALL
                SELECT d.id
                FROM departments d
                INNER JOIN managed m ON d.parent_id = m.id
              )
              SELECT 1 FROM managed WHERE id = c.department_id
            )
          )
        )
        OR (
          c.kind IN ('cross_team', 'group_dm')
          AND (
            EXISTS (
              SELECT 1 FROM channel_members cm
              WHERE cm.channel_id = c.id AND cm.user_id = $1::uuid
            )
            OR c.created_by = $1::uuid
          )
        )
      )
    LIMIT 1
    `,
    [userId, channelId]
  );
  return Boolean(res.rows[0]?.ok);
}

async function fetchMessageDto(messageId) {
  const res = await pool.query(
    `
    SELECT
      m.id,
      m.channel_id,
      m.user_id,
      m.parent_message_id,
      m.body,
      m.created_at,
      m.edited_at,
      m.deleted_at,
      u.name AS user_name,
      u.email AS user_email
    FROM messages m
    JOIN users u ON u.id = m.user_id
    WHERE m.id = $1::uuid
    LIMIT 1
    `,
    [messageId]
  );
  const row = res.rows[0];
  if (!row) {
    return null;
  }
  const attRes = await pool.query(
    `
    SELECT id::text, original_name, mime_type, byte_size::text, created_at
    FROM file_attachments
    WHERE entity_type = 'chat_message' AND entity_id = $1::uuid
    ORDER BY created_at ASC
    `,
    [messageId]
  );
  const attachments = attRes.rows.map((r) => {
    const isImage = r.mime_type.startsWith("image/");
    const expired = chatAttachmentExpired(r.created_at);
    return {
      id: r.id,
      originalName: r.original_name,
      mimeType: r.mime_type,
      byteSize: Number(r.byte_size),
      url: `/api/files/${r.id}`,
      previewUrl: isImage && !expired ? `/api/files/${r.id}?inline=1` : null,
      isImage,
      ...(expired ? { expired: true } : {})
    };
  });
  return {
    id: row.id,
    channelId: row.channel_id,
    userId: row.user_id,
    parentMessageId: row.parent_message_id,
    body: row.body,
    createdAt: row.created_at.toISOString(),
    editedAt: row.edited_at ? row.edited_at.toISOString() : null,
    deletedAt: row.deleted_at ? row.deleted_at.toISOString() : null,
    userName: row.user_name,
    userEmail: row.user_email,
    reactions: [],
    attachments
  };
}

async function getChannelLogContext(channelId) {
  const res = await pool.query(
    `
    SELECT name, department_id::text
    FROM channels
    WHERE id = $1::uuid
    LIMIT 1
    `,
    [channelId]
  );
  return {
    name: res.rows[0]?.name ?? "채널",
    departmentId: res.rows[0]?.department_id ?? null
  };
}

async function createActivityLogSafe({
  userId,
  actionType,
  entityType,
  entityId,
  entityName,
  departmentId = null,
  metadata = {}
}) {
  try {
    const ins = await pool.query(
      `
      INSERT INTO activity_logs (
        user_id, action_type, entity_type, entity_id, entity_name, department_id, metadata
      )
      VALUES ($1::uuid, $2, $3, $4::uuid, $5, $6::uuid, $7::jsonb)
      RETURNING id::text
      `,
      [userId, actionType, entityType, entityId, entityName, departmentId, JSON.stringify(metadata)]
    );
    io.emit("activity:new", { id: ins.rows[0]?.id ?? null });
  } catch (e) {
    console.error("[server chat activity-log]", e);
  }
}

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = Number.parseInt(process.env.PORT ?? "3000", 10);

const app = next({ dev });
const handle = app.getRequestHandler();

await app.prepare();

const httpServer = createServer((req, res) => {
  const parsedUrl = parse(req.url, true);
  void handle(req, res, parsedUrl);
});

const io = new Server(httpServer, {
  path: "/socket.io/",
  cors: {
    origin: true,
    credentials: true
  }
});

const onlineUsers = new Map();

function currentOnlineUserIds() {
  return [...onlineUsers.keys()];
}

function emitOnline() {
  io.emit("activity:online", { userIds: currentOnlineUserIds() });
}

globalThis.__chatIoBroadcast = (channelId, event, payload) => {
  io.to(`channel:${channelId}`).emit(event, payload);
};
globalThis.__activityIoBroadcast = (event, payload) => {
  io.emit(event, payload);
};
globalThis.__emitToUser = (userId, event, payload) => {
  if (typeof userId !== "string") {
    return;
  }
  io.to(`user:${userId}`).emit(event, payload);
};
globalThis.__activityIoOnlineUserIds = () => currentOnlineUserIds();

io.use((socket, next) => {
  try {
    const cookies = parseCookies(socket.handshake.headers.cookie ?? "");
    const token = cookies.auth_token;
    if (!token) {
      next(new Error("unauthorized"));
      return;
    }
    const payload = jwt.verify(token, getJwtSecret());
    if (typeof payload !== "object" || payload === null || !("sub" in payload)) {
      next(new Error("unauthorized"));
      return;
    }
    socket.data.userId = String(payload.sub);
    next();
  } catch {
    next(new Error("unauthorized"));
  }
});

io.on("connection", (socket) => {
  const userId = socket.data.userId;
  if (typeof userId === "string") {
    socket.join(`user:${userId}`);
    onlineUsers.set(userId, (onlineUsers.get(userId) ?? 0) + 1);
    emitOnline();
  }

  socket.on("chat:join", async (channelId, ack) => {
    try {
      if (typeof channelId !== "string") {
        throw new Error("invalid_channel");
      }
      const ok = await canAccessChannel(socket.data.userId, channelId);
      if (!ok) {
        throw new Error("forbidden");
      }
      await socket.join(`channel:${channelId}`);
      if (typeof ack === "function") {
        ack({ ok: true });
      }
    } catch {
      if (typeof ack === "function") {
        ack({ ok: false });
      }
    }
  });

  socket.on("chat:leave", (channelId) => {
    if (typeof channelId === "string") {
      void socket.leave(`channel:${channelId}`);
    }
  });

  socket.on("chat:message", async (payload, ack) => {
    try {
      if (!payload || typeof payload !== "object") {
        throw new Error("invalid");
      }
      const channelId = payload.channelId;
      const body = typeof payload.body === "string" ? payload.body.trim() : "";
      const parentMessageId =
        typeof payload.parentMessageId === "string" ? payload.parentMessageId : null;

      if (typeof channelId !== "string" || body.length === 0) {
        throw new Error("invalid");
      }
      if (body.length > 10000) {
        throw new Error("too_long");
      }

      const userId = socket.data.userId;
      const allowed = await canAccessChannel(userId, channelId);
      if (!allowed) {
        throw new Error("forbidden");
      }

      if (parentMessageId) {
        const parentRes = await pool.query(
          `SELECT id, channel_id FROM messages WHERE id = $1::uuid LIMIT 1`,
          [parentMessageId]
        );
        const parent = parentRes.rows[0];
        if (!parent || String(parent.channel_id) !== channelId) {
          throw new Error("bad_thread");
        }
      }

      const insert = await pool.query(
        `
        INSERT INTO messages (channel_id, user_id, parent_message_id, body)
        VALUES ($1::uuid, $2::uuid, $3::uuid, $4)
        RETURNING id
        `,
        [channelId, userId, parentMessageId, body]
      );

      const messageId = insert.rows[0].id;
      const message = await fetchMessageDto(messageId);
      if (!message) {
        throw new Error("save_failed");
      }
      const channelCtx = await getChannelLogContext(channelId);
      await createActivityLogSafe({
        userId,
        actionType: "message_sent",
        entityType: "channel",
        entityId: channelId,
        entityName: channelCtx.name,
        departmentId: channelCtx.departmentId,
        metadata: {
          messageId: String(messageId),
          parentMessageId,
          hasAttachment: false,
          source: "socket",
          url: "/chat"
        }
      });

      const enriched = { ...message, channelDisplayName: channelCtx.name };
      io.to(`channel:${channelId}`).emit("chat:message", enriched);
      io.emit("chat:notify", {
        channelId,
        channelDisplayName: channelCtx.name,
        senderName: message.userName,
        bodyPreview: String(message.body ?? "")
          .replace(/\u200b/g, "")
          .trim()
          .slice(0, 50),
        authorUserId: message.userId,
        messageId: message.id,
        parentMessageId: message.parentMessageId
      });
      io.emit("nav:badges", {});

      if (typeof ack === "function") {
        ack({ ok: true, message: enriched });
      }
    } catch (error) {
      const code =
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "error";
      if (typeof ack === "function") {
        ack({ ok: false, code });
      }
    }
  });

  socket.on("disconnect", () => {
    const uid = socket.data.userId;
    if (typeof uid !== "string") {
      return;
    }
    const left = (onlineUsers.get(uid) ?? 1) - 1;
    if (left <= 0) {
      onlineUsers.delete(uid);
    } else {
      onlineUsers.set(uid, left);
    }
    emitOnline();
  });
});

httpServer.listen(port, hostname, () => {
  console.log(`> Ready on http://${hostname}:${port}`);

  const cronSecret = process.env.CLEANUP_CRON_SECRET;
  if (cronSecret) {
    const base = `http://127.0.0.1:${port}`;
    function runFileCleanupJob() {
      fetch(`${base}/api/admin/cleanup`, {
        method: "POST",
        headers: { "x-cleanup-secret": cronSecret }
      }).catch((err) => {
        console.error("[file cleanup cron]", err);
      });
    }
    function scheduleNextMidnightCleanup() {
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
      const ms = Math.max(1000, next.getTime() - now.getTime());
      setTimeout(() => {
        runFileCleanupJob();
        scheduleNextMidnightCleanup();
      }, ms);
    }
    scheduleNextMidnightCleanup();
  } else {
    console.warn(
      "[file cleanup] CLEANUP_CRON_SECRET is unset — daily midnight attachment cleanup from server.mjs is disabled (admin can still run manually)."
    );
  }
});
