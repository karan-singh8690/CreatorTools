'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  ExternalLink,
  Star,
  Sparkles,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PartnerCategory, Partner } from '@/lib/partners'

// ─── Dialog Version (for placeholder tools) ─────────────────────────────

interface PartnerRecommendationDialogProps {
  category: PartnerCategory | undefined
  toolName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PartnerRecommendationDialog({
  category,
  toolName,
  open,
  onOpenChange,
}: PartnerRecommendationDialogProps) {
  if (!category) {
    // Fallback for tools without partner config
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center mb-2">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-amber-500" />
              </div>
            </div>
            <DialogTitle className="text-center text-xl">
              {toolName} — Coming Soon
            </DialogTitle>
            <DialogDescription className="text-center">
              We&apos;re working on bringing you the <strong>{toolName}</strong> feature. Stay tuned for updates!
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-center mb-2">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-100 to-amber-50 flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-orange-500" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl">
            {category.title}
          </DialogTitle>
          <DialogDescription className="text-center text-sm leading-relaxed">
            {category.subtitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {category.partners.map((partner, index) => (
            <PartnerCard key={partner.id} partner={partner} featured={index === 0} />
          ))}
        </div>

        <div className="mt-4 text-center">
          <p className="text-[10px] text-gray-400">
            These are partner recommendations. We may earn a commission if you sign up.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Inline Card Version (for AI fallback in tool views) ────────────────

interface PartnerRecommendationInlineProps {
  category: PartnerCategory
  compact?: boolean
  className?: string
}

export function PartnerRecommendationInline({
  category,
  compact = false,
  className,
}: PartnerRecommendationInlineProps) {
  const [expanded, setExpanded] = useState(false)
  const visiblePartners = expanded ? category.partners : category.partners.slice(0, 1)

  return (
    <Card className={cn('border-amber-200 bg-gradient-to-br from-amber-50/60 to-orange-50/40', className)}>
      <CardContent className={cn(compact ? 'p-3' : 'p-4')}>
        <div className="flex items-start gap-3">
          <div className={cn(
            'rounded-lg bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center shrink-0',
            compact ? 'w-8 h-8' : 'w-10 h-10'
          )}>
            <Sparkles className={cn('text-orange-500', compact ? 'w-4 h-4' : 'w-5 h-5')} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className={cn('font-semibold text-gray-800', compact ? 'text-xs' : 'text-sm')}>
              {category.title}
            </h4>
            {!compact && (
              <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                {category.subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {visiblePartners.map((partner) => (
            <div
              key={partner.id}
              className="bg-white/80 rounded-lg border border-amber-100 p-3 hover:border-amber-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800">{partner.name}</span>
                    {partner.badge && (
                      <Badge className="text-[9px] h-4 px-1.5 bg-orange-100 text-orange-700 hover:bg-orange-100">
                        <Star className="w-2.5 h-2.5 mr-0.5" />
                        {partner.badge}
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{partner.description}</p>
                </div>
                <a
                  href={partner.url}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="shrink-0"
                >
                  <Button
                    size="sm"
                    className="h-7 text-[11px] bg-orange-500 hover:bg-orange-600 text-white gap-1"
                  >
                    Try Free
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                </a>
              </div>
              {!compact && (
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2">
                  {partner.features.map((feature) => (
                    <span key={feature} className="text-[10px] text-gray-400 flex items-center gap-0.5">
                      <Check className="w-2.5 h-2.5 text-green-400" />
                      {feature}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {category.partners.length > 1 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 w-full text-center text-[11px] text-orange-600 hover:text-orange-700 font-medium flex items-center justify-center gap-1 py-1"
          >
            {expanded ? (
              <>
                Show Less <ChevronUp className="w-3 h-3" />
              </>
            ) : (
              <>
                {category.partners.length - 1} more option{category.partners.length - 1 > 1 ? 's' : ''} <ChevronDown className="w-3 h-3" />
              </>
            )}
          </button>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Partner Card (used in dialog) ──────────────────────────────────────

function PartnerCard({ partner, featured }: { partner: Partner; featured: boolean }) {
  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-all',
        featured
          ? 'border-orange-200 bg-white shadow-sm'
          : 'border-gray-100 bg-white/60 hover:bg-white'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Partner Logo placeholder */}
        <div className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center shrink-0',
          featured
            ? 'bg-gradient-to-br from-orange-100 to-amber-50'
            : 'bg-gray-50'
        )}>
          <span className="text-lg font-bold text-gray-600">
            {partner.name.charAt(0)}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-800">{partner.name}</h3>
            {partner.badge && (
              <Badge className={cn(
                'text-[9px] h-4 px-1.5',
                featured
                  ? 'bg-orange-100 text-orange-700 hover:bg-orange-100'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-100'
              )}>
                <Star className="w-2.5 h-2.5 mr-0.5" />
                {partner.badge}
              </Badge>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">{partner.description}</p>

          {/* Features */}
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2">
            {partner.features.map((feature) => (
              <span key={feature} className="text-[10px] text-gray-400 flex items-center gap-0.5">
                <Check className="w-2.5 h-2.5 text-green-400" />
                {feature}
              </span>
            ))}
          </div>

          {/* CTA Button */}
          <a
            href={partner.url}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="inline-block mt-3"
          >
            <Button
              size="sm"
              className={cn(
                'h-8 text-xs gap-1.5',
                featured
                  ? 'bg-orange-500 hover:bg-orange-600 text-white'
                  : 'bg-gray-800 hover:bg-gray-900 text-white'
              )}
            >
              {partner.badge === 'Free Trial' || partner.badge === 'Free App' || partner.badge === 'Free Tier' || partner.badge === 'Free Demo'
                ? 'Try It Free'
                : partner.badge === 'Best Value' || partner.badge === 'Best Quality' || partner.badge === 'Best Accuracy'
                  ? 'Get Started'
                  : 'Learn More'}
              <ExternalLink className="w-3 h-3" />
            </Button>
          </a>
        </div>
      </div>
    </div>
  )
}
