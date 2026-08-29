import { useEffect, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'
import { Send, Sparkles } from 'lucide-react'
import { fetchCodebaseAnswer } from '../Slice/ReduxSlice/githubSlice.js'

const SUGGESTIONS = [
  'Where does caching happen?',
  'How do mutations retry?',
  'Where should I start reading?',
]

function fallbackReply(question) {
  const q = question.toLowerCase()

  if (q.includes('cache')) return 'The cache logic usually lives near the repo index or query state code. Start with the file that owns the query state and the indexing layer.'
  if (q.includes('mutat') || q.includes('retry')) return 'Mutations and retry behavior are typically handled in the request/update flow and the state wrapper around that call.'
  if (q.includes('start') || q.includes('read')) return 'Start from the entry file and the main state layer, then follow the first file that owns requests or repository indexing.'

  return 'I could not find a grounded answer in the indexed repo yet. Try asking about a specific file, function, or request flow.'
}

export default function ChatPanel({ owner, repo }) {
  const dispatch = useDispatch()
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Ask about this codebase and I will answer using the indexed files in this repo.',
    },
  ])
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, isThinking])

  function send(text) {
    const question = text.trim()
    if (!question) return
    setMessages((m) => [...m, { role: 'user', content: question }])
    setInput('')
    setIsThinking(true)
    dispatch(fetchCodebaseAnswer({ owner, repo, query: question }))
      .unwrap()
      .then((answer) => {
        setMessages((m) => [...m, { role: 'assistant', content: answer || fallbackReply(question) }])
      })
      .catch((error) => {
        setMessages((m) => [...m, { role: 'assistant', content: fallbackReply(question) + ` (${error})` }])
      })
      .finally(() => setIsThinking(false))
  }

  function handleSubmit(e) {
    e.preventDefault()
    send(input)
  }

  return (
    <div className="h-full flex flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin px-5 py-5 space-y-5">
        {messages.map((m, i) => (
          <ChatBubble key={i} role={m.role} content={m.content} />
        ))}
        {isThinking && (
          <div className="flex items-center gap-2 text-text-faint text-sm pl-1">
            <Sparkles size={13} className="text-signal animate-pulse" />
            <span className="font-mono">reading the codebase…</span>
          </div>
        )}

        {messages.length <= 1 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="text-xs font-mono px-2.5 py-1.5 rounded-md border border-ink-border text-text-muted hover:text-signal hover:border-signal/40 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-ink-border p-3.5">
        <div className="flex items-center gap-2 bg-ink-panelAlt border border-ink-border rounded-md px-3 py-2.5 focus-within:border-signal/50 transition-colors">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this codebase…"
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-faint focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            aria-label="Send message"
            className="text-signal disabled:text-text-faint disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <Send size={16} />
          </button>
        </div>
      </form>
    </div>
  )
}

function ChatBubble({ role, content }) {
  const isUser = role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[92%] text-[14px] leading-relaxed rounded-lg px-3.5 py-2.5 ${
          isUser
            ? 'bg-signal-soft/40 text-text-primary rounded-br-sm'
            : 'bg-ink-panelAlt text-text-muted rounded-bl-sm border border-ink-border'
        }`}
      >
        {content}
      </div>
    </div>
  )
}
