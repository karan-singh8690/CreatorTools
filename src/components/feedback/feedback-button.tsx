'use client'

import { useState, useCallback } from 'react'
import { MessageSquare, Send, Loader2, CheckCircle2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export function FeedbackButton() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleSubmit = useCallback(async () => {
    if (!message.trim()) {
      toast.error('Please enter a message')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.trim(),
          email: email.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to submit feedback')
      }

      setIsSuccess(true)
      toast.success('Thank you for your feedback! 🎉')

      // Reset after showing success state briefly
      setTimeout(() => {
        setOpen(false)
        // Reset form after dialog close animation
        setTimeout(() => {
          setMessage('')
          setEmail('')
          setIsSuccess(false)
        }, 300)
      }, 1500)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }, [message, email])

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      // Don't reset immediately — let close animation finish
      setTimeout(() => {
        setIsSuccess(false)
      }, 300)
    }
  }, [])

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-30 md:z-40 flex items-center gap-2 px-4 py-3 bg-[#4A90D9] hover:bg-[#3A7BC8] text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95 group"
        aria-label="Send feedback"
      >
        <MessageSquare className="w-5 h-5 transition-transform group-hover:scale-110" />
        <span className="text-sm font-medium hidden sm:inline">Feedback</span>
      </button>

      {/* Feedback Dialog */}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          {isSuccess ? (
            /* Success State */
            <div className="flex flex-col items-center justify-center py-6 gap-3">
              <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800">Feedback Sent!</h3>
              <p className="text-sm text-gray-500 text-center">
                Thank you for helping us improve CreatorTools.
              </p>
            </div>
          ) : (
            /* Form State */
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-[#4A90D9]" />
                  Send Feedback
                </DialogTitle>
                <DialogDescription>
                  Share your thoughts, report bugs, or suggest features. We read every message.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                {/* Message Field */}
                <div className="space-y-2">
                  <Label htmlFor="feedback-message" className="text-sm font-medium text-gray-700">
                    Message <span className="text-red-400">*</span>
                  </Label>
                  <Textarea
                    id="feedback-message"
                    placeholder="What's on your mind? Bug reports, feature ideas, or just saying hi..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="min-h-[120px] resize-none"
                    maxLength={5000}
                    disabled={isSubmitting}
                  />
                  <p className="text-[11px] text-gray-400 text-right">
                    {message.length}/5000
                  </p>
                </div>

                {/* Email Field (Optional) */}
                <div className="space-y-2">
                  <Label htmlFor="feedback-email" className="text-sm font-medium text-gray-700">
                    Email <span className="text-gray-400 font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="feedback-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting}
                  />
                  <p className="text-[11px] text-gray-400">
                    So we can reply if needed. We won&apos;t spam you.
                  </p>
                </div>

                {/* Submit Button */}
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !message.trim()}
                  className="w-full bg-[#4A90D9] hover:bg-[#3A7BC8] text-white"
                  size="lg"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Submit Feedback
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
