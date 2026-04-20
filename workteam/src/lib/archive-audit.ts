import { createActivityLogSafe } from "@/lib/activity-log";
import { db } from "@/lib/db";
import type { AuditAction } from "@/types/archive";
import type { ActivityActionType, ActivityEntityType } from "@/types/activity";

export async function insertAuditLog(input: {
  userId: string;
  action: AuditAction | string;
  targetId: string | null;
}): Promise<void> {
  await db.query(
    `
    INSERT INTO audit_logs (user_id, action, target_id)
    VALUES ($1::uuid, $2, $3)
    `,
    [input.userId, input.action, input.targetId]
  );
}

type ActivityPair = { actionType: ActivityActionType; entityType: ActivityEntityType };

function mapAuditToActivity(action: AuditAction): ActivityPair | null {
  switch (action) {
    case "document_viewed":
      return { actionType: "document_viewed", entityType: "document" };
    case "document_created":
      return { actionType: "document_created", entityType: "document" };
    case "document_updated":
      return { actionType: "document_updated", entityType: "document" };
    case "document_version_created":
      return { actionType: "document_version_created", entityType: "document" };
    case "workspace_member_role_changed":
      return { actionType: "workspace_member_role_changed", entityType: "workspace" };
    case "workspace_member_removed":
      return { actionType: "workspace_member_role_changed", entityType: "workspace" };
    default:
      return null;
  }
}

/** 감사 로그 + 액티비티 피드(activity_logs) 동시 기록 */
export async function recordAuditAndActivity(input: {
  userId: string;
  auditAction: AuditAction;
  targetId: string | null;
  /** activity_logs.entity_id */
  entityId: string;
  entityName: string;
}): Promise<void> {
  await insertAuditLog({
    userId: input.userId,
    action: input.auditAction,
    targetId: input.targetId
  });
  const pair = mapAuditToActivity(input.auditAction);
  if (!pair) {
    return;
  }
  await createActivityLogSafe({
    userId: input.userId,
    actionType: pair.actionType,
    entityType: pair.entityType,
    entityId: input.entityId,
    entityName: input.entityName,
    departmentId: null,
    metadata: {}
  });
}
