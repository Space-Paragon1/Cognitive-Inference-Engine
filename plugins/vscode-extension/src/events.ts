/**
 * Event type definitions for the CLR VSCode extension.
 */

export type IdeEventType =
  | "COMPILE_ERROR"
  | "COMPILE_SUCCESS"
  | "FILE_SAVE"
  | "FILE_SWITCH"
  | "KEYSTROKE"
  | "DEBUG_START"
  | "DEBUG_STOP"
  | "TEST_FAIL"
  | "TEST_PASS"
  | "TERMINAL_CMD";

export interface IdeEvent {
  source: "ide";
  type: IdeEventType;
  timestamp: number;
  data: Record<string, unknown>;
}

export function makeEvent(type: IdeEventType, data: Record<string, unknown> = {}): IdeEvent {
  return {
    source: "ide",
    type,
    timestamp: Date.now() / 1000,
    data,
  };
}
