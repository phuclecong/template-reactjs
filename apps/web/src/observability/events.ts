import { reportEvent } from "./logger"

/**
 * Records a completed domain action. Event names use `entity.action` in the
 * past tense, and `data` carries ids and enums — never names or free text.
 */
export function track(event: string, data?: Record<string, unknown>): void {
  reportEvent(event, data)
}
