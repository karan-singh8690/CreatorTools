import { Metadata } from 'next'
import Link from 'next/link'
import { blogArticles, getBlogCategories } from '@/lib/blog-data'
import { SITE_URL } from '@/lib/seo-config'

export function generateMetadata(): Metadata {
  return {
    title: 'CreatorTools Blog — PDF Tips, Tricks & How-To Guides',
    description:
      'Expert guides on PDF compression, editing, OCR, merging, signing, security, and more. Free how-to articles from CreatorTools to help you master PDF workflows.',
    keywords: [
      'pdf tips',
      'pdf guides',
      'pdf how to',
      'compress pdf guide',
      'edit pdf tips',
      'merge pdf tutorial',
      'pdf blog',
    ],
    openGraph: {
      title: 'CreatorTools Blog — PDF Tips, Tricks & How-To Guides',
      description:
        'Expert guides on PDF compression, editing, OCR, merging, signing, security, and more.',
      url: `${SITE_URL}/blog`,
      siteName: 'CreatorTools',
      type: 'website',
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'CreatorTools Blog — PDF Tips, Tricks & How-To Guides',
      description:
        'Expert guides on PDF compression, editing, OCR, merging, signing, security, and more.',
    },
    alternates: {
      canonical: `${SITE_URL}/blog`,
    },
  }
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

export default function BlogListPage() {
  const categories = getBlogCategories()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'CreatorTools Blog',
    description:
      'Expert guides on PDF compression, editing, OCR, merging, signing, security, and more.',
    url: `${SITE_URL}/blog`,
    publisher: {
      '@type': 'Organization',
      name: 'CreatorTools',
      url: SITE_URL,
    },
    blogPost: blogArticles.map((article) => ({
      '@type': 'BlogPosting',
      headline: article.title,
      description: article.metaDescription,
      datePublished: article.date,
      author: {
        '@type': 'Organization',
        name: article.author,
      },
      url: `${SITE_URL}/blog/${article.slug}`,
    })),
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
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
              href="/"
              className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              All Tools
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1E3A5F] via-[#2D5A8E] to-[#1A365D]" />
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -right-32 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-amber-400/10 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex items-center gap-2 text-sm text-blue-200/60">
              <li>
                <Link href="/" className="hover:text-white transition-colors">
                  Home
                </Link>
              </li>
              <li><span className="mx-1">/</span></li>
              <li className="text-white font-medium">Blog</li>
            </ol>
          </nav>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-4">
            PDF Tips, Tricks &<br className="hidden sm:block" /> How-To Guides
          </h1>
          <p className="text-lg text-blue-100/70 max-w-2xl leading-relaxed">
            Expert guides to help you compress, edit, merge, sign, secure, and convert your PDF files. All free, all practical.
          </p>
        </div>
      </section>

      {/* Category Filter */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-900 text-white">
              All Articles
            </span>
            {categories.map((cat) => (
              <span
                key={cat}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600"
              >
                {cat}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Article Grid */}
      <section className="py-12 sm:py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {blogArticles.map((article) => (
              <article
                key={article.slug}
                className="group flex flex-col rounded-2xl border border-gray-100 bg-white hover:border-gray-200 hover:shadow-lg transition-all duration-300 overflow-hidden"
              >
                <div className="px-5 pt-5 flex items-center justify-between">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                      categoryColors[article.category] || 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {article.category}
                  </span>
                  <span className="text-xs text-gray-400">{article.readTime}</span>
                </div>
                <div className="px-5 pt-4 pb-5 flex flex-col flex-1">
                  <h2 className="text-base font-bold text-gray-900 leading-snug mb-2 group-hover:text-blue-600 transition-colors">
                    <Link href={`/blog/${article.slug}`} className="hover:underline">
                      {article.title}
                    </Link>
                  </h2>
                  <p className="text-sm text-gray-500 leading-relaxed mb-4 flex-1">
                    {article.excerpt}
                  </p>
                  <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                    <time dateTime={article.date} className="text-xs text-gray-400">
                      {new Date(article.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </time>
                    <Link
                      href={`/blog/${article.slug}`}
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

      {/* CTA Banner */}
      <section className="py-12 sm:py-16 bg-gradient-to-b from-gray-50/80 to-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1E3A5F] via-[#2D5A8E] to-[#1A365D] p-8 sm:p-12 text-center">
            <div className="absolute -top-20 -right-20 w-60 h-60 bg-blue-400/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-amber-400/10 rounded-full blur-3xl" />
            <div className="relative z-10">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                Try Our Free PDF Tools
              </h2>
              <p className="text-blue-100/70 max-w-md mx-auto mb-6">
                18+ free online tools to compress, convert, merge, sign, and secure your PDFs.
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-gray-900 rounded-xl font-semibold text-sm shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5"
              >
                Explore All Tools →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="CreatorTools" className="w-6 h-6 rounded" />
            <span className="text-sm font-semibold text-gray-700">
              Creator<span className="text-blue-500">Tools</span>
            </span>
          </div>
          <p className="text-xs text-gray-400">
            &copy; {new Date().getFullYear()} CreatorTools. All tools are free and run securely.
          </p>
        </div>
      </footer>

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  )
}
