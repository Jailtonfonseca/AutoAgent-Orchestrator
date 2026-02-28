import React, { useState, useEffect, useRef } from 'react';
import { Send, Terminal, Shield, Key, Settings as SettingsIcon, Play, Square, AlertCircle, CheckCircle2, Download, Eye, History, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageKind, WSMessage, AgentMessage, VerifierResult, CredentialRequest, ActionResult } from './types';
import Markdown from 'react-markdown';

// --- Components ---

const SetupModal = ({ onComplete }: { onComplete: () => void }) => {
  const [provider, setProvider] = useState('gemini');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gemini-3-flash-preview');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/config/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey, model })
      });
      onComplete();
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
      >
        <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mb-6">
          <SettingsIcon className="w-8 h-8 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Welcome to AutoAgent</h2>
        <p className="text-zinc-500 mb-6">
          Please configure your primary LLM provider to get started. This will be used for both the Agents and the Verifier.
        </p>
        
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-bold text-zinc-700 mb-1">Provider</label>
            <select 
              value={provider} 
              onChange={(e) => {
                setProvider(e.target.value);
                if (e.target.value === 'gemini') setModel('gemini-3-flash-preview');
                if (e.target.value === 'openai') setModel('gpt-4o');
                if (e.target.value === 'anthropic') setModel('claude-3-5-sonnet-20241022');
                if (e.target.value === 'openrouter') setModel('openai/gpt-4o');
                if (e.target.value === 'deepseek') setModel('deepseek-chat');
                if (e.target.value === 'groq') setModel('llama3-8b-8192');
              }}
              className="w-full p-3 rounded-xl border border-black/10 outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="gemini">Google Gemini</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="openrouter">OpenRouter</option>
              <option value="deepseek">DeepSeek</option>
              <option value="groq">Groq</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-zinc-700 mb-1">Model</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full p-3 rounded-xl border border-black/10 outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-zinc-700 mb-1">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={`Enter your ${provider} API Key`}
              className="w-full p-3 rounded-xl border border-black/10 outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={!apiKey || saving}
          className="w-full py-4 bg-black text-white rounded-2xl font-bold hover:bg-zinc-800 disabled:opacity-50 transition-all"
        >
          {saving ? 'Saving...' : 'Save & Continue'}
        </button>
      </motion.div>
    </div>
  );
};

