import { db } from "@/lib/db";
import { broadcastActivityEvent } from "@/lib/activity-socket-broadcast";
import type { ActivityActionType, ActivityEntityType } from "@/types/activity";

type CreateActivityLogInput = {
  userId: string;
  actionType: ActivityActionType;
  entityType: ActivityEntityType;
  entityId: string;
  entityName: string;
  departmentId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function createActivityLog(input: CreateActivityLogInput): Promise<void> {
  const { userId, actionType, entityType, entityId, entityName, departmentId = null, metadata = {} } = input;
  const ins = await db.query<{ id: string }>(
    `
    INSERT INTO activity_logs (
      user_id, action_type, entity_type, entity_id, entity_name, department_id, metadata
    )
    VALUES ($1::uuid, $2, $3, $4::uuid, $5, $6::uuid, $7::jsonb)
    RETURNING id::text
    `,
    [userId, actionType, entityType, entityId, entityName, departmentId, JSON.stringify(metadata)]
  );
  broadcastActivityEvent("activity:new", { id: ins.rows[0]?.id ?? null });
}

export async function createActivityLogSafe(input: CreateActivityLogInput): Promise<void> {
  try {
    await createActivityLog(input);
  } catch (e) {
    console.error("[activity-log]", e);
  }
}

