import type { PoolClient } from "pg";
import type { TaskStatus } from "@/types/tasks";

export async function moveTask(
  client: PoolClient,
  taskId: string,
  newStatus: TaskStatus,
  newIndex: number
): Promise<void> {
  const locked = await client.query<{ status: string; department_id: string | null }>(
    `SELECT status, department_id::text FROM tasks WHERE id = $1 FOR UPDATE`,
    [taskId]
  );
  if (locked.rowCount === 0) {
    throw new Error("NOT_FOUND");
  }

  const oldStatus = locked.rows[0].status as TaskStatus;
  const deptId = locked.rows[0].department_id;

  const deptParams = (status: string) => (deptId === null ? [status] : [status, deptId]);

  if (oldStatus === newStatus) {
    const { rows } = await client.query<{ id: string }>(
      deptId === null
        ? `SELECT id FROM tasks WHERE status = $1 AND department_id IS NULL ORDER BY position ASC, created_at ASC`
        : `SELECT id FROM tasks WHERE status = $1 AND department_id = $2::uuid ORDER BY position ASC, created_at ASC`,
      deptParams(oldStatus)
    );
    const ids = rows.map((r) => r.id);
    const cur = ids.indexOf(taskId);
    if (cur === -1) {
      return;
    }
    ids.splice(cur, 1);
    const idx = Math.max(0, Math.min(newIndex, ids.length));
    ids.splice(idx, 0, taskId);
    for (let p = 0; p < ids.length; p++) {
      await client.query(`UPDATE tasks SET position = $1, updated_at = NOW() WHERE id = $2`, [
        p,
        ids[p]
      ]);
    }
    return;
  }

  const { rows: srcRows } = await client.query<{ id: string }>(
    deptId === null
      ? `SELECT id FROM tasks WHERE status = $1 AND department_id IS NULL ORDER BY position ASC, created_at ASC`
      : `SELECT id FROM tasks WHERE status = $1 AND department_id = $2::uuid ORDER BY position ASC, created_at ASC`,
    deptParams(oldStatus)
  );
  const srcIds = srcRows.map((r) => r.id).filter((id) => id !== taskId);
  for (let p = 0; p < srcIds.length; p++) {
    await client.query(`UPDATE tasks SET position = $1, updated_at = NOW() WHERE id = $2`, [
      p,
      srcIds[p]
    ]);
  }

  const { rows: dstRows } = await client.query<{ id: string }>(
    deptId === null
      ? `SELECT id FROM tasks WHERE status = $1 AND department_id IS NULL ORDER BY position ASC, created_at ASC`
      : `SELECT id FROM tasks WHERE status = $1 AND department_id = $2::uuid ORDER BY position ASC, created_at ASC`,
    deptParams(newStatus)
  );
  const dstIds = dstRows.map((r) => r.id);
  const idx = Math.max(0, Math.min(newIndex, dstIds.length));
  dstIds.splice(idx, 0, taskId);
  for (let p = 0; p < dstIds.length; p++) {
    await client.query(
      `UPDATE tasks SET status = $1, position = $2, updated_at = NOW() WHERE id = $3`,
      [newStatus, p, dstIds[p]]
    );
  }
}
