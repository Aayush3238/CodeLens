import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { aiAPI } from '../services/api'
import { PageHeader, Button, EmptyState, Skeleton } from '../components/ui'
import { Bot, Send, Plus, MessageSquare, User } from 'lucide-react'

function ChatMessage({ message }) {
  const isUser = message.role === 'user'
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isUser ? 'bg-primary-600' : 'bg-dark-700 bg-gray-200'}`}>
        {isUser ? <User size={16} /> : <Bot size={16} className="text-primary-400" />}
      </div>
      <div className={`max-w-[70%] rounded-2xl px-4 py-3 ${isUser ? 'bg-primary-600 text-white' : 'bg-dark-800 bg-gray-100 text-dark-100 text-gray-800'}`}>
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="text-sm prose prose-invert prose-sm max-w-none">
            <ReactMarkdown
              components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '')
                  return !inline && match ? (
                    <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div" className="rounded-lg">
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={className} {...props}>{children}</code>
                  )
                },
                p({ children }) {
                  return <p className="mb-2 last:mb-0">{children}</p>
                },
                ul({ children }) {
                  return <ul className="list-disc pl-4 mb-2">{children}</ul>
                },
                ol({ children }) {
                  return <ol className="list-decimal pl-4 mb-2">{children}</ol>
                },
                strong({ children }) {
                  return <strong className="font-bold">{children}</strong>
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </motion.div>
  )
}

export default function AICoach() {
  const [activeConversation, setActiveConversation] = useState(null)
  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)
  const queryClient = useQueryClient()

  const { data: conversations, isLoading: loadingConversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => aiAPI.getConversations().then((r) => r.data.conversations),
  })

  const createMutation = useMutation({
    mutationFn: () => aiAPI.createConversation({ title: 'New Chat' }).then((r) => r.data.conversation),
    onSuccess: (conv) => {
      setActiveConversation({ ...conv, messages: [] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })

  const handleSend = async () => {
    if (!input.trim() || !activeConversation) return
    const userMsg = { role: 'user', content: input, _pending: true }
    const pendingMsg = { role: 'assistant', content: '', _pending: true }

    setActiveConversation((prev) => ({
      ...prev,
      messages: [...(prev?.messages || []), userMsg, pendingMsg],
    }))

    const currentInput = input
    setInput('')

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/ai/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ conversationId: activeConversation.id, content: currentInput }),
      })

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.done) break
              if (data.content) {
                fullContent += data.content
                setActiveConversation((prev) => {
                  const msgs = [...(prev?.messages || [])]
                  const lastIdx = msgs.length - 1
                  msgs[lastIdx] = { ...msgs[lastIdx], content: fullContent }
                  return { ...prev, messages: msgs }
                })
              }
            } catch {}
          }
        }
      }

      setActiveConversation((prev) => {
        const msgs = [...(prev?.messages || [])]
        msgs[msgs.length - 1] = { role: 'assistant', content: fullContent }
        return { ...prev, messages: msgs }
      })
    } catch {
      setActiveConversation((prev) => {
        const msgs = [...(prev?.messages || [])]
        msgs[msgs.length - 1] = { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }
        return { ...prev, messages: msgs }
      })
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeConversation?.messages])

  return (
    <div className="h-[calc(100vh-120px)] flex gap-6">
      {/* Sidebar */}
      <div className="hidden md:flex flex-col w-64 card p-4">
        <Button onClick={() => createMutation.mutate()} className="w-full mb-4" disabled={createMutation.isPending}>
          <Plus size={16} className="mr-2" /> New Chat
        </Button>
        <div className="flex-1 overflow-y-auto scrollbar-thin space-y-2">
          {loadingConversations ? (
            [...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)
          ) : (
            (conversations || []).map((conv) => (
              <button
                key={conv.id}
                onClick={() => setActiveConversation(conv)}
                className={`w-full text-left p-3 rounded-xl text-sm transition-colors flex items-center gap-2 ${activeConversation?.id === conv.id ? 'bg-primary-600/10 text-primary-400 border border-primary-600/20' : 'hover:bg-dark-800 hover:bg-gray-100 text-dark-300 text-gray-600'}`}
              >
                <MessageSquare size={14} />
                <span className="truncate">{conv.title}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col card">
        {!activeConversation ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-primary-600/10 flex items-center justify-center mb-4">
              <Bot size={32} className="text-primary-400" />
            </div>
            <h3 className="text-xl font-bold mb-2">LeetCoach AI</h3>
            <p className="text-dark-400 text-gray-500 max-w-md mb-6">
              Ask me anything about algorithms, data structures, or get help understanding your solutions.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
              {['Explain this solution', 'Why did I get TLE?', 'Compare approaches', 'Give me a hint'].map((q) => (
                <button key={q} onClick={() => {
                  createMutation.mutate(undefined, {
                    onSuccess: () => setInput(q),
                  })
                }} className="p-3 rounded-xl bg-dark-800 bg-gray-100 hover:bg-dark-700 hover:bg-gray-200 text-left text-sm text-dark-300 text-gray-600 transition-colors">
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-4">
              {(activeConversation.messages || []).length === 0 && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-dark-700 bg-gray-200 flex items-center justify-center">
                    <Bot size={16} className="text-primary-400" />
                  </div>
                  <div className="bg-dark-800 bg-gray-100 rounded-2xl px-4 py-3">
                    <p className="text-sm">Hi! I'm LeetCoach AI. How can I help you today?</p>
                  </div>
                </div>
              )}
              {(activeConversation.messages || []).map((msg, i) => (
                <ChatMessage key={`${activeConversation.id}-${i}`} message={msg} />
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-dark-800 border-gray-200">
              <div className="flex gap-3">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Ask me anything..."
                  className="input flex-1"
                />
                <Button onClick={handleSend} disabled={!input.trim()}>
                  <Send size={16} />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
