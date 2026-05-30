'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { HardHat } from 'lucide-react'
import { toast } from 'sonner'

interface ComingSoonDialogProps {
  toolName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ComingSoonDialog({
  toolName,
  open,
  onOpenChange,
}: ComingSoonDialogProps) {
  const handleNotifyMe = () => {
    toast.success(`You'll be notified when ${toolName} is available!`, {
      description: 'We saved your interest for this feature.',
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center mb-2">
            <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center">
              <HardHat className="w-8 h-8 text-amber-500" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl">
            {toolName} — Coming Soon
          </DialogTitle>
          <DialogDescription className="text-center">
            We&apos;re working hard to bring you the <strong>{toolName}</strong>{' '}
            feature. It&apos;s currently under development and will be available
            in a future update.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/50 p-4 text-center">
          <p className="text-sm text-amber-700">
            This feature is being crafted with care. Want to be the first to
            know when it&apos;s ready?
          </p>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-center">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="sm:min-w-[100px]"
          >
            Close
          </Button>
          <Button
            onClick={handleNotifyMe}
            className="sm:min-w-[140px] bg-amber-500 hover:bg-amber-600 text-white"
          >
            Notify Me
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
