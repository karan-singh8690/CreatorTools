import { MetadataRoute } from 'next'
import { SITE_URL, toolsSEO, getAllSlugs } from '@/lib/seo-config'
import { getAllBlogSlugs } from '@/lib/blog-data'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  // Home page
  const homePage: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
  ]

  // SEO landing pages at /tools/[slug] — these are the highest-value
  // pages for organic search, so they get priority 0.9
  const seenSlugs = new Set<string>()
  const seoLandingPages: MetadataRoute.Sitemap = []

  for (const slug of getAllSlugs()) {
    if (seenSlugs.has(slug)) continue
    seenSlugs.add(slug)

    seoLandingPages.push({
      url: `${SITE_URL}/tools/${slug}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    })
  }

  // Tool interface pages — /?tool=viewId
  // Deduplicate by URL since multiple SEO entries
  // (e.g. QR sub-types) can share the same ?tool= viewId
  const seenUrls = new Set<string>()
  const toolPages: MetadataRoute.Sitemap = []

  for (const tool of toolsSEO) {
    const url = `${SITE_URL}/?tool=${tool.viewId}`
    if (seenUrls.has(url)) continue
    seenUrls.add(url)

    toolPages.push({
      url,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })
  }

  // Blog pages — /blog and /blog/[slug]
  const blogPages: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/blog`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
  ]

  for (const slug of getAllBlogSlugs()) {
    blogPages.push({
      url: `${SITE_URL}/blog/${slug}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    })
  }

  return [...homePage, ...seoLandingPages, ...toolPages, ...blogPages]
}
