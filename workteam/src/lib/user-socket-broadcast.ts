type EmitToUserFn = (userId: string, event: string, payload: unknown) => void;

export function emitSocketToUser(userId: string, event: string, payload: unknown) {
  const fn = (globalThis as unknown as { __emitToUser?: EmitToUserFn }).__emitToUser;
  try {
    fn?.(userId, event, payload);
  } catch {
    void 0;
  }
}
