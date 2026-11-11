/** Journey chapters (kept separate from the Three.js scene so the page shell doesn't load three eagerly). */
export const CHAPTERS = ["enter", "discover", "develop", "demonstrate", "converge"] as const;
export type Chapter = (typeof CHAPTERS)[number];
