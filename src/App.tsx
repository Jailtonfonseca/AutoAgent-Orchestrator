import React, { useState, useEffect, useRef } from 'react';
import { Send, Terminal, Shield, Key, Settings as SettingsIcon, Play, Square, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageKind, WSMessage, AgentMessage, VerifierResult, CredentialRequest, ActionResult } from './types';

// --- Components ---

const ConfigPanel = ({ onStart, isRunning }: { onStart: (config: any) => void, isRunning: boolean }) => {
  const [task, setTask] = useState('');
  const [autoApply, setAutoApply] = useState(true);

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-black/5">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <Play className="w-5 h-5 text-emerald-500" />
        New Task
      </h2>
      <textarea
        value={task}
        onChange={(e) => setTask(e.target.value)}
        placeholder="Describe the task for the agents..."
        className="w-full h-32 p-4 rounded-xl border border-black/10 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all resize-none mb-4"
      />
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer group">
          <div className={`w-10 h-6 rounded-full p-1 transition-colors ${autoApply ? 'bg-emerald-500' : 'bg-zinc-300'}`}>
            <div className={`w-4 h-4 bg-white rounded-full transition-transform ${autoApply ? 'translate-x-4' : 'translate-x-0'}`} />
          </div>
          <input type="checkbox" className="hidden" checked={autoApply} onChange={() => setAutoApply(!autoApply)} />
          <span className="text-sm font-medium text-zinc-600 group-hover:text-zinc-900">Auto-apply actions</span>
        </label>
        <button
          onClick={() => onStart({ task, autoApply })}
          disabled={isRunning || !task.trim()}
          className="px-6 py-2 bg-black text-white rounded-xl font-medium hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
        >
          {isRunning ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {isRunning ? 'Stop' : 'Start Execution'}
        </button>
      </div>
    </div>
  );
};

