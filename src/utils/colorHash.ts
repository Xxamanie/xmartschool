// Shared helpers for deterministically deriving a "color" from a string
// (e.g. a user id or subject name), so avatars/badges get a consistent but
// varied color without persisting anything. Used by StaffRoom, Private
// Messages, and the Timetable subject grid.

/** Hashes a string to an index in [0, length). */
export const hashStringToIndex = (value: string, length: number): number =>
  [...value].reduce((acc, c) => acc + c.charCodeAt(0), 0) % length;

/** Picks an item from `palette` deterministically based on `value`. */
export const colorForString = (value: string, palette: readonly string[]): string =>
  palette[hashStringToIndex(value, palette.length)];

export const AVATAR_COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-orange-500',
  'bg-pink-500', 'bg-indigo-500', 'bg-teal-500', 'bg-red-500',
] as const;

/** Deterministic avatar background color for a user id. */
export const avatarColor = (id: string): string => colorForString(id, AVATAR_COLORS);
