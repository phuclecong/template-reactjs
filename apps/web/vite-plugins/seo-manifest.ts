import type { RoutePath } from "../src/routes/route-paths"
import {
  OG_IMAGE_ALT,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_PATH,
  OG_IMAGE_WIDTH,
  SITE_DESCRIPTION,
  SITE_NAME,
  TITLE_TEMPLATE,
  absoluteUrl,
  canonicalUrl,
  pageTitle,
  routeMetadata,
  type RouteMetadata,
} from "../src/routes/route-metadata"

/**
 * Build-only description of the metadata the build emitted, written to
 * `dist/seo-manifest.json`.
 *
 * The build-output check reads this file instead of carrying its own copy of
 * the route table, so changing `route-metadata.ts` cannot leave the checker
 * asserting stale copy. The manifest is not served to browsers and is not
 * imported by client code.
 */

export const SEO_MANIFEST_FILE = "seo-manifest.json"

export type SeoManifestRoute = {
  path: RoutePath
  file: string
  title: string
  description: string
  canonical: string
  robots: string
}

export type SeoManifest = {
  siteUrl: string
  site: {
    name: string
    description: string
    titleTemplate: string
  }
  ogImage: {
    path: string
    url: string
    alt: string
    width: number
    height: number
  }
  catchAll: {
    title: string
    description: string
    robots: string
  }
  routes: SeoManifestRoute[]
}

/** Derives the manifest from the typed route table and a concrete origin. */
export function buildSeoManifest(siteUrl: string): SeoManifest {
  const routes = (
    Object.entries(routeMetadata) as [RoutePath, RouteMetadata][]
  )
    .filter(([, metadata]) => metadata.indexable)
    .map(([path, metadata]) => ({
      path,
      file: `${path.slice(1)}.html`,
      title: pageTitle(metadata.title),
      description: metadata.description,
      canonical: canonicalUrl(path, siteUrl),
      robots: "index, follow",
    }))
    .sort((left, right) => left.path.localeCompare(right.path))

  return {
    siteUrl,
    site: {
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      titleTemplate: TITLE_TEMPLATE,
    },
    ogImage: {
      path: OG_IMAGE_PATH,
      url: absoluteUrl(OG_IMAGE_PATH, siteUrl),
      alt: OG_IMAGE_ALT,
      width: OG_IMAGE_WIDTH,
      height: OG_IMAGE_HEIGHT,
    },
    catchAll: {
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
      robots: "noindex",
    },
    routes,
  }
}

/** Serializes the manifest deterministically for the build output. */
export function serializeSeoManifest(siteUrl: string): string {
  return `${JSON.stringify(buildSeoManifest(siteUrl), null, 2)}\n`
}
