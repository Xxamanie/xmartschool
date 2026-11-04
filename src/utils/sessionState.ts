export type ApiSession = { userId?: string; schoolId?: string; generation: number };
let session: ApiSession = { generation: 0 };

export const getApiSession = (): ApiSession => ({ ...session });
export const setApiSession = (userId?: string, schoolId?: string) => {
  if (session.userId === userId && session.schoolId === schoolId) return;
  session = { userId, schoolId, generation: session.generation + 1 };
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('xss-session-changed'));
};
export const advanceApiSession = () => { session = { ...session, generation: session.generation + 1 }; };
