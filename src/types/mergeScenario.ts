/**
 * Enum representing different merge scenarios based on content presence.
 * Uses bitmask encoding:
 * - Bit 0 (1): Other content present
 * - Bit 1 (2): Local content present
 * - Bit 2 (4): Ancestor content present
 */
export enum MergeScenario {
  NONE = 0, // 000 — No content
  OTHER_ONLY = 1, // 001 — Only other
  LOCAL_ONLY = 2, // 010 — Only local
  LOCAL_AND_OTHER = 3, // 011 — Local + other
  ANCESTOR_ONLY = 4, // 100 — Only ancestor
  ANCESTOR_AND_OTHER = 5, // 101 — Ancestor + other
  ANCESTOR_AND_LOCAL = 6, // 110 — Ancestor + local
  ALL = 7, // 111 — All three
}
