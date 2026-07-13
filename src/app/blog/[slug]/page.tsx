import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  getBlogArticleBySlug,
  getAllBlogSlugs,
  getRelatedArticles,
} from '@/lib/blog-data'
import { SITE_URL } from '@/lib/seo-config'

// Generate static paths for all blog articles
export function generateStaticParams() {
  return getAllBlogSlugs().map((slug) => ({ slug }))
}

// Generate metadata for each blog article
export function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  return params.then(({ slug }) => {
    const article = getBlogArticleBySlug(slug)

    if (!article) {
      return { title: 'Article Not Found' }
    }

    return {
      title: article.metaTitle,
      description: article.metaDescription,
      keywords: article.keywords,
      openGraph: {
        title: article.metaTitle,
        description: article.metaDescription,
        url: `${SITE_URL}/blog/${article.slug}`,
        siteName: 'CreatorTools',
        type: 'article',
        locale: 'en_US',
        publishedTime: article.date,
        authors: [article.author],
      },
      twitter: {
        card: 'summary_large_image',
        title: article.metaTitle,
        description: article.metaDescription,
      },
      alternates: {
        canonical: `${SITE_URL}/blog/${article.slug}`,
      },
    }
  })
}

const categoryColors: Record<string, string> = {
  'PDF Compression': 'bg-amber-100 text-amber-700',
  'PDF Editing': 'bg-blue-100 text-blue-700',
  'PDF Merging': 'bg-emerald-100 text-emerald-700',
  'OCR & Text Extraction': 'bg-pink-100 text-pink-700',
  'PDF Formatting': 'bg-cyan-100 text-cyan-700',
  'PDF Security': 'bg-red-100 text-red-700',
  eSignature: 'bg-fuchsia-100 text-fuchsia-700',
  'PDF Conversion': 'bg-violet-100 text-violet-700',
  'PDF Protection': 'bg-indigo-100 text-indigo-700',
}

