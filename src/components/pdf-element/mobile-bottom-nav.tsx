'use client'

import { useAppStore, ViewType } from '@/store/app-store'
import {
  Home,
  Zap,
  FileText,
  QrCode,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  id: string
  label: string
  icon: React.ElementType
  view: ViewType
}

const navItems: NavItem[] = [
  { id: 'home', label: 'Home', icon: Home, view: 'home' },
  { id: 'tools', label: 'Tools', icon: Zap, view: 'all-tools' },
  { id: 'files', label: 'Files', icon: FileText, view: 'home' },
  { id: 'qr', label: 'QR Code', icon: QrCode, view: 'qr-generator' },
  { id: 'settings', label: 'Settings', icon: Settings, view: 'settings' },
]

export function MobileBottomNav() {
  const { currentView, setCurrentView, setActiveSidebarItem, setFileFilter } = useAppStore()

  const handleNavClick = (item: NavItem) => {
    if (item.id === 'files') {
      setFileFilter('all')
      setActiveSidebarItem('recent-files')
    }
    setCurrentView(item.view)
  }

  const isActive = (item: NavItem) => {
    if (item.id === 'home' && currentView === 'home') return true
    if (item.id === 'tools' && currentView === 'all-tools') return true
    if (item.id === 'qr' && currentView === 'qr-generator') return true
    if (item.id === 'settings' && currentView === 'settings') return true
    if (item.id === 'files' && currentView === 'home') return true
    return false
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-14">
        {navItems.map((item) => {
          const active = isActive(item)
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item)}
              className={cn(
                'flex flex-col items-center justify-center text-center gap-0.5 flex-1 h-full py-1 transition-colors',
                active ? 'text-[#4A90D9]' : 'text-gray-400 active:text-gray-600'
              )}
            >
              <item.icon className={cn('w-5 h-5', active && 'stroke-[2.5]')} />
              <span className={cn('text-[10px] font-medium', active && 'font-semibold')}>
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
