import { pino } from "pino";
import type { Logger } from "./domain/ports.ts";

export function createLogger(level: string): Logger {
  return pino({ level, timestamp: pino.stdTimeFunctions.isoTime });
}
