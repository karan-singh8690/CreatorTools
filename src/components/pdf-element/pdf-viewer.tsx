'use client'

import { useAppStore, ChatMessage } from '@/store/app-store'
import {
  Home,
  MessageSquare,
  Pencil,
  ArrowRightLeft,
  Eye,
  FolderTree,
  Wrench,
  Shield,
  LayoutGrid,
  Download,
  Printer,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Send,
  Mic,
  Paperclip,
  MessageCircle,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

export function PdfViewer() {
  const {
    selectedPdfFile,
    setCurrentView,
    pdfPage,
    setPdfPage,
    pdfTotalPages,
    chatMessages,
    addChatMessage,
    isChatLoading,
    setIsChatLoading,
  } = useAppStore()

  const [chatInput, setChatInput] = useState('')
  const [chatType, setChatType] = useState('pdf')
  const [showChat, setShowChat] = useState(true)
  const [showPrint, setShowPrint] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const file = selectedPdfFile || { name: 'document.pdf', pages: 1 }

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: chatInput.trim(),
      timestamp: new Date(),
    }

    addChatMessage(userMessage)
    setChatInput('')
    setIsChatLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: chatInput.trim(),
          fileName: file.name,
          history: chatMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      })

      const data = await response.json()

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message || 'I apologize, but I was unable to process your request. Please try again.',
        timestamp: new Date(),
      }

      addChatMessage(assistantMessage)
    } catch {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      }
      addChatMessage(errorMessage)
    } finally {
      setIsChatLoading(false)
    }
  }

  const handleSuggestedQuestion = (question: string) => {
    setChatInput(question)
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentView('home')}
            className="p-2 rounded hover:bg-gray-100 text-gray-500 transition-colors"
            title="Home"
          >
            <Home className="w-4 h-4" />
          </button>
          <Separator orientation="vertical" className="h-5 mx-1" />
          <button className="p-2 rounded hover:bg-gray-100 text-gray-500 transition-colors" title="Comment">
            <MessageSquare className="w-4 h-4" />
          </button>
          <button className="p-2 rounded hover:bg-gray-100 text-gray-500 transition-colors" title="Edit">
            <Pencil className="w-4 h-4" />
          </button>
          <button className="p-2 rounded hover:bg-gray-100 text-gray-500 transition-colors" title="Convert">
            <ArrowRightLeft className="w-4 h-4" />
          </button>
          <button className="p-2 rounded hover:bg-gray-100 text-gray-500 transition-colors" title="View">
            <Eye className="w-4 h-4" />
          </button>
          <button className="p-2 rounded hover:bg-gray-100 text-gray-500 transition-colors" title="Organize">
            <FolderTree className="w-4 h-4" />
          </button>
          <button className="p-2 rounded hover:bg-gray-100 text-gray-500 transition-colors" title="Tools">
            <Wrench className="w-4 h-4" />
          </button>
          <button className="p-2 rounded hover:bg-gray-100 text-gray-500 transition-colors" title="Protect">
            <Shield className="w-4 h-4" />
          </button>
          <button className="p-2 rounded hover:bg-gray-100 text-gray-500 transition-colors" title="All">
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowChat(!showChat)}
            className={cn(
              'p-2 rounded transition-colors',
              showChat ? 'bg-red-50 text-red-500 border border-red-200' : 'hover:bg-gray-100 text-gray-500'
            )}
            title="Chat with PDF"
          >
            <MessageCircle className="w-4 h-4" />
          </button>
          <button className="p-2 rounded hover:bg-gray-100 text-gray-500 transition-colors" title="Download">
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowPrint(!showPrint)}
            className="p-2 rounded hover:bg-gray-100 text-gray-500 transition-colors"
            title="Print"
          >
            <Printer className="w-4 h-4" />
          </button>
          <button className="p-2 rounded hover:bg-gray-100 text-gray-500 transition-colors" title="More">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex min-h-0">
        {/* Print Settings Panel (Left) */}
        {showPrint && (
          <div className="w-64 bg-white border-r border-gray-200 p-4 overflow-y-auto shrink-0">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Print</h3>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Printer</label>
                <div className="w-full px-3 py-2 border border-gray-200 rounded-md text-xs text-gray-600 bg-gray-50">
                  PDFelement Printer
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Print Settings</label>
                <div className="w-full px-3 py-2 border border-gray-200 rounded-md text-xs text-gray-600 bg-gray-50 mb-2">
                  Single side
                </div>
                <div className="w-full px-3 py-2 border border-gray-200 rounded-md text-xs text-gray-600 bg-gray-50 mb-2">
                  A4 21 × 29.7 cm
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs text-gray-600">
                    <input type="checkbox" className="rounded border-gray-300" />
                    The page size of the source file
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-600">
                    <input type="checkbox" className="rounded border-gray-300" />
                    Print as image
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-2 block">Orientation</label>
                <div className="flex gap-2">
                  <div className="w-10 h-14 border-2 border-gray-300 rounded-sm flex items-center justify-center">
                    <div className="w-6 h-8 border border-gray-400 rounded-sm" />
                  </div>
                  <div className="w-14 h-10 border-2 border-gray-300 rounded-sm flex items-center justify-center">
                    <div className="w-8 h-6 border border-gray-400 rounded-sm" />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-2 block">Page Range</label>
                <RadioGroup defaultValue="current" className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="current" id="current" className="h-3.5 w-3.5" />
                    <Label htmlFor="current" className="text-xs text-gray-600 font-normal">Current page</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="all" className="h-3.5 w-3.5" />
                    <Label htmlFor="all" className="text-xs text-gray-600 font-normal">All pages</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="custom" id="custom" className="h-3.5 w-3.5" />
                    <Label htmlFor="custom" className="text-xs text-gray-600 font-normal">Custom</Label>
                  </div>
                </RadioGroup>
              </div>

              <button className="text-xs text-[#4A90D9] hover:underline">
                Show Advanced Settings
              </button>

              <div className="space-y-2 pt-2">
                <Button variant="outline" className="w-full h-8 text-xs">
                  Add as Template
                </Button>
                <Button className="w-full h-8 text-xs bg-[#4A90D9] hover:bg-[#3A7BC8]">
                  Print
                </Button>
                <Button variant="outline" className="w-full h-8 text-xs" onClick={() => setShowPrint(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* PDF Document Viewer (Center) */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
            <div className="bg-white shadow-lg rounded-sm w-full max-w-[680px] aspect-[8.5/11] p-12">
              <div className="space-y-4">
                <h1 className="text-xl font-bold text-gray-900 leading-tight">
                  User Trust and Opinion Leader Interaction: The Moderating Effect of Psychological Congruence on Information Adoption
                </h1>
                <div className="text-sm text-gray-600 space-y-3">
                  <p className="font-semibold">Abstract</p>
                  <p className="text-xs leading-relaxed">
                    This study investigates the relationship between user trust and opinion leader interaction in the context of social media platforms. We examine how psychological congruence moderates the effect of trust on information adoption behaviors. Drawing on the elaboration likelihood model and social influence theory, we propose that psychological congruence between users and opinion leaders strengthens the positive relationship between trust and information adoption.
                  </p>
                  <p className="font-semibold mt-4">1. Introduction</p>
                  <p className="text-xs leading-relaxed">
                    In the era of social media, opinion leaders play a crucial role in shaping user attitudes and behaviors. The concept of opinion leadership, first introduced by Lazarsfeld et al. (1944), has evolved significantly with the rise of digital platforms. Users increasingly rely on opinion leaders for product recommendations, news consumption, and decision-making processes.
                  </p>
                  <p className="text-xs leading-relaxed mt-2">
                    Trust has been identified as a fundamental determinant of information adoption in online environments (McKnight et al., 2002). However, the mechanisms through which trust influences information adoption, particularly in the context of opinion leader interactions, remain underexplored. This study addresses this gap by introducing psychological congruence as a moderating variable.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Page Navigation */}
          <div className="flex items-center justify-center gap-3 py-2 bg-white border-t border-gray-200">
            <button
              onClick={() => setPdfPage(Math.max(1, pdfPage - 1))}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-400 disabled:opacity-30 transition-colors"
              disabled={pdfPage <= 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-gray-500">
              {pdfPage} / {pdfTotalPages}
            </span>
            <button
              onClick={() => setPdfPage(Math.min(pdfTotalPages, pdfPage + 1))}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-400 disabled:opacity-30 transition-colors"
              disabled={pdfPage >= pdfTotalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Chat with PDF Sidebar (Right) */}
        {showChat && (
          <div className="w-80 bg-white border-l border-gray-200 flex flex-col shrink-0">
            {/* Chat Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">Chat with PDF</h3>
              </div>
              <button
                onClick={() => setShowChat(false)}
                className="p-1 rounded hover:bg-gray-100 text-gray-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chat Type */}
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-[10px] font-medium text-gray-500 mb-2">Choose a Type</p>
              <RadioGroup value={chatType} onValueChange={setChatType} className="flex gap-4">
                <div className="flex items-center space-x-1.5">
                  <RadioGroupItem value="pdf" id="chat-pdf" className="h-3.5 w-3.5" />
                  <Label htmlFor="chat-pdf" className="text-xs text-gray-600 font-normal">Chat with PDF</Label>
                </div>
                <div className="flex items-center space-x-1.5">
                  <RadioGroupItem value="other" id="chat-other" className="h-3.5 w-3.5" />
                  <Label htmlFor="chat-other" className="text-xs text-gray-600 font-normal">Chat with Other</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Chat Messages */}
            <ScrollArea className="flex-1 px-4 py-3">
              <div className="space-y-3">
                {chatMessages.map((msg) => (
                  <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cn(
                        'max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed',
                        msg.role === 'user'
                          ? 'bg-[#4A90D9] text-white'
                          : 'bg-gray-100 text-gray-700'
                      )}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-lg px-3 py-2 text-xs text-gray-500">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>

            {/* Suggested Questions */}
            {chatMessages.length <= 1 && (
              <div className="px-4 py-2 border-t border-gray-100">
                <div className="space-y-1">
                  <button
                    onClick={() => handleSuggestedQuestion('Can you summarize the content of PDF?')}
                    className="w-full text-left text-[11px] text-[#4A90D9] hover:underline"
                  >
                    Q1: Can you summarize the content of PDF?
                  </button>
                  <button
                    onClick={() => handleSuggestedQuestion('What are the key points?')}
                    className="w-full text-left text-[11px] text-[#4A90D9] hover:underline"
                  >
                    Q2: What are the key points?
                  </button>
                </div>
              </div>
            )}

            {/* Chat Input */}
            <div className="px-4 py-3 border-t border-gray-200">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] text-gray-400">DeepSeek-V3</span>
              </div>
              <div className="flex items-end gap-2">
                <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400 shrink-0">
                  <Mic className="w-4 h-4" />
                </button>
                <div className="flex-1 relative">
                  <Textarea
                    placeholder="Ask anything about PDF... Press Enter to send"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSendMessage()
                      }
                    }}
                    className="min-h-[36px] max-h-[80px] text-xs resize-none pr-8"
                    rows={1}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!chatInput.trim() || isChatLoading}
                    className="absolute right-2 bottom-2 p-1 rounded text-[#4A90D9] hover:bg-blue-50 disabled:text-gray-300 disabled:hover:bg-transparent transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400 shrink-0">
                  <Paperclip className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1 truncate">{file.name}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
