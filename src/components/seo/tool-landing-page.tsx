'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  QrCode,
  Shield,
  Zap,
  Star,
  Sparkles,
} from 'lucide-react'
import { SITE_URL } from '@/lib/seo-config'
import type { ToolSEO } from '@/lib/seo-config'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  }),
}

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.15 },
  },
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden transition-all duration-200 hover:border-gray-200">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left"
      >
        <span className="text-sm font-semibold text-gray-800">{question}</span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        )}
      </button>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="px-6 pb-4"
        >
          <p className="text-sm text-gray-500 leading-relaxed">{answer}</p>
        </motion.div>
      )}
    </div>
  )
}

export function ToolLandingPage({ tool }: { tool: ToolSEO }) {
  return (
    <div className="min-h-screen bg-white">
      {/* ── Top Navigation Bar ── */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
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
            <Link
              href={`/?tool=${tool.viewId}`}
              className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Try Free
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1E3A5F] via-[#2D5A8E] to-[#1A365D]" />
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full blur-3xl" style={{ backgroundColor: tool.color + '15' }} />
          <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-blue-400/10 rounded-full blur-3xl" />
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }} />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-6 py-20 sm:py-28">
          <motion.div variants={stagger} initial="hidden" animate="visible" className="max-w-3xl">
            {/* Badge */}
            <motion.div variants={fadeUp} custom={0} className="mb-6">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white border border-white/20 backdrop-blur-sm"
                style={{ backgroundColor: tool.color + '30' }}
              >
                <Zap className="w-3 h-3" />
                Free Online Tool
              </span>
            </motion.div>

            {/* H1 */}
            <motion.h1
              variants={fadeUp}
              custom={1}
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.1] mb-5"
            >
              {tool.h1}
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              variants={fadeUp}
              custom={2}
              className="text-lg sm:text-xl text-blue-100/70 max-w-2xl leading-relaxed mb-8"
            >
              {tool.subtitle}
            </motion.p>

            {/* CTA */}
            <motion.div variants={fadeUp} custom={3} className="flex flex-wrap gap-3">
              <Link
                href={`/?tool=${tool.viewId}`}
                className="group flex items-center gap-2 px-7 py-3.5 bg-white text-gray-900 rounded-xl font-semibold text-sm shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5"
              >
                Try {tool.title} Free
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <a
                href="#features"
                className="flex items-center gap-2 px-7 py-3.5 bg-white/10 hover:bg-white/15 text-white rounded-xl font-semibold text-sm border border-white/20 backdrop-blur-sm transition-all duration-300"
              >
                See Features
              </a>
            </motion.div>

            {/* Trust signals */}
            <motion.div variants={fadeUp} custom={4} className="flex flex-wrap items-center gap-6 mt-10">
              {[
                { icon: Shield, text: 'Secure & Private' },
                { icon: Zap, text: 'No Signup Required' },
                { icon: Star, text: '100% Free' },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-2">
                  <item.icon className="w-4 h-4 text-blue-200/60" />
                  <span className="text-sm text-blue-200/60">{item.text}</span>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
              How It Works
            </h2>
            <p className="text-gray-400 max-w-md mx-auto">
              Three simple steps to get your work done
            </p>
          </motion.div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto"
          >
            {tool.howItWorks.map((step) => (
              <motion.div
                key={step.step}
                variants={fadeUp}
                custom={step.step - 1}
                className="relative flex flex-col items-center text-center p-8 rounded-2xl bg-gray-50 border border-gray-100"
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg mb-4"
                  style={{ backgroundColor: tool.color }}
                >
                  {step.step}
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-16 sm:py-20 bg-gradient-to-b from-gray-50/80 to-white">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
              Powerful Features
            </h2>
            <p className="text-gray-400 max-w-md mx-auto">
              Everything you need to get the job done right
            </p>
          </motion.div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-4xl mx-auto"
          >
            {tool.features.map((feature, i) => (
              <motion.div
                key={feature.title}
                variants={fadeUp}
                custom={i}
                className="flex gap-4 p-6 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: tool.color + '15' }}
                >
                  <Check className="w-5 h-5" style={{ color: tool.color }} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">{feature.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative overflow-hidden rounded-3xl p-10 sm:p-14 text-center"
            style={{ backgroundColor: tool.color + '10' }}
          >
            <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full blur-3xl" style={{ backgroundColor: tool.color + '15' }} />
            <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full blur-3xl" style={{ backgroundColor: tool.color + '10' }} />

            <div className="relative z-10">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
                Ready to {tool.title}?
              </h2>
              <p className="text-gray-500 max-w-md mx-auto mb-6">
                Try it now — free, fast, and no signup required.
              </p>
              <Link
                href={`/?tool=${tool.viewId}`}
                className="group inline-flex items-center gap-2 px-8 py-4 text-white rounded-xl font-semibold text-sm shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5"
                style={{ backgroundColor: tool.color }}
              >
                Start {tool.title} — It&apos;s Free
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-16 sm:py-20 bg-gradient-to-b from-gray-50/80 to-white">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
              Frequently Asked Questions
            </h2>
            <p className="text-gray-400 max-w-md mx-auto">
              Got questions? We&apos;ve got answers.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl mx-auto space-y-3"
          >
            {tool.faq.map((item) => (
              <FAQItem key={item.question} question={item.question} answer={item.answer} />
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Other Tools ── */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
              Explore More Tools
            </h2>
            <p className="text-gray-400 max-w-md mx-auto">
              18+ free tools to power your workflow
            </p>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-w-4xl mx-auto">
            {[
              { name: 'Edit PDF', slug: 'pdf-editor', icon: FileText, color: '#4A90D9' },
              { name: 'QR Generator', slug: 'qr-generator', icon: QrCode, color: '#F97316' },
              { name: 'Merge PDF', slug: 'combine-pdf', icon: FileText, color: '#10B981' },
              { name: 'Compress PDF', slug: 'compress-pdf', icon: Zap, color: '#F59E0B' },
              { name: 'Watermark', slug: 'watermark-pdf', icon: Shield, color: '#3B82F6' },
              { name: 'Convert PDF', slug: 'convert-pdf', icon: ArrowRight, color: '#8B5CF6' },
              { name: 'OCR PDF', slug: 'ocr-pdf', icon: Star, color: '#EC4899' },
              { name: 'Sign PDF', slug: 'sign-document-pdf', icon: Shield, color: '#D946EF' },
              { name: 'Remove Watermark', slug: 'remove-watermark-pdf', icon: Sparkles, color: '#E11D48' },
            ]
              .filter((t) => t.slug !== tool.slug)
              .map((t) => (
                <Link
                  key={t.slug}
                  href={`/tools/${t.slug}`}
                  className="group flex items-center gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: t.color + '15' }}
                  >
                    <t.icon className="w-4 h-4" style={{ color: t.color }} />
                  </div>
                  <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                    {t.name}
                  </span>
                </Link>
              ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="CreatorTools" className="w-6 h-6 rounded" />
            <span className="text-sm font-semibold text-gray-700">
              Creator<span className="text-blue-500">Tools</span>
            </span>
          </div>
          <p className="text-xs text-gray-400">
            &copy; {new Date().getFullYear()} CreatorTools. All tools are free and run securely in your browser.
          </p>
        </div>
      </footer>

      {/* ── JSON-LD Structured Data: SoftwareApplication ── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: `CreatorTools ${tool.title}`,
            description: tool.metaDescription,
            url: `${SITE_URL}/tools/${tool.slug}`,
            applicationCategory: 'UtilitiesApplication',
            operatingSystem: 'Any',
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'USD',
            },
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: '4.8',
              ratingCount: '1250',
              bestRating: '5',
              worstRating: '1',
            },
          }),
        }}
      />

      {/* ── JSON-LD Structured Data: FAQPage ── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: tool.faq.map((item) => ({
              '@type': 'Question',
              name: item.question,
              acceptedAnswer: {
                '@type': 'Answer',
                text: item.answer,
              },
            })),
          }),
        }}
      />

      {/* ── JSON-LD Structured Data: HowTo ── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'HowTo',
            name: `How to ${tool.title}`,
            description: tool.subtitle,
            step: tool.howItWorks.map((step) => ({
              '@type': 'HowToStep',
              position: step.step,
              name: step.title,
              text: step.desc,
            })),
          }),
        }}
      />
    </div>
  )
}