// Render HTML from the content string
function renderContent(content: string) {
  // Split by double newlines for paragraphs
  const blocks = content.split('\n\n')

  return blocks.map((block, i) => {
    const trimmed = block.trim()
    if (!trimmed) return null

    // Heading detection
    if (trimmed.startsWith('### ')) {
      return (
        <h3 key={i} className="text-lg font-bold text-gray-900 mt-8 mb-3">
          {trimmed.slice(4)}
        </h3>
      )
    }
    if (trimmed.startsWith('## ')) {
      return (
        <h2 key={i} className="text-xl font-bold text-gray-900 mt-10 mb-4">
          {trimmed.slice(3)}
        </h2>
      )
    }

    // List detection (unordered)
    const listItems = trimmed.split('\n').filter((l) => l.trim().startsWith('- ') || l.trim().startsWith('* '))
    if (listItems.length > 0 && listItems.length === trimmed.split('\n').filter(Boolean).length) {
      return (
        <ul key={i} className="space-y-2 my-4 ml-1">
          {listItems.map((item, j) => (
            <li
              key={j}
              className="flex items-start gap-2 text-gray-600 leading-relaxed"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-2.5 flex-shrink-0" />
              <span dangerouslySetInnerHTML={{ __html: parseInlineHtml(item.trim().slice(2)) }} />
            </li>
          ))}
        </ul>
      )
    }

    // Ordered list detection
    const orderedItems = trimmed.split('\n').filter((l) => /^\d+\.\s/.test(l.trim()))
    if (orderedItems.length > 0 && orderedItems.length === trimmed.split('\n').filter(Boolean).length) {
      return (
        <ol key={i} className="space-y-2 my-4 ml-1">
          {orderedItems.map((item, j) => (
            <li
              key={j}
              className="flex items-start gap-2 text-gray-600 leading-relaxed"
            >
              <span className="text-sm font-semibold text-blue-600 mt-0.5 flex-shrink-0 w-5 text-right">
                {j + 1}.
              </span>
              <span dangerouslySetInnerHTML={{ __html: parseInlineHtml(item.trim().replace(/^\d+\.\s/, '')) }} />
            </li>
          ))}
        </ol>
      )
    }

    // Table detection (simple markdown tables)
    if (trimmed.includes('|') && trimmed.includes('---')) {
      const rows = trimmed
        .split('\n')
        .filter((l) => l.trim() && !l.trim().startsWith('|---'))
        .map((l) =>
          l
            .split('|')
            .map((c) => c.trim())
            .filter(Boolean)
        )
      if (rows.length > 1) {
        return (
          <div key={i} className="overflow-x-auto my-6 rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  {rows[0].map((cell, j) => (
                    <th key={j} className="px-4 py-3 text-left font-semibold text-gray-700 border-b border-gray-200">
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(1).map((row, j) => (
                  <tr key={j} className="border-b border-gray-100 last:border-b-0">
                    {row.map((cell, k) => (
                      <td key={k} className="px-4 py-2.5 text-gray-600">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    }

    // Regular paragraph
    return (
      <p
        key={i}
        className="text-gray-600 leading-relaxed my-4"
        dangerouslySetInnerHTML={{ __html: parseInlineHtml(trimmed) }}
      />
    )
  })
}

// Parse inline HTML links from content
function parseInlineHtml(text: string): string {
  // The content already contains <a href="...">...</a> tags, so we just return as-is
  // But we also need to handle bold text: **text** → <strong>text</strong>
  return text.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-gray-800">$1</strong>')
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const article = getBlogArticleBySlug(slug)

  if (!article) {
    notFound()
  }

  const relatedArticles = getRelatedArticles(slug, 3)

  // JSON-LD Article schema
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.metaDescription,
    datePublished: article.date,
    dateModified: article.date,
    author: {
      '@type': 'Organization',
      name: article.author,
    },
    publisher: {
      '@type': 'Organization',
      name: 'CreatorTools',
      url: SITE_URL,
    },
    url: `${SITE_URL}/blog/${article.slug}`,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${SITE_URL}/blog/${article.slug}`,
    },
    keywords: article.keywords.join(', '),
  }

  // JSON-LD FAQPage schema (if article has FAQ)
  const faqJsonLd =
    article.faq && article.faq.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: article.faq.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: item.answer,
            },
          })),
        }
      : null

  return (
    <div className="min-h-screen bg-white">
      {/* ── Navigation Bar ── */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="CreatorTools" className="w-8 h-8 rounded-lg" />
            <span className="text-lg font-bold text-gray-800">
              Creator<span className="text-blue-500">Tools</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/blog"
              className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              Blog
            </Link>
            {article.toolSlug && (
              <Link
                href={`/tools/${article.toolSlug}`}
                className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Try Free
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* ── Breadcrumbs ── */}
      <div className="bg-white border-b border-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3">
          <nav aria-label="Breadcrumb">
            <ol className="flex items-center gap-2 text-sm text-gray-400">
              <li>
                <Link href="/" className="hover:text-gray-600 transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <span className="mx-1">/</span>
              </li>
              <li>
                <Link href="/blog" className="hover:text-gray-600 transition-colors">
                  Blog
                </Link>
              </li>
              <li>
                <span className="mx-1">/</span>
              </li>
              <li className="text-gray-700 font-medium truncate max-w-[200px] sm:max-w-none">
                {article.title}
              </li>
            </ol>
          </nav>
        </div>
      </div>

      {/* ── Article Header ── */}
      <header className="bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
          <div className="flex items-center gap-3 mb-4">
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                categoryColors[article.category] || 'bg-gray-100 text-gray-600'
              }`}
            >
              {article.category}
            </span>
            <span className="text-xs text-gray-400">{article.readTime}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 leading-tight mb-4">
            {article.title}
          </h1>
          <p className="text-base sm:text-lg text-gray-500 leading-relaxed max-w-3xl">
            {article.excerpt}
          </p>
          <div className="flex items-center gap-4 mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-xs font-bold text-blue-600">CT</span>
              </div>
              <span className="text-sm font-medium text-gray-700">{article.author}</span>
            </div>
            <time dateTime={article.date} className="text-sm text-gray-400">
              {new Date(article.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
          </div>
        </div>
      </header>

      {/* ── Article Content ── */}
      <article className="max-w-4xl mx-auto px-4 sm:px-6 pb-12">
        <div className="prose-custom">{renderContent(article.content)}</div>
      </article>

      {/* ── FAQ Section ── */}
      {article.faq && article.faq.length > 0 && (
        <section className="bg-gray-50 border-t border-gray-100">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6">
              Frequently Asked Questions
            </h2>
            <div className="space-y-3">
              {article.faq.map((item, i) => (
                <details
                  key={i}
                  className="group rounded-xl border border-gray-200 bg-white overflow-hidden"
                >
                  <summary className="flex items-center justify-between px-6 py-4 cursor-pointer text-sm font-semibold text-gray-800 hover:bg-gray-50 transition-colors list-none">
                    {item.question}
                    <svg
                      className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform flex-shrink-0 ml-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <div className="px-6 pb-4 text-sm text-gray-500 leading-relaxed">
                    {item.answer}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA Banner ── */}
      {article.toolSlug && (
        <section className="py-12 sm:py-16 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1E3A5F] via-[#2D5A8E] to-[#1A365D] p-8 sm:p-12 text-center">
              <div className="absolute -top-20 -right-20 w-60 h-60 bg-blue-400/10 rounded-full blur-3xl" />
              <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-amber-400/10 rounded-full blur-3xl" />
              <div className="relative z-10">
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">
                  Ready to Try It?
                </h2>
                <p className="text-blue-100/70 max-w-md mx-auto mb-6">
                  Use our free online tool — no signup, no watermarks, no download required.
                </p>
                <Link
                  href={`/tools/${article.toolSlug}`}
                  className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-gray-900 rounded-xl font-semibold text-sm shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5"
                >
                  Try {article.category.replace('PDF ', '').replace('& ', '')} Free
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Related Articles ── */}
      {relatedArticles.length > 0 && (
        <section className="py-12 sm:py-16 bg-gradient-to-b from-gray-50/80 to-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-8">
              Related Articles
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {relatedArticles.map((related) => (
                <article
                  key={related.slug}
                  className="group flex flex-col rounded-2xl border border-gray-100 bg-white hover:border-gray-200 hover:shadow-lg transition-all duration-300 overflow-hidden"
                >
                  <div className="px-5 pt-5 flex items-center justify-between">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                        categoryColors[related.category] || 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {related.category}
                    </span>
                    <span className="text-xs text-gray-400">{related.readTime}</span>
                  </div>
                  <div className="px-5 pt-4 pb-5 flex flex-col flex-1">
                    <h3 className="text-base font-bold text-gray-900 leading-snug mb-2 group-hover:text-blue-600 transition-colors">
                      <Link href={`/blog/${related.slug}`} className="hover:underline">
                        {related.title}
                      </Link>
                    </h3>
                    <p className="text-sm text-gray-500 leading-relaxed flex-1 line-clamp-2">
                      {related.excerpt}
                    </p>
                    <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-50">
                      <time dateTime={related.date} className="text-xs text-gray-400">
                        {new Date(related.date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </time>
                      <Link
                        href={`/blog/${related.slug}`}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        Read more →
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="CreatorTools" className="w-6 h-6 rounded" />
            <span className="text-sm font-semibold text-gray-700">
              Creator<span className="text-blue-500">Tools</span>
            </span>
          </div>
          <p className="text-xs text-gray-400">
            &copy; {new Date().getFullYear()} CreatorTools. All tools are free and run securely in
            your browser.
          </p>
        </div>
      </footer>

      {/* ── JSON-LD Structured Data ── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}
    </div>
  )
}
