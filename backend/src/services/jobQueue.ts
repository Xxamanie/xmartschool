export const retryDate = (attempts: number) => new Date(Date.now() + Math.min(3600, 15 * 2 ** Math.min(attempts, 8)) * 1000);
export const staleJobLock = () => new Date(Date.now() - 5 * 60 * 1000);
export const errorSummary = (error: unknown) => (error instanceof Error ? error.message : 'Processing failed').slice(0, 400);
