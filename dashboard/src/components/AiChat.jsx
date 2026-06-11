import { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Bot, X, Send, ChevronDown, Loader2, CheckCircle, XCircle, AlertTriangle, Wrench } from 'lucide-react';
import api from '../lib/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function ToolBadge({ tool }) {
  const icon = tool.ok === false
    ? <XCircle size={12} style={{ color: 'var(--discord-red)' }} />
    : tool.ok === true
      ? <CheckCircle size={12} style={{ color: 'var(--discord-green)' }} />
      : <Loader2 size={12} className="animate-spin" style={{ color: 'var(--discord-blurple)' }} />;

  const labels = {
    create_channel: 'Создание канала',
    delete_channel: 'Удаление канала',
    create_role:    'Создание роли',
    delete_role:    'Удаление роли',
    rename_channel: 'Переименование',
    list_server_state: 'Загрузка данных',
    propose_plan:   'Составление плана',
  };

  return (
    <div className="flex items-center gap-1.5 text-xs py-1 px-2 rounded" style={{ backgroundColor: 'rgba(88,101,242,0.1)', color: 'var(--discord-text-muted)' }}>
      <Wrench size={11} />
      <span>{labels[tool.name] || tool.name}</span>
      {tool.input?.name && <span className="opacity-60">— {tool.input.name}</span>}
      {tool.input?.newName && <span className="opacity-60">→ {tool.input.newName}</span>}
      <span className="ml-auto">{icon}</span>
    </div>
  );
}

function PlanCard({ plan, onConfirm, onCancel, confirmed }) {
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(250,166,26,0.3)', backgroundColor: 'rgba(250,166,26,0.06)' }}>
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid rgba(250,166,26,0.2)', backgroundColor: 'rgba(250,166,26,0.1)' }}>
        <AlertTriangle size={14} style={{ color: '#FAA61A' }} />
        <span className="text-sm font-semibold" style={{ color: '#FAA61A' }}>{plan.title}</span>
      </div>
      <div className="px-3 py-2.5 space-y-2">
        <p className="text-sm" style={{ color: 'var(--discord-text-muted)' }}>{plan.summary}</p>
        <ol className="space-y-1">
          {plan.steps.map((step, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <span className="flex-shrink-0 w-5 h-5 rounded-full text-xs flex items-center justify-center font-medium" style={{ backgroundColor: 'rgba(88,101,242,0.2)', color: 'var(--discord-blurple)' }}>{i + 1}</span>
              <span style={{ color: 'var(--discord-text)' }}>{step}</span>
            </li>
          ))}
        </ol>
        {plan.warning && (
          <p className="text-xs p-2 rounded" style={{ backgroundColor: 'rgba(237,66,69,0.1)', color: 'var(--discord-red)' }}>
            ⚠ {plan.warning}
          </p>
        )}
        {!confirmed && (
          <div className="flex gap-2 pt-1">
            <button onClick={onConfirm} className="discord-btn discord-btn-danger flex-1 text-sm py-1.5">Подтвердить</button>
            <button onClick={onCancel} className="discord-btn discord-btn-ghost flex-1 text-sm py-1.5">Отмена</button>
          </div>
        )}
        {confirmed && (
          <p className="text-xs text-center py-1" style={{ color: 'var(--discord-green)' }}>✓ Выполняется…</p>
        )}
      </div>
    </div>
  );
}

