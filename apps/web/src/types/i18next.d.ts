import "i18next"
import type { en } from "@/utils/translations/en"

/**
 * Types i18next's `t()` against the English dictionary, so a missing or renamed
 * translation key is a compile error. `en` is the source of truth (see
 * `utils/translations/en.ts`); `vi` is already typed against it.
 *
 * The client-side `Locale` resolution is unchanged (ADR-0004): this only types
 * the dictionary's surface at call sites.
 */
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation"
    resources: {
      translation: typeof en
    }
  }
}