const ConfigPanel = ({ onStart, isRunning }: { onStart: (config: any) => void, isRunning: boolean }) => {
  const [task, setTask] = useState('');
  const [autoApply, setAutoApply] = useState(true);
  const [language, setLanguage] = useState('English');

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-black/5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Play className="w-5 h-5 text-emerald-500" />
          New Task
        </h2>
        <select 
          value={language} 
          onChange={(e) => setLanguage(e.target.value)}
          className="text-sm p-2 rounded-lg border border-black/10 outline-none focus:ring-2 focus:ring-emerald-500/20 bg-zinc-50"
        >
          <option value="English">English</option>
          <option value="Portuguese">Português</option>
          <option value="Spanish">Español</option>
          <option value="French">Français</option>
          <option value="German">Deutsch</option>
        </select>
      </div>
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
          onClick={() => onStart({ task, autoApply, language })}
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

const Chat = ({ messages, onSendInput, isRunning }: { messages: any[], onSendInput: (text: string) => void, isRunning: boolean }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [inputText, setInputText] = useState('');

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (inputText.trim()) {
      onSendInput(inputText);
      setInputText('');
    }
  };

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
              {msg.kind === MessageKind.USER_MESSAGE && (
                <div className="bg-emerald-900/30 p-4 rounded-lg border border-emerald-500/30 text-emerald-100">
                  <div className="flex items-center gap-2 font-bold mb-2 text-emerald-400">
                    <MessageSquare className="w-4 h-4" /> User Instruction
                  </div>
                  <p className="whitespace-pre-wrap">{msg.payload.text}</p>
                </div>
              )}
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

      {isRunning && (
        <div className="mt-4 pt-4 border-t border-zinc-800 flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Send an instruction to the agents..."
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-zinc-100 outline-none focus:border-emerald-500/50 font-mono text-sm"
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim()}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white p-2 rounded-xl transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
};

const Settings = ({ credentials, onAdd, onDelete }: { credentials: any[], onAdd: (p: string, v: string) => void, onDelete: (p: string) => void }) => {
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
          Save Credential
        </button>
        <div className="pt-4 border-t border-black/5">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Stored Providers</h3>
          <div className="flex flex-col gap-2">
            {credentials.length === 0 && <span className="text-zinc-400 text-sm italic">No credentials stored.</span>}
            {credentials.map((c, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-zinc-50 border border-black/5 rounded-xl">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="font-medium">{c.provider}</span>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setProvider(c.provider)} 
                    className="text-xs font-bold text-zinc-500 hover:text-zinc-900 transition-colors"
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => onDelete(c.provider)} 
                    className="text-xs font-bold text-rose-500 hover:text-rose-700 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
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
        <p className="text-zinc-500 mb-4">
          An agent is requesting a <span className="font-bold text-zinc-900">{request.provider}</span> key.
          <br />
          <span className="text-sm italic">Reason: {request.description}</span>
        </p>
        
        {request.instructions && (
          <div className="mb-6 p-4 bg-amber-50 rounded-xl border border-amber-100 text-sm text-amber-800">
            <strong>How to get it:</strong><br/>
            {request.instructions}
          </div>
        )}

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
  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);
  const [infographic, setInfographic] = useState<string | null>(null);
  const [finalOutput, setFinalOutput] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    fetchCredentials();
    checkSetup();
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      setHistory(data);
    } catch (e) {
      console.error("Failed to fetch history", e);
    }
  };

  const loadHistoryTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/history/${taskId}`);
      const data = await res.json();
      setMessages(data);
      setInfographic(null);
      setFinalOutput(null);
      setIsRunning(false);
      
      const finalMsg = data.find((m: any) => m.kind === MessageKind.FINAL_OUTPUT);
      if (finalMsg) setFinalOutput(finalMsg.payload.content);
      
      const infoMsg = data.find((m: any) => m.kind === MessageKind.INFOGRAPHIC_READY);
      if (infoMsg) setInfographic(infoMsg.payload.html);
    } catch (e) {
      console.error("Failed to load task history", e);
    }
  };

  const checkSetup = async () => {
    try {
      const res = await fetch('/api/config/llm');
      const data = await res.json();
      setIsSetupComplete(data.configured);
    } catch (e) {
      console.error("Failed to check setup", e);
      setIsSetupComplete(false);
    }
  };

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
    setInfographic(null);
    setFinalOutput(null);
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
        } else if (msg.kind === MessageKind.INFOGRAPHIC_READY) {
          setInfographic(msg.payload.html);
        } else if (msg.kind === MessageKind.FINAL_OUTPUT) {
          setFinalOutput(msg.payload.content);
        } else if (msg.kind === MessageKind.FINISHED || msg.kind === MessageKind.ERROR) {
          setIsRunning(false);
          fetchHistory();
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

  const handleDeleteCredential = async (provider: string) => {
    try {
      await fetch(`/api/credentials/demo-user/${provider}`, {
        method: 'DELETE'
      });
      fetchCredentials();
    } catch (e) {
      console.error("Failed to delete credential", e);
    }
  };

  const handleSendInput = (text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ cmd: 'user_input', text }));
    }
  };

  if (isSetupComplete === null) return null;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans p-8">
      {!isSetupComplete && <SetupModal onComplete={() => setIsSetupComplete(true)} />}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Config & Settings */}
        <div className="lg:col-span-4 space-y-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
                <Shield className="text-white w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">AutoAgent</h1>
                <p className="text-xs text-zinc-500 font-medium uppercase tracking-widest">Orchestrator v1.0</p>
              </div>
            </div>
            <button 
              onClick={() => setIsSetupComplete(false)}
              className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
              title="Configure LLM"
            >
              <SettingsIcon className="w-5 h-5" />
            </button>
          </div>
          
          <ConfigPanel onStart={startTask} isRunning={isRunning} />
          <Settings credentials={credentials} onAdd={handleAddCredential} onDelete={handleDeleteCredential} />
          
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-black/5">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-zinc-500" />
              History
            </h2>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin">
              {history.length === 0 && <span className="text-zinc-400 text-sm italic">No previous tasks.</span>}
              {history.map((t, i) => (
                <button
                  key={i}
                  onClick={() => loadHistoryTask(t.id)}
                  className="w-full text-left p-3 rounded-xl border border-black/5 hover:bg-zinc-50 transition-colors"
                >
                  <div className="text-sm font-medium text-zinc-900 truncate">{t.task}</div>
                  <div className="text-xs text-zinc-500 mt-1 flex justify-between">
                    <span>{t.model}</span>
                    <span>{new Date(t.ts).toLocaleDateString()}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Audit Trail */}
        <div className="lg:col-span-8 space-y-4">
          <Chat messages={messages} onSendInput={handleSendInput} isRunning={isRunning} />
          
          <AnimatePresence>
            {finalOutput && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-8 bg-white border border-black/10 rounded-2xl shadow-xl"
              >
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-black/5">
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  </div>
                  <h3 className="font-bold text-xl">Final Output</h3>
                </div>
                <div className="prose prose-zinc max-w-none">
                  <Markdown>{finalOutput}</Markdown>
                </div>
              </motion.div>
            )}
            {infographic && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
                    <Download className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-emerald-800 text-lg">Infográfico Pronto!</h3>
                    <p className="text-sm text-emerald-600 font-medium">O resumo visual da tarefa foi gerado com sucesso.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => {
                      const blob = new Blob([infographic], { type: 'text/html' });
                      const url = URL.createObjectURL(blob);
                      window.open(url, '_blank');
                    }} 
                    className="px-5 py-2.5 bg-white text-emerald-700 font-bold rounded-xl shadow-sm hover:bg-emerald-50 transition-all flex items-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    Visualizar
                  </button>
                  <button 
                    onClick={() => {
                      const blob = new Blob([infographic], { type: 'text/html' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'infografico-autoagent.html';
                      a.click();
                    }} 
                    className="px-5 py-2.5 bg-emerald-500 text-white font-bold rounded-xl shadow-sm hover:bg-emerald-600 transition-all flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Baixar HTML
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