function Message({ msg, onConfirmPlan, onCancelPlan }) {
  const isUser = msg.role === 'user';

  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--discord-blurple)' }}>
          <Bot size={14} className="text-white" />
        </div>
      )}
      <div className={`max-w-[85%] space-y-1.5 ${isUser ? 'items-end flex flex-col' : ''}`}>
        {msg.tools && msg.tools.length > 0 && !isUser && (
          <div className="space-y-1 w-full">
            {msg.tools.map((t, i) => <ToolBadge key={i} tool={t} />)}
          </div>
        )}
        {msg.plan && !isUser && (
          <PlanCard
            plan={msg.plan}
            onConfirm={() => onConfirmPlan(msg.id)}
            onCancel={() => onCancelPlan(msg.id)}
            confirmed={msg.planConfirmed}
          />
        )}
        {msg.text && (
          <div
            className="text-sm px-3 py-2 rounded-lg leading-relaxed whitespace-pre-wrap"
            style={isUser
              ? { backgroundColor: 'var(--discord-blurple)', color: 'white', borderRadius: '16px 4px 16px 16px' }
              : { backgroundColor: 'var(--discord-bg-secondary)', color: 'var(--discord-text)', borderRadius: '4px 16px 16px 16px' }
            }
          >
            {msg.text}
          </div>
        )}
        {msg.streaming && !msg.text && !msg.plan && (
          <div className="flex items-center gap-1.5 px-3 py-2" style={{ color: 'var(--discord-text-muted)' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: 'var(--discord-text-muted)', animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: 'var(--discord-text-muted)', animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: 'var(--discord-text-muted)', animationDelay: '300ms' }} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function AiChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  // Full OpenAI-style message history (preserves tool_calls context)
  const apiMessagesRef = useRef([]);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);
  const qc = useQueryClient();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function addUserMsg(text) {
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', text }]);
  }

  function createBotMsg() {
    const id = Date.now() + 1;
    setMessages(prev => [...prev, { id, role: 'bot', text: '', tools: [], streaming: true }]);
    return id;
  }

  function updateBotMsg(id, updater) {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...updater(m) } : m));
  }

  async function sendMessage(text, isConfirmation = false, planSteps = null) {
    if (!text.trim() || loading) return;
    setLoading(true);

    if (!isConfirmation) {
      addUserMsg(text);
      setInput('');
    }

    const msgId = createBotMsg();
    const token = localStorage.getItem('jwt');

    try {
      const response = await fetch(`${API_BASE}/api/v1/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: text,
          // Keep only last 6 messages to stay within token limits
          apiMessages: apiMessagesRef.current.slice(-6),
          planConfirmed: isConfirmation,
        }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentText = '';
      let currentTools = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          let event;
          try { event = JSON.parse(line.slice(6)); } catch { continue; }

          if (event.type === 'text') {
            currentText += event.text;
            updateBotMsg(msgId, () => ({ text: currentText, streaming: true }));
          }

          if (event.type === 'tool_start') {
            currentTools = [...currentTools, { name: event.toolName, input: event.input, ok: null }];
            updateBotMsg(msgId, () => ({ tools: currentTools }));
          }

          if (event.type === 'tool_end') {
            currentTools = currentTools.map(t =>
              t.name === event.toolName && t.ok === null ? { ...t, ok: event.ok } : t
            );
            updateBotMsg(msgId, () => ({ tools: currentTools }));
          }

          if (event.type === 'plan') {
            updateBotMsg(msgId, () => ({ plan: event.plan, streaming: false }));
          }

          if (event.type === 'done') {
            updateBotMsg(msgId, () => ({ streaming: false }));
            if (event.invalidate) qc.invalidateQueries();
            // Store only last 4 messages to keep token usage low
            if (event.apiMessages) {
              apiMessagesRef.current = event.apiMessages.slice(-4);
            }
          }

          if (event.type === 'error') {
            updateBotMsg(msgId, () => ({ text: `Ошибка: ${event.message}`, streaming: false }));
          }
        }
      }

    } catch (err) {
      updateBotMsg(msgId, () => ({ text: `Ошибка соединения: ${err.message}`, streaming: false }));
    } finally {
      setLoading(false);
    }
  }

  function handleConfirmPlan(msgId) {
    const planMsg = messages.find(m => m.id === msgId);
    const plan = planMsg?.plan;
    const stepsText = plan?.steps?.map((s, i) => `${i + 1}. ${s}`).join('\n') || '';
    const confirmText = stepsText
      ? `Подтверждаю. Выполни план:\n${stepsText}`
      : 'Подтверждаю, выполни план.';
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, planConfirmed: true } : m));
    sendMessage(confirmText, true);
  }

  function handleCancelPlan(msgId) {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, planCancelled: true } : m));
    apiMessagesRef.current = [];
    setMessages(prev => [...prev, { id: Date.now(), role: 'bot', text: 'Отменено.', tools: [] }]);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95"
        style={{ backgroundColor: 'var(--discord-blurple)', boxShadow: '0 4px 20px rgba(88,101,242,0.5)' }}
        title="AI Assistant"
      >
        {open
          ? <ChevronDown size={22} className="text-white" />
          : <Bot size={22} className="text-white" />
        }
      </button>

      {/* Chat window */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-40 w-96 flex flex-col rounded-xl overflow-hidden shadow-2xl"
          style={{
            height: '520px',
            backgroundColor: 'var(--discord-bg)',
            border: '1px solid var(--discord-border)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
            style={{ backgroundColor: 'var(--discord-bg-secondary)', borderBottom: '1px solid var(--discord-border)' }}
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--discord-blurple)' }}>
              <Bot size={16} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">AI Ассистент</p>
              <p className="text-xs" style={{ color: 'var(--discord-green)' }}>● Онлайн · claude-sonnet-4-6</p>
            </div>
            <button
              onClick={() => { setMessages([]); apiMessagesRef.current = []; }}
              className="text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors"
              style={{ color: 'var(--discord-text-muted)' }}
              title="Очистить историю"
            >
              Очистить
            </button>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded hover:bg-white/10 transition-colors"
              style={{ color: 'var(--discord-text-muted)' }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: 'var(--discord-text-muted)' }}>
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(88,101,242,0.1)' }}>
                  <Bot size={24} style={{ color: 'var(--discord-blurple)' }} />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium text-white">Чем могу помочь?</p>
                  <p className="text-xs">Управляй сервером голосом — создавай каналы, роли, реструктурируй</p>
                </div>
                <div className="space-y-1.5 w-full mt-2">
                  {[
                    'Создай канал #общение',
                    'Покажи все роли сервера',
                    'Пересоздай структуру сервера с нуля',
                  ].map(hint => (
                    <button
                      key={hint}
                      onClick={() => { setInput(hint); inputRef.current?.focus(); }}
                      className="w-full text-left text-xs px-3 py-2 rounded-lg transition-colors hover:bg-white/10"
                      style={{ border: '1px solid var(--discord-border)', color: 'var(--discord-text-muted)' }}
                    >
                      {hint}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map(msg => (
              <Message
                key={msg.id}
                msg={msg}
                onConfirmPlan={handleConfirmPlan}
                onCancelPlan={handleCancelPlan}
              />
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex-shrink-0 p-3" style={{ borderTop: '1px solid var(--discord-border)', backgroundColor: 'var(--discord-bg-secondary)' }}>
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Напиши команду…"
                disabled={loading}
                rows={1}
                className="discord-input resize-none flex-1 text-sm py-2 max-h-28"
                style={{ lineHeight: '1.5' }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={loading || !input.trim()}
                className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
                style={{
                  backgroundColor: (loading || !input.trim()) ? 'var(--discord-border)' : 'var(--discord-blurple)',
                  color: 'white',
                }}
              >
                {loading
                  ? <Loader2 size={15} className="animate-spin" />
                  : <Send size={15} />
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
