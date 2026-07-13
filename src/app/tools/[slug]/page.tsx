import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getToolBySlug, getAllSlugs, SITE_URL } from '@/lib/seo-config'
import { ToolLandingPage } from '@/components/seo/tool-landing-page'

// Generate static paths for all tool pages
export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }))
}

// Generate metadata for each tool page
export function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  return params.then(({ slug }) => {
    const tool = getToolBySlug(slug)

    if (!tool) {
      return { title: 'Tool Not Found' }
    }

    return {
      title: tool.metaTitle,
      description: tool.metaDescription,
      keywords: tool.keywords,
      openGraph: {
        title: tool.metaTitle,
        description: tool.metaDescription,
        url: `${SITE_URL}/tools/${tool.slug}`,
        siteName: 'CreatorTools',
        type: 'website',
        locale: 'en_US',
        images: [
          {
            url: '/og-image.png',
            width: 1200,
            height: 630,
            alt: tool.h1,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: tool.metaTitle,
        description: tool.metaDescription,
        images: ['/og-image.png'],
      },
      alternates: {
        canonical: `${SITE_URL}/tools/${tool.slug}`,
      },
    }
  })
}

// Server component that renders the landing page
export default async function ToolPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const tool = getToolBySlug(slug)

  if (!tool) {
    notFound()
  }

  return <ToolLandingPage tool={tool} />
}