const Chat = ({ messages }: { messages: any[] }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="bg-zinc-950 rounded-2xl p-6 shadow-xl border border-white/10 flex flex-col h-[600px]">
      <div className="flex items-center gap-2 mb-4 text-zinc-400 font-mono text-xs uppercase tracking-widest">
        <Terminal className="w-4 h-4" />
        Audit Trail / Agent Logs
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-mono text-sm"
            >
              {msg.kind === MessageKind.AGENT_MESSAGE && (
                <div className="bg-zinc-900/50 p-4 rounded-lg border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-emerald-400 font-bold">{msg.payload.sender} → {msg.payload.recipient}</span>
                    <span className="text-zinc-600 text-xs">{new Date(msg.payload.ts).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-zinc-300 whitespace-pre-wrap">{msg.payload.content}</p>
                </div>
              )}
              {msg.kind === MessageKind.VERIFIER_RESULT && (
                <div className={`p-3 rounded-lg border flex items-start gap-3 ${msg.payload.verdict === 'pass' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
                  <Shield className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-bold flex items-center gap-2">
                      Verifier: {msg.payload.verdict.toUpperCase()} 
                      <span className="text-xs font-normal opacity-70">({(msg.payload.confidence * 100).toFixed(0)}% confidence)</span>
                    </div>
                    <p className="text-xs opacity-90">{msg.payload.reason}</p>
                    {msg.payload.suggested_actions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {msg.payload.suggested_actions.map((a: string, j: number) => (
                          <span key={j} className="text-[10px] px-2 py-0.5 rounded bg-black/20 border border-current/20">{a}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {msg.kind === MessageKind.INFO && (
                <div className="text-zinc-500 flex items-center gap-2 italic">
                  <div className="w-1 h-1 rounded-full bg-zinc-700" />
                  {msg.payload.msg}
                </div>
              )}
              {msg.kind === MessageKind.ACTION_RESULT && (
                <div className="text-amber-400 flex items-center gap-2 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  {msg.payload.detail}
                </div>
              )}
              {msg.kind === MessageKind.ERROR && (
                <div className="text-rose-500 flex items-center gap-2 font-bold">
                  <AlertCircle className="w-4 h-4" />
                  Error: {msg.payload.msg}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

const Settings = ({ credentials, onAdd }: { credentials: any[], onAdd: (p: string, v: string) => void }) => {
  const [provider, setProvider] = useState('');
  const [value, setValue] = useState('');

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-black/5">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <SettingsIcon className="w-5 h-5 text-zinc-500" />
        Credential Manager
      </h2>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <input
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            placeholder="Provider (e.g. github)"
            className="p-3 rounded-xl border border-black/10 outline-none focus:ring-2 focus:ring-black/5"
          />
          <input
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="API Key / Secret"
            className="p-3 rounded-xl border border-black/10 outline-none focus:ring-2 focus:ring-black/5"
          />
        </div>
        <button
          onClick={() => { onAdd(provider, value); setProvider(''); setValue(''); }}
          disabled={!provider || !value}
          className="w-full py-3 bg-zinc-100 text-zinc-900 rounded-xl font-medium hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
        >
          <Key className="w-4 h-4" />
          Add Credential
        </button>
        <div className="pt-4 border-t border-black/5">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Stored Providers</h3>
          <div className="flex flex-wrap gap-2">
            {credentials.length === 0 && <span className="text-zinc-400 text-sm italic">No credentials stored.</span>}
            {credentials.map((c, i) => (
              <span key={i} className="px-3 py-1 bg-zinc-50 border border-black/5 rounded-full text-sm font-medium flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                {c.provider}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const CredentialModal = ({ request, onSubmit, onCancel }: { request: CredentialRequest, onSubmit: (v: string) => void, onCancel: () => void }) => {
  const [value, setValue] = useState('');

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
      >
        <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mb-6">
          <Key className="w-8 h-8 text-amber-600" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Credential Required</h2>
        <p className="text-zinc-500 mb-6">
          An agent is requesting a <span className="font-bold text-zinc-900">{request.provider}</span> key.
          <br />
          <span className="text-sm italic">Reason: {request.description}</span>
        </p>
        <input
          type="password"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter API Key"
          className="w-full p-4 rounded-2xl border-2 border-zinc-100 focus:border-amber-500 outline-none transition-all mb-6"
        />
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(value)}
            disabled={!value}
            className="flex-1 py-4 bg-amber-500 text-white rounded-2xl font-bold hover:bg-amber-600 disabled:opacity-50 transition-all"
          >
            Provide Key
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [isRunning, setIsRunning] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [credentials, setCredentials] = useState<any[]>([]);
  const [pendingRequest, setPendingRequest] = useState<CredentialRequest | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    fetchCredentials();
  }, []);

  const fetchCredentials = async () => {
    try {
      const res = await fetch('/api/credentials/demo-user');
      const data = await res.json();
      setCredentials(data);
    } catch (e) {
      console.error("Failed to fetch credentials", e);
    }
  };

  const startTask = async (config: any) => {
    setMessages([]);
    setIsRunning(true);
    try {
      const res = await fetch('/api/start-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, user_id: 'demo-user' })
      });
      const { ws: wsPath } = await res.json();
      
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}${wsPath}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        const msg: WSMessage = JSON.parse(event.data);
        setMessages(prev => [...prev, msg]);

        if (msg.kind === MessageKind.CREDENTIAL_REQUEST) {
          setPendingRequest(msg.payload);
        } else if (msg.kind === MessageKind.FINISHED || msg.kind === MessageKind.ERROR) {
          setIsRunning(false);
        }
      };

      ws.onclose = () => setIsRunning(false);
    } catch (e) {
      console.error("Failed to start task", e);
      setIsRunning(false);
    }
  };

  const handleAddCredential = async (provider: string, value: string) => {
    try {
      await fetch('/api/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 'demo-user', provider, value })
      });
      fetchCredentials();
      if (pendingRequest?.provider === provider) {
        setPendingRequest(null);
      }
    } catch (e) {
      console.error("Failed to add credential", e);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans p-8">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Config & Settings */}
        <div className="lg:col-span-4 space-y-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
              <Shield className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">AutoAgent</h1>
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-widest">Orchestrator v1.0</p>
            </div>
          </div>
          
          <ConfigPanel onStart={startTask} isRunning={isRunning} />
          <Settings credentials={credentials} onAdd={handleAddCredential} />
        </div>

        {/* Right Column: Audit Trail */}
        <div className="lg:col-span-8">
          <Chat messages={messages} />
        </div>
      </div>

      <AnimatePresence>
        {pendingRequest && (
          <CredentialModal
            request={pendingRequest}
            onSubmit={(val) => handleAddCredential(pendingRequest.provider, val)}
            onCancel={() => setPendingRequest(null)}
          />
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
}
