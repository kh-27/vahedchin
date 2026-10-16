/** Core logic: no DOM, no React. The UI (stage 4) uses only what is exported here. */

export * from "./conflict";
export * from "./generate";
export * from "./rules";
export { DEFAULT_PREFERENCES, EXAM_WINDOW_DAYS, type Features, type Preferences, type ScoreParts } from "./score";
export * from "./time";
export type * from "./types";
