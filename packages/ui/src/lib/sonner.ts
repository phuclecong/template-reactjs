/**
 * Imperative toast API.
 *
 * The registry-vendored `sonner.tsx` primitive exports only `Toaster`; toast
 * callers (the Refine notification provider, feature code) reach the sonner
 * runtime through this repo-owned module instead of importing the vendor
 * package directly.
 */
export { toast } from "sonner"
