import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Sparkles, Play, Square, Mic, Upload, Cpu, FileText, Pause, Settings, LayoutPanelTop, Trash2, X, Minus, Loader2, Maximize, MoreVertical, Download, Plus, Move, Eye, EyeOff, ChevronDown, ChevronUp, ChevronRight, Save, Crop, CheckCircle2, XCircle, AlertTriangle, Info, Edit2, Layout, ZoomIn, ZoomOut, Key, RefreshCcw, RefreshCw, ArrowDown, User, Clock, Keyboard, ClipboardPaste, Copy, Shield, ShieldAlert, ShieldCheck, Code2, BookOpen, Columns, Minimize2, HardDrive, MessageSquareShare, Image as ImageIcon, Send, Mail, FileCode } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { initAIClient, getInterviewAnswer, switchProvider } from './AIClient';
import type { TimedApiKey } from './AIClient';
import { initSTT, transcribeAudioChunk, setSTTApiKey } from './STTClient';
// @ts-ignore
const { ipcRenderer, shell, clipboard } = window.require('electron');
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyWqhztb7GbVlghFBJeusoJ-YcYx-9WPsADg9JbUXTOY-QKTpjR1ivKNyJP3iJ3wzpgKw/exec';



// Clean plain-English release notes formatter with top heading and description below
const renderReleaseNotes = (notes: any) => {
  const defaultHighlights = [
    {
      title: "Turbocharged Instant Startup Architecture",
      desc: "Instant single-instance check, tuned Chromium V8 bytecode caching, lazy-loaded subsystems, and Vite chunk splitting deliver near-instant cold-boot startup."
    },
    {
      title: "Guaranteed Instant Update Relaunch & Startup",
      desc: "Detached update launcher waits for file lock release, installs the new version, and automatically starts Clue AI without getting stuck or requiring manual intervention."
    },
    {
      title: "NSIS Installer Silent Execution Hooks",
      desc: "Native process termination and custom NSIS launch hooks ensure the application reliably restarts immediately upon update completion."
    },
    {
      title: "Interactive HTML Session Exports with Favicon & Branding",
      desc: "Exported session HTML files feature clickable question accordions, embedded session images, and official Clue AI atom favicon for browser tabs."
    }
  ];

  let points: { title: string, desc: string }[] = [];

  if (notes) {
    let text = typeof notes === 'string' ? notes : Array.isArray(notes) ? notes.map(n => n.note || n).join('\n') : JSON.stringify(notes);
    text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');

    // 1. Check for numbered blocks: e.g. "1. **Title**\n   - desc" or "1. Title: desc"
    const numberedRegex = /(?:^|\n)\s*\d+[\.\)]\s*(?:\*\*)?([^\n\*\:]+)(?:\*\*)?\s*[\:\-]?\s*([^\n]*(?:\n\s*[-*•]\s*[^\n]+)*)/g;
    let match;
    while ((match = numberedRegex.exec(text)) !== null) {
      const title = match[1].replace(/<[^>]+>/g, '').trim();
      let rawDesc = (match[2] || '').trim();
      // Clean leading bullet points or indentations from description
      const desc = rawDesc.replace(/^\s*[-*•]\s*/gm, '').replace(/\n+/g, ' ').replace(/<[^>]+>/g, '').replace(/\*\*/g, '').trim();
      if (title.length > 2 && !title.toLowerCase().startsWith("what's new") && !title.toLowerCase().startsWith("release notes")) {
        points.push({ title, desc });
      }
    }

    // 2. If numbered didn't match, check HTML list items
    if (points.length === 0) {
      const liMatches = text.match(/<li[^>]*>([\s\S]*?)<\/li>/gi);
      if (liMatches && liMatches.length > 0) {
        liMatches.forEach(item => {
          const clean = item.replace(/<[^>]+>/g, '').replace(/\?\?/g, '').trim();
          if (!clean) return;
          const colonIdx = clean.indexOf(':');
          if (colonIdx > 0 && colonIdx < 60) {
            points.push({ title: clean.substring(0, colonIdx).trim(), desc: clean.substring(colonIdx + 1).trim() });
          } else {
            points.push({ title: clean, desc: '' });
          }
        });
      }
    }

    // 3. Fallback to standard bullet points
    if (points.length === 0) {
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.startsWith('-') || l.startsWith('*') || l.startsWith('•'));
      lines.forEach(l => {
        const clean = l.replace(/^[-*•]\s*/, '').replace(/<[^>]+>/g, '').replace(/\*\*/g, '').replace(/\?\?/g, '').trim();
        if (!clean) return;
        const colonIdx = clean.indexOf(':');
        if (colonIdx > 0 && colonIdx < 60) {
          points.push({ title: clean.substring(0, colonIdx).trim(), desc: clean.substring(colonIdx + 1).trim() });
        } else {
          points.push({ title: clean, desc: '' });
        }
      });
    }
  }

  const listToRender = points.length > 0 ? points : defaultHighlights;

  return (
    <div className="space-y-3">
      {listToRender.map((p, idx) => (
        <div key={idx} className="flex flex-col bg-white/[0.03] border border-white/5 rounded-xl p-3 hover:border-cyan-500/30 transition-all shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
            <span className="font-bold text-white text-xs tracking-wide">{p.title}</span>
          </div>
          {p.desc && (
            <div className="text-[11px] text-white/70 leading-relaxed pl-4">
              {p.desc}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const CopyButton = ({ text, className, tooltip: _tooltip, size = 14 }: { text: string, className?: string, tooltip?: string, size?: number }) => {
  const [copied, setCopied] = useState(false);
  const [empty, setEmpty] = useState(false);

  const handleCopy = () => {
    if (!text || text.trim() === "") {
      setEmpty(true);
      setTimeout(() => setEmpty(false), 2000);
      return;
    }
    clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };


  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {copied && <span className="text-green-500 text-[10px] font-bold animate-pulse">Copied!</span>}
      {empty && <span className="text-rose-500 text-[10px] font-bold animate-pulse">No Text</span>}
      <button
        onClick={handleCopy}
        className={className}
      >
        <FileText size={size} />
      </button>
    </div>
  );
};
const formatTimer = (totalSeconds: number) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

declare global {
  interface Window {
    debugLogs: string;
  }
}
window.debugLogs = window.debugLogs || '';

const logEvent = (msg: string) => {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  window.debugLogs += line;
  console.log(`[DEBUG] ${msg}`);
};

// Cross-device safety helper: wrap any async call with a timeout to prevent hanging or freezing
const withTimeout = <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
  let timer: any;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([promise, timeoutPromise]).then((res) => {
    clearTimeout(timer);
    return res;
  }).catch((err) => {
    clearTimeout(timer);
    throw err;
  });
};

const validateGroqKey = async (key: string): Promise<boolean> => {
  return key.trim().length > 0;
};

const validateGeminiKey = async (key: string): Promise<boolean> => {
  return key.trim().length > 0;
};

type KeyValidationState = 'idle' | 'validating' | 'valid' | 'invalid' | 'duplicate';




const validateClaudeKey = async (key: string): Promise<boolean> => {
  if (!key.trim()) return false;
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key.trim(),
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hello' }]
      })
    });
    // Even if it fails due to balance, usually it returns a 400 or 403.
    // Anthropic returns 401 for invalid keys. 400 for bad request.
    const data = await response.json();
    if (response.status === 401) return false;
    if (data.type === 'error' && data.error.type === 'authentication_error') return false;
    return true;
  } catch {
    return false;
  }
};

const validateChatgptKey = async (key: string): Promise<boolean> => {
  return key.trim().length > 0;
};

const validateDeepseekKey = async (key: string): Promise<{ valid: boolean, balance: string }> => {
  if (!key.trim()) return { valid: false, balance: '' };
  try {
    const response = await fetch('https://api.deepseek.com/user/balance', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${key.trim()}`
      }
    });
    if (response.status === 401) return { valid: false, balance: '' };
    const data = await response.json();
    if (data && data.balance_infos && data.balance_infos.length > 0) {
      return { valid: true, balance: data.balance_infos[0].total_balance };
    }
    return { valid: true, balance: '' };
  } catch {
    return { valid: false, balance: '' };
  }
};

const validateGlmKey = async (key: string): Promise<boolean> => {
  return key.trim().length > 0;
};

const CustomSelect = ({ value, onChange, options, className, icon, listClassName }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((o: any) => o.value === value) || options[0];

  return (
    <>
      <div className={`relative ${className || ''}`}>
        {isOpen && (
          <div
            className="fixed inset-0 z-[100]"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
            }}
          />
        )}
        <button
          type="button"
          className="flex items-center justify-between gap-2 cursor-pointer w-full relative z-[105] select-none text-left bg-transparent border-none outline-none p-0"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(prev => !prev);
          }}
        >
          <div className="flex flex-wrap items-center justify-start gap-2 truncate">
            {icon && icon}
            <span className="truncate">{selectedOption?.label || value}</span>
          </div>
          <ChevronDown size={14} className={`text-brand-subtext transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        {isOpen && (
          <div className={`absolute z-[110] left-0 right-0 top-full mt-1.5 bg-[#18181b] border border-white/10 rounded-xl overflow-hidden shadow-2xl max-h-60 overflow-y-auto ${listClassName || ''}`}>
            {options.map((opt: any) => (
              <div
                key={opt.value}
                className={`px-4 py-2.5 hover:bg-white/10 cursor-pointer text-sm transition-colors ${opt.value === value ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-brand-subtext hover:text-white'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(opt.value);
                  setIsOpen(false);
                }}
              >
                {opt.label}
              </div>
            ))}
          </div>
        )}

      </div>
    </>
  );
};

function App() {

  const [preferredCodeLanguage, setPreferredCodeLanguage] = useState<string>(() => {
    return localStorage.getItem('clueai_code_language') || 'Java';
  });
  const [provider, setProvider] = useState<'groq' | 'gemini-flash' | 'claude' | 'chatgpt' | 'deepseek'>(() => {
    return (localStorage.getItem('selected_provider') as any) || 'groq';
  });
  const [groqKeys, setGroqKeys] = useState<string[]>(() => {
    try {
      const keys = JSON.parse(localStorage.getItem('groq_api_keys') || '[]');
      return keys.length === 15 ? keys : [...keys, ...Array(15).fill('')].slice(0, 15);
    } catch { return Array(15).fill(''); }
  });
  const [geminiKeys, setGeminiKeys] = useState<string[]>(() => {
    try {
      const keys = JSON.parse(localStorage.getItem('gemini_api_keys') || '[]');
      return keys.length === 15 ? keys : [...keys, ...Array(15).fill('')].slice(0, 15);
    } catch { return Array(15).fill(''); }
  });

  const [groqKeyStatus, setGroqKeyStatus] = useState<KeyValidationState[]>(Array(15).fill('idle'));
  const [geminiKeyStatus, setGeminiKeyStatus] = useState<KeyValidationState[]>(Array(15).fill('idle'));
  const [showGroqKeys, setShowGroqKeys] = useState<boolean[]>(Array(15).fill(false));
  const [showGeminiKeys, setShowGeminiKeys] = useState<boolean[]>(Array(15).fill(false));

  const [claudeKeys, setClaudeKeys] = useState<TimedApiKey[]>(() => {
    try {
      const keys = JSON.parse(localStorage.getItem('claude_api_keys') || '[]');
      return keys.length === 2 ? keys : [...keys, ...Array(2).fill({ key: '', addedAt: 0 })].slice(0, 2);
    } catch { return Array(2).fill({ key: '', addedAt: 0 }); }
  });
  const [chatgptKeys, setChatgptKeys] = useState<TimedApiKey[]>(() => {
    try {
      const keys = JSON.parse(localStorage.getItem('chatgpt_api_keys') || '[]');
      return keys.length === 3 ? keys : [...keys, ...Array(3).fill({ key: '', addedAt: 0 })].slice(0, 3);
    } catch { return Array(3).fill({ key: '', addedAt: 0 }); }
  });
  const [deepseekKeys, setDeepseekKeys] = useState<TimedApiKey[]>(() => {
    try {
      const keys = JSON.parse(localStorage.getItem('deepseek_api_keys') || '[]');
      return keys.length === 3 ? keys : [...keys, ...Array(3).fill({ key: '', addedAt: 0 })].slice(0, 3);
    } catch { return Array(3).fill({ key: '', addedAt: 0 }); }
  });

  const [glmKeys, setGlmKeys] = useState<TimedApiKey[]>(() => {
    try {
      const keys = JSON.parse(localStorage.getItem('glm_api_keys') || '[]');
      return keys.length === 3 ? keys : [...keys, ...Array(3).fill({ key: '', addedAt: 0 })].slice(0, 3);
    } catch { return Array(3).fill({ key: '', addedAt: 0 }); }
  });

  const [claudeKeyStatus, setClaudeKeyStatus] = useState<KeyValidationState[]>(Array(2).fill('idle'));
  const [chatgptKeyStatus, setChatgptKeyStatus] = useState<KeyValidationState[]>(Array(3).fill('idle'));
  const [deepseekKeyStatus, setDeepseekKeyStatus] = useState<KeyValidationState[]>(Array(3).fill('idle'));
  const [glmKeyStatus, setGlmKeyStatus] = useState<KeyValidationState[]>(Array(3).fill('idle'));

  const [showClaudeKeys, setShowClaudeKeys] = useState<boolean[]>(Array(2).fill(false));
  const [showChatgptKeys, setShowChatgptKeys] = useState<boolean[]>(Array(3).fill(false));
  const [showDeepseekKeys, setShowDeepseekKeys] = useState<boolean[]>(Array(3).fill(false));
  const [showGlmKeys, setShowGlmKeys] = useState<boolean[]>(Array(3).fill(false));
  const [deepseekBalances, setDeepseekBalances] = useState<string[]>(Array(3).fill(''));


  const [sysMicVolume, setSysMicVolume] = useState(100);
  const [sysMicMuted, setSysMicMuted] = useState(false);
  const [showAudioErrorModal, setShowAudioErrorModal] = useState(false);
  const [activeMicName, setActiveMicName] = useState('Default Microphone');
  const [availableMics, setAvailableMics] = useState<{ deviceId: string, label: string }[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>(() => {
    return localStorage.getItem('selected_audio_input_device') || 'default';
  });
  const [availableOutputs, setAvailableOutputs] = useState<{ deviceId: string, label: string }[]>([]);
  const [selectedOutputId, setSelectedOutputId] = useState<string>(() => {
    return localStorage.getItem('selected_audio_output_device') || 'default';
  });
  const [liveVoiceLevel, setLiveVoiceLevel] = useState(0);


  const cleanKeys = (keys: TimedApiKey[], limitDays: number) => {
    return keys.map(k => {
      if (!k.addedAt) return k;
      const daysPassed = (Date.now() - k.addedAt) / (1000 * 60 * 60 * 24);
      return daysPassed >= limitDays ? { key: '', addedAt: 0 } : k;
    });
  };




  useEffect(() => {
    setClaudeKeys(prev => cleanKeys(prev, 14));
    setChatgptKeys(prev => cleanKeys(prev, 90));
    setDeepseekKeys(prev => cleanKeys(prev, 90));
  }, []);

  const handleMicVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setSysMicVolume(val);
    ipcRenderer.invoke('set-mic-volume', val);
  };

  const handleMicMuteToggle = () => {
    const newState = !sysMicMuted;
    setSysMicMuted(newState);
    ipcRenderer.invoke('toggle-mic-mute', newState);
  };

  const [apiAccordion, setApiAccordion] = useState<'groq' | 'gemini' | 'claude' | 'chatgpt' | 'deepseek' | 'glm' | 'none'>('none');

  const [isRecording, setIsRecording] = useState(false);
  // const [isAnswerMaximized, setIsAnswerMaximized] = useState(false);
  const [showReminderEmailSuggest, setShowReminderEmailSuggest] = useState(false);
  const [showNotesEmailSuggest, setShowNotesEmailSuggest] = useState(false);

  const isRecordingRef = useRef(false);
  const isRecoveringRef = useRef(false);
  isRecordingRef.current = isRecording;
  const [isPaused, setIsPaused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [localSettingsStealth, setLocalSettingsStealth] = useState(false);
  const [localReminderStealth, setLocalReminderStealth] = useState(false);
  const [localNotesStealth, setLocalNotesStealth] = useState(false);
  const [localRenameStealth, setLocalRenameStealth] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [finalizedText, setFinalizedText] = useState('');
  const [interimText, setInterimText] = useState('');
  const finalizedTranscriptRef = useRef('');
  const interimTranscriptRef = useRef('');
  const [aiAnswer, setAiAnswer] = useState('');
  const aiAnswerRef = useRef('');
  aiAnswerRef.current = aiAnswer;
  const [, setSources] = useState<any[]>([]);
  const [selectedSource, setSelectedSource] = useState('');
  const [altColor, setAltColor] = useState(false);

  const [stealthWarningToast, setStealthWarningToast] = useState<{ x: number, y: number, isShieldToast?: boolean } | null>(null);

  const [stealthMode, setStealthMode] = useState(() => {
    try {
      const saved = localStorage.getItem('appStealthMode');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const [showStealthWarning, setShowStealthWarning] = useState(false);
  const [showVirtualKeyboard, setShowVirtualKeyboard] = useState(false);
  const showVirtualKeyboardRef = useRef(false);
  showVirtualKeyboardRef.current = showVirtualKeyboard;
  const virtualKeyboardTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [transcriptTextSize, setTranscriptTextSize] = useState(() => {
    try { return parseInt(localStorage.getItem('clueai_transcript_size') || '15'); } catch { return 15; }
  });
  const [aiAnswerTextSize, setAiAnswerTextSize] = useState(() => {
    try { return parseInt(localStorage.getItem('clueai_answer_size') || '15'); } catch { return 15; }
  });
  const [currentSessionHistory, setCurrentSessionHistory] = useState<{ question: string, answer: string, images?: string[], modelInfo?: string }[]>([]);
  const [showPreviousQuestions, setShowPreviousQuestions] = useState(false);
  const [expandedAnswers, setExpandedAnswers] = useState<Record<number, boolean>>({});

  const transcriptScrollRef = useRef<HTMLDivElement>(null);
  const aiAnswerScrollRef = useRef<HTMLDivElement>(null);

  // User-controlled scrolling: Forced auto-scroll to bottom disabled during AI generation
  // so the user can read from the beginning and scroll freely without the view continually jumping.

  const [editTranscript, setEditTranscript] = useState('');

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number, right: number } | null>(null);
  const [isAnswerMinimized, setIsAnswerMinimized] = useState(false);
  const [stealthFontSize, setStealthFontSize] = useState<number>(() => Number(localStorage.getItem('clueai_stealth_font_size')) || 11.5);
  const [isTranscriptMinimized, setIsTranscriptMinimized] = useState(false);
  const [isTopBarMinimized, setIsTopBarMinimized] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(0); // 0 = stopped, 1-5 = speed level
  const [isVoiceScroll, setIsVoiceScroll] = useState(false);
  const isVoiceScrollRef = useRef(false);
  isVoiceScrollRef.current = isVoiceScroll;
  const [voiceScrollSpeed, setVoiceScrollSpeed] = useState<number>(2); // 1-5 speed level for Voice Scroll
  const voiceScrollSpeedRef = useRef<number>(2);
  voiceScrollSpeedRef.current = voiceScrollSpeed;
  const isSpeakingRef = useRef<boolean>(false);
  const [isSpeakingLive, setIsSpeakingLive] = useState(false);
  const lastSpokenTimestampRef = useRef<number>(0);
  const voiceVelocityRef = useRef<number>(0);
  const isHoveringAnswerRef = useRef<boolean>(false);
  const isWheelOverridingRef = useRef<boolean>(false);
  const wheelTimeoutRef = useRef<any>(null);
  const [activeReadIndex, setActiveReadIndex] = useState(0);
  const activeReadIndexRef = useRef(0);
  activeReadIndexRef.current = activeReadIndex;
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionName, setEditingSessionName] = useState('');

  // --- AUTO-UPDATER & NOTIFICATIONS STATE ---
  const [appVersion, setAppVersion] = useState('5.9.6');
  const [liveSpokenText, setLiveSpokenText] = useState<string>('');
  const liveSpokenTextRef = useRef<string>('');
  const [installStageText, setInstallStageText] = useState<string>('Extracting update packages...');
  const [sessionModalMode, setSessionModalMode] = useState<'new' | 'resume'>('new');
  const [sessionSearchTerm, setSessionSearchTerm] = useState('');
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'>('idle');
  const [updateInfo, setUpdateInfo] = useState<{ version?: string; releaseDate?: string; releaseNotes?: string | any[]; message?: string }>({});
  const [downloadProgress, setDownloadProgress] = useState<{ percent: number; bytesPerSecond: number; transferred: number; total: number }>({ percent: 0, bytesPerSecond: 0, transferred: 0, total: 0 });
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false);
  const isInstallingUpdateRef = useRef(false);
  isInstallingUpdateRef.current = isInstallingUpdate;
  const [installProgress, setInstallProgress] = useState(0);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showStartupUpdatePopup, setShowStartupUpdatePopup] = useState(false);
  const showUpdateModalRef = useRef(false);
  showUpdateModalRef.current = showUpdateModal;
  const hasShownStartupPopupRef = useRef(false);
  const [isHistoryScrolled, setIsHistoryScrolled] = useState(false);
  const [isCodeSplitView, setIsCodeSplitView] = useState(true);

  // --- STORAGE MONITOR & CACHE CONTROLS ---
  const [storageInfo, setStorageInfo] = useState<{
    appSizeMB: number;
    appStorageFormatted: string;
    softwareSizeMB: number;
    softwareStorageFormatted: string;
    userDataSizeMB: number;
    userDataStorageFormatted: string;
    totalStorageGB: number;
    freeStorageGB: number;
    usedStorageGB: number;
    usedPercent: number;
    isFilling: boolean;
    isFull: boolean;
  }>({
    appSizeMB: 875,
    appStorageFormatted: '875 MB',
    softwareSizeMB: 830,
    softwareStorageFormatted: '830 MB',
    userDataSizeMB: 45,
    userDataStorageFormatted: '45 MB',
    totalStorageGB: 0,
    freeStorageGB: 0,
    usedStorageGB: 0,
    usedPercent: 0,
    isFilling: false,
    isFull: false
  });
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [showClearStorageConfirm, setShowClearStorageConfirm] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [cacheClearedSuccess, setCacheClearedSuccess] = useState(false);
  const [isRefreshingStorage, setIsRefreshingStorage] = useState(false);
  const [storageRefreshedMsg, setStorageRefreshedMsg] = useState(false);

  // User Data Deletion Modal State
  const [showDeleteUserDataConfirm, setShowDeleteUserDataConfirm] = useState(false);
  const [deleteUserDataInput, setDeleteUserDataInput] = useState('');
  const [isDeletingUserData, setIsDeletingUserData] = useState(false);
  const [userDataDeletedSuccess, setUserDataDeletedSuccess] = useState(false);
  const [userDataPurgeStage, setUserDataPurgeStage] = useState<'idle' | 'clearing-cache' | 'clearing-sessions' | 'rebuilding' | 'done'>('idle');

  // --- FEEDBACK & SUPPORT MODAL STATE ---
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({
    name: '',
    email: '',
    category: 'Bug / Issue',
    description: '',
    imageBase64: ''
  });
  const [feedbackErrors, setFeedbackErrors] = useState<{ email?: string; description?: string }>({});
  const [feedbackStatus, setFeedbackStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [feedbackStatusMsg, setFeedbackStatusMsg] = useState('');
  const [showFeedbackEmailSuggest, setShowFeedbackEmailSuggest] = useState(false);
  const [isUploadingFeedbackImage, setIsUploadingFeedbackImage] = useState(false);
  const [showSettingsEmailSuggest, setShowSettingsEmailSuggest] = useState(false);
  const feedbackFileInputRef = useRef<HTMLInputElement>(null);

  // --- UNIVERSAL 6-DIGIT EMAIL OTP VERIFICATION STATE ---
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [expectedOtp, setExpectedOtp] = useState<string>('');
  const [otpTargetEmail, setOtpTargetEmail] = useState<string>('');
  const [otpPendingType, setOtpPendingType] = useState<'feedback' | 'reminder' | 'note' | 'onboarding' | 'settings' | 'export' | null>(null);

  // --- SESSION EXPORT MODAL STATE ---
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportTargetSession, setExportTargetSession] = useState<any>(null);
  const [exportEmailInput, setExportEmailInput] = useState('');
  const [exportEmailStatus, setExportEmailStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [exportEmailMsg, setExportEmailMsg] = useState('');
  const [showExportEmailSuggest, setShowExportEmailSuggest] = useState(false);
  const [isExportingHtml, setIsExportingHtml] = useState(false);
  const [htmlExportSuccess, setHtmlExportSuccess] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfExportSuccess, setPdfExportSuccess] = useState(false);
  const [otpError, setOtpError] = useState(false);
  const [otpSuccess, setOtpSuccess] = useState(false);
  const [otpIsSending, setOtpIsSending] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(60);
  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const pendingOtpCallbackRef = useRef<(() => void) | null>(null);

  // Email Verification Helpers
  const isEmailVerified = useCallback((email: string): boolean => {
    if (!email || !email.trim()) return false;
    try {
      const verifiedList: string[] = JSON.parse(localStorage.getItem('clueai_verified_emails') || '[]');
      return verifiedList.some(e => e.toLowerCase() === email.trim().toLowerCase());
    } catch {
      return false;
    }
  }, []);

  const markEmailVerified = useCallback((email: string) => {
    if (!email || !email.trim()) return;
    const clean = email.trim().toLowerCase();
    try {
      const verifiedList: string[] = JSON.parse(localStorage.getItem('clueai_verified_emails') || '[]');
      if (!verifiedList.some(e => e.toLowerCase() === clean)) {
        verifiedList.push(clean);
        localStorage.setItem('clueai_verified_emails', JSON.stringify(verifiedList));
      }
      const savedList: string[] = JSON.parse(localStorage.getItem('clueai_saved_emails') || '[]');
      if (!savedList.some(e => e.toLowerCase() === clean)) {
        savedList.unshift(email.trim());
        localStorage.setItem('clueai_saved_emails', JSON.stringify(savedList));
      }
      localStorage.setItem('clueai_saved_email', email.trim());

      fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'register_user',
          email: clean,
          user_name: localStorage.getItem('clueai_username') || 'ClueAI User',
          app_version: '5.9.6'
        })
      }).catch(() => {});
    } catch {}
  }, []);

  useEffect(() => {
    let timer: any = null;
    if (showOtpModal && otpCountdown > 0) {
      timer = setInterval(() => {
        setOtpCountdown(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [showOtpModal, otpCountdown]);

  const triggerOtpVerification = (
    type: 'feedback' | 'reminder' | 'note' | 'onboarding' | 'settings' | 'export',
    targetEmail: string,
    onVerifiedCallback: () => void
  ) => {
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setExpectedOtp(generatedOtp);
    setOtpTargetEmail(targetEmail.trim());
    setOtpPendingType(type as any);
    pendingOtpCallbackRef.current = onVerifiedCallback;
    setOtpDigits(['', '', '', '', '', '']);
    setOtpError(false);
    setOtpSuccess(false);
    setOtpCountdown(60);
    setShowOtpModal(true);
    setOtpIsSending(true);
    setOnboardingIsSubmitting(false);

    const activeName = (type === 'onboarding' ? onboardingName.trim() : feedbackForm.name.trim()) || username || 'ClueAI User';

    fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'send_otp',
        email: targetEmail.trim(),
        to_email: targetEmail.trim(),
        user_email: targetEmail.trim(),
        otp: generatedOtp,
        user_name: activeName,
        app_version: appVersion
      })
    })
      .catch(console.error)
      .finally(() => {
        setOtpIsSending(false);
        setTimeout(() => {
          otpInputsRef.current[0]?.focus();
        }, 150);
      });
  };

  const handleResendOtp = () => {
    if (otpCountdown > 0 || !otpTargetEmail) return;
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setExpectedOtp(generatedOtp);
    setOtpDigits(['', '', '', '', '', '']);
    setOtpError(false);
    setOtpSuccess(false);
    setOtpCountdown(60);
    setOtpIsSending(true);

    const activeName = (otpPendingType === 'onboarding' ? onboardingName.trim() : feedbackForm.name.trim()) || username || 'ClueAI User';

    fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'send_otp',
        email: otpTargetEmail.trim(),
        to_email: otpTargetEmail.trim(),
        user_email: otpTargetEmail.trim(),
        otp: generatedOtp,
        user_name: activeName,
        app_version: appVersion
      })
    })
      .catch(console.error)
      .finally(() => {
        setOtpIsSending(false);
        setTimeout(() => {
          otpInputsRef.current[0]?.focus();
        }, 150);
      });
  };

  const validateOtpCode = (enteredCode: string) => {
    if (enteredCode === expectedOtp) {
      setOtpError(false);
      setOtpSuccess(true);
      markEmailVerified(otpTargetEmail);

      setTimeout(() => {
        setShowOtpModal(false);
        setOtpSuccess(false);
        if (pendingOtpCallbackRef.current) {
          pendingOtpCallbackRef.current();
          pendingOtpCallbackRef.current = null;
        }
      }, 1000);
    } else {
      setOtpError(true);
    }
  };

  const handleOtpDigitChange = (index: number, value: string) => {
    const cleanVal = value.replace(/\D/g, '');
    if (!cleanVal) {
      const newDigits = [...otpDigits];
      newDigits[index] = '';
      setOtpDigits(newDigits);
      setOtpError(false);
      return;
    }
    const digit = cleanVal.slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);
    setOtpError(false);

    if (index < 5 && digit) {
      otpInputsRef.current[index + 1]?.focus();
    }

    const fullCode = newDigits.join('');
    if (fullCode.length === 6 && !newDigits.includes('')) {
      validateOtpCode(fullCode);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        otpInputsRef.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const newDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || '';
    }
    setOtpDigits(newDigits);
    setOtpError(false);
    if (pasted.length === 6) {
      validateOtpCode(pasted);
      otpInputsRef.current[5]?.focus();
    } else {
      otpInputsRef.current[pasted.length]?.focus();
    }
  };

  // Semver comparison helper
  const isNewerVersion = (latest: string, current: string): boolean => {
    try {
      const l = latest.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
      const c = current.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
      for (let i = 0; i < Math.max(l.length, c.length); i++) {
        const numL = l[i] ?? 0;
        const numC = c[i] ?? 0;
        if (numL > numC) return true;
        if (numL < numC) return false;
      }
      return false;
    } catch {
      return latest !== current;
    }
  };

  const fetchStorageInfo = useCallback(async () => {
    try {
      if (ipcRenderer && ipcRenderer.invoke) {
        const info = await ipcRenderer.invoke('get-storage-info');
        if (info) {
          setStorageInfo(info);
        }
      }
    } catch {}
  }, []);

  const handleRefreshStorage = async () => {
    setIsRefreshingStorage(true);
    setStorageRefreshedMsg(false);
    try {
      await fetchStorageInfo();
      // Ensure smooth, visible spin animation feedback
      await new Promise(r => setTimeout(r, 650));
      setStorageRefreshedMsg(true);
      setTimeout(() => setStorageRefreshedMsg(false), 2500);
    } catch {}
    finally {
      setIsRefreshingStorage(false);
    }
  };

  const handleClearCache = async () => {
    setIsClearingCache(true);
    try {
      const res = await ipcRenderer.invoke('clear-clueai-cache');
      if (res && res.success) {
        setCacheClearedSuccess(true);
        setTimeout(() => setCacheClearedSuccess(false), 3500);
      }
    } catch (err) {
      console.error('Error clearing cache:', err);
    } finally {
      setIsClearingCache(false);
      fetchStorageInfo();
    }
  };

  const handleDeleteUserData = async () => {
    setIsDeletingUserData(true);
    setUserDataPurgeStage('clearing-cache');
    try {
      await new Promise(r => setTimeout(r, 450));
      setUserDataPurgeStage('clearing-sessions');
      await ipcRenderer.invoke('delete-user-data');

      await new Promise(r => setTimeout(r, 450));
      setUserDataPurgeStage('rebuilding');
      try {
        localStorage.removeItem('sessions');
        localStorage.removeItem('currentSessionId');
        localStorage.removeItem('clueai_recent_transcripts');
        localStorage.removeItem('clueai_saved_notes');
        localStorage.removeItem('clueai_cached_prompts');
      } catch {}

      setSessions([]);
      setCurrentSessionId('');
      setSessionLog('');
      setSessionNameInput('');
      setTranscript('');
      setFinalizedText('');
      setInterimText('');

      await new Promise(r => setTimeout(r, 400));
      setUserDataPurgeStage('done');
      setUserDataDeletedSuccess(true);
      await fetchStorageInfo();

      setTimeout(() => {
        setUserDataDeletedSuccess(false);
        setIsDeletingUserData(false);
        setShowDeleteUserDataConfirm(false);
        setDeleteUserDataInput('');
        setUserDataPurgeStage('idle');
      }, 2000);
    } catch (err) {
      console.error('Error deleting user data:', err);
      setIsDeletingUserData(false);
      setUserDataPurgeStage('idle');
    }
  };

  // Feedback Submission & Screenshot Upload Handlers
  const handleFeedbackImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file only (PNG, JPG, WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Selected image exceeds 5 MB. Please select a smaller screenshot.');
      return;
    }
    setIsUploadingFeedbackImage(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === 'string') {
        setFeedbackForm(prev => ({ ...prev, imageBase64: ev.target!.result as string }));
      }
      setIsUploadingFeedbackImage(false);
    };
    reader.onerror = () => {
      setIsUploadingFeedbackImage(false);
      alert('Failed to read image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleFeedbackPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          if (file.size > 5 * 1024 * 1024) {
            alert('Pasted screenshot exceeds 5 MB.');
            return;
          }
          setIsUploadingFeedbackImage(true);
          const reader = new FileReader();
          reader.onload = (ev) => {
            if (typeof ev.target?.result === 'string') {
              setFeedbackForm(prev => ({ ...prev, imageBase64: ev.target!.result as string }));
            }
            setIsUploadingFeedbackImage(false);
          };
          reader.onerror = () => {
            setIsUploadingFeedbackImage(false);
          };
          reader.readAsDataURL(file);
          e.preventDefault();
          break;
        }
      }
    }
  };

  const handleSendFeedback = async () => {
    const errors: { email?: string; description?: string } = {};
    const emailTrimmed = feedbackForm.email.trim();
    const descTrimmed = feedbackForm.description.trim();

    if (!emailTrimmed) {
      errors.email = 'Email address is required.';
    } else if (!/^\S+@\S+\.\S+$/.test(emailTrimmed)) {
      errors.email = 'Please provide a valid email address (e.g. user@example.com).';
    }

    if (!descTrimmed) {
      errors.description = 'Please describe the issue or feedback you are reporting.';
    } else if (descTrimmed.length < 8) {
      errors.description = 'Please provide at least 8 characters explaining the issue.';
    }

    if (Object.keys(errors).length > 0) {
      setFeedbackErrors(errors);
      return;
    }

    setFeedbackErrors({});

    const executeFeedbackSend = async () => {
      setFeedbackStatus('sending');
      setFeedbackStatusMsg('Routing feedback report to Clue AI engineers...');

      try {
        markEmailVerified(emailTrimmed);

        const payload = {
          type: 'feedback',
          user_name: feedbackForm.name.trim() || username || 'ClueAI User',
          user_email: emailTrimmed,
          email: emailTrimmed,
          to_email: emailTrimmed,
          category: feedbackForm.category,
          description: descTrimmed,
          image_base64: feedbackForm.imageBase64 || '',
          app_version: appVersion,
          timestamp: new Date().toISOString()
        };

        await fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        });

        setFeedbackStatus('success');
        setFeedbackStatusMsg('Feedback successfully dispatched! Dispatched to farhankhalid17968@gmail.com and clueai.support@gmail.com. A confirmation email has also been sent to your inbox.');

        setTimeout(() => {
          setShowFeedbackModal(false);
          setFeedbackStatus('idle');
          setFeedbackForm({
            name: '',
            email: '',
            category: 'Bug / Issue',
            description: '',
            imageBase64: ''
          });
        }, 2500);
      } catch (err) {
        setFeedbackStatus('error');
        setFeedbackStatusMsg('Failed to dispatch feedback. Please check your internet connection or email clueai.support@gmail.com.');
      }
    };

    if (isEmailVerified(emailTrimmed)) {
      executeFeedbackSend();
    } else {
      triggerOtpVerification('feedback', emailTrimmed, executeFeedbackSend);
    }
  };

  // Word-Level Voice Teleprompter Progress Tracker
  const [readWordIndex, setReadWordIndex] = useState(0);
  const readWordIndexRef = useRef(0);
  readWordIndexRef.current = readWordIndex;
  const readWordProgressRef = useRef(0);
  readWordProgressRef.current = readWordIndex;


  const [username, setUsername] = useState(() => {
    try { return localStorage.getItem('clueai_username') || ''; } catch { return ''; }
  });
  const [userEmail, setUserEmail] = useState(() => {
    try { return localStorage.getItem('clueai_user_email') || ''; } catch { return ''; }
  });
  const [showOnboardingModal, setShowOnboardingModal] = useState(() => {
    try {
      // 1. Strict one-time device check: once set, NEVER open again until uninstalled
      if (localStorage.getItem('clueai_device_onboarded') === 'true') return false;
      if (localStorage.getItem('clueai_onboarded') === 'true') return false;
      if (localStorage.getItem('clueai_onboarded_v580') === 'true') return false;

      // 2. If user already has username or email configured, do NOT prompt again
      const savedEmail = localStorage.getItem('clueai_user_email');
      const savedName = localStorage.getItem('clueai_username');
      if (savedEmail && savedEmail.trim().length > 0) return false;
      if (savedName && savedName.trim().length > 0) return false;

      const savedEmails = JSON.parse(localStorage.getItem('clueai_saved_emails') || '[]');
      if (Array.isArray(savedEmails) && savedEmails.length > 0) return false;

      return true;
    } catch {
      return false;
    }
  });
  const [onboardingName, setOnboardingName] = useState(() => {
    try { return localStorage.getItem('clueai_username') || ''; } catch { return ''; }
  });
  const [onboardingEmail, setOnboardingEmail] = useState(() => {
    try { return localStorage.getItem('clueai_user_email') || ''; } catch { return ''; }
  });
  const [showOnboardingEmailSuggest, setShowOnboardingEmailSuggest] = useState(false);
  const [onboardingError, setOnboardingError] = useState('');
  const [onboardingIsSubmitting, setOnboardingIsSubmitting] = useState(false);
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(false);
  const [tempUsername, setTempUsername] = useState(username);

  const handleCompleteOnboarding = () => {
    setOnboardingError('');
    const nameTrimmed = onboardingName.trim();
    const emailTrimmed = onboardingEmail.trim().toLowerCase();

    if (!nameTrimmed || nameTrimmed.length < 2) {
      setOnboardingError('Please enter your full name (minimum 2 characters).');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailTrimmed || !emailRegex.test(emailTrimmed)) {
      setOnboardingError('Please enter a valid email address.');
      return;
    }

    setOnboardingIsSubmitting(true);

    const finalizeOnboarding = () => {
      setUsername(nameTrimmed);
      setUserEmail(emailTrimmed);
      localStorage.setItem('clueai_username', nameTrimmed);
      localStorage.setItem('clueai_user_email', emailTrimmed);
      localStorage.setItem('clueai_device_onboarded', 'true');
      localStorage.setItem('clueai_onboarded', 'true');
      localStorage.setItem('clueai_onboarded_v580', 'true');
      markEmailVerified(emailTrimmed);

      const saved = JSON.parse(localStorage.getItem('clueai_saved_emails') || '[]');
      if (!saved.includes(emailTrimmed)) {
        saved.unshift(emailTrimmed);
        localStorage.setItem('clueai_saved_emails', JSON.stringify(saved));
      }

      fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'welcome',
          user_name: nameTrimmed,
          user_email: emailTrimmed,
          email: emailTrimmed,
          to_email: emailTrimmed,
          app_version: appVersion
        })
      }).catch(console.error);

      setShowOnboardingModal(false);
      setOnboardingIsSubmitting(false);

      // Auto-engage full stealth shield after setup completes
      setStealthMode(true);
      ipcRenderer.invoke('set-stealth', true);

      setModelChangeMsg(`Welcome to Clue AI, ${nameTrimmed}!`);
      setTimeout(() => setModelChangeMsg(''), 4000);
    };

    if (isEmailVerified(emailTrimmed)) {
      finalizeOnboarding();
    } else {
      triggerOtpVerification('onboarding', emailTrimmed, finalizeOnboarding);
    }
  };

  // Reminders
  // The old reminders state is completely removed in favor of reminderProfiles
  const [showReminderPopup, setShowReminderPopup] = useState(false);
  const [showReminderErrors, setShowReminderErrors] = useState(false);

  const [showNotesPopup, setShowNotesPopup] = useState(false);

  const [showNotesErrors, setShowNotesErrors] = useState(false);
  const [notesForm, setNotesForm] = useState({ id: '', notes: '', email: '', date: '', time: '', ampm: 'AM' });
  const [notesProfiles, setNotesProfiles] = useState<{ id: string, notes: string, email: string, date: string, time: string, ampm: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem('notes_profiles') || '[]'); } catch { return []; }
  });

  const [alertMessage, setAlertMessage] = useState<{ title: string, message: string, type: 'error' | 'success' | 'warning' } | null>(null);
  const [reminderProfiles, setReminderProfiles] = useState<{ id: string, name: string, jobTitle: string, email: string, phone: string, date: string, time: string, ampm: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem('reminder_profiles') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem('reminder_profiles', JSON.stringify(reminderProfiles));
  }, [reminderProfiles]);

  useEffect(() => {
    localStorage.setItem('notes_profiles', JSON.stringify(notesProfiles));
  }, [notesProfiles]);

  const [reminderForm, setReminderForm] = useState({ id: '', name: '', jobTitle: '', email: '', phone: '', date: '', time: '', ampm: 'AM' });
  const [emailSendStatus, setEmailSendStatus] = useState<'idle' | 'sending' | 'success'>('idle');
  const [reminderPopupMode, setReminderPopupMode] = useState<'create' | 'preview' | 'edit'>('create');
  const [notesPopupMode, setNotesPopupMode] = useState<'create' | 'preview' | 'edit'>('create');
  const [itemToDelete, setItemToDelete] = useState<{ id: string, type: 'reminder' | 'note', name: string, isPast: boolean } | null>(null);

  const getDayOfWeek = (dateString: string) => {
    if (!dateString) return '';
    const parts = dateString.split('-');
    if (parts.length !== 3) return '';
    const [d, m, y] = parts;
    if (d.length === 2 && m.length === 2 && y.length === 4) {
      const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', { weekday: 'long' });
      }
    }
    return '';
  };

  const validateDateTime = (dateStr: string, timeStr: string, ampmStr: string) => {
    let dateError = '';
    let timeError = '';

    // Date validation
    if (dateStr && dateStr.length === 10) {
      const dateRegex = /^\d{2}-\d{2}-\d{4}$/;
      if (!dateRegex.test(dateStr)) {
        dateError = 'Invalid date format (DD-MM-YYYY)';
      } else {
        const [d, m, y] = dateStr.split('-').map(Number);
        if (m < 1 || m > 12) {
          dateError = 'Month must be between 01 and 12';
        } else if (y < 2026) {
          dateError = 'Year cannot be in the past';
        } else {
          const daysInMonth = new Date(y, m, 0).getDate();
          if (d < 1 || d > daysInMonth) {
            dateError = m === 2 ? `February has ${daysInMonth} days in ${y}` : `Month ${m} has ${daysInMonth} days`;
          } else {
            const today = new Date();
            const inputDate = new Date(y, m - 1, d);
            today.setHours(0, 0, 0, 0);
            if (inputDate < today) {
              dateError = 'Date cannot be in the past';
            }
          }
        }
      }
    }

    // Time validation
    if (timeStr && timeStr.length === 5) {
      const timeRegex = /^(0[1-9]|1[0-2]):[0-5]\d$/;
      if (!timeRegex.test(timeStr)) {
        let [hours, minutes] = timeStr.split(':');
        if (Number(hours) > 12 || Number(hours) < 1) {
          timeError = 'Hour must be 01-12';
        } else if (Number(minutes) > 59) {
          timeError = 'Minute must be 00-59';
        } else {
          timeError = 'Invalid time format (HH:MM)';
        }
      } else if (!dateError && dateStr.length === 10) {
        const [d, m, y] = dateStr.split('-').map(Number);
        const inputDate = new Date(y, m - 1, d);
        const today = new Date();
        if (inputDate.toDateString() === today.toDateString()) {
          let [hours, minutes] = timeStr.split(':').map(Number);
          if (ampmStr === 'PM' && hours < 12) hours += 12;
          if (ampmStr === 'AM' && hours === 12) hours = 0;

          const inputTime = new Date(today);
          inputTime.setHours(hours, minutes, 0, 0);

          if (inputTime <= today) {
            timeError = 'Time cannot be in the past';
          }
        }
      }
    }

    return { dateError, timeError };
  };

  const handleDateChange = (val: string, form: any, setForm: any) => {
    // Let them backspace without auto-filling everything back
    if (val.length < form.date.length) {
      setForm({ ...form, date: val });
      return;
    }

    let formatted = val.replace(/[^\d-]/g, '');

    if (formatted.length === 1 && parseInt(formatted) > 3) {
      formatted = '0' + formatted;
    }

    if (formatted.length === 2 && !formatted.includes('-')) {
      const d = new Date();
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const year = d.getFullYear().toString();
      formatted = `${formatted}-${month}-${year}`;
    }

    setForm({ ...form, date: formatted.substring(0, 10) });
  };

  const handleTimeChange = (val: string, form: any, setForm: any) => {
    if (val.length < form.time.length) {
      setForm({ ...form, time: val });
      return;
    }

    let formatted = val.replace(/[^\d:]/g, '');

    if (formatted.length === 1 && parseInt(formatted) > 1) {
      formatted = '0' + formatted + ':';
    }

    if (formatted.length === 2 && !formatted.includes(':')) {
      formatted = formatted + ':';
    }

    setForm({ ...form, time: formatted.substring(0, 5) });
  };



  const [resumeText, setResumeText] = useState(localStorage.getItem('resume_text') || '');
  const [resumeFileName, setResumeFileName] = useState(localStorage.getItem('resume_file_name') || '');
  const [isUploadingResume, setIsUploadingResume] = useState(false);

  const [resumeText2, setResumeText2] = useState(localStorage.getItem('resume_text_2') || '');
  const [resumeFileName2, setResumeFileName2] = useState(localStorage.getItem('resume_file_name_2') || '');
  const [isUploadingResume2, setIsUploadingResume2] = useState(false);
  const [resumePriority, setResumePriority] = useState<number>(parseInt(localStorage.getItem('resume_priority') || '1'));

  const [personalContextText, setPersonalContextText] = useState(localStorage.getItem('personal_context_text') || '');
  const [personalContextFileName, setPersonalContextFileName] = useState(localStorage.getItem('personal_context_file_name') || '');
  const [isUploadingPersonalContext, setIsUploadingPersonalContext] = useState(false);

  const [opacity, setOpacity] = useState(() => {
    try {
      const saved = localStorage.getItem('appOpacity');
      return saved ? parseFloat(saved) : 1.0;
    } catch {
      return 1.0;
    }
  });
  const [showMinSizeWarning, setShowMinSizeWarning] = useState(false);
  const [layout, setLayout] = useState<'horizontal' | 'vertical'>('horizontal');
  // Snapshot States
  const [currentSnapshots, setCurrentSnapshots] = useState<string[]>([]);

  const [previewSnapshot, setPreviewSnapshot] = useState<string | null>(null);


  // Session History
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [expandedHistoryItems, setExpandedHistoryItems] = useState<Record<string, { transcript: boolean, answer: boolean }>>({});

  const toggleHistoryItem = (sessionId: string, idx: number, type: 'transcript' | 'answer') => {
    const key = `${sessionId}-${idx}`;
    setExpandedHistoryItems(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || { transcript: false, answer: false }),
        [type]: !(prev[key]?.[type])
      }
    }));
  };
  const [sessions, setSessions] = useState<{ id: string, name: string, time: string, transcript: string, aiAnswer: string, date?: string, snapshotHistory?: { id: string, image: string, transcriptContext: string }[], history?: { question: string, answer: string, images?: string[], modelInfo?: string }[] }[]>(() => {
    try { return JSON.parse(localStorage.getItem('sessions') || '[]'); } catch { return []; }
  });
  const [showSessionPrompt, setShowSessionPrompt] = useState(false);
  const [showStartStealthWarning, setShowStartStealthWarning] = useState(false);
  const [showApiKeyMissingError, setShowApiKeyMissingError] = useState(false);
  // const [showNoInputError, setShowNoInputError] = useState(false);
  const [sessionNameInput, setSessionNameInput] = useState('');
  const [currentSessionId, setCurrentSessionId] = useState('');

  const [sessionLog, setSessionLog] = useState('');
  const [interviewTitle, setInterviewTitle] = useState(localStorage.getItem('interview_title') || '');
  const [sessionError, setSessionError] = useState('');

  const [saveMessages, setSaveMessages] = useState<{ type: 'success' | 'invalid' | 'duplicate', text: string }[]>([]);
  const [deleteMessage, setDeleteMessage] = useState<{ provider: string, index: number } | null>(null);

  const [activeAIInfo, setActiveAIInfo] = useState<{ provider: string, index: number } | null>(null);
  const [modelChangeMsg, setModelChangeMsg] = useState('');
  const [globalHotkeysEnabled, setGlobalHotkeysEnabled] = useState(true);

  // Dynamically compute AI models that actually have at least one valid configured API key
  const availableModelOptions = useMemo(() => {
    const opts: { value: 'groq' | 'gemini-flash' | 'claude' | 'chatgpt' | 'deepseek'; label: string }[] = [];
    if (groqKeys.some((k: any) => k.trim())) opts.push({ value: 'groq', label: 'Groq (GPT-OSS 20B)' });
    if (geminiKeys.some((k: any) => k.trim())) opts.push({ value: 'gemini-flash', label: 'Gemini 2.5 Flash' });
    if (claudeKeys.some((k: any) => k.key.trim())) opts.push({ value: 'claude', label: 'Claude 3.5 Sonnet' });
    if (chatgptKeys.some((k: any) => k.key.trim())) opts.push({ value: 'chatgpt', label: 'ChatGPT (GPT-4o)' });
    if (deepseekKeys.some((k: any) => k.key.trim())) opts.push({ value: 'deepseek', label: 'DeepSeek Coder' });
    return opts;
  }, [groqKeys, geminiKeys, claudeKeys, chatgptKeys, deepseekKeys]);

  // Unified model cycling function for hotkey '5' / 's' and UI button
  const cycleNextModel = useCallback(() => {
    if (availableModelOptions.length === 0) {
      setModelChangeMsg('No API keys configured (Open Settings ⚙)');
      setTimeout(() => setModelChangeMsg(''), 3000);
      return;
    }
    const currentIndex = availableModelOptions.findIndex(o => o.value === provider);
    const nextIndex = currentIndex !== -1 ? (currentIndex + 1) % availableModelOptions.length : 0;
    const nextProv = availableModelOptions[nextIndex].value;
    setProvider(nextProv);
    switchProvider(nextProv);
    localStorage.setItem('selected_provider', nextProv);
    const nameMap: any = { 'groq': 'Groq', 'gemini-flash': 'Gemini Flash', 'claude': 'Claude', 'chatgpt': 'ChatGPT', 'deepseek': 'DeepSeek' };
    setModelChangeMsg(`Switched to ${nameMap[nextProv] || nextProv}`);
    setTimeout(() => setModelChangeMsg(''), 3000);
  }, [availableModelOptions, provider]);

  // Auto-synchronize provider: if current provider is not among configured keys, auto-select first available
  useEffect(() => {
    if (availableModelOptions.length > 0 && !availableModelOptions.some(o => o.value === provider)) {
      const nextProv = availableModelOptions[0].value;
      setProvider(nextProv);
      switchProvider(nextProv);
      localStorage.setItem('selected_provider', nextProv);
    }
  }, [availableModelOptions, provider]);

  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        if (globalHotkeysEnabled) {
          ipcRenderer.invoke('toggle-global-hotkeys', false);
        }
      }
    };
    const handleFocusOut = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        if (globalHotkeysEnabled) {
          ipcRenderer.invoke('toggle-global-hotkeys', true);
        }
      }
    };
    window.addEventListener('focusin', handleFocusIn);
    window.addEventListener('focusout', handleFocusOut);
    return () => {
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('focusout', handleFocusOut);
    };
  }, [globalHotkeysEnabled]);
  const [showInfo, setShowInfo] = useState(false);

  const groqValidationCache = useRef<Record<string, boolean>>({});
  const geminiValidationCache = useRef<Record<string, boolean>>({});

  const claudeValidationCache = useRef<Record<string, boolean>>({});
  const chatgptValidationCache = useRef<Record<string, boolean>>({});
  const deepseekValidationCache = useRef<Record<string, { valid: boolean, balance: string }>>({});
  const glmValidationCache = useRef<Record<string, boolean>>({});


  const saveApiKeys = () => {
    const dupGroq = groqKeyStatus.map((s, i) => s === 'duplicate' ? i + 1 : -1).filter(i => i !== -1);
    const dupGem = geminiKeyStatus.map((s, i) => s === 'duplicate' ? i + 1 : -1).filter(i => i !== -1);
    const invGroq = groqKeyStatus.map((s, i) => s === 'invalid' ? i + 1 : -1).filter(i => i !== -1);
    const invGem = geminiKeyStatus.map((s, i) => s === 'invalid' ? i + 1 : -1).filter(i => i !== -1);
    const invClaude = claudeKeyStatus.map((s, i) => s === 'invalid' ? i + 1 : -1).filter(i => i !== -1);
    const invChatgpt = chatgptKeyStatus.map((s, i) => s === 'invalid' ? i + 1 : -1).filter(i => i !== -1);
    const invDeepseek = deepseekKeyStatus.map((s, i) => s === 'invalid' ? i + 1 : -1).filter(i => i !== -1);

    let msgs: { type: 'success' | 'invalid' | 'duplicate', text: string }[] = [];
    if (dupGroq.length > 0) msgs.push({ type: 'duplicate', text: `Warning: Groq Key ${dupGroq.join(' and ')} are duplicates.` });
    if (dupGem.length > 0) msgs.push({ type: 'duplicate', text: `Warning: Gemini Key ${dupGem.join(' and ')} are duplicates.` });
    if (invGroq.length > 0) msgs.push({ type: 'invalid', text: `Error: Groq Key ${invGroq.join(' and ')} are invalid.` });
    if (invGem.length > 0) msgs.push({ type: 'invalid', text: `Error: Gemini Key ${invGem.join(' and ')} are invalid.` });
    if (invClaude.length > 0) msgs.push({ type: 'invalid', text: `Error: Claude Key ${invClaude.join(' and ')} are invalid.` });
    if (invChatgpt.length > 0) msgs.push({ type: 'invalid', text: `Error: ChatGPT Key ${invChatgpt.join(' and ')} are invalid.` });
    if (invDeepseek.length > 0) msgs.push({ type: 'invalid', text: `Error: DeepSeek Key ${invDeepseek.join(' and ')} are invalid.` });

    if (invGroq.length > 0 || invGem.length > 0 || invClaude.length > 0 || invChatgpt.length > 0 || invDeepseek.length > 0) {
      setSaveMessages(msgs);
      setTimeout(() => setSaveMessages([]), 8000);
      return;
    }

    localStorage.setItem('groq_api_keys', JSON.stringify(groqKeys));
    localStorage.setItem('gemini_api_keys', JSON.stringify(geminiKeys));
    localStorage.setItem('claude_api_keys', JSON.stringify(claudeKeys));
    localStorage.setItem('chatgpt_api_keys', JSON.stringify(chatgptKeys));
    localStorage.setItem('deepseek_api_keys', JSON.stringify(deepseekKeys));
    localStorage.setItem('glm_api_keys', JSON.stringify(glmKeys));

    let targetProvider = provider;
    const hasCurrent = (
      (provider === 'groq' && groqKeys.some(k => k.trim())) ||
      (provider === 'gemini-flash' && geminiKeys.some(k => k.trim())) ||
      (provider === 'claude' && claudeKeys.some(k => k.key.trim())) ||
      (provider === 'chatgpt' && chatgptKeys.some(k => k.key.trim())) ||
      (provider === 'deepseek' && deepseekKeys.some(k => k.key.trim()))
    );

    if (!hasCurrent) {
      if (geminiKeys.some(k => k.trim())) targetProvider = 'gemini-flash';
      else if (groqKeys.some(k => k.trim())) targetProvider = 'groq';
      else if (claudeKeys.some(k => k.key.trim())) targetProvider = 'claude';
      else if (chatgptKeys.some(k => k.key.trim())) targetProvider = 'chatgpt';
      else if (deepseekKeys.some(k => k.key.trim())) targetProvider = 'deepseek';

      setProvider(targetProvider);
      switchProvider(targetProvider);
      localStorage.setItem('selected_provider', targetProvider);
    }

    initAIClient(targetProvider, groqKeys, geminiKeys, claudeKeys, chatgptKeys, deepseekKeys, glmKeys);
    setSTTApiKey(groqKeys.filter(k => k.trim()), geminiKeys.filter(k => k.trim()));

    if (msgs.length === 0) {
      msgs.push({ type: 'success', text: 'Saved successfully!' });
    }

    setSaveMessages(msgs);
    setTimeout(() => setSaveMessages([]), 8000);
  };

  useEffect(() => { localStorage.setItem('groq_api_keys', JSON.stringify(groqKeys)); }, [groqKeys]);
  useEffect(() => { localStorage.setItem('gemini_api_keys', JSON.stringify(geminiKeys)); }, [geminiKeys]);
  useEffect(() => { localStorage.setItem('claude_api_keys', JSON.stringify(claudeKeys)); }, [claudeKeys]);
  useEffect(() => { localStorage.setItem('chatgpt_api_keys', JSON.stringify(chatgptKeys)); }, [chatgptKeys]);
  useEffect(() => { localStorage.setItem('deepseek_api_keys', JSON.stringify(deepseekKeys)); }, [deepseekKeys]);
  useEffect(() => { localStorage.setItem('glm_api_keys', JSON.stringify(glmKeys)); }, [glmKeys]);
  useEffect(() => { localStorage.setItem('selected_provider', provider); }, [provider]);

  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      // 1. Identify which keys need validation, outside the state setter to avoid closure stale state
      const keysToValidate = new Set<string>();
      for (let i = 0; i < 15; i++) {
        const key = groqKeys[i].trim();
        if (key && groqKeys.findIndex((k, idx) => idx !== i && k.trim() === key) === -1) {
          if (groqValidationCache.current[key] === undefined) {
            keysToValidate.add(key);
          }
        }
      }

      setGroqKeyStatus(prev => {
        const next = [...prev];
        for (let i = 0; i < 15; i++) {
          const key = groqKeys[i].trim();
          if (!key) {
            next[i] = 'idle';
          } else if (groqKeys.findIndex((k, idx) => idx !== i && k.trim() === key) !== -1) {
            next[i] = 'duplicate';
          } else {
            if (groqValidationCache.current[key] === undefined) {
              next[i] = 'validating';
            } else {
              next[i] = groqValidationCache.current[key] ? 'valid' : 'invalid';
            }
          }
        }
        return next;
      });

      if (keysToValidate.size > 0) {
        await Promise.all(Array.from(keysToValidate).map(async (key) => {
          groqValidationCache.current[key] = await validateGroqKey(key);
        }));

        setGroqKeyStatus(prev => {
          const next = [...prev];
          for (let i = 0; i < 15; i++) {
            const key = groqKeys[i].trim();
            if (key && groqKeys.findIndex((k, idx) => idx !== i && k.trim() === key) === -1) {
              if (groqValidationCache.current[key] !== undefined) {
                next[i] = groqValidationCache.current[key] ? 'valid' : 'invalid';
              }
            }
          }
          return next;
        });
      }
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [groqKeys]);

  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      const keysToValidate = new Set<string>();
      for (let i = 0; i < 15; i++) {
        const key = geminiKeys[i].trim();
        if (key && geminiKeys.findIndex((k, idx) => idx !== i && k.trim() === key) === -1) {
          if (geminiValidationCache.current[key] === undefined) {
            keysToValidate.add(key);
          }
        }
      }

      setGeminiKeyStatus(prev => {
        const next = [...prev];
        for (let i = 0; i < 15; i++) {
          const key = geminiKeys[i].trim();
          if (!key) {
            next[i] = 'idle';
          } else if (geminiKeys.findIndex((k, idx) => idx !== i && k.trim() === key) !== -1) {
            next[i] = 'duplicate';
          } else {
            if (geminiValidationCache.current[key] === undefined) {
              next[i] = 'validating';
            } else {
              next[i] = geminiValidationCache.current[key] ? 'valid' : 'invalid';
            }
          }
        }
        return next;
      });

      if (keysToValidate.size > 0) {
        await Promise.all(Array.from(keysToValidate).map(async (key) => {
          geminiValidationCache.current[key] = await validateGeminiKey(key);
        }));

        setGeminiKeyStatus(prev => {
          const next = [...prev];
          for (let i = 0; i < 15; i++) {
            const key = geminiKeys[i].trim();
            if (key && geminiKeys.findIndex((k, idx) => idx !== i && k.trim() === key) === -1) {
              if (geminiValidationCache.current[key] !== undefined) {
                next[i] = geminiValidationCache.current[key] ? 'valid' : 'invalid';
              }
            }
          }
          return next;
        });
      }
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [geminiKeys]);


  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      const keysToValidate = new Set<string>();
      for (let i = 0; i < 2; i++) {
        const key = claudeKeys[i].key.trim();
        if (key && claudeValidationCache.current[key] === undefined) {
          keysToValidate.add(key);
        }
      }

      setClaudeKeyStatus(prev => {
        const next = [...prev];
        for (let i = 0; i < 2; i++) {
          const key = claudeKeys[i].key.trim();
          if (!key) {
            next[i] = 'idle';
          } else {
            if (claudeValidationCache.current[key] === undefined) {
              next[i] = 'validating';
            } else {
              next[i] = claudeValidationCache.current[key] ? 'valid' : 'invalid';
            }
          }
        }
        return next;
      });

      if (keysToValidate.size > 0) {
        await Promise.all(Array.from(keysToValidate).map(async (key) => {
          claudeValidationCache.current[key] = await validateClaudeKey(key);
        }));
        setClaudeKeyStatus(prev => {
          const next = [...prev];
          for (let i = 0; i < 2; i++) {
            const key = claudeKeys[i].key.trim();
            if (key) {
              if (claudeValidationCache.current[key] !== undefined) {
                next[i] = claudeValidationCache.current[key] ? 'valid' : 'invalid';
              }
            }
          }
          return next;
        });
      }
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [claudeKeys]);

  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      const keysToValidate = new Set<string>();
      for (let i = 0; i < 3; i++) {
        const key = chatgptKeys[i].key.trim();
        if (key && chatgptValidationCache.current[key] === undefined) {
          keysToValidate.add(key);
        }
      }

      setChatgptKeyStatus(prev => {
        const next = [...prev];
        for (let i = 0; i < 3; i++) {
          const key = chatgptKeys[i].key.trim();
          if (!key) {
            next[i] = 'idle';
          } else {
            if (chatgptValidationCache.current[key] === undefined) {
              next[i] = 'validating';
            } else {
              next[i] = chatgptValidationCache.current[key] ? 'valid' : 'invalid';
            }
          }
        }
        return next;
      });

      if (keysToValidate.size > 0) {
        await Promise.all(Array.from(keysToValidate).map(async (key) => {
          chatgptValidationCache.current[key] = await validateChatgptKey(key);
        }));
        setChatgptKeyStatus(prev => {
          const next = [...prev];
          for (let i = 0; i < 3; i++) {
            const key = chatgptKeys[i].key.trim();
            if (key) {
              if (chatgptValidationCache.current[key] !== undefined) {
                next[i] = chatgptValidationCache.current[key] ? 'valid' : 'invalid';
              }
            }
          }
          return next;
        });
      }
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [chatgptKeys]);

  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      const keysToValidate = new Set<string>();
      for (let i = 0; i < 3; i++) {
        const key = glmKeys[i].key.trim();
        if (key && glmKeys.findIndex((k, idx) => idx !== i && k.key.trim() === key) === -1) {
          if (glmValidationCache.current[key] === undefined) {
            keysToValidate.add(key);
          }
        }
      }

      setGlmKeyStatus(prev => {
        const next = [...prev];
        for (let i = 0; i < 3; i++) {
          const key = glmKeys[i].key.trim();
          if (!key) {
            next[i] = 'idle';
          } else if (glmKeys.findIndex((k, idx) => idx !== i && k.key.trim() === key) !== -1) {
            next[i] = 'duplicate';
          } else {
            if (glmValidationCache.current[key] === undefined) {
              next[i] = 'validating';
            } else {
              next[i] = glmValidationCache.current[key] ? 'valid' : 'invalid';
            }
          }
        }
        return next;
      });

      if (keysToValidate.size > 0) {
        await Promise.all(Array.from(keysToValidate).map(async (key) => {
          glmValidationCache.current[key] = await validateGlmKey(key);
        }));

        setGlmKeyStatus(prev => {
          const next = [...prev];
          for (let i = 0; i < 3; i++) {
            const key = glmKeys[i].key.trim();
            if (key && glmKeys.findIndex((k, idx) => idx !== i && k.key.trim() === key) === -1) {
              if (glmValidationCache.current[key] !== undefined) {
                next[i] = glmValidationCache.current[key] ? 'valid' : 'invalid';
              }
            }
          }
          return next;
        });
      }
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [glmKeys]);

  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      const keysToValidate = new Set<string>();
      for (let i = 0; i < 3; i++) {
        const key = deepseekKeys[i].key.trim();
        if (key && deepseekValidationCache.current[key] === undefined) {
          keysToValidate.add(key);
        }
      }

      setDeepseekKeyStatus(prev => {
        const next = [...prev];
        for (let i = 0; i < 3; i++) {
          const key = deepseekKeys[i].key.trim();
          if (!key) {
            next[i] = 'idle';
          } else {
            if (deepseekValidationCache.current[key] === undefined) {
              next[i] = 'validating';
            } else {
              next[i] = deepseekValidationCache.current[key].valid ? 'valid' : 'invalid';
            }
          }
        }
        return next;
      });

      if (keysToValidate.size > 0) {
        await Promise.all(Array.from(keysToValidate).map(async (key) => {
          deepseekValidationCache.current[key] = await validateDeepseekKey(key);
        }));

        setDeepseekKeyStatus(prev => {
          const next = [...prev];
          for (let i = 0; i < 3; i++) {
            const key = deepseekKeys[i].key.trim();
            if (key) {
              if (deepseekValidationCache.current[key] !== undefined) {
                next[i] = deepseekValidationCache.current[key].valid ? 'valid' : 'invalid';
              }
            }
          }
          return next;
        });

        setDeepseekBalances(prev => {
          const next = [...prev];
          for (let i = 0; i < 3; i++) {
            const key = deepseekKeys[i].key.trim();
            if (key && deepseekValidationCache.current[key]) {
              next[i] = deepseekValidationCache.current[key].balance;
            }
          }
          return next;
        });
      }
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [deepseekKeys]);


  const fetchAudioDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices
        .filter(d => d.kind === 'audioinput')
        .map((d, index) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${index + 1}`
        }));
      setAvailableMics(mics);

      const outputs = devices
        .filter(d => d.kind === 'audiooutput')
        .map((d, index) => ({
          deviceId: d.deviceId,
          label: d.label || `Speaker/Headphone ${index + 1}`
        }));
      setAvailableOutputs(outputs);

      if (mics.length > 0) {
        const currentSelected = mics.find(m => m.deviceId === selectedMicId);
        if (currentSelected) {
          setActiveMicName(currentSelected.label);
        } else {
          const defaultMic = mics.find(m => m.deviceId === 'default') || mics[0];
          setActiveMicName(defaultMic.label);
        }
      }
    } catch (e) {
      console.warn('Device enumeration notice:', e);
    }
  };

  useEffect(() => {
    fetchAudioDevices();
    navigator.mediaDevices.addEventListener('devicechange', fetchAudioDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', fetchAudioDevices);
    };
  }, [selectedMicId]);

  useEffect(() => {
    localStorage.setItem('selected_audio_input_device', selectedMicId);
  }, [selectedMicId]);

  useEffect(() => {
    localStorage.setItem('selected_audio_output_device', selectedOutputId);
  }, [selectedOutputId]);

  // Live Voice Activity meter when Settings panel is open
  useEffect(() => {
    if (!showSettings) {
      setLiveVoiceLevel(0);
      return;
    }

    let audioContext: AudioContext | null = null;
    let meterStream: MediaStream | null = null;
    let animId: number;

    const startMeter = async () => {
      try {
        const constraints: MediaStreamConstraints = {
          audio: selectedMicId && selectedMicId !== 'default'
            ? { deviceId: { exact: selectedMicId } }
            : true,
          video: false,
        };
        meterStream = await navigator.mediaDevices.getUserMedia(constraints);
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(meterStream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateMeter = () => {
          if (!analyser) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          // Scale from 0-128 to 0-100%
          const pct = Math.min(100, Math.round((avg / 64) * 100));
          setLiveVoiceLevel(pct);
          animId = requestAnimationFrame(updateMeter);
        };
        updateMeter();
      } catch (err) {
        console.warn('Voice meter notice:', err);
      }
    };

    startMeter();

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (meterStream) {
        meterStream.getTracks().forEach(t => t.stop());
      }
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch(() => {});
      }
      setLiveVoiceLevel(0);
    };
  }, [showSettings, selectedMicId]);

  // Sync mic state continuously and reactively to keep settings UI aligned with Windows system settings
  useEffect(() => {
    // Initial sync
    const syncState = () => {
      ipcRenderer.invoke('get-mic-state').then((state: any) => {
        if (state && typeof state.volume === 'number') {
          setSysMicVolume(state.volume);
          setSysMicMuted(Boolean(state.muted));
        }
      }).catch(() => { });
    };

    syncState();

    const handleMicStateChanged = (_event: any, state: { volume: number; muted: boolean }) => {
      if (state && typeof state.volume === 'number') {
        setSysMicVolume(state.volume);
        setSysMicMuted(Boolean(state.muted));
      }
    };

    ipcRenderer.on('mic-state-changed', handleMicStateChanged);

    const audioSyncInterval = setInterval(syncState, 800);
    return () => {
      clearInterval(audioSyncInterval);
      ipcRenderer.removeListener('mic-state-changed', handleMicStateChanged);
    };
  }, []);

  // Instant sync when settings modal opens
  useEffect(() => {
    if (showSettings) {
      ipcRenderer.invoke('get-mic-state').then((state: any) => {
        if (state && typeof state.volume === 'number') {
          setSysMicVolume(state.volume);
          setSysMicMuted(Boolean(state.muted));
        }
      }).catch(() => { });
    }
  }, [showSettings]);

  useEffect(() => {
    localStorage.setItem('resume_text', resumeText);
  }, [resumeText]);

  useEffect(() => {
    localStorage.setItem('resume_file_name', resumeFileName);
  }, [resumeFileName]);

  useEffect(() => {
    localStorage.setItem('resume_text_2', resumeText2);
  }, [resumeText2]);

  useEffect(() => {
    localStorage.setItem('resume_file_name_2', resumeFileName2);
  }, [resumeFileName2]);

  useEffect(() => {
    localStorage.setItem('resume_priority', resumePriority.toString());
  }, [resumePriority]);

  useEffect(() => {
    localStorage.setItem('personal_context_text', personalContextText);
  }, [personalContextText]);

  useEffect(() => {
    localStorage.setItem('personal_context_file_name', personalContextFileName);
  }, [personalContextFileName]);


  // reminder_profiles already persisted by the effect at line ~320; duplicate removed

  useEffect(() => {
    if (isRecording) {
      ipcRenderer.invoke('set-layout', layout);
    }
  }, [layout]);

  useEffect(() => {
    localStorage.setItem('sessions', JSON.stringify(sessions));
  }, [sessions]);

  // Emergency save on app close
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isRecording) {
        const finalLog = sessionLog + `\n\n[APP_CLOSED_AT:${new Date().toLocaleTimeString()}]\n\n`;
        if (finalLog.trim()) {
          const newSession = {
            id: currentSessionId || Date.now().toString(),
            name: sessionNameInput || 'Untitled Session',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            date: new Date().toLocaleDateString(),
            transcript: finalLog.trim(),
            aiAnswer: '',
            history: [...currentSessionHistory]
          };
          const newSessions = [newSession, ...sessions.filter(s => s.id !== newSession.id)];
          localStorage.setItem('sessions', JSON.stringify(newSessions));
        }
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isRecording, sessionLog, currentSessionId, sessionNameInput, currentSessionHistory, sessions]);


  useEffect(() => {
    localStorage.setItem('interview_title', interviewTitle);
  }, [interviewTitle]);





  // Block typing if stealth mode is ON
  useEffect(() => {
    const handleInputAttempt = (e: Event) => {
      if (showOnboardingModal) return; // Never block input during onboarding setup!
      if (stealthMode) {
        const target = e.target as HTMLElement;
        if (target.closest && (target.closest('.stealth-exempt') || target.closest('.onboarding-modal-container'))) return;
        if (target.tagName === 'TEXTAREA' || (target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'checkbox')) {
          e.preventDefault();
          e.stopPropagation();
          const rect = target.getBoundingClientRect();
          const modal = target.closest('.w-full.max-w-2xl, .w-full.max-w-4xl, .w-full.max-w-sm, .w-full.max-w-md');
          const shieldBtn = modal ? modal.querySelector('.shield-toggle-btn') : null;

          if (shieldBtn) {
            const shieldRect = shieldBtn.getBoundingClientRect();
            setStealthWarningToast({ x: shieldRect.left + (shieldRect.width / 2), y: shieldRect.bottom + 12, isShieldToast: true });
          } else {
            setStealthWarningToast({ x: rect.left + (rect.width / 2), y: rect.bottom + 12, isShieldToast: false });
          }

          if ((window as any).stealthToastTimeout) clearTimeout((window as any).stealthToastTimeout);
          (window as any).stealthToastTimeout = setTimeout(() => setStealthWarningToast(null), 2500);
        }
      }
    };

    document.addEventListener('mousedown', handleInputAttempt, true);
    document.addEventListener('keydown', handleInputAttempt, true);
    return () => {
      document.removeEventListener('mousedown', handleInputAttempt, true);
      document.removeEventListener('keydown', handleInputAttempt, true);
    };
  }, [stealthMode, showOnboardingModal]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isAiFullscreen, setIsAiFullscreen] = useState(false);
  const isAiFullscreenRef = useRef(false);
  isAiFullscreenRef.current = isAiFullscreen;
  const [frozenQuestionTranscript, setFrozenQuestionTranscript] = useState('');
  const frozenQuestionTranscriptRef = useRef('');
  frozenQuestionTranscriptRef.current = frozenQuestionTranscript;

  useEffect(() => {
    ipcRenderer.send('set-window-maximized', isAiFullscreen);
    if (isAiFullscreen) {
      currentIgnoreRef.current = false;
      ipcRenderer.send('set-ignore-mouse-events', false);
      ipcRenderer.invoke('set-ignore-mouse-events', false);
      ipcRenderer.invoke('focus-window').catch(() => {});
    } else {
      setIsVoiceScroll(false);
      setScrollSpeed(0);
      setActiveReadIndex(0);
    }
  }, [isAiFullscreen]);

  const [aiCopied, setAiCopied] = useState(false);

  const [topBarPos, setTopBarPos] = useState({ x: 0, y: 0 });
  const [answerPos, setAnswerPos] = useState({ x: 0, y: 0 });
  const dragStateRef = useRef<{ panel: 'top' | 'answer' | null, startX: number, startY: number, initialX: number, initialY: number }>({ panel: null, startX: 0, startY: 0, initialX: 0, initialY: 0 });

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const state = dragStateRef.current;
      if (!state.panel) return;
      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;
      if (state.panel === 'top') {
        setTopBarPos({ x: state.initialX + dx, y: state.initialY + dy });
      } else if (state.panel === 'answer') {
        setAnswerPos({ x: state.initialX + dx, y: state.initialY + dy });
      }
    };
    const handlePointerUp = () => {
      dragStateRef.current = { panel: null, startX: 0, startY: 0, initialX: 0, initialY: 0 };
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, []);



  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const timerIntervalRef = useRef<any>(null);
  const recordingStartTimeRef = useRef<number | null>(null);
  const aiAbortControllerRef = useRef<AbortController | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioChunksRef = useRef<Float32Array[]>([]);
  const totalAudioSamplesRef = useRef<number>(0);

  const clearAudioBuffer = () => {
    audioChunksRef.current = [];
    totalAudioSamplesRef.current = 0;
  };
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    // During recording OR AI fullscreen: hotkeys are ALWAYS on.
    // Mouse hover no longer affects hotkey state — it caused hotkeys to turn off
    // when the mouse moved off the answer panel, which is unexpected behavior.
    const shouldEnable = isRecording || isAiFullscreen;

    if (!shouldEnable) {
      setGlobalHotkeysEnabled(false);
      if (typeof ipcRenderer !== 'undefined') {
        ipcRenderer.invoke('toggle-global-hotkeys', false);
      }
    } else {
      setGlobalHotkeysEnabled(true);
      if (typeof ipcRenderer !== 'undefined') {
        ipcRenderer.invoke('toggle-global-hotkeys', true);
      }
    }
  }, [isAiFullscreen, isRecording]);


  // Stealth Mode click-through & mouse-boundary hotkey gating — throttled to ~20Hz
  const lastMouseSendRef = useRef<number>(0);
  const currentIgnoreRef = useRef<boolean | null>(null);
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const now = Date.now();
      if (now - lastMouseSendRef.current < 50) return; // 20Hz throttle
      lastMouseSendRef.current = now;

      // 1. If Stealth Shield is OFF, NEVER pass through or ignore mouse events: whole app is 100% interactive!
      if (!stealthMode) {
        if (currentIgnoreRef.current !== false) {
          currentIgnoreRef.current = false;
          ipcRenderer.send('set-ignore-mouse-events', false);
        }
        return;
      }

      // 2. If AI fullscreen is open, or any modal dialog is active, or app is on the dashboard:
      // ALWAYS ensure the window is 100% interactive so the answer screen never gets stuck or locks out clicks!
      const isAnyModalActive = showSettings || showInfo || showUpdateModal || showStorageModal || showClearStorageConfirm || showDeleteUserDataConfirm || showFeedbackModal || showOtpModal || showExportModal || showOnboardingModal || storageInfo.isFull || showSessionPrompt || showReminderPopup || showNotesPopup || showStealthWarning || showPreviousQuestions || Boolean(previewSnapshot);
      if (isAiFullscreen || isAnyModalActive || (!isRecording && !isAiFullscreen)) {
        if (currentIgnoreRef.current !== false) {
          currentIgnoreRef.current = false;
          ipcRenderer.send('set-ignore-mouse-events', false);
        }
        return;
      }

      const target = e.target as HTMLElement;
      // 3. Any button, input, textarea, card, toolbar, panel or drag-area is ALWAYS interactive!
      if (target.closest && (
        target.closest('.stealth-exempt') ||
        target.closest('.onboarding-modal-container') ||
        target.closest('button') ||
        target.closest('input') ||
        target.closest('textarea') ||
        target.closest('select') ||
        target.closest('.no-drag') ||
        target.closest('.drag-area') ||
        target.closest('.custom-scrollbar')
      )) {
        if (currentIgnoreRef.current !== false) {
          currentIgnoreRef.current = false;
          ipcRenderer.send('set-ignore-mouse-events', false);
          if (globalHotkeysEnabled) ipcRenderer.invoke('toggle-global-hotkeys', true);
        }
        return;
      }

      const shouldPassThrough = target.classList.contains('click-through-bg') || target === document.body || target === document.documentElement || target.id === 'root';

      if (currentIgnoreRef.current !== shouldPassThrough) {
        currentIgnoreRef.current = shouldPassThrough;
        ipcRenderer.send('set-ignore-mouse-events', shouldPassThrough);
      }
    };

    const handleMouseLeave = () => {
      // If stealth mode is off, or AI answer is fullscreen, or any modal is open, or dashboard is visible: NEVER ignore mouse events!
      const isAnyModalActive = showSettings || showInfo || showUpdateModal || showStorageModal || showClearStorageConfirm || showDeleteUserDataConfirm || showFeedbackModal || showOtpModal || showExportModal || showOnboardingModal || storageInfo.isFull || showSessionPrompt || showReminderPopup || showNotesPopup || showStealthWarning || showPreviousQuestions || Boolean(previewSnapshot);
      if (!stealthMode || isAiFullscreen || isAnyModalActive || (!isAiFullscreen && !isRecording)) {
        if (currentIgnoreRef.current !== false) {
          currentIgnoreRef.current = false;
          ipcRenderer.send('set-ignore-mouse-events', false);
        }
        return;
      }
      if (currentIgnoreRef.current !== true) {
        currentIgnoreRef.current = true;
        ipcRenderer.send('set-ignore-mouse-events', true);
      }
    };

    const handleMouseEnter = () => {
      if (!stealthMode || isAiFullscreen || (!isAiFullscreen && !isRecording)) {
        if (currentIgnoreRef.current !== false) {
          currentIgnoreRef.current = false;
          ipcRenderer.send('set-ignore-mouse-events', false);
        }
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
      if (isAiFullscreen) {
        currentIgnoreRef.current = false;
        ipcRenderer.send('set-ignore-mouse-events', false);
      }
    };
  }, [isAiFullscreen, isRecording, globalHotkeysEnabled, stealthMode]);

  // When stealth mode is toggled OFF, immediately restore full window mouse interactivity
  useEffect(() => {
    if (!stealthMode) {
      currentIgnoreRef.current = false;
      ipcRenderer.send('set-ignore-mouse-events', false);
      ipcRenderer.invoke('set-ignore-mouse-events', false);
    }
  }, [stealthMode]);

  // Robust snapshot preview window focus and Escape key handling in all modes (including Stealth)
  useEffect(() => {
    if (previewSnapshot) {
      currentIgnoreRef.current = false;
      ipcRenderer.send('set-ignore-mouse-events', false);
      ipcRenderer.invoke('focus-window').catch(() => {});

      const handlePreviewKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' || e.code === 'Escape' || e.keyCode === 27) {
          e.preventDefault();
          e.stopPropagation();
          setPreviewSnapshot(null);
        }
      };

      window.addEventListener('keydown', handlePreviewKeyDown, { capture: true });
      return () => {
        window.removeEventListener('keydown', handlePreviewKeyDown, { capture: true });
      };
    }
  }, [previewSnapshot]);

  // Restore mouse responsiveness and reset passthrough whenever the window is shown/restored
  useEffect(() => {
    const handleWindowShown = () => {
      currentIgnoreRef.current = false;
      ipcRenderer.send('set-ignore-mouse-events', false);
      if (globalHotkeysEnabled && isRecording) {
        ipcRenderer.invoke('toggle-global-hotkeys', true);
      }
    };
    ipcRenderer.on('window-shown', handleWindowShown);
    return () => {
      ipcRenderer.removeListener('window-shown', handleWindowShown);
    };
  }, [globalHotkeysEnabled, isRecording]);

  const handleCheckForUpdates = useCallback(() => {
    setUpdateStatus('checking');

    // Fast instant check against release repository with 3.5s timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    fetch('https://api.github.com/repos/HelloWorld-Farhan/ClueAi/releases/latest', { cache: 'no-store', signal: controller.signal })
      .then(r => r.json())
      .then(d => {
        clearTimeout(timeoutId);
        if (d && d.tag_name) {
          const latestTag = d.tag_name.replace(/^v/, '').trim();
          if (isNewerVersion(latestTag, appVersion)) {
            setUpdateStatus('available');
            setUpdateInfo({
              version: latestTag,
              releaseDate: d.published_at,
              releaseNotes: d.body
            });
            if (!showUpdateModalRef.current && !hasShownStartupPopupRef.current) {
              hasShownStartupPopupRef.current = true;
              setShowStartupUpdatePopup(true);
            }
            return;
          }
        }
        setUpdateStatus('not-available');
      })
      .catch(() => {
        clearTimeout(timeoutId);
        setUpdateStatus('not-available');
      });

    // Also trigger native updater in background
    ipcRenderer.invoke('check-for-updates').catch(() => {});
  }, [appVersion]);

  // Auto-updater IPC event listeners & version retrieval & initial checks
  useEffect(() => {
    // Notify main process that React UI has painted so splash window smoothly closes
    try {
      ipcRenderer.send('app-mounted');
    } catch {}

    // Auto-sync all local inboxes with Google Apps Script registered user pool for update broadcasts
    try {
      const primaryEmail = localStorage.getItem('clueai_user_email');
      const savedEmails: string[] = JSON.parse(localStorage.getItem('clueai_saved_emails') || '[]');
      const verifiedEmails: string[] = JSON.parse(localStorage.getItem('clueai_verified_emails') || '[]');
      const allEmails = Array.from(new Set([primaryEmail, ...savedEmails, ...verifiedEmails].filter(Boolean) as string[]));
      if (allEmails.length > 0) {
        fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'register_user',
            email: primaryEmail || allEmails[0],
            saved_emails: allEmails,
            user_name: localStorage.getItem('clueai_username') || 'ClueAI User',
            app_version: '5.9.6'
          })
        }).catch(() => {});
      }
    } catch {}

    ipcRenderer.invoke('get-app-version').then((v: string) => {
      if (v) setAppVersion(v);
    }).catch(() => { });

    // Defer network checks and disk storage scan by 3.5s to ensure cold boot paints instantly
    const initialDeferredTimer = setTimeout(() => {
      handleCheckForUpdates();
      fetchStorageInfo();
    }, 3500);
    const storageTimer = setInterval(fetchStorageInfo, 30000);

    const handleUpdaterStatus = (_event: any, data: any) => {
      if (!data) return;
      setUpdateStatus(data.status);
      if (data.status === 'available') {
        setUpdateInfo({
          version: data.version,
          releaseDate: data.releaseDate,
          releaseNotes: data.releaseNotes,
        });
        if (!showUpdateModalRef.current && !hasShownStartupPopupRef.current) {
          hasShownStartupPopupRef.current = true;
          setShowStartupUpdatePopup(true);
        }
      } else if (data.status === 'not-available') {
        // Quietly marked as up to date; do not prompt or re-check
        setUpdateStatus('not-available');
      } else if (data.status === 'downloading') {
        setDownloadProgress({
          percent: data.percent || 0,
          bytesPerSecond: data.bytesPerSecond || 0,
          transferred: data.transferred || 0,
          total: data.total || 0,
        });
        if (isInstallingUpdateRef.current) {
          const dlPercent = data.percent || 0;
          const mapped = Math.min(50, Math.max(1, Math.round(dlPercent * 0.5)));
          setInstallProgress(mapped);
          const mbTransferred = ((data.transferred || 0) / 1048576).toFixed(1);
          const mbTotal = ((data.total || 0) / 1048576).toFixed(1);
          const speed = ((data.bytesPerSecond || 0) / 1048576).toFixed(1);
          setInstallStageText(`Downloading update (${mbTransferred} MB / ${mbTotal} MB • ${speed} MB/s)...`);
        }
      } else if (data.status === 'downloaded') {
        setUpdateInfo(prev => ({ ...prev, version: data.version, releaseNotes: data.releaseNotes || prev.releaseNotes }));
        if (isInstallingUpdateRef.current) {
          triggerSeamlessInstallPhases();
        }
      } else if (data.status === 'error') {
        if (isInstallingUpdateRef.current) {
          setIsInstallingUpdate(false);
          setShowUpdateModal(true);
          setUpdateStatus('error');
          setUpdateInfo(prev => ({ ...prev, message: data.message || 'Update download encountered an issue. Please try again.' }));
        }
      }
    };

    ipcRenderer.on('updater-status', handleUpdaterStatus);
    return () => {
      clearTimeout(initialDeferredTimer);
      clearInterval(storageTimer);
      ipcRenderer.removeListener('updater-status', handleUpdaterStatus);
    };
  }, [handleCheckForUpdates, fetchStorageInfo]);

  const triggerSeamlessInstallPhases = () => {
    let current = 50;
    setInstallProgress(50);
    setInstallStageText("Verifying update package integrity & signatures...");

    const tick = () => {
      current += 1;
      setInstallProgress(current);

      let delay = 35;
      if (current <= 70) {
        setInstallStageText("Extracting update packages & assets...");
        delay = 30;
      } else if (current <= 92) {
        setInstallStageText("Replacing system binaries & updating assets...");
        delay = 40;
      } else if (current < 100) {
        setInstallStageText("Finalizing installation & preparing instant launch...");
        delay = 35;
      } else {
        setInstallStageText("Update 100% complete! Launching Clue AI...");
        ipcRenderer.invoke('quit-and-install-update');
        return;
      }

      setTimeout(tick, delay);
    };

    setTimeout(tick, 35);
  };

  const handleStartUnifiedUpdate = () => {
    setIsInstallingUpdate(true);
    setShowUpdateModal(false);
    setShowStartupUpdatePopup(false);

    if (updateStatus === 'downloaded') {
      triggerSeamlessInstallPhases();
    } else {
      setInstallProgress(1);
      setInstallStageText("Initiating secure update download from Clue AI cloud...");
      setUpdateStatus('downloading');
      setDownloadProgress({ percent: 0, bytesPerSecond: 0, transferred: 0, total: 0 });

      // Visual smooth initial progress ramp while connection establishes
      let initialDl = 1;
      const initialTimer = setInterval(() => {
        if (!isInstallingUpdateRef.current) {
          clearInterval(initialTimer);
          return;
        }
        if (initialDl < 15 && downloadProgress.percent === 0) {
          initialDl += 1;
          setInstallProgress(initialDl);
          setInstallStageText(`Connecting to Clue AI cloud (${initialDl}%)...`);
        } else {
          clearInterval(initialTimer);
        }
      }, 120);

      ipcRenderer.invoke('download-update', updateInfo.version).then((res: any) => {
        if (res && res.error) {
          clearInterval(initialTimer);
          setIsInstallingUpdate(false);
          setShowUpdateModal(true);
          setUpdateStatus('error');
          setUpdateInfo(prev => ({ ...prev, message: res.error }));
        }
      }).catch((err: any) => {
        clearInterval(initialTimer);
        setIsInstallingUpdate(false);
        setShowUpdateModal(true);
        setUpdateStatus('error');
        setUpdateInfo(prev => ({ ...prev, message: err?.message || 'Download failed' }));
      });
    }
  };

  const handleDownloadUpdate = handleStartUnifiedUpdate;
  const handleRestartToInstall = handleStartUnifiedUpdate;

  // Auto-scroll transcript box to bottom as words stream in
  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [finalizedText, interimText, transcript]);

  // Synchronize dynamic window sizing: compact dock vs 860px for modals, snapshot preview, or AI answer
  useEffect(() => {
    if (isRecording) {
      const isExpanded = isAiFullscreen || showSettings || showInfo || showVirtualKeyboard || showPreviousQuestions || showUpdateModal || showStorageModal || showClearStorageConfirm || storageInfo.isFull || Boolean(previewSnapshot);
      const hasSnapshots = currentSnapshots.length > 0;
      const isTranscriptTall = transcript.length > 80;
      ipcRenderer.invoke('set-ai-fullscreen-bounds', isExpanded, { hasSnapshots, isTranscriptTall });
    }
  }, [isAiFullscreen, showSettings, showInfo, showVirtualKeyboard, showPreviousQuestions, showUpdateModal, showStorageModal, showClearStorageConfirm, storageInfo.isFull, previewSnapshot, isRecording, currentSnapshots.length, transcript.length > 80]);

  useEffect(() => {
    localStorage.setItem('appStealthMode', stealthMode.toString());
    ipcRenderer.invoke('set-stealth', stealthMode);
  }, [stealthMode]);

  useEffect(() => {
    localStorage.setItem('appOpacity', opacity.toString());
  }, [opacity]);

  useEffect(() => {
    // If onboarding setup is active, keep shield OFF so user can freely enter name and email
    if (showOnboardingModal) {
      setStealthMode(false);
      ipcRenderer.invoke('set-stealth', false);
    } else {
      // Default to Stealth Mode ON every time the app opens for maximum safety
      setStealthMode(true);
      ipcRenderer.invoke('set-stealth', true);
    }

    // Defer desktop sources enumeration to prevent startup UI blocking
    const timer = setTimeout(() => {
      ipcRenderer.invoke('get-desktop-sources').then((s: any) => {
        setSources(s);
        if (s.length > 0) setSelectedSource(s[0].id);
      }).catch(() => {});
    }, 150);

    return () => clearTimeout(timer);
  }, []);

  // Ensure shield is OFF whenever onboarding modal is open
  useEffect(() => {
    if (showOnboardingModal) {
      setStealthMode(false);
      ipcRenderer.invoke('set-stealth', false);
    }
  }, [showOnboardingModal]);

  useEffect(() => {
    setStealthWarningToast(null);
  }, [showReminderPopup, showNotesPopup, showSettings, showSessionPrompt, showVirtualKeyboard]);

  // Dynamically allow focus ONLY when the user needs to type text.
  // When these modals are closed, the app becomes a non-focusable Ghost Overlay to bypass anti-cheat checks.
  useEffect(() => {
    const wantsFocus = showSessionPrompt || showSettings || showUsernamePrompt || showReminderPopup || showVirtualKeyboard || showNotesPopup || (editingSessionId !== null);

    // When NOT recording (e.g., in the main menu/history tab), the app should always be focusable so users can interact with everything normally.
    // When RECORDING (stealth mode), the app is generally an unfocusable ghost overlay to avoid detection.
    // However, if the user opens a modal (wantsFocus), they have accepted the risk and we MUST make it focusable so they can type.
    const needsFocus = !isRecording || wantsFocus;

    ipcRenderer.invoke('set-focusable', needsFocus);

    // Only hijack keys globally if we are recording AND the window is acting as an unfocusable ghost overlay.
    ipcRenderer.invoke('toggle-global-hotkeys', !needsFocus && isRecording);
  }, [showSessionPrompt, showSettings, showUsernamePrompt, showReminderPopup, showVirtualKeyboard, showNotesPopup, editingSessionId, isRecording]);

  useEffect(() => {
    if (showVirtualKeyboard) {
      clearAudioBuffer();
      interimTranscriptRef.current = '';
      setEditTranscript(transcript);

      // Force window to take active OS focus and immediately silence all background hotkeys
      ipcRenderer.invoke('set-focusable', true);
      ipcRenderer.invoke('focus-window');
      ipcRenderer.invoke('toggle-global-hotkeys', false);

      const focusTextarea = () => {
        const el = virtualKeyboardTextareaRef.current;
        if (el) {
          el.focus();
          const len = el.value.length;
          el.setSelectionRange(len, len);
        }
      };

      focusTextarea();
      requestAnimationFrame(focusTextarea);
      setTimeout(focusTextarea, 20);
      setTimeout(focusTextarea, 80);
      setTimeout(focusTextarea, 200);

      const handleGlobalKeydown = () => {
        const el = virtualKeyboardTextareaRef.current;
        if (el && document.activeElement !== el) {
          el.focus();
        }
      };

      window.addEventListener('keydown', handleGlobalKeydown, true);
      return () => {
        window.removeEventListener('keydown', handleGlobalKeydown, true);
      };
    } else {
      if (isRecording) {
        ipcRenderer.invoke('toggle-global-hotkeys', true);
      }
    }
  }, [showVirtualKeyboard, transcript, isRecording]);

  const [deleteMsg, setDeleteMsg] = useState('');

  const handleDeleteFile = (type: 'resume1' | 'resume2' | 'personal') => {
    if (type === 'resume1') {
      setResumeText('');
      setResumeFileName('');
    } else if (type === 'resume2') {
      setResumeText2('');
      setResumeFileName2('');
    } else if (type === 'personal') {
      setPersonalContextText('');
      setPersonalContextFileName('');
    }
    setDeleteMsg('Successfully deleted');
    setTimeout(() => setDeleteMsg(''), 3000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'resume1' | 'resume2' | 'personal') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === 'resume1') setIsUploadingResume(true);
    else if (type === 'resume2') setIsUploadingResume2(true);
    else setIsUploadingPersonalContext(true);

    if (type === 'resume1') setResumeFileName(file.name);
    else if (type === 'resume2') setResumeFileName2(file.name);
    else setPersonalContextFileName(file.name);

    try {
      let parsedText = '';
      if (file.name.endsWith('.pdf')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await ipcRenderer.invoke('parse-pdf-buffer', arrayBuffer);

        if (result && typeof result === 'object') {
          if (result.isScanned) {
            setAlertMessage({ title: 'Image-Only PDF', message: 'Warning: This PDF appears to be a scanned document (images only) without selectable text. CrackIt cannot read text from images. Please upload a text-based PDF or convert this file using an OCR tool first.', type: 'warning' });
          }
          parsedText = result.text || '';
        } else if (typeof result === 'string') {
          parsedText = result;
        }
      } else {
        const reader = new FileReader();
        parsedText = await new Promise((resolve) => {
          reader.onload = (ev) => resolve(ev.target?.result as string);
          reader.readAsText(file);
        });
      }

      if (parsedText) {
        if (type === 'resume1') setResumeText(parsedText);
        else if (type === 'resume2') setResumeText2(parsedText);
        else setPersonalContextText(parsedText);
      } else {
        setAlertMessage({ title: 'Parse Error', message: 'Failed to parse file.', type: 'error' });
        if (type === 'resume1') setResumeFileName('');
        else if (type === 'resume2') setResumeFileName2('');
        else setPersonalContextFileName('');
      }
    } catch (err: any) {
      if (type === 'resume1') {
        setIsUploadingResume(false);
      } else if (type === 'resume2') {
        setIsUploadingResume2(false);
      } else {
        setIsUploadingPersonalContext(false);
      }
      setAlertMessage({ title: 'Error', message: `Error parsing file: ${err.message}`, type: 'error' });
      if (type === 'resume1') setResumeFileName('');
      else if (type === 'resume2') setResumeFileName2('');
      else setPersonalContextFileName('');
    } finally {
      if (type === 'resume1') setIsUploadingResume(false);
      else if (type === 'resume2') setIsUploadingResume2(false);
      else setIsUploadingPersonalContext(false);
    }
  };

  const handleStartCaptureClick = async () => {
    if (username.trim() === '') {
      setLocalRenameStealth(stealthMode);
      setShowUsernamePrompt(true);
      return;
    }

    const hasGroq = groqKeys.some(k => k.trim() !== '');
    const hasGemini = geminiKeys.some(k => k.trim() !== '');
    const hasClaude = claudeKeys.some(k => k.key.trim() !== '');
    const hasChatGPT = chatgptKeys.some(k => k.key.trim() !== '');
    const hasDeepSeek = deepseekKeys.some(k => k.key.trim() !== '');
    const hasGlm = glmKeys.some(k => k.key.trim() !== '');

    const hasAnyKey = hasGroq || hasGemini || hasClaude || hasChatGPT || hasDeepSeek || hasGlm;
    if (!hasAnyKey) {
      setAlertMessage({ title: 'API Key Required', message: 'Please add at least one valid API key (Gemini, Groq, Claude, ChatGPT, or DeepSeek) in Settings to start the interview.', type: 'warning' });
      setLocalSettingsStealth(stealthMode);
      setShowSettings(true);
      return;
    }

    // Determine the active provider: if current selected provider has a key, keep it; otherwise auto-select the provider that has a key!
    let activeProvider = provider;
    const isCurrentProviderValid = (
      (provider === 'groq' && hasGroq) ||
      (provider === 'gemini-flash' && hasGemini) ||
      (provider === 'claude' && hasClaude) ||
      (provider === 'chatgpt' && hasChatGPT) ||
      (provider === 'deepseek' && hasDeepSeek)
    );

    if (!isCurrentProviderValid) {
      if (hasGemini) activeProvider = 'gemini-flash';
      else if (hasGroq) activeProvider = 'groq';
      else if (hasClaude) activeProvider = 'claude';
      else if (hasChatGPT) activeProvider = 'chatgpt';
      else if (hasDeepSeek) activeProvider = 'deepseek';

      setProvider(activeProvider);
      switchProvider(activeProvider);
      localStorage.setItem('selected_provider', activeProvider);
    }

    if (!selectedSource) {
      setAlertMessage({ title: 'Source Missing', message: 'Please select a screen to capture.', type: 'warning' });
      return;
    }

    // PRE-FLIGHT AUDIO CHECK
    try {
      const testStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      testStream.getTracks().forEach(t => t.stop());
    } catch (e) {
      // If getUserMedia fails the mic is not accessible
    }

    if (!stealthMode) {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        oscillator.start();
        setTimeout(() => oscillator.stop(), 300);
      } catch (e) { }

      setShowStartStealthWarning(true);
      return;
    }

    setSessionNameInput('');
    setCurrentSessionId('');
    setSessionError('');
    setShowSessionPrompt(true);
  };

  const proceedWithInterview = () => {
    setShowStartStealthWarning(false);
    setSessionNameInput('');
    setCurrentSessionId('');
    setSessionError('');
    setShowSessionPrompt(true);
  };

  const activeAITimeoutRef = useRef<any>(null);

  const startRecording = async (isSilentRestart: boolean | any = false, isStealthBypass: boolean = false) => {
    const silent = typeof isSilentRestart === 'boolean' ? isSilentRestart : false;

    // Auto-resolve desktop screen source if empty, without blocking or hanging
    let activeSourceId = selectedSource;
    if (!activeSourceId) {
      try {
        const freshSources: any = await withTimeout<any>(ipcRenderer.invoke('get-desktop-sources'), 1500, []);
        if (freshSources && freshSources.length > 0) {
          setSources(freshSources);
          setSelectedSource(freshSources[0].id);
          activeSourceId = freshSources[0].id;
        }
      } catch (_) {}
    }

    if (!silent) {
      let activeProvider = provider;
      const hasCurrent = (
        (provider === 'groq' && groqKeys.some(k => k.trim())) ||
        (provider === 'gemini-flash' && geminiKeys.some(k => k.trim())) ||
        (provider === 'claude' && claudeKeys.some(k => k.key.trim())) ||
        (provider === 'chatgpt' && chatgptKeys.some(k => k.key.trim())) ||
        (provider === 'deepseek' && deepseekKeys.some(k => k.key.trim()))
      );

      if (!hasCurrent) {
        if (geminiKeys.some(k => k.trim())) activeProvider = 'gemini-flash';
        else if (groqKeys.some(k => k.trim())) activeProvider = 'groq';
        else if (claudeKeys.some(k => k.key.trim())) activeProvider = 'claude';
        else if (chatgptKeys.some(k => k.key.trim())) activeProvider = 'chatgpt';
        else if (deepseekKeys.some(k => k.key.trim())) activeProvider = 'deepseek';

        setProvider(activeProvider);
        switchProvider(activeProvider);
        localStorage.setItem('selected_provider', activeProvider);
      }
      setIsAnswerMinimized(false);
      setIsTranscriptMinimized(false);
      setIsTopBarMinimized(false);
      setGlobalHotkeysEnabled(true);
      setTopBarPos({ x: 0, y: 0 });
      setAnswerPos({ x: 0, y: 0 });
      ipcRenderer.invoke('toggle-global-hotkeys', true);

      if (showSessionPrompt || isStealthBypass) {
        if (!currentSessionId) {
          const name = isStealthBypass ? ('Stealth Session ' + new Date().toLocaleTimeString()) : sessionNameInput.trim();
          if (!name) {
            setSessionError('Please enter a session name.');
            return;
          }
          if (sessions.some(s => s.name.toLowerCase() === name.toLowerCase())) {
            setSessionError('Session name already exists. Please choose a different name.');
            return;
          }

          setCurrentSessionId(Date.now().toString());
          setSessionLog(`\n\n[SESSION_START:${new Date().toLocaleTimeString()}]\n\n`);
          setCurrentSessionHistory([]);
        } else {
          // Resuming an existing session: preserve history and append continuation heading
          const existing = sessions.find(s => s.id === currentSessionId);
          const nowStr = `${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`;
          const continuationBanner = `\n\n-------------------------------------------------------\n[SESSION_CONTINUED: ${nowStr}]\n-------------------------------------------------------\n\n`;
          if (existing) {
            setSessionLog((existing.transcript || '') + continuationBanner);
            if (Array.isArray(existing.history)) {
              setCurrentSessionHistory([...existing.history]);
            }
            if (existing.name && !sessionNameInput) {
              setSessionNameInput(existing.name);
            }
          } else {
            setSessionLog(`\n\n[SESSION_START:${new Date().toLocaleTimeString()}]\n\n`);
            setCurrentSessionHistory([]);
          }
        }
      } else if (!currentSessionId) {
        setCurrentSessionId(Date.now().toString());
        setSessionLog(`\n\n[SESSION_START:${new Date().toLocaleTimeString()}]\n\n`);
        setCurrentSessionHistory([]);
      } else {
        const existing = sessions.find(s => s.id === currentSessionId);
        const nowStr = `${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`;
        const continuationBanner = `\n\n-------------------------------------------------------\n[SESSION_CONTINUED: ${nowStr}]\n-------------------------------------------------------\n\n`;
        if (existing) {
          setSessionLog((existing.transcript || '') + continuationBanner);
          if (Array.isArray(existing.history)) {
            setCurrentSessionHistory([...existing.history]);
          }
        }
      }

      setTranscript('');
      setFinalizedText('');
      setInterimText('');
      finalizedTranscriptRef.current = '';
      interimTranscriptRef.current = '';
    }

    setSessionError('');
    setShowSessionPrompt(false);
    setIsRecording(true);
    setIsPaused(false);
    ipcRenderer.invoke('start-interview-window', layout);

    const validGroqKeys = groqKeys.filter(k => k.trim());
    const validGeminiKeys = geminiKeys.filter(k => k.trim());

    initAIClient(provider, groqKeys, geminiKeys, claudeKeys, chatgptKeys, deepseekKeys, glmKeys);
    setSTTApiKey(validGroqKeys, validGeminiKeys);

    await withTimeout(initSTT(() => { }), 2500, null);
    clearAudioBuffer();

    try {
      let desktopStream: MediaStream | null = null;
      let micStream: MediaStream | null = null;

      // 1. Attempt Desktop Audio Capture with 2500ms safety timeout
      try {
        if (activeSourceId) {
          desktopStream = await withTimeout(
            navigator.mediaDevices.getUserMedia({
              audio: {
                mandatory: {
                  chromeMediaSource: 'desktop',
                  chromeMediaSourceId: activeSourceId,
                }
              } as any,
              video: {
                mandatory: {
                  chromeMediaSource: 'desktop',
                  chromeMediaSourceId: activeSourceId,
                }
              } as any
            }),
            2500,
            null
          );

          if (desktopStream) {
            desktopStream.getVideoTracks().forEach(t => t.stop());
          }
        }
      } catch (errDesktop) {
        console.warn('Meeting desktop loopback audio notice (non-fatal, continuing):', errDesktop);
        desktopStream = null;
      }

      // 2. Attempt Microphone Capture with safety timeout
      try {
        const micConstraints: MediaTrackConstraints = {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        };
        if (selectedMicId && selectedMicId !== 'default') {
          micConstraints.deviceId = { exact: selectedMicId };
        }
        micStream = await withTimeout(
          navigator.mediaDevices.getUserMedia({
            audio: micConstraints,
            video: false,
          }),
          2000,
          null
        );
      } catch (errMic1) {
        console.warn('Direct mic with constraints notice, trying basic audio...', errMic1);
      }

      if (!micStream || micStream.getAudioTracks().length === 0) {
        try {
          const fallbackConstraints: MediaTrackConstraints = {};
          if (selectedMicId && selectedMicId !== 'default') {
            fallbackConstraints.deviceId = { exact: selectedMicId };
          }
          micStream = await withTimeout(
            navigator.mediaDevices.getUserMedia({
              audio: Object.keys(fallbackConstraints).length > 0 ? fallbackConstraints : true,
              video: false,
            }),
            2000,
            null
          );
        } catch (errMic2) {
          console.warn('Basic mic failed, enumerating connected audio devices (earpods / external mic)...', errMic2);
          try {
            const devices = await withTimeout(navigator.mediaDevices.enumerateDevices(), 1500, []);
            const audioInputs = devices.filter(d => d.kind === 'audioinput');
            for (const dev of audioInputs) {
              try {
                micStream = await withTimeout(
                  navigator.mediaDevices.getUserMedia({
                    audio: { deviceId: { exact: dev.deviceId } },
                    video: false,
                  }),
                  1500,
                  null
                );
                if (micStream && micStream.getAudioTracks().length > 0) break;
              } catch (_) {}
            }
          } catch (_) {}
        }
      }

      const hasDesktopAudio = Boolean(desktopStream && desktopStream.getAudioTracks().length > 0);
      const hasMicAudio = Boolean(micStream && micStream.getAudioTracks().length > 0);

      if (!hasDesktopAudio && !hasMicAudio) {
        throw new Error('No working audio input was detected. Please verify your earpods or microphone are connected and try again.');
      }

      const combinedTracks: MediaStreamTrack[] = [];
      if (hasDesktopAudio && desktopStream) combinedTracks.push(...desktopStream.getAudioTracks());
      if (hasMicAudio && micStream) combinedTracks.push(...micStream.getAudioTracks());
      streamRef.current = new MediaStream(combinedTracks);

      let recoveryTimeout: any = null;
      const handleDeviceBreak = () => {
        if (!isRecordingRef.current || isRecoveringRef.current) return;
        isRecoveringRef.current = true;
        console.log("Audio device routing changed (earpods/headphones connected or disconnected). Auto-recovering in 800ms...");
        if (recoveryTimeout) clearTimeout(recoveryTimeout);
        recoveryTimeout = setTimeout(async () => {
          try {
            stopRecording(true);
            await startRecording(true);
          } catch (e) {
            console.warn("Auto-recovery first attempt failed, retrying in 1s...", e);
            setTimeout(() => {
              startRecording(true).catch(() => {}).finally(() => {
                isRecoveringRef.current = false;
              });
            }, 1000);
            return;
          }
          isRecoveringRef.current = false;
        }, 800);
      };

      if (hasMicAudio && micStream) {
        micStream.getAudioTracks().forEach(track => track.addEventListener('ended', handleDeviceBreak));
      }
      if (hasDesktopAudio && desktopStream) {
        desktopStream.getAudioTracks().forEach(track => track.addEventListener('ended', handleDeviceBreak));
      }
      navigator.mediaDevices.ondevicechange = handleDeviceBreak;

      // AudioContext: try 16000Hz, or fallback to device native sample rate (e.g. 48000Hz on Bluetooth earpods)
      let audioCtx: AudioContext;
      try {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      } catch (errCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      audioContextRef.current = audioCtx;

      const mixer = audioCtx.createGain();
      if (hasDesktopAudio && desktopStream) {
        try {
          const desktopSource = audioCtx.createMediaStreamSource(desktopStream);
          // Boost meeting loopback audio so remote interviewer/participant voices in Zoom, Teams, Meet are crystal clear
          const desktopGain = audioCtx.createGain();
          desktopGain.gain.value = 1.35;
          desktopSource.connect(desktopGain);
          desktopGain.connect(mixer);
        } catch (errConnectDesktop) {
          console.warn('Could not connect desktop source to mixer:', errConnectDesktop);
        }
      }
      if (hasMicAudio && micStream) {
        try {
          const micSource = audioCtx.createMediaStreamSource(micStream);
          const micGain = audioCtx.createGain();
          micGain.gain.value = 2.0; // Boost microphone capture so quiet speech is heard clearly
          micSource.connect(micGain);
          micGain.connect(mixer);
        } catch (errConnectMic) {
          console.warn('Could not connect mic source to mixer:', errConnectMic);
        }
      }

      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      const inputSampleRate = audioCtx.sampleRate || 16000;

      processor.onaudioprocess = (e) => {
        // When manual edit / keyword editor is open, do not buffer speech
        if (showVirtualKeyboardRef.current) return;

        const inputData = e.inputBuffer.getChannelData(0);

        // Native Web Audio Volume Gate (0% CPU, 0 API calls)
        let frameMax = 0;
        let frameSumSquares = 0;
        for (let i = 0; i < inputData.length; i++) {
          const val = Math.abs(inputData[i]);
          if (val > frameMax) frameMax = val;
          frameSumSquares += val * val;
        }
        const frameRms = Math.sqrt(frameSumSquares / inputData.length);

        // Ambient noise threshold: sound above 0.015 or RMS above 0.005 (captures quiet speech)
        if (frameMax > 0.015 || frameRms > 0.005) {
          lastSpokenTimestampRef.current = Date.now();
        }

        // Voice active state with smooth 350ms speech hold buffer (accommodates inter-syllable pauses)
        const isSpeaking = (Date.now() - lastSpokenTimestampRef.current) < 350;
        if (isSpeakingRef.current !== isSpeaking) {
          isSpeakingRef.current = isSpeaking;
          setIsSpeakingLive(isSpeaking);
        }

        // If paused, or if in AI answer view and Voice Scroll is not enabled, do not buffer speech
        if (isPausedRef.current || (isAiFullscreenRef.current && !isVoiceScrollRef.current)) return;

        let resampled: Float32Array;

        if (inputSampleRate === 16000) {
          resampled = new Float32Array(inputData);
        } else {
          // Accurate linear downsampling from Bluetooth / system sample rate (48kHz/44.1kHz) to 16kHz
          const ratio = inputSampleRate / 16000;
          const newLength = Math.round(inputData.length / ratio);
          resampled = new Float32Array(newLength);
          for (let i = 0; i < newLength; i++) {
            const originIndex = i * ratio;
            const indexFloor = Math.floor(originIndex);
            const indexCeil = Math.min(inputData.length - 1, indexFloor + 1);
            const t = originIndex - indexFloor;
            resampled[i] = (1 - t) * inputData[indexFloor] + t * inputData[indexCeil];
          }
        }

        audioChunksRef.current.push(resampled);
        totalAudioSamplesRef.current += resampled.length;

        // If Voice Scroll is active, trigger real-time chunk recognition as soon as ~350ms is captured
        if (isAiFullscreenRef.current && isVoiceScrollRef.current && totalAudioSamplesRef.current >= 16000 * 0.35 && !isProcessingRef.current) {
          processAudioRef.current();
        }
      };

      mixer.connect(processor);
      const silencer = audioCtx.createGain();
      silencer.gain.value = 0.0001;
      processor.connect(silencer);
      silencer.connect(audioCtx.destination);

      // Successfully initialized audio! Transition window to interview dock layout now:
      await ipcRenderer.invoke('start-interview-window', layout);
      setIsRecording(true);
      setIsPaused(false);

      intervalRef.current = setInterval(() => {
        processAudioRef.current();
      }, 500);

      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (!silent || !recordingStartTimeRef.current) {
        recordingStartTimeRef.current = Date.now();
        setRecordingSeconds(0);
      }
      timerIntervalRef.current = setInterval(() => {
        if (recordingStartTimeRef.current) {
          const elapsed = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
          setRecordingSeconds(elapsed);
        }
      }, 500);
    } catch (e: any) {
      if (stealthMode) ipcRenderer.invoke('set-stealth', true);
      console.error('startRecording error:', e);
      if (silent) {
        setTimeout(() => startRecording(true).finally(() => { isRecoveringRef.current = false; }), 2000);
        return;
      }
      setAlertMessage({
        title: 'Capture Notice',
        message: e?.message || 'Failed to capture audio. If earpods were recently plugged in, click Restart ClueAI to reset your Windows audio routing.',
        type: 'error'
      });
      setIsRecording(false);
      setIsPaused(false);
      setShowSessionPrompt(false);
      clearAudioBuffer();
      // Ensure window is always restored to full dashboard size if audio init fails
      ipcRenderer.invoke('stop-interview-window');
    }
  };

  const processAudioRef = useRef<() => void>(() => { });
  const isProcessingRef = useRef(false);
  const silenceFramesRef = useRef(0);
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
  const listeningSessionIdRef = useRef(0);

  const processAudio = async () => {
    if (!streamRef.current) return;
    // When manual edit section is open, do not transcribe or inject words
    if (showVirtualKeyboardRef.current) return;
    if (isPausedRef.current || (isAiFullscreenRef.current && !isVoiceScrollRef.current)) {
      return;
    }
    if (isProcessingRef.current) return;

    const isVoiceScrollMode = Boolean(isAiFullscreenRef.current && isVoiceScrollRef.current);
    const minSamples = isVoiceScrollMode ? (16000 * 0.35) : (16000 * 0.8);
    if (totalAudioSamplesRef.current < minSamples) {
      return;
    }

    isProcessingRef.current = true;
    try {
      // Merge chunk buffers only when preparing audio for analysis
      const totalLen = totalAudioSamplesRef.current;
      let currentAudio = new Float32Array(totalLen);
      let offset = 0;
      for (const ch of audioChunksRef.current) {
        currentAudio.set(ch, offset);
        offset += ch.length;
      }

      if (currentAudio.length > 16000 * 30) {
        currentAudio = currentAudio.slice(currentAudio.length - 16000 * 30);
        audioChunksRef.current = [currentAudio];
        totalAudioSamplesRef.current = currentAudio.length;
      }

      // Dual-Metric Voice Activity Detection (VAD): RMS Energy + Peak Amplitude
      const recentAudio = currentAudio.slice(Math.max(0, currentAudio.length - 16000 * 0.8));
      let sumSquares = 0;
      let maxVal = 0;
      for (let i = 0; i < recentAudio.length; i++) {
        const val = recentAudio[i];
        const absVal = Math.abs(val);
        if (absVal > maxVal) maxVal = absVal;
        sumSquares += val * val;
      }
      const rms = Math.sqrt(sumSquares / (recentAudio.length || 1));

      // Sensitive Vocal Gate: Captures quiet/soft voices without capturing ambient static
      // Ambient fan/room noise: maxVal < 0.012, rms < 0.004
      // Human speech (including quiet and soft speech): maxVal >= 0.015 or rms >= 0.005
      const isVoiceActive = (maxVal >= 0.015 || rms >= 0.005);

      if (!isVoiceActive) {
        silenceFramesRef.current += 1;
        // Require at least 2.0s (4 frames of 500ms) of continuous silence before committing sentence
        if (silenceFramesRef.current >= 4 && totalAudioSamplesRef.current > 0) {
          logEvent("Silence detected. Committing sentence and flushing STT buffer.");

          if (!isVoiceScrollMode && interimTranscriptRef.current) {
            finalizedTranscriptRef.current = (finalizedTranscriptRef.current + ' ' + interimTranscriptRef.current).trim();
          }

          clearAudioBuffer(); // FLUSH buffer only when user actually finished talking
          interimTranscriptRef.current = ''; // Reset interim
          silenceFramesRef.current = 0;

          if (!isPausedRef.current && !isVoiceScrollMode) {
            setFinalizedText(finalizedTranscriptRef.current);
            setInterimText('');
            setTranscript(finalizedTranscriptRef.current);
          }
        }
        isProcessingRef.current = false;
        return;
      }

      silenceFramesRef.current = 0; // Reset silence counter since they are speaking

      // Special handling for Voice Scroll (Real-Time Word Detection & Blurring Teleprompter)
      if (isVoiceScrollMode) {
        if (!aiAnswerRef.current) {
          clearAudioBuffer();
          isProcessingRef.current = false;
          return;
        }

        const cleanAnswer = aiAnswerRef.current.replace(/<think>[\s\S]*?(?:<\/think>|$)/g, '').replace(/(?:\r?\n){3,}/g, '\n\n').trim();
        const allWords = cleanAnswer.split(/\s+/).filter(Boolean);
        const curWordIdx = readWordIndexRef.current || 0;

        // Extract upcoming words as targeted context prompt for Whisper
        const upcomingWords = allWords.slice(curWordIdx, curWordIdx + 15).map(w => w.replace(/[^a-zA-Z0-9]/g, '')).filter(Boolean);
        const promptSnippet = upcomingWords.slice(0, 8).join(' ');

        const spokenChunk = await transcribeAudioChunk(currentAudio, promptSnippet);
        clearAudioBuffer(); // Keep buffer short (~350ms) for real-time responsiveness

        if (spokenChunk && !spokenChunk.startsWith('ERR:') && spokenChunk.trim().length > 0) {
          const cleanSpoken = spokenChunk.trim();
          setLiveSpokenText(cleanSpoken);
          liveSpokenTextRef.current = cleanSpoken;

          const spokenWords = cleanSpoken.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
          if (spokenWords.length > 0 && allWords.length > 0) {
            let newWordIdx = curWordIdx;
            const lookaheadMax = Math.min(allWords.length, curWordIdx + 10);

            const isMatch = (target: string, spoken: string) => {
              if (!target || !spoken) return false;
              const t = target.toLowerCase().replace(/[^a-z0-9]/g, '');
              const s = spoken.toLowerCase().replace(/[^a-z0-9]/g, '');
              if (!t || !s) return false;
              if (t === s) return true;
              if (t.length > 3 && s.length > 3 && (t.includes(s) || s.includes(t))) return true;
              if (t.length >= 4 && s.length >= 4 && t.slice(0, 3) === s.slice(0, 3)) return true;
              return false;
            };

            for (let i = curWordIdx; i < lookaheadMax; i++) {
              for (let s = 0; s < spokenWords.length; s++) {
                if (isMatch(allWords[i], spokenWords[s])) {
                  newWordIdx = Math.max(newWordIdx, i + 1);
                  break;
                }
              }
            }

            if (newWordIdx > curWordIdx) {
              const boundedIdx = Math.min(allWords.length - 1, newWordIdx);
              setReadWordIndex(boundedIdx);
              readWordIndexRef.current = boundedIdx;
              readWordProgressRef.current = boundedIdx;

              const el = document.getElementById(`teleprompter-word-${boundedIdx}`);
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }
          }
        }

        isProcessingRef.current = false;
        return;
      }

      logEvent(`Triggering STT. Buffer size: ${(currentAudio.length / 16000).toFixed(2)}s, Max Volume: ${maxVal.toFixed(4)}`);

      // FORCE COMMIT: If the buffer exceeds 12 seconds, Whisper large-v3-turbo might start dropping earlier sentences.
      // We force a commit here to start a fresh sentence chunk.
      if (currentAudio.length > 16000 * 12) {
        logEvent("Buffer exceeded 12s. Force-committing to prevent Whisper summarization loss.");
        if (interimTranscriptRef.current) {
          finalizedTranscriptRef.current = (finalizedTranscriptRef.current + ' ' + interimTranscriptRef.current).trim();
        }
        clearAudioBuffer();
        interimTranscriptRef.current = '';
        if (!isPausedRef.current) {
          setFinalizedText(finalizedTranscriptRef.current);
          setInterimText('');
          setTranscript(finalizedTranscriptRef.current);
        }
        isProcessingRef.current = false;
        return; // Skip this STT cycle, the next cycle will grab the fresh audio
      }

      const currentSessionId = listeningSessionIdRef.current;
      const sttStart = Date.now();
      let text = await transcribeAudioChunk(currentAudio);
      const latency = Date.now() - sttStart;

      // If the user clicked Next Question or Clear while we were awaiting STT, discard the stale result
      if (currentSessionId !== listeningSessionIdRef.current) {
        logEvent("Discarding stale STT result from previous listening session.");
        return;
      }

      logEvent(`STT Latency: ${latency}ms, Raw Text: ${text}`);

      // Aggressive filter for common Whisper static hallucinations
      const lowerText = (text || '').trim().toLowerCase().replace(/[^a-z0-9 ]/g, '');
      const hallucinations = [
        'thank you', 'hello', 'food', 'io', 'you', 'test', 'bye',
        'tt', 'tep', 'teek', 'teekia', 'technical interview'
      ];
      if (hallucinations.includes(lowerText) || lowerText.length < 2) {
        logEvent(`Filtered hallucination: ${text}`);
        text = ''; // Ignore hallucination
      }

      // De-duplication logic to fix Whisper repeating phrases in large buffers
      let words = text.split(' ');
      let half = Math.floor(words.length / 2);
      if (half >= 4) {
        let firstHalf = words.slice(0, half).join(' ').toLowerCase().replace(/[^a-z0-9]/g, '');
        let secondHalf = words.slice(-half).join(' ').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (firstHalf === secondHalf) {
          text = words.slice(0, half).join(' ');
          logEvent(`Filtered duplication: ${text}`);
        }
      }

      if (text && text.startsWith('ERR:')) {
        console.error('Error during transcription:', text);
        logEvent(`Transcription ERROR: ${text}`);
      } else if (text) {
        interimTranscriptRef.current = text;
        if (!isPausedRef.current) {
          setInterimText(text);
          setFinalizedText(finalizedTranscriptRef.current);
          setTranscript((finalizedTranscriptRef.current + ' ' + text).trim());
        }
      }
    } finally {
      isProcessingRef.current = false;
    }
  };

  processAudioRef.current = processAudio;

  // Use a stable ref so the keyboard useEffect never needs to re-register due to this function changing
  const manualTriggerAIRef = useRef<(overrideSnapshots?: string[], overrideTranscript?: string, overrideLanguage?: string) => Promise<void>>(async () => { });

  const manualTriggerAI = async (overrideSnapshots?: string[], overrideTranscript?: string, overrideLanguage?: string) => {
    const snaps = overrideSnapshots || currentSnapshots;
    const isLanguageSwitch = isAiFullscreen; // If already showing, this is a re-generate (language switch)
    if (aiAbortControllerRef.current) {
      aiAbortControllerRef.current.abort();
    }
    aiAbortControllerRef.current = new AbortController();
    const signal = aiAbortControllerRef.current.signal;
    const currentTranscript = overrideTranscript !== undefined ? overrideTranscript : transcript;

    if (!interimTranscriptRef.current && !finalizedTranscriptRef.current && !currentTranscript && snaps.length === 0) {
      return;
    }

    setFrozenQuestionTranscript(currentTranscript);
    listeningSessionIdRef.current++; // Invalidate any in-flight STT so no late audio chunks mutate anything
    clearAudioBuffer(); // Flush all lingering audio chunks

    setIsPaused(true);
    isPausedRef.current = true;
    isAiFullscreenRef.current = true;
    setIsGenerating(true);
    setIsAiFullscreen(true);

    if (!isLanguageSwitch && (currentTranscript.trim() || snaps.length > 0)) {
      // Only add a new history item if this is NOT a language re-generation
      setCurrentSessionHistory(prev => [...prev, { question: currentTranscript, answer: '', images: [...snaps] }]);
    } else if (isLanguageSwitch) {
      // For language switch: clear the answer of the last entry so it streams fresh
      setCurrentSessionHistory(prev => {
        if (prev.length === 0) return prev;
        const newHistory = [...prev];
        newHistory[newHistory.length - 1] = {
          ...newHistory[newHistory.length - 1],
          question: currentTranscript, // Update question to reflect any injected language requests
          answer: ''
        };
        return newHistory;
      });
    }

    setAiAnswer('');
    let finalAnswer = '';
    let currentProviderInfo = '';

    try {
      await getInterviewAnswer(
        currentTranscript,
        resumeText,
        resumeText2,
        resumePriority,
        personalContextText,
        interviewTitle,
        snaps,
        (chunk) => {
          finalAnswer += chunk;
          setAiAnswer(prev => prev + chunk);
        },
        (info) => {
          currentProviderInfo = `${info.provider.toUpperCase()} (Key ${info.index})`;
          setActiveAIInfo(info);
          if (activeAITimeoutRef.current) clearTimeout(activeAITimeoutRef.current);
          activeAITimeoutRef.current = setTimeout(() => setActiveAIInfo(null), 5000);
        },
        signal,
        overrideLanguage || preferredCodeLanguage
      );
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('AI generation error:', err);
      }
    } finally {
      // ALWAYS reset generating state even if aborted or errored — prevents UI freeze
      setIsGenerating(false);
    }

    // Only save to history/log if we got a real answer AND request was not aborted
    if (finalAnswer.trim() && !signal.aborted) {
      setCurrentSessionHistory(prev => {
        const newHistory = [...prev];
        if (newHistory.length > 0) {
          newHistory[newHistory.length - 1].answer = finalAnswer;
        }
        return newHistory;
      });
      // Use currentTranscript (local var) not stale transcript state for accurate log
      const imagesLog = snaps.map(s => `[IMAGE_BASE64:${s}]`).join('\n');
      setSessionLog(prev => prev + `\n\n--- QUESTION ---\n${imagesLog ? imagesLog + '\n' : ''}${currentTranscript}\n\n--- AI ANSWER ---\n[MODEL:${currentProviderInfo}]\n${finalAnswer}\n\n`);
    } else if (signal.aborted) {
      // Remove the unanswered placeholder history item if generation was cancelled (only for fresh triggers)
      if (!isLanguageSwitch) {
        setCurrentSessionHistory(prev => prev.filter((_, idx) => idx !== prev.length - 1 || prev[prev.length - 1]?.answer !== ''));
      }
    }
  };

  // Keep the ref always pointing to the latest version
  manualTriggerAIRef.current = manualTriggerAI;

  const cycleNextCodeLanguage = useCallback(async () => {
    const langs = ['Java', 'Python', 'C++', 'JavaScript', 'TypeScript', 'C#', 'Go', 'Rust'];
    const currentNorm = (preferredCodeLanguage || 'Java').toLowerCase();
    const currentIndex = langs.findIndex(l => l.toLowerCase() === currentNorm);
    const nextIndex = currentIndex !== -1 ? (currentIndex + 1) % langs.length : 0;
    const nextLang = langs[nextIndex];

    setPreferredCodeLanguage(nextLang);
    localStorage.setItem('clueai_code_language', nextLang);
    setModelChangeMsg(`Language: ${nextLang}`);
    setTimeout(() => setModelChangeMsg(''), 3000);

    if (isAiFullscreen) {
      const baseQuestion = (
        frozenQuestionTranscriptRef.current ||
        frozenQuestionTranscript ||
        (currentSessionHistory.length > 0 ? currentSessionHistory[currentSessionHistory.length - 1]?.question : '') ||
        finalizedTranscriptRef.current ||
        transcript ||
        ''
      ).replace(/\n*\[(?:User requested code in|Please rewrite the solution code in) .*?\]/gi, '').trim();

      const targetQuestion = baseQuestion 
        ? `${baseQuestion}\n\n[Please rewrite the solution code in ${nextLang}]`
        : `[Please rewrite the solution code in ${nextLang}]`;

      const targetImages = currentSnapshots.length > 0
        ? currentSnapshots
        : (currentSessionHistory.length > 0 ? currentSessionHistory[currentSessionHistory.length - 1]?.images || [] : []);

      await manualTriggerAIRef.current(
        targetImages.length > 0 ? targetImages : undefined,
        targetQuestion,
        nextLang
      );
    }
  }, [preferredCodeLanguage, isAiFullscreen, transcript, currentSnapshots, frozenQuestionTranscript, currentSessionHistory]);

  const handleSnipClick = async () => {
    const wasPaused = isPausedRef.current;
    setIsPaused(true);
    isPausedRef.current = true;
    const base64Img = await ipcRenderer.invoke('start-snipping', selectedSource);
    if (!base64Img) {
      if (!wasPaused || isAiFullscreen) {
        setIsPaused(false);
        isPausedRef.current = false;
      }
      return; // User cancelled
    }

    setCurrentSnapshots(prev => {
      const next = [...prev, base64Img];
      if (next.length > 8) return next.slice(next.length - 8);
      return next;
    });

    if (isAiFullscreen) {
      setIsPaused(false);
      isPausedRef.current = false;
    }
  };

  const stopRecording = (isSilentRestart: boolean | any = false) => {
    if (aiAbortControllerRef.current) aiAbortControllerRef.current.abort();
    setIsGenerating(false);
    const silent = typeof isSilentRestart === 'boolean' ? isSilentRestart : false;

    const savedHistory = [...currentSessionHistory];
    const savedDurationSec = recordingSeconds;
    const existingSession = currentSessionId ? sessions.find(s => s.id === currentSessionId) : null;

    if (!silent) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
      recordingStartTimeRef.current = null;
      setRecordingSeconds(0);

      // Reset to default main menu size cleanly
      ipcRenderer.invoke('stop-interview-window');

      setProvider('groq');
      switchProvider('groq');
      setIsRecording(false);
      setIsPaused(false);
      isPausedRef.current = false;
      isAiFullscreenRef.current = false;
      setIsAiFullscreen(false);
      setFrozenQuestionTranscript('');

      setCurrentSnapshots([]);
      setCurrentSessionHistory([]);
    }

    if (processorRef.current) processorRef.current.disconnect();
    if (audioContextRef.current) audioContextRef.current.close();
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    navigator.mediaDevices.ondevicechange = null;
    streamRef.current = null;
    clearAudioBuffer();

    if (!silent) {
      console.log('Idle');
      const finalLog = sessionLog + `\n\n[SESSION_END:${new Date().toLocaleTimeString()}|DURATION:${formatTimer(savedDurationSec)}]\n\n`;

      if (finalLog.trim()) {
        const newSession = {
          id: currentSessionId || Date.now().toString(),
          name: sessionNameInput || existingSession?.name || 'Untitled Session',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          date: existingSession?.date || new Date().toLocaleDateString(),
          duration: formatTimer(savedDurationSec),
          transcript: finalLog.trim(),
          aiAnswer: '',
          history: savedHistory
        };
        setSessions(prev => [newSession, ...prev.filter(s => s.id !== newSession.id)]);
      }

      // Clear everything from the screen so it's perfectly fresh
      setTranscript('');
      setFinalizedText('');
      setInterimText('');
      setAiAnswer('');
      setSessionLog('');
      setRecordingSeconds(0);
      finalizedTranscriptRef.current = '';
      interimTranscriptRef.current = '';
    }
  };

  const deleteSession = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
  };

  const handleRenameSession = (id: string) => {
    if (editingSessionName.trim()) {
      setSessions(prev => prev.map(s => s.id === id ? { ...s, name: editingSessionName.trim() } : s));
    }
    setEditingSessionId(null);
  };

  interface SessionExportInteraction {
    question: string;
    images: string[];
    answer: string;
    modelInfo: string;
    timestamp?: string;
  }

  const parseSessionInteractions = (session: any): { interactions: SessionExportInteraction[]; sessionStart: string; sessionEnd: string; duration: string } => {
    let interactions: SessionExportInteraction[] = [];
    let sessionStart = '';
    let sessionEnd = '';
    let duration = session?.duration || '';

    if (session?.history && Array.isArray(session.history) && session.history.length > 0) {
      interactions = session.history.map((h: any) => ({
        question: h.question || h.q || 'Session Question',
        answer: h.answer || h.a || '',
        images: Array.isArray(h.images) ? h.images : [],
        modelInfo: h.modelInfo || h.provider || h.model || 'ClueAI Engine',
        timestamp: h.timestamp || ''
      }));
    }

    if (session?.transcript) {
      const lines = session.transcript.split('\n');
      let currentInteraction: SessionExportInteraction | null = null;
      let block = '';

      for (let line of lines) {
        if (line.includes('[SESSION_START:')) {
          if (!sessionStart) sessionStart = line.match(/\[SESSION_START:(.*?)\]/)?.[1] || '';
        } else if (line.includes('[SESSION_END:')) {
          const match = line.match(/\[SESSION_END:(.*?)\|DURATION:(.*?)\]/);
          if (match) {
            sessionEnd = match[1] || '';
            if (match[2]) duration = match[2];
          }
        } else if (line.includes('[SESSION_CONTINUED:')) {
          const match = line.match(/\[SESSION_CONTINUED:(.*?)\]/);
          if (match && !sessionStart) sessionStart = match[1];
        } else if (line.includes('--- QUESTION ---')) {
          if (interactions.length === 0) {
            if (currentInteraction) interactions.push(currentInteraction);
            currentInteraction = { question: '', images: [], answer: '', modelInfo: '' };
            block = 'question';
          }
        } else if (line.includes('--- AI ANSWER ---')) {
          if (interactions.length === 0) {
            block = 'answer';
          }
        } else if (line.startsWith('[IMAGE_BASE64:')) {
          const match = line.match(/\[IMAGE_BASE64:(.*?)\]/);
          if (match && currentInteraction) currentInteraction.images.push(match[1]);
        } else if (line.startsWith('[MODEL:')) {
          const match = line.match(/\[MODEL:(.*?)\]/);
          if (match && currentInteraction) currentInteraction.modelInfo = match[1];
        } else {
          if (currentInteraction && interactions.length === 0) {
            if (block === 'question') currentInteraction.question += line + '\n';
            if (block === 'answer') currentInteraction.answer += line + '\n';
          }
        }
      }
      if (currentInteraction && interactions.length === 0) interactions.push(currentInteraction);
    }

    return { interactions, sessionStart, sessionEnd, duration };
  };

  const generateSessionStandaloneHtml = (session: any) => {
    const { interactions, sessionStart, duration } = parseSessionInteractions(session);
    const sessionName = session.title || session.name || 'ClueAI_Session';
    const dateStr = session.date || new Date().toLocaleDateString();
    const timeStr = session.time || '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Clue AI • ${sessionName}</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%23080b14'/%3E%3Ccircle cx='16' cy='16' r='4' fill='%2300f2fe'/%3E%3Cellipse cx='16' cy='16' rx='11' ry='4.5' fill='none' stroke='%2338bdf8' stroke-width='1.5' transform='rotate(30 16 16)'/%3E%3Cellipse cx='16' cy='16' rx='11' ry='4.5' fill='none' stroke='%23818cf8' stroke-width='1.5' transform='rotate(-30 16 16)'/%3E%3C/svg%3E">
  <link rel="shortcut icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%23080b14'/%3E%3Ccircle cx='16' cy='16' r='4' fill='%2300f2fe'/%3E%3Cellipse cx='16' cy='16' rx='11' ry='4.5' fill='none' stroke='%2338bdf8' stroke-width='1.5' transform='rotate(30 16 16)'/%3E%3Cellipse cx='16' cy='16' rx='11' ry='4.5' fill='none' stroke='%23818cf8' stroke-width='1.5' transform='rotate(-30 16 16)'/%3E%3C/svg%3E">
  <link rel="apple-touch-icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%23080b14'/%3E%3Ccircle cx='16' cy='16' r='4' fill='%2300f2fe'/%3E%3Cellipse cx='16' cy='16' rx='11' ry='4.5' fill='none' stroke='%2338bdf8' stroke-width='1.5' transform='rotate(30 16 16)'/%3E%3Cellipse cx='16' cy='16' rx='11' ry='4.5' fill='none' stroke='%23818cf8' stroke-width='1.5' transform='rotate(-30 16 16)'/%3E%3C/svg%3E">
  <link rel="icon" type="image/png" href="https://cdn.jsdelivr.net/gh/HelloWorld-Farhan/ClueAi@main/public/logo.png">
  <style>
    :root {
      --bg: #070913;
      --card-bg: #0e1322;
      --card-hover: #13192c;
      --border: #1e293b;
      --accent: #38bdf8;
      --accent-cyan: #06b6d4;
      --accent-grad: linear-gradient(135deg, #06b6d4, #3b82f6);
      --text: #f8fafc;
      --text-muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 36px 20px;
      line-height: 1.6;
    }
    .container { max-width: 920px; margin: 0 auto; }
    .header {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 24px 28px;
      margin-bottom: 28px;
      position: relative;
      overflow: hidden;
      box-shadow: 0 10px 30px -10px rgba(0,0,0,0.5);
    }
    .header::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; height: 3px;
      background: var(--accent-grad);
    }
    .brand-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 16px;
      margin-bottom: 16px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .brand-identity {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-logo {
      width: 32px;
      height: 32px;
      border-radius: 10px;
      background: #0b1020;
      border: 1px solid rgba(56, 189, 248, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      box-shadow: 0 0 15px rgba(6, 182, 212, 0.25);
    }
    .brand-logo img { width: 100%; height: 100%; object-fit: cover; }
    .brand-text { display: flex; flex-direction: column; }
    .brand-name {
      font-size: 1.1rem;
      font-weight: 900;
      letter-spacing: -0.02em;
      color: #fff;
    }
    .brand-name span { color: var(--accent); }
    .brand-subtitle {
      font-size: 0.7rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 600;
    }
    .brand-badges { display: flex; align-items: center; gap: 8px; }
    .badge-version {
      background: rgba(56, 189, 248, 0.12);
      color: var(--accent);
      border: 1px solid rgba(56, 189, 248, 0.3);
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 0.7rem;
      font-weight: 800;
      font-family: monospace;
    }
    .badge-status {
      background: rgba(34, 197, 94, 0.12);
      color: #4ade80;
      border: 1px solid rgba(34, 197, 94, 0.3);
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 0.7rem;
      font-weight: 700;
    }
    h1.session-title {
      font-size: 1.6rem;
      margin-bottom: 10px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.01em;
    }
    .meta { display: flex; flex-wrap: wrap; gap: 14px 22px; font-size: 0.85rem; color: var(--text-muted); }
    .meta span b { color: var(--text); }
    .interaction-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      margin-bottom: 16px;
      overflow: hidden;
      transition: all 0.2s ease;
    }
    .interaction-card:hover {
      border-color: rgba(56, 189, 248, 0.35);
      background: var(--card-hover);
    }
    details.interaction-card summary {
      padding: 14px 20px;
      background: rgba(255,255,255,0.02);
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      user-select: none;
      list-style: none;
    }
    details.interaction-card summary::-webkit-details-marker { display: none; }
    .header-left { display: flex; align-items: center; gap: 10px; }
    .header-right { display: flex; align-items: center; gap: 8px; }
    .badge-q {
      background: rgba(6, 182, 212, 0.15);
      color: var(--accent);
      border: 1px solid rgba(6, 182, 212, 0.3);
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .badge-model { font-family: monospace; font-size: 0.72rem; color: var(--text-muted); }
    .toggle-arrow {
      font-size: 0.85rem;
      color: var(--accent);
      transition: transform 0.2s ease;
      display: inline-block;
    }
    details[open] .toggle-arrow { transform: rotate(180deg); }
    .card-body { padding: 20px; }
    .question-box {
      font-weight: 600;
      font-size: 1rem;
      color: #fff;
      margin-bottom: 14px;
      line-height: 1.5;
      white-space: pre-wrap;
    }
    .card-images {
      margin-bottom: 16px;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .card-images img {
      max-width: 100%;
      max-height: 420px;
      object-fit: contain;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: #000;
    }
    .answer-box {
      background: #070a14;
      border-left: 3px solid var(--accent);
      padding: 16px;
      border-radius: 12px;
      font-size: 0.95rem;
      color: #e2e8f0;
      white-space: pre-wrap;
      line-height: 1.6;
    }
    .answer-label {
      font-size: 0.68rem;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--accent);
      margin-bottom: 8px;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid rgba(255,255,255,0.05);
      color: #71717a;
      font-size: 0.8rem;
    }
    .footer a { color: var(--accent); text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand-bar">
        <div class="brand-identity">
          <div class="brand-logo">
            <img src="https://cdn.jsdelivr.net/gh/HelloWorld-Farhan/ClueAi@main/public/logo.png" onerror="this.style.display='none'" alt="Clue AI" />
          </div>
          <div class="brand-text">
            <span class="brand-name">Clue<span>AI</span></span>
            <span class="brand-subtitle">Interview Intelligence System</span>
          </div>
        </div>
        <div class="brand-badges">
          <span class="badge-version">V5.9.6</span>
          <span class="badge-status">Export Verified</span>
        </div>
      </div>

      <h1 class="session-title">${sessionName}</h1>
      <div class="meta">
        <span><b>Date:</b> ${dateStr}</span>
        <span><b>Time:</b> ${timeStr || 'N/A'}</span>
        ${sessionStart ? `<span><b>Started:</b> ${sessionStart}</span>` : ''}
        ${duration ? `<span><b>Total Duration:</b> ${duration}</span>` : ''}
        <span><b>Interactions:</b> ${interactions.length}</span>
      </div>
    </div>

    ${interactions.map((it, idx) => `
      <details class="interaction-card" open>
        <summary>
          <div class="header-left">
            <span class="badge-q">Question ${idx + 1}</span>
            <span class="badge-model">${it.modelInfo || 'ClueAI Engine'}</span>
            ${it.timestamp ? `<span class="badge-model" style="color:#64748b;">• ${it.timestamp}</span>` : ''}
          </div>
          <div class="header-right">
            <span class="toggle-arrow">▼</span>
          </div>
        </summary>
        <div class="card-body">
          <div class="question-box">${it.question || 'Session Question'}</div>
          ${it.images && it.images.length > 0 ? `
            <div class="card-images">
              ${it.images.map((img: string) => `<img src="${img}" alt="Attached Session Snapshot"/>`).join('')}
            </div>
          ` : ''}
          <div class="answer-box">
            <div class="answer-label">AI Response / Code Solution</div>
            <div>${it.answer || 'No response recorded.'}</div>
          </div>
        </div>
      </details>
    `).join('')}

    <div class="footer">
      Generated by <b>Clue AI</b> • Interview Intelligence System • Created by <a href="https://farhan-khalid-portfolio.vercel.app/" target="_blank" rel="noopener">Farhan Khalid</a>
    </div>
  </div>
</body>
</html>`;
  };

  const downloadSessionHtml = (session: any) => {
    setIsExportingHtml(true);
    setHtmlExportSuccess(false);
    try {
      const sessionName = session.title || session.name || 'ClueAI_Session';
      const cleanName = sessionName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const htmlContent = generateSessionStandaloneHtml(session);
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cleanName}.html`;
      a.click();
      URL.revokeObjectURL(url);
      setHtmlExportSuccess(true);
      setTimeout(() => setHtmlExportSuccess(false), 3000);
    } catch (err) {
      console.error('HTML export error:', err);
    } finally {
      setIsExportingHtml(false);
    }
  };

  const buildSessionPdfHtml = (session: any) => {
    const { interactions, sessionStart, duration } = parseSessionInteractions(session);
    const sessionTitle = session.title || session.name || 'ClueAI Session';
    const dateStr = session.date || new Date().toLocaleDateString();
    const timeStr = session.time || '';

    const itemsHtml = interactions.map((item, index) => `
      <div class="interaction-block">
        <div class="q-header">
          <span class="q-num">QUESTION ${index + 1}</span>
          <span class="q-model">${item.modelInfo || 'ClueAI Model'}</span>
        </div>
        <div class="question-text">${item.question.replace(/\n/g, '<br/>')}</div>
        ${item.images && item.images.length > 0 ? `
          <div class="image-gallery">
            ${item.images.map((img: string) => `<img src="${img}" style="max-width:100%;max-height:360px;object-fit:contain;border-radius:6px;border:1px solid #cbd5e1;margin:8px 0;display:block;" alt="Session Screenshot"/>`).join('')}
          </div>
        ` : ''}
        <div class="answer-box">
          <div class="answer-label">AI RESPONSE / CODE:</div>
          <div class="answer-text">${item.answer.replace(/\n/g, '<br/>')}</div>
        </div>
      </div>
    `).join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${sessionTitle} - Clue AI Report</title>
  <style>
    @page { margin: 15mm; size: A4; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #fff;
      padding: 24px;
      font-size: 13px;
      line-height: 1.6;
    }
    .header {
      border-bottom: 2px solid #0284c7;
      padding-bottom: 12px;
      margin-bottom: 24px;
    }
    .header h1 {
      font-size: 22px;
      margin: 0 0 6px 0;
      color: #0f172a;
      font-weight: 800;
    }
    .meta {
      color: #475569;
      font-size: 11px;
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
    }
    .meta span b { color: #0f172a; }
    .interaction-block {
      page-break-inside: avoid;
      margin-bottom: 20px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 16px;
      background: #f8fafc;
    }
    .q-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 11px;
      font-weight: bold;
      color: #0284c7;
    }
    .question-text {
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 12px;
      font-size: 14px;
      line-height: 1.5;
    }
    .answer-box {
      background: #ffffff;
      border-left: 3px solid #0284c7;
      padding: 12px;
      border-radius: 4px;
    }
    .answer-label {
      font-size: 10px;
      font-weight: bold;
      letter-spacing: 0.5px;
      color: #0284c7;
      margin-bottom: 6px;
    }
    .answer-text {
      color: #0f172a;
      font-weight: 500;
      white-space: pre-wrap;
      line-height: 1.6;
    }
    .footer {
      margin-top: 30px;
      border-top: 1px solid #e2e8f0;
      padding-top: 10px;
      font-size: 10px;
      color: #64748b;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${sessionTitle}</h1>
    <div class="meta">
      <span><b>Date:</b> ${dateStr}</span>
      <span><b>Time:</b> ${timeStr || 'N/A'}</span>
      ${sessionStart ? `<span><b>Started:</b> ${sessionStart}</span>` : ''}
      ${duration ? `<span><b>Total Duration:</b> ${duration}</span>` : ''}
      <span><b>Interactions:</b> ${interactions.length}</span>
      <span>Clue AI Intelligence System</span>
    </div>
  </div>
  ${itemsHtml}
  <div class="footer">
    Generated with Clue AI • Interview Intelligence System • Developed by Farhan Khalid
  </div>
</body>
</html>`;
  };

  const downloadSessionPdf = async (session: any) => {
    const sessionTitle = session.title || session.name || 'ClueAI_Session';
    const cleanName = sessionTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const htmlContent = buildSessionPdfHtml(session);

    setIsExportingPdf(true);
    setPdfExportSuccess(false);

    try {
      if (typeof ipcRenderer !== 'undefined' && ipcRenderer.invoke) {
        const res = await ipcRenderer.invoke('generate-pdf-buffer', htmlContent);
        if (res && res.success && res.base64) {
          const byteCharacters = atob(res.base64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${cleanName}.pdf`;
          a.click();
          URL.revokeObjectURL(url);
          setPdfExportSuccess(true);
          setTimeout(() => setPdfExportSuccess(false), 3000);
          return;
        }
      }

      // Standalone browser fallback: direct file download without opening blocking print dialog
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cleanName}.html`;
      a.click();
      URL.revokeObjectURL(url);
      setPdfExportSuccess(true);
      setTimeout(() => setPdfExportSuccess(false), 3000);
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const generateSessionEmailBody = (session: any, interactions: SessionExportInteraction[]) => {
    const sessionTitle = session.title || session.name || 'ClueAI Session';
    const dateStr = session.date || new Date().toLocaleDateString();
    const timeStr = session.time || '';

    return `
      <div style="text-align:left;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:16px 20px;">
          <div style="font-size:15px;font-weight:800;color:#0f172a;margin-bottom:6px;">${sessionTitle}</div>
          <div style="font-size:12px;color:#475569;margin-bottom:12px;">Recorded on ${dateStr} ${timeStr ? '• ' + timeStr : ''}</div>
          <div style="display:inline-block;background:#0f172a;color:#38bdf8;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:700;font-family:monospace;">
            ${interactions.length} Total Interaction${interactions.length === 1 ? '' : 's'} Logged
          </div>
        </div>
      </div>
    `;
  };

  const handleSendExportEmail = async () => {
    if (!exportTargetSession) return;
    const targetEmail = (exportEmailInput || userEmail || '').trim();
    if (!targetEmail || !targetEmail.includes('@') || !targetEmail.includes('.')) {
      setExportEmailStatus('error');
      setExportEmailMsg('Please provide a valid recipient email address.');
      return;
    }

    const executeSend = async () => {
      setExportEmailStatus('sending');
      setExportEmailMsg('Delivering session export to ' + targetEmail + '...');
      try {
        const { interactions } = parseSessionInteractions(exportTargetSession);
        const emailContentHtml = generateSessionEmailBody(exportTargetSession, interactions);
        const fullStandaloneHtml = generateSessionStandaloneHtml(exportTargetSession);
        const sessionTitle = exportTargetSession.title || exportTargetSession.name || 'Interview Session';

        await fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'session_export',
            session_name: sessionTitle,
            to_email: targetEmail,
            user_name: username || 'Clue AI User',
            app_version: appVersion,
            html_content: emailContentHtml,
            full_html: fullStandaloneHtml,
            summary: `Exported ${interactions.length} interaction${interactions.length === 1 ? '' : 's'} from session ${sessionTitle}.`
          })
        });

        markEmailVerified(targetEmail);
        setExportEmailStatus('success');
        setExportEmailMsg('Session export delivered to ' + targetEmail + '!');
        setTimeout(() => {
          setShowExportModal(false);
          setExportEmailStatus('idle');
          setExportEmailMsg('');
        }, 2200);
      } catch (err: any) {
        setExportEmailStatus('error');
        setExportEmailMsg('Failed to deliver session export: ' + (err?.message || 'Network error'));
      }
    };

    if (!isEmailVerified(targetEmail)) {
      triggerOtpVerification('export', targetEmail, executeSend);
    } else {
      executeSend();
    }
  };

  const exportSession = (session: any) => {
    setExportTargetSession(session);
    setExportEmailInput(userEmail || localStorage.getItem('clueai_saved_email') || '');
    setExportEmailStatus('idle');
    setExportEmailMsg('');
    setShowExportModal(true);
  };



  const resumeListening = () => {
    if (currentSnapshots.length > 0) {

    }

    listeningSessionIdRef.current++; // Invalidate any in-flight STT processing
    setTranscript('');
    setFinalizedText('');
    setInterimText('');
    finalizedTranscriptRef.current = '';
    interimTranscriptRef.current = '';
    clearAudioBuffer();

    setAiAnswer('');
    setCurrentSnapshots([]);
    setIsPaused(false);
    // setShowNoInputError(false);
    isPausedRef.current = false;
  };

  const handlePauseToggle = () => {
    if (isPaused) {
      resumeListening();
    } else {
      setIsPaused(true);
      isPausedRef.current = true;
      setTranscript('');
      setFinalizedText('');
      setInterimText('');
      finalizedTranscriptRef.current = '';
      interimTranscriptRef.current = '';
      clearAudioBuffer();
    }
  };

  const handleClearAll = () => {
    if (currentSnapshots.length > 0) {

    }
    listeningSessionIdRef.current++; // Invalidate any in-flight STT processing
    setTranscript('');
    setFinalizedText('');
    setInterimText('');
    finalizedTranscriptRef.current = '';
    interimTranscriptRef.current = '';
    clearAudioBuffer();
    setCurrentSnapshots([]);
    setAiAnswer('');
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // If Snapshot Preview is open, Escape closes ONLY the preview modal and returns to live transcript!
      if (previewSnapshot) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setPreviewSnapshot(null);
        }
        return;
      }

      // If Virtual Keyboard Editor is open, completely bypass ALL interview shortcuts so user can type on physical keyboard!
      if (showVirtualKeyboard) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setShowVirtualKeyboard(false);
          if (globalHotkeysEnabled && isRecording) ipcRenderer.invoke('toggle-global-hotkeys', true);
        }
        return;
      }

      // Local Ctrl+Shift+K minimize/restore shortcut if window has focus
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key.toLowerCase() === 'k' || e.code === 'KeyK')) {
        e.preventDefault();
        minimizeApp();
        return;
      }

      // Local Ctrl+Shift+X emergency close & kill all processes
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key.toLowerCase() === 'x' || e.code === 'KeyX')) {
        e.preventDefault();
        closeApp();
        return;
      }

      // Local Ctrl+Shift+R safe reload
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key.toLowerCase() === 'r' || e.code === 'KeyR')) {
        e.preventDefault();
        restartApp();
        return;
      }

      // If hotkeys toggle is OFF, block all shortcut keys entirely
      if (!globalHotkeysEnabled) return;

      // Ignore if user is typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setShowVirtualKeyboard(false);
          if (globalHotkeysEnabled) ipcRenderer.invoke('toggle-global-hotkeys', true);
        }
        return;
      }

      const key = e.key.toLowerCase();

      // Resize window shortcuts (Robust using physical key codes)
      if (e.altKey && (e.code === 'Equal' || e.code === 'NumpadAdd' || key === '=' || key === '+' || e.code === 'BracketRight' || key === ']')) {
        e.preventDefault();
        ipcRenderer.invoke('resize-window', 50, 50);
        return;
      } else if (e.altKey && (e.code === 'Minus' || e.code === 'NumpadSubtract' || key === '-' || key === '_' || e.code === 'BracketLeft' || key === '[')) {
        e.preventDefault();
        handleShrinkWindow();
        return;
      } else if (e.altKey && (key === 'arrowup' || key === 'pageup')) {
        e.preventDefault();
        if (transcriptScrollRef.current) transcriptScrollRef.current.scrollTop -= 60;
        if (aiAnswerScrollRef.current) aiAnswerScrollRef.current.scrollTop -= 60;
        return;
      } else if (e.altKey && (key === 'arrowdown' || key === 'pagedown')) {
        e.preventDefault();
        if (transcriptScrollRef.current) transcriptScrollRef.current.scrollTop += 60;
        if (aiAnswerScrollRef.current) aiAnswerScrollRef.current.scrollTop += 60;
        return;
      } else if (!e.altKey && key === 'arrowup') {
        e.preventDefault();
        ipcRenderer.send('move-window-by', { x: 0, y: -50 });
        return;
      } else if (!e.altKey && key === 'arrowdown') {
        e.preventDefault();
        ipcRenderer.send('move-window-by', { x: 0, y: 50 });
        return;
      } else if (!e.altKey && key === 'arrowleft') {
        e.preventDefault();
        ipcRenderer.send('move-window-by', { x: -50, y: 0 });
        return;
      } else if (key === 'arrowright') {
        e.preventDefault();
        ipcRenderer.send('move-window-by', { x: 50, y: 0 });
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (key === 'r' || key === 'R')) {
        e.preventDefault();
        restartApp();
        return;
      }

      if (!isRecording && !isAiFullscreen) return;

      if (key === '7' || key === 'q') {
        e.preventDefault();
        setShowVirtualKeyboard(true);
      } else if (key === 'escape') {
        if (previewSnapshot) {
          e.preventDefault();
          setPreviewSnapshot(null);
        } else if (showVirtualKeyboard) {
          e.preventDefault();
          setShowVirtualKeyboard(false);
          if (globalHotkeysEnabled) ipcRenderer.invoke('toggle-global-hotkeys', true);
        }
      } else if (key === '0' || (e.altKey && key === '0')) {
        e.preventDefault();
        setAltColor(prev => !prev);
      } else if (key === '8' || key === 'h' || (e.altKey && (key === '8' || key === 'h'))) {
        e.preventDefault();
        setShowPreviousQuestions(prev => !prev);
      } else if (key === 'x' || key === '2') {
        e.preventDefault();
        if (!isGenerating) {
          manualTriggerAIRef.current();
        }
      } else if (key === 'z' || key === '1') {
        e.preventDefault();
        if (isAiFullscreen) {
          // Abort any in-progress generation immediately
          if (aiAbortControllerRef.current) aiAbortControllerRef.current.abort();
          setIsGenerating(false);
          isAiFullscreenRef.current = false;
          setIsAiFullscreen(false);
          setTranscript('');
          setFinalizedText('');
          setInterimText('');
          setFrozenQuestionTranscript('');
          finalizedTranscriptRef.current = '';
          interimTranscriptRef.current = '';
          setAiAnswer('');
          setCurrentSnapshots([]);
          clearAudioBuffer();
          listeningSessionIdRef.current++;
          setIsPaused(false);
          isPausedRef.current = false;
        } else {
          handlePauseToggle();
        }
      } else if (key === 'c' || key === '3') {
        e.preventDefault();
        if (isAiFullscreen) {
          if (aiAbortControllerRef.current) aiAbortControllerRef.current.abort();
          setIsGenerating(false);
          isAiFullscreenRef.current = false;
          setIsAiFullscreen(false);
          setIsPaused(false);
          isPausedRef.current = false;
          setTranscript('');
          setFinalizedText('');
          setInterimText('');
          setFrozenQuestionTranscript('');
          finalizedTranscriptRef.current = '';
          interimTranscriptRef.current = '';
          setAiAnswer('');
          setCurrentSnapshots([]);
          clearAudioBuffer();
          listeningSessionIdRef.current++;
        } else {
          handleClearAll();
        }
      } else if (key === 's' || key === '5') {
        e.preventDefault();
        cycleNextModel();
      } else if (key === '9' || (e.altKey && key === '9')) {
        e.preventDefault();
        cycleNextCodeLanguage();
      } else if (key === 'd' || key === '6') {
        e.preventDefault();
        stopRecording();
      } else if (key === 'a' || key === '4') {
        e.preventDefault();
        handleSnipClick();
      }
    };

    const handleIPCHotkey = (_event: any, action: string) => {
      if (!isRecording && !isAiFullscreen) return;
      if (action === 'toggle-color') {
        setAltColor(prev => !prev);
      } else if (action === 'cycle-language') {
        cycleNextCodeLanguage();
      } else if (action === 'toggle-pause') {
        if (isAiFullscreen) {
          // Abort any in-progress generation immediately
          if (aiAbortControllerRef.current) aiAbortControllerRef.current.abort();
          setIsGenerating(false);
          isAiFullscreenRef.current = false;
          setIsAiFullscreen(false);
          setTranscript('');
          setFinalizedText('');
          setInterimText('');
          setFrozenQuestionTranscript('');
          finalizedTranscriptRef.current = '';
          interimTranscriptRef.current = '';
          setAiAnswer('');
          setCurrentSnapshots([]);
          clearAudioBuffer();
          listeningSessionIdRef.current++;
          setIsPaused(false);
          isPausedRef.current = false;
        } else {
          handlePauseToggle();
        }
      } else if (action === 'force-ai') {
        if (!isGenerating) {
          manualTriggerAIRef.current();
        }
      } else if (action === 'clear-all') {
        if (isAiFullscreen) {
          if (aiAbortControllerRef.current) aiAbortControllerRef.current.abort();
          setIsGenerating(false);
          isAiFullscreenRef.current = false;
          setIsAiFullscreen(false);
          setIsPaused(false);
          isPausedRef.current = false;
          setTranscript('');
          setFinalizedText('');
          setInterimText('');
          setFrozenQuestionTranscript('');
          finalizedTranscriptRef.current = '';
          interimTranscriptRef.current = '';
          setAiAnswer('');
          setCurrentSnapshots([]);
          clearAudioBuffer();
          listeningSessionIdRef.current++;
        } else {
          handleClearAll();
        }
      } else if (action === 'show-size-warning') {
        setShowMinSizeWarning(true);
      } else if (action === 'snapshot') {
        handleSnipClick();
      } else if (action === 'switch-model') {
        cycleNextModel();
      } else if (action === 'stop-generation') {
        stopRecording();
      } else if (action === 'edit-transcript') {
        setShowVirtualKeyboard(true);
        ipcRenderer.invoke('toggle-global-hotkeys', false);
        ipcRenderer.invoke('focus-window');
      } else if (action === 'toggle-history') {
        setShowPreviousQuestions(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    ipcRenderer.on('trigger-hotkey', handleIPCHotkey);

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      ipcRenderer.off('trigger-hotkey', handleIPCHotkey);
    };
    // manualTriggerAI intentionally excluded — we use manualTriggerAIRef.current to avoid
    // re-registering this expensive listener on every render during AI streaming
  }, [isRecording, isPaused, isGenerating, currentSnapshots, previewSnapshot, transcript, provider, isAiFullscreen, groqKeys, geminiKeys, claudeKeys, chatgptKeys, deepseekKeys, glmKeys]);

  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();
    let accumulatedScroll = 0;

    const scrollLoop = (time: number) => {
      const delta = Math.min(100, Math.max(1, time - lastTime));
      lastTime = time;

      if (isAiFullscreen && aiAnswerScrollRef.current) {
        if (isVoiceScrollRef.current) {
          // "Voice-Gated Delta Scrolling" (100% Offline & Non-AI)
          // Hover-to-Pause / Wheel Override: if mouse wheel or hover is active, pause immediately
          const isPausedManually = isHoveringAnswerRef.current || isWheelOverridingRef.current;

          // Speed mapping: 1x=20px/s, 2x=35px/s (standard reading pace), 3x=55px/s, 4x=80px/s, 5x=110px/s
          const speedTable = [20, 20, 35, 55, 80, 110];
          const targetVelocity = (!isPausedManually && isSpeakingRef.current)
            ? (speedTable[voiceScrollSpeedRef.current] || 35)
            : 0;

          // Physics-based smooth acceleration & gentle deceleration to stop
          // When speaking starts: accelerate quickly to reading speed
          // When user pauses or takes a breath: gently decelerate to a stop
          const rate = targetVelocity > voiceVelocityRef.current ? 7.5 : 4.5;
          const blend = 1 - Math.exp(-rate * (delta / 1000));
          voiceVelocityRef.current += (targetVelocity - voiceVelocityRef.current) * blend;

          if (Math.abs(voiceVelocityRef.current) < 0.2) {
            voiceVelocityRef.current = 0;
          }

          if (voiceVelocityRef.current > 0) {
            const scrollPx = (voiceVelocityRef.current * delta) / 1000;
            aiAnswerScrollRef.current.scrollBy(0, scrollPx);
          }
        } else if (scrollSpeed > 0) {
          // Constant Auto-Scroll
          const pixelsPerSecond = scrollSpeed * 15;
          const scrollAmount = (pixelsPerSecond * delta) / 1000;
          accumulatedScroll += scrollAmount;

          if (accumulatedScroll >= 1) {
            const pixelsToScroll = Math.floor(accumulatedScroll);
            aiAnswerScrollRef.current.scrollBy(0, pixelsToScroll);
            accumulatedScroll -= pixelsToScroll;
          }
        }
      }

      animationFrameId = requestAnimationFrame(scrollLoop);
    };

    if (isAiFullscreen && (scrollSpeed > 0 || isVoiceScroll)) {
      animationFrameId = requestAnimationFrame(scrollLoop);
    }

    return () => cancelAnimationFrame(animationFrameId);
  }, [scrollSpeed, isVoiceScroll, isAiFullscreen]);

  // NOTE: The click-through / mouse-events logic is handled exclusively by the
  // pointermove handler above (lines ~1181-1204). The duplicate mousemove handler
  // that used to exist here caused a race condition — it was overriding the
  // pointer-based logic and sometimes locking out mouse clicks. Removed.

  const closeApp = () => {
    try {
      ipcRenderer.invoke('kill-all-processes');
    } catch {
      ipcRenderer.send('app-quit');
    }
  };
  const minimizeApp = () => {
    ipcRenderer.invoke('minimize-window');
  };
  const restartApp = () => {
    ipcRenderer.invoke('restart-app');
  };

  const handleShrinkWindow = () => {
    const MIN_WIDTH = layout === 'horizontal' ? 950 : 450;
    const MIN_HEIGHT = layout === 'horizontal' ? 450 : 800;

    if (window.innerWidth - 50 < MIN_WIDTH || window.innerHeight - 50 < MIN_HEIGHT) {
      setShowMinSizeWarning(true);
    } else {
      ipcRenderer.invoke('resize-window', -50, -50);
    }
  };

  const markdownComponents = useMemo(() => ({
    code(props: any) {
      const { node, className, children, ...rest } = props;
      const match = /language-(\w+)/.exec(className || "");
      let codeTextRaw = String(children).replace(/\n$/, "");
      const codeText = codeTextRaw;
      const currentLang = match ? match[1]?.toLowerCase() : '';
      let displayLang = currentLang;
      if (currentLang === 'cpp') displayLang = 'c++';
      else if (currentLang === 'js') displayLang = 'javascript';
      else if (currentLang === 'ts') displayLang = 'typescript';
      else if (currentLang === 'csharp') displayLang = 'c#';

      if (match && (match[1] === 'exact-answer' || match[1] === 'exact_answer')) {
        return (
          <div className="w-full my-3 p-4 bg-gradient-to-r from-emerald-500/25 via-teal-500/20 to-cyan-500/25 border-2 border-emerald-400/70 rounded-2xl shadow-[0_0_25px_rgba(16,185,129,0.3)] flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/30 border border-emerald-400/60 flex items-center justify-center text-emerald-300 font-black text-lg shrink-0 shadow-sm">
              ✓
            </div>
            <div>
              <div className="text-[10px] uppercase font-black tracking-widest text-emerald-400 mb-0.5">MCQ Top Answer</div>
              <div className="text-white font-black text-base md:text-lg tracking-tight">{codeText}</div>
            </div>
          </div>
        );
      }

      return match ? (
        <div className="w-full flex justify-center my-4">
          <div className="max-w-4xl w-full rounded-2xl border border-white/15 bg-black overflow-hidden shadow-2xl">
            {/* Dedicated Code Header Toolbar: Language Selector & Copy Button cleanly positioned above code */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#12131c] border-b border-white/10 select-none">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 mr-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500/70 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70 inline-block" />
                </div>
                <motion.span
                  key={displayLang || preferredCodeLanguage}
                  initial={{ opacity: 0, scale: 0.9, y: -2 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => cycleNextCodeLanguage()}
                  title="Click to cycle programming language (Press 9)"
                  className="text-[11px] font-mono font-bold tracking-wider uppercase text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 active:scale-95 border border-cyan-500/25 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm cursor-pointer transition-all"
                >
                  <Code2 size={11} className="text-cyan-400" />
                  {displayLang || preferredCodeLanguage.toLowerCase()}
                </motion.span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                  <div className="w-36">
                    <CustomSelect
                      value={displayLang || preferredCodeLanguage.toLowerCase()}
                      onChange={async (targetLang: string) => {
                        if (!targetLang || targetLang.toLowerCase() === (displayLang || preferredCodeLanguage.toLowerCase())) return;
                        const langLabel = targetLang === 'c++' ? 'C++' : targetLang === 'c#' ? 'C#' : targetLang.charAt(0).toUpperCase() + targetLang.slice(1);
                        setPreferredCodeLanguage(langLabel);
                        localStorage.setItem('clueai_code_language', langLabel);
                        setModelChangeMsg(`Language: ${langLabel}`);
                        setTimeout(() => setModelChangeMsg(''), 3000);

                        const baseQuestion = (
                          frozenQuestionTranscriptRef.current ||
                          frozenQuestionTranscript ||
                          (currentSessionHistory.length > 0 ? currentSessionHistory[currentSessionHistory.length - 1]?.question : '') ||
                          finalizedTranscriptRef.current ||
                          transcript ||
                          ''
                        ).replace(/\n*\[(?:User requested code in|Please rewrite the solution code in) .*?\]/gi, '').trim();

                        const targetQuestion = baseQuestion 
                          ? `${baseQuestion}\n\n[Please rewrite the solution code in ${langLabel}]`
                          : `[Please rewrite the solution code in ${langLabel}]`;

                        const targetImages = currentSnapshots.length > 0
                          ? currentSnapshots
                          : (currentSessionHistory.length > 0 ? currentSessionHistory[currentSessionHistory.length - 1]?.images || [] : []);

                        await manualTriggerAI(
                          targetImages.length > 0 ? targetImages : undefined,
                          targetQuestion,
                          langLabel
                        );
                      }}
                      options={[
                        { value: 'java', label: 'Java (Default)' },
                        { value: 'python', label: 'Python' },
                        { value: 'c++', label: 'C++' },
                        { value: 'javascript', label: 'JavaScript' },
                        { value: 'typescript', label: 'TypeScript' },
                        { value: 'c#', label: 'C#' },
                        { value: 'go', label: 'Go' },
                        { value: 'rust', label: 'Rust' },
                      ]}
                      className="bg-[#18181b] hover:bg-[#27272a] text-white border border-white/20 text-xs rounded-lg px-2.5 py-1 outline-none cursor-pointer backdrop-blur-md font-medium transition-all"
                      listClassName="text-xs bg-[#18181b] !max-h-48 overflow-y-auto custom-scrollbar"
                    />
                  </div>
                  <CopyButton
                    text={codeText}
                    className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors cursor-pointer"
                    tooltip="Copy code"
                  />
                </div>
                {/* Shortcut Key 9 marked below the dropdown */}
                <div className="flex items-center gap-1.5 pr-0.5">
                  <span className="text-[9px] text-white/40 uppercase font-semibold tracking-wider">Change Lang:</span>
                  <button
                    onClick={() => cycleNextCodeLanguage()}
                    className="bg-white/10 hover:bg-cyan-500/20 text-cyan-300 hover:text-cyan-200 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border border-white/15 hover:border-cyan-500/40 flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                    title="Press 9 to cycle programming language"
                  >
                    <span>Press 9</span>
                  </button>
                </div>
              </div>
            </div>
            <SyntaxHighlighter
              {...rest}
              children={codeText}
              style={vscDarkPlus}
              language={match[1]}
              PreTag="div"
              className="!m-0 !p-5 !bg-black"
              customStyle={{ backgroundColor: '#000000', fontSize: 'inherit', margin: 0 }}
            />
          </div>
        </div>
      ) : (
        <code {...rest} className="bg-white/10 text-cyan-300 px-1.5 py-0.5 rounded font-mono font-semibold" style={{ fontSize: '0.9em' }}>
          {children}
        </code>
      );
    },
    strong({ children, ...props }: any) {
      return (
        <strong
          className={`font-extrabold px-1.5 py-0.5 mx-0.5 rounded-md inline-block tracking-tight shadow-sm ${
            altColor 
              ? 'text-amber-800 bg-amber-500/20 border border-amber-600/30' 
              : 'text-amber-300 bg-amber-400/15 border border-amber-400/30 drop-shadow-[0_0_8px_rgba(251,191,36,0.2)]'
          }`}
          {...props}
        >
          {children}
        </strong>
      );
    },
    p({ children, ...props }: any) {
      const textContent = Array.isArray(children) 
        ? children.map(c => typeof c === 'string' ? c : (c?.props?.children ? String(c.props.children) : '')).join('') 
        : (typeof children === 'string' ? children : '');

      const trimmed = textContent.trim();
      const isMcqHeader = (/^(?:\*\*)?Option\s+[A-D][: -]/i.test(trimmed) || /^(?:\*\*)?Correct\s+(?:Option|Answer)[: -]/i.test(trimmed)) && !textContent.includes('<Text of Option');
      if (isMcqHeader) {
        return (
          <div className="w-full my-3 p-4 bg-gradient-to-r from-emerald-500/25 via-teal-500/20 to-cyan-500/25 border-2 border-emerald-400/70 rounded-2xl shadow-[0_0_25px_rgba(16,185,129,0.3)] flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/30 border border-emerald-400/60 flex items-center justify-center text-emerald-300 font-black text-lg shrink-0 shadow-sm">
              ✓
            </div>
            <div>
              <div className="text-[10px] uppercase font-black tracking-widest text-emerald-400 mb-0.5">MCQ Direct Answer</div>
              <div className="text-white font-black text-base md:text-lg tracking-tight">{children}</div>
            </div>
          </div>
        );
      }
      if (textContent.includes('<Text of Option')) return null;

      // Advantage / Benefit / Pros Callout Box
      const isAdvantage = /^(?:\*\*)?(?:Advantage|Benefit|Pros?|Strength)s?[: -]/i.test(trimmed);
      if (isAdvantage) {
        return (
          <div className="w-full my-3 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/15 to-teal-500/10 border border-emerald-400/40 shadow-md flex items-start gap-3">
            <div className="w-7 h-7 rounded-xl bg-emerald-500/25 border border-emerald-400/50 flex items-center justify-center text-emerald-300 font-black text-sm shrink-0 mt-0.5 shadow-sm">
              <CheckCircle2 size={15} className="text-emerald-300" />
            </div>
            <div className="flex-1 text-emerald-100 font-medium leading-relaxed">
              {children}
            </div>
          </div>
        );
      }

      // Disadvantage / Trade-off / Limitation Callout Box
      const isDisadvantage = /^(?:\*\*)?(?:Disadvantage|Drawback|Cons?|Weakness|Limitation|Trade-off)s?[: -]/i.test(trimmed);
      if (isDisadvantage) {
        return (
          <div className="w-full my-3 p-3.5 rounded-2xl bg-gradient-to-r from-rose-500/15 to-amber-500/10 border border-rose-400/40 shadow-md flex items-start gap-3">
            <div className="w-7 h-7 rounded-xl bg-rose-500/25 border border-rose-400/50 flex items-center justify-center text-rose-300 font-black text-sm shrink-0 mt-0.5 shadow-sm">
              <AlertTriangle size={15} className="text-rose-300" />
            </div>
            <div className="flex-1 text-rose-100 font-medium leading-relaxed">
              {children}
            </div>
          </div>
        );
      }

      // Differentiation / Comparison Box
      const isComparison = /^(?:\*\*)?(?:Difference|Comparison|Versus|vs)s?[: -]/i.test(trimmed);
      if (isComparison) {
        return (
          <div className="w-full my-3 p-3.5 rounded-2xl bg-gradient-to-r from-cyan-500/15 to-blue-500/10 border border-cyan-400/40 shadow-md flex items-start gap-3">
            <div className="w-7 h-7 rounded-xl bg-cyan-500/25 border border-cyan-400/50 flex items-center justify-center text-cyan-300 font-black text-sm shrink-0 mt-0.5 shadow-sm">
              <Columns size={15} className="text-cyan-300" />
            </div>
            <div className="flex-1 text-cyan-100 font-medium leading-relaxed">
              {children}
            </div>
          </div>
        );
      }

      // Standard Paragraph with Paragraph Start Indicator Accent Bar
      return (
        <p className="my-2.5 leading-relaxed flex items-start gap-2.5 font-medium pl-3 border-l-2 border-cyan-400/50 hover:border-cyan-400 transition-colors" {...props}>
          <span className="flex-1">{children}</span>
        </p>
      );
    },
    h1({ children, ...props }: any) {
      return (
        <div className="w-full mt-4 mb-2 pb-2 border-b border-cyan-500/30">
          <h1 className="text-xl md:text-2xl font-black bg-gradient-to-r from-cyan-300 via-teal-200 to-white bg-clip-text text-transparent flex items-center gap-2.5 tracking-tight" {...props}>
            <span className="w-2.5 h-6 rounded-full bg-gradient-to-b from-cyan-400 to-teal-500 shrink-0 inline-block shadow-[0_0_10px_rgba(6,182,212,0.5)]" />
            <span>{children}</span>
          </h1>
        </div>
      );
    },
    h2({ children, ...props }: any) {
      return (
        <div className="w-full mt-3.5 mb-2">
          <h2 className="text-lg md:text-xl font-extrabold text-cyan-300 flex items-center gap-2 tracking-tight" {...props}>
            <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0 shadow-[0_0_8px_rgba(34,211,238,0.7)]" />
            <span>{children}</span>
          </h2>
        </div>
      );
    },
    h3({ children, ...props }: any) {
      return (
        <div className="w-full mt-3 mb-1.5">
          <h3 className="text-base font-bold text-teal-300 flex items-center gap-2 tracking-tight" {...props}>
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0 shadow-[0_0_6px_rgba(45,212,191,0.6)]" />
            <span>{children}</span>
          </h3>
        </div>
      );
    },
    h4({ children, ...props }: any) {
      return (
        <h4 className="text-sm font-bold text-sky-300/90 mt-2 mb-1 uppercase tracking-wider flex items-center gap-1.5" {...props}>
          <span>{children}</span>
        </h4>
      );
    },
    ul({ children, ...props }: any) {
      return <ul className="flex flex-col gap-2 my-2.5 pl-1" {...props}>{children}</ul>;
    },
    ol({ children, ...props }: any) {
      return (
        <ol className="flex flex-col gap-2 my-2.5 pl-1 list-decimal list-inside text-cyan-300 font-bold" {...props}>
          <div className="text-white/90 font-medium inline">{children}</div>
        </ol>
      );
    },
    li({ node, children, ...props }: any) {
      const textContent = Array.isArray(children) 
        ? children.map(c => typeof c === 'string' ? c : (c?.props?.children ? String(c.props.children) : '')).join('') 
        : (typeof children === 'string' ? children : '');

      const trimmed = textContent.trim();
      const isAdvantage = /^(?:\*\*)?(?:Advantage|Benefit|Pros?|Strength)s?[: -]/i.test(trimmed);
      const isDisadvantage = /^(?:\*\*)?(?:Disadvantage|Drawback|Cons?|Weakness|Limitation|Trade-off)s?[: -]/i.test(trimmed);
      const isDifference = /^(?:\*\*)?(?:Difference|Comparison|Versus|vs)s?[: -]/i.test(trimmed);

      if (isAdvantage) {
        return (
          <li className="flex items-start gap-2.5 my-1.5 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-white/95 leading-relaxed shadow-sm" {...props}>
            <div className="w-5 h-5 rounded-lg bg-emerald-500/25 border border-emerald-400/50 flex items-center justify-center text-emerald-300 text-xs shrink-0 mt-0.5 shadow-sm">
              <CheckCircle2 size={13} className="text-emerald-300" />
            </div>
            <div className="flex-1 font-medium">{children}</div>
          </li>
        );
      }

      if (isDisadvantage) {
        return (
          <li className="flex items-start gap-2.5 my-1.5 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-white/95 leading-relaxed shadow-sm" {...props}>
            <div className="w-5 h-5 rounded-lg bg-rose-500/25 border border-rose-400/50 flex items-center justify-center text-rose-300 text-xs shrink-0 mt-0.5 shadow-sm">
              <AlertTriangle size={13} className="text-rose-300" />
            </div>
            <div className="flex-1 font-medium">{children}</div>
          </li>
        );
      }

      if (isDifference) {
        return (
          <li className="flex items-start gap-2.5 my-1.5 p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-white/95 leading-relaxed shadow-sm" {...props}>
            <div className="w-5 h-5 rounded-lg bg-cyan-500/25 border border-cyan-400/50 flex items-center justify-center text-cyan-300 text-xs shrink-0 mt-0.5 shadow-sm">
              <Columns size={13} className="text-cyan-300" />
            </div>
            <div className="flex-1 font-medium">{children}</div>
          </li>
        );
      }

      return (
        <li className="flex items-start gap-2.5 leading-relaxed text-white/95 my-0.5" {...props}>
          <span className="w-2 h-2 rounded-full bg-gradient-to-tr from-cyan-400 to-teal-400 shrink-0 mt-2 shadow-[0_0_6px_rgba(34,211,238,0.6)]" />
          <div className="flex-1 font-medium">{children}</div>
        </li>
      );
    },
    blockquote({ children, ...props }: any) {
      return (
        <blockquote className="my-3 pl-3.5 py-2 border-l-4 border-cyan-400/80 bg-white/[0.04] rounded-r-xl italic text-white/95" {...props}>
          {children}
        </blockquote>
      );
    },
    table({ children, ...props }: any) {
      return (
        <div className="w-full my-3 overflow-x-auto rounded-xl border border-white/10 shadow-lg">
          <table className="w-full text-left text-xs border-collapse" {...props}>{children}</table>
        </div>
      );
    },
    th({ children, ...props }: any) {
      return <th className="bg-white/10 p-2.5 font-bold text-cyan-300 border-b border-white/10" {...props}>{children}</th>;
    },
    td({ children, ...props }: any) {
      return <td className="p-2.5 border-b border-white/5 font-medium text-white/90" {...props}>{children}</td>;
    }
  }), [groqKeys, preferredCodeLanguage, transcript, currentSnapshots, altColor]);

  return (
    <>

      <div
        className={`absolute inset-0 flex flex-col items-center ${stealthMode && !isAiFullscreen ? 'pointer-events-none click-through-bg' : 'pointer-events-auto'} font-sans select-none animate-in fade-in duration-150 fill-mode-both ${isAiFullscreen ? 'p-4' : ''}`}
        style={{ transition: 'none' }}
      >
        <AnimatePresence>
          {isAiFullscreen ? (
            <motion.div
              key="ai-fullscreen-panel"
              initial={{ opacity: 0, scale: 0.98, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -8 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="flex flex-col w-full h-full gap-4 items-center pointer-events-auto z-50"
            >
            {/* Top Bar Panel */}
            <div
              className={`border border-white/15 shrink-0 drag-area rounded-2xl pointer-events-auto shadow-2xl mt-2 transition-all duration-150 ${isTopBarMinimized ? 'w-14 h-14 flex items-center justify-center p-0 rounded-full bg-black/80 backdrop-blur-md cursor-pointer group' : 'flex flex-col w-full max-w-[940px] mx-auto gap-3 p-4'}`}
              style={{
                backgroundColor: isTopBarMinimized ? undefined : (altColor ? 'rgba(255, 255, 255, 0.96)' : 'rgba(12, 13, 20, 0.96)'),
                backdropFilter: (isTopBarMinimized || opacity < 0.05) ? "none" : `blur(${opacity * 30}px)`,
                borderColor: isTopBarMinimized ? undefined : (altColor ? 'rgba(128, 128, 128, 0.3)' : 'rgba(255, 255, 255, 0.15)'),
                boxShadow: isTopBarMinimized ? undefined : "0 25px 60px -10px rgba(0, 0, 0, 0.8)",
                transform: `translate(${topBarPos.x}px, ${topBarPos.y}px)`
              }}
              onPointerDown={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest && target.closest('.stealth-exempt')) return;
                const scrollContainer = target.closest('.custom-scrollbar');
                const isScrollbarClick = scrollContainer && (e.clientX >= scrollContainer.getBoundingClientRect().right - 20);
                if (target.tagName !== 'BUTTON' && target.tagName !== 'INPUT' && target.tagName !== 'SELECT' && target.closest('button') === null && !isScrollbarClick) {
                  dragStateRef.current = {
                    panel: 'top',
                    startX: e.clientX,
                    startY: e.clientY,
                    initialX: topBarPos.x,
                    initialY: topBarPos.y
                  };
                }
              }}
              onPointerUp={() => {
                dragStateRef.current = { panel: null, startX: 0, startY: 0, initialX: 0, initialY: 0 };
              }}
            >
              {isTopBarMinimized ? (
                <div
                  className="w-full h-full flex items-center justify-center text-cyan-400 hover:text-cyan-300 transition-colors"
                  onClick={() => setIsTopBarMinimized(false)}
                >
                  <span className="text-2xl select-none group-hover:scale-110 transition-transform">🧠</span>
                  <div className="absolute inset-0 rounded-full border border-cyan-400/30 group-hover:border-cyan-400/60 animate-[spin_4s_linear_infinite]" />
                </div>
              ) : (
                <>
                  {/* Row 1: Header Toolbar */}
                  <div className="flex items-center justify-between w-full no-drag gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-white/5 rounded-lg text-white/50 border border-white/5 flex items-center justify-center cursor-default">
                        <Move size={14} />
                      </div>
                      <div className="bg-gradient-to-r from-fuchsia-500/20 to-purple-500/20 text-fuchsia-300 border border-fuchsia-500/30 px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-fuchsia-400 animate-pulse"></span>
                        <span>{activeAIInfo ? `${activeAIInfo.provider} (Key ${activeAIInfo.index})` : (provider ? provider.toUpperCase() : "AI Answer")}</span>
                      </div>
                    </div>

                    {/* Right: Actions in single, non-overlapping horizontal group */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Font Size */}
                      <div className="flex items-center gap-1 bg-white/5 rounded-xl p-0.5 border border-white/10 shrink-0">
                        <button
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() => {
                            const next = Math.max(10, aiAnswerTextSize - 1);
                            setAiAnswerTextSize(next);
                            localStorage.setItem('clueai_answer_size', next.toString());
                          }}
                          className="px-2 py-1 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors font-bold text-xs cursor-pointer"
                        >
                          A-
                        </button>
                        <span className="text-[11px] text-white/70 font-mono w-4 text-center select-none font-bold">{aiAnswerTextSize}</span>
                        <button
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() => {
                            const next = Math.min(40, aiAnswerTextSize + 1);
                            setAiAnswerTextSize(next);
                            localStorage.setItem('clueai_answer_size', next.toString());
                          }}
                          className="px-2 py-1 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors font-bold text-xs cursor-pointer"
                        >
                          A+
                        </button>
                      </div>

                      {/* Auto Scroll with User-Managed Speed Controls */}
                      <div className={`flex items-center rounded-xl p-0.5 border transition-all ${scrollSpeed > 0 ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-400 shadow-sm' : 'bg-white/5 border-white/10 text-white/70'}`}>
                        <button
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() => {
                            setIsVoiceScroll(false); // Mutual exclusion: turn off Voice Scroll
                            setScrollSpeed(prev => (prev === 0 ? 1 : 0));
                          }}
                          className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${scrollSpeed > 0 ? 'bg-emerald-500/20 text-emerald-300' : 'hover:text-white'}`}
                          title={scrollSpeed > 0 ? "Pause Auto Scroll" : "Start Auto Scroll"}
                        >
                          {scrollSpeed > 0 ? <Pause size={12} /> : <ArrowDown size={12} />}
                          <span className="text-[10px]">{scrollSpeed > 0 ? 'Scrolling' : 'Scroll'}</span>
                        </button>

                        {scrollSpeed > 0 && (
                          <div className="flex items-center gap-0.5 pl-1 pr-1 border-l border-white/10">
                            <button
                              type="button"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={() => setScrollSpeed(prev => Math.max(1, prev - 1))}
                              className="w-4 h-5 flex items-center justify-center hover:bg-white/10 rounded text-[10px] font-bold text-white/60 hover:text-white cursor-pointer"
                              title="Decrease speed"
                            >
                              -
                            </button>
                            <button
                              type="button"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={() => setScrollSpeed(prev => (prev >= 5 ? 1 : prev + 1))}
                              className="px-1 text-[10px] font-mono font-black text-emerald-300 hover:text-emerald-200 cursor-pointer"
                              title="Click to cycle speed (1x - 5x)"
                            >
                              {scrollSpeed}x
                            </button>
                            <button
                              type="button"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={() => setScrollSpeed(prev => Math.min(5, prev + 1))}
                              className="w-4 h-5 flex items-center justify-center hover:bg-white/10 rounded text-[10px] font-bold text-white/60 hover:text-white cursor-pointer"
                              title="Increase speed"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Voice Scroll (Voice-Gated Delta Teleprompter Mode - 100% Offline & Non-AI) */}
                      <div className={`flex items-center rounded-xl p-0.5 border transition-all ${
                        isVoiceScroll 
                          ? 'bg-cyan-500/15 border-cyan-400/40 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.25)]' 
                          : 'bg-white/5 border-white/10 text-white/70 hover:text-white'
                      }`}>
                        <button
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() => {
                            setIsVoiceScroll(prev => {
                              const next = !prev;
                              if (next) {
                                setScrollSpeed(0); // Mutual exclusion: turn off normal scroll
                                if (!isRecordingRef.current) {
                                  startRecording(true);
                                }
                              }
                              return next;
                            });
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                            isVoiceScroll ? 'bg-cyan-500/20 text-cyan-300' : 'hover:text-white'
                          }`}
                          title="Voice Scroll: Automatically scrolls smoothly as you speak (100% offline, zero API calls)"
                        >
                          <Mic size={12} className={isVoiceScroll ? (isSpeakingLive ? 'text-emerald-400 animate-pulse' : 'text-cyan-400') : 'text-white/60'} />
                          <span className="text-[10px] tracking-tight">
                            {isVoiceScroll ? (isSpeakingLive ? 'Speaking' : 'Voice Scroll ON') : 'Voice Scroll'}
                          </span>
                        </button>

                        {isVoiceScroll && (
                          <div className="flex items-center gap-0.5 pl-1 pr-1 border-l border-cyan-500/30">
                            <button
                              type="button"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={() => setVoiceScrollSpeed(prev => Math.max(1, prev - 1))}
                              className="w-4 h-5 flex items-center justify-center hover:bg-white/10 rounded text-[10px] font-bold text-cyan-300 hover:text-white cursor-pointer"
                              title="Decrease voice scroll speed"
                            >
                              -
                            </button>
                            <button
                              type="button"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={() => setVoiceScrollSpeed(prev => (prev >= 5 ? 1 : prev + 1))}
                              className="px-1 text-[10px] font-mono font-black text-cyan-300 hover:text-cyan-200 cursor-pointer"
                              title="Cycle voice scroll speed (1x - 5x)"
                            >
                              {voiceScrollSpeed}x
                            </button>
                            <button
                              type="button"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={() => setVoiceScrollSpeed(prev => Math.min(5, prev + 1))}
                              className="w-4 h-5 flex items-center justify-center hover:bg-white/10 rounded text-[10px] font-bold text-cyan-300 hover:text-white cursor-pointer"
                              title="Increase voice scroll speed"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Copy Button */}
                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => {
                          if (!aiAnswer) return;
                          clipboard.writeText(aiAnswer.replace(/<think>[\s\S]*?(?:<\/think>|$)/g, '').trim());
                          setAiCopied(true);
                          setTimeout(() => setAiCopied(false), 2000);
                        }}
                        className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white border border-white/15 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        {aiCopied ? (
                          <><CheckCircle2 size={13} className="text-emerald-400" /> <span className="text-emerald-400">COPIED</span></>
                        ) : (
                          <><FileText size={13} /> COPY</>
                        )}
                      </button>

                      {/* Next Question Button */}
                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => {
                          if (aiAbortControllerRef.current) aiAbortControllerRef.current.abort();
                          setIsGenerating(false);
                          isAiFullscreenRef.current = false;
                          setIsAiFullscreen(false);
                          setTranscript('');
                          setFinalizedText('');
                          setInterimText('');
                          setFrozenQuestionTranscript('');
                          finalizedTranscriptRef.current = '';
                          interimTranscriptRef.current = '';
                          setAiAnswer('');
                          setCurrentSnapshots([]);
                          clearAudioBuffer();
                          listeningSessionIdRef.current++;
                          setIsPaused(false);
                          isPausedRef.current = false;
                          setIsVoiceScroll(false);
                          setScrollSpeed(0);
                          setActiveReadIndex(0);
                          setReadWordIndex(0);
                          readWordProgressRef.current = 0;
                        }}
                        className="px-3.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs rounded-xl flex items-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.35)] transition-all shrink-0 active:scale-95 cursor-pointer"
                      >
                        <Play size={12} fill="currentColor" /> NEXT Q. <span className="text-[9px] bg-black/20 px-1 rounded ml-0.5">1</span>
                      </button>

                      {/* Close Button */}
                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => {
                          if (aiAbortControllerRef.current) aiAbortControllerRef.current.abort();
                          setIsGenerating(false);
                          isAiFullscreenRef.current = false;
                          setIsAiFullscreen(false);
                          setIsPaused(false);
                          isPausedRef.current = false;
                          setIsVoiceScroll(false);
                          setScrollSpeed(0);
                          setActiveReadIndex(0);
                          setReadWordIndex(0);
                          readWordProgressRef.current = 0;
                          setTranscript('');
                          setFinalizedText('');
                          setInterimText('');
                          setFrozenQuestionTranscript('');
                          finalizedTranscriptRef.current = '';
                          interimTranscriptRef.current = '';
                          clearAudioBuffer();
                          setAiAnswer('');
                          setCurrentSnapshots([]);
                          listeningSessionIdRef.current++;
                        }}
                        className="px-3 py-1 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                      >
                        <X size={13} /> CLOSE <span className="text-[9px] bg-white/10 px-1 rounded ml-0.5">3</span>
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Ultra-Wide Question Context Box */}
                  <div className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-1.5 no-drag">
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5 text-cyan-400 font-bold text-[10.5px] uppercase tracking-wider">
                        <Cpu size={11} /> Interviewer Question
                      </div>
                      <span className="text-[9px] text-white/40 font-mono">
                        Next Q (1) • Close (3)
                      </span>
                    </div>
                    <div className="text-white text-[13px] leading-snug max-h-[52px] overflow-y-auto custom-scrollbar select-text pr-2">
                      {(frozenQuestionTranscript || transcript || "").trim() || "Screenshot / Vision analysis provided."}
                    </div>

                    {/* Inline Snapshots */}
                    {currentSnapshots.length > 0 && (
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/10 flex-wrap">
                        {currentSnapshots.map((snap, idx) => (
                          <div key={idx} className="relative group/snap rounded-lg overflow-hidden border border-white/20 w-16 h-12 shrink-0">
                            <img src={snap} alt={`Snapshot ${idx + 1}`} className="w-full h-full object-cover" />
                            <button
                              onClick={() => setCurrentSnapshots(prev => prev.filter((_, i) => i !== idx))}
                              className="absolute top-0 right-0 p-1 bg-rose-500/90 hover:bg-rose-500 text-white rounded-bl-lg opacity-0 group-hover/snap:opacity-100 transition-opacity"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={async () => {
                            setIsPaused(true);
                            isPausedRef.current = true;
                            const base64Img = await ipcRenderer.invoke('start-snipping', selectedSource);
                            if (!base64Img) {
                              setIsPaused(false);
                              isPausedRef.current = false;
                              return;
                            }
                            setCurrentSnapshots(prev => {
                              const next = [...prev, base64Img];
                              if (next.length > 8) return next.slice(next.length - 8);
                              return next;
                            });
                            setIsPaused(false);
                            isPausedRef.current = false;
                          }}
                          className="w-16 h-12 flex flex-col items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg border border-white/20 border-dashed text-white/60 hover:text-white transition-colors cursor-pointer shrink-0"
                        >
                          <Plus size={14} />
                          <span className="text-[8px] uppercase font-bold mt-0.5 tracking-wider">Add</span>
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* AI Answer Content Panel */}
            <div
              className={`border border-white/15 shrink-0 drag-area pointer-events-auto shadow-2xl mt-1 mb-4 transition-all duration-150 ${isAnswerMinimized ? 'flex p-3 bg-[#09090b]/90 backdrop-blur-md cursor-grab active:cursor-grabbing group overflow-hidden rounded-2xl' : 'flex flex-col overflow-hidden w-full max-w-[940px] max-h-[75vh] relative rounded-2xl shadow-[0_30px_70px_rgba(0,0,0,0.95)]'}`}
              style={{
                backgroundColor: isAnswerMinimized ? undefined : (altColor ? 'rgba(255, 255, 255, 0.96)' : 'rgba(10, 11, 16, 0.98)'),
                backdropFilter: (isAnswerMinimized || opacity < 0.05) ? "none" : `blur(${opacity * 30}px)`,
                borderColor: isAnswerMinimized ? undefined : (altColor ? 'rgba(128, 128, 128, 0.3)' : 'rgba(255, 255, 255, 0.15)'),
                borderWidth: isAnswerMinimized ? undefined : "1px",
                boxShadow: isAnswerMinimized ? undefined : "0 30px 80px -10px rgba(0, 0, 0, 0.9)",
                transform: `translate(${answerPos.x}px, ${answerPos.y}px)`,
                width: isAnswerMinimized ? Math.max(250, 350 + (stealthFontSize - 11.5) * 25) + 'px' : undefined,
                height: isAnswerMinimized ? Math.max(100, 200 + (stealthFontSize - 11.5) * 15) + 'px' : undefined
              }}
              onPointerDown={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest && target.closest('.stealth-exempt')) return;

                // Allow normal text selection and touch-scrolling by ignoring drags inside the scrollable area
                if (target.tagName !== 'BUTTON' && target.tagName !== 'INPUT' && target.tagName !== 'SELECT' && target.closest('button') === null && !target.closest('.custom-scrollbar')) {
                  dragStateRef.current = {
                    panel: 'answer',
                    startX: e.clientX,
                    startY: e.clientY,
                    initialX: answerPos.x,
                    initialY: answerPos.y
                  };
                }
              }}
              onPointerUp={() => {
                dragStateRef.current = { panel: null, startX: 0, startY: 0, initialX: 0, initialY: 0 };
              }}
            >
              {isAnswerMinimized ? (
                <div
                  className={`w-full h-full flex flex-col overflow-hidden relative ${altColor ? 'text-black/80' : 'text-white/90'}`}
                  onDoubleClick={() => setIsAnswerMinimized(false)}
                >
                  <div className="absolute top-1 right-2 z-30 opacity-100 bg-[#0a0b12]/95 border border-white/20 backdrop-blur-xl rounded-xl px-2 py-0.5 flex items-center gap-1.5 shadow-md">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setStealthFontSize(prev => {
                          const newVal = Math.max(9, prev - 0.5);
                          localStorage.setItem('clueai_stealth_font_size', newVal.toString());
                          return newVal;
                        });
                      }}
                      className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded transition-colors"
                    ><Minus size={12} /></button>
                    <span className="text-[10px] font-mono text-cyan-400 font-bold px-0.5 select-none">{stealthFontSize}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setStealthFontSize(prev => {
                          const newVal = Math.min(24, prev + 0.5);
                          localStorage.setItem('clueai_stealth_font_size', newVal.toString());
                          return newVal;
                        });
                      }}
                      className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded transition-colors"
                    ><Plus size={12} /></button>
                    <div className="w-[1px] h-3 bg-white/20 mx-0.5" />
                    <button onClick={() => setIsAnswerMinimized(false)} className="text-cyan-400 hover:text-cyan-300 p-1 hover:bg-cyan-500/10 rounded transition-colors"><Maximize size={12} /></button>
                  </div>
                  <div
                    ref={aiAnswerScrollRef}
                    onMouseEnter={() => { isHoveringAnswerRef.current = true; }}
                    onMouseLeave={() => { isHoveringAnswerRef.current = false; }}
                    onWheel={() => {
                      isWheelOverridingRef.current = true;
                      if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current);
                      wheelTimeoutRef.current = setTimeout(() => {
                        isWheelOverridingRef.current = false;
                      }, 1500);
                    }}
                    className="overflow-y-auto pr-1 leading-snug font-bold w-full h-full no-scrollbar"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', fontSize: `${stealthFontSize}px` }}
                  >
                    {aiAnswer ? (
                      <ReactMarkdown components={markdownComponents}>
                        {aiAnswer.replace(/<think>[\s\S]*?(?:<\/think>|$)/g, '').replace(/(?:\r?\n){3,}/g, '\n\n').trim()}
                      </ReactMarkdown>
                    ) : (
                      "Generating..."
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-full flex justify-center pt-3 cursor-grab active:cursor-grabbing no-drag opacity-30 hover:opacity-100 transition-opacity">
                    <div className="w-12 h-1.5 rounded-full bg-white/50"></div>
                  </div>

                  <div
                    className={`overflow-y-auto custom-scrollbar no-drag bg-transparent ${isAnswerMinimized ? 'w-full p-4' : 'w-full p-6 md:p-8'}`}
                    ref={aiAnswerScrollRef}
                    onMouseEnter={() => { isHoveringAnswerRef.current = true; }}
                    onMouseLeave={() => { isHoveringAnswerRef.current = false; }}
                    onWheel={() => {
                      isWheelOverridingRef.current = true;
                      if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current);
                      wheelTimeoutRef.current = setTimeout(() => {
                        isWheelOverridingRef.current = false;
                      }, 1500);
                    }}
                  >
                    <div className={`max-w-5xl mx-auto font-bold leading-snug ${altColor ? 'text-black/60' : 'text-white/90'}`} style={{ fontSize: aiAnswerTextSize + "px" }}>
                      {/* Unified Answer Header: Solution Title, Split View Toggle, Font Controls & Minimize in single row */}
                      <div className="flex items-center justify-between gap-3 mb-4 pb-2.5 border-b border-white/10 select-none">
                        <div className="flex items-center gap-2">
                          {aiAnswer && aiAnswer.includes('```') ? (
                            <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5 uppercase tracking-wider">
                              <Code2 size={15} /> Coding Solution Active ({preferredCodeLanguage})
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-cyan-400/90 flex items-center gap-1.5 uppercase tracking-wider">
                              <Sparkles size={15} /> AI Solution
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2.5">
                          {aiAnswer && aiAnswer.includes('```') && (
                            <button
                              onClick={() => setIsCodeSplitView(!isCodeSplitView)}
                              className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                                isCodeSplitView 
                                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.25)]' 
                                  : 'bg-white/5 text-white/60 hover:text-white border-white/10'
                              }`}
                            >
                              <Columns size={13} /> {isCodeSplitView ? 'Split View (Code & Info)' : 'Unified View'}
                            </button>
                          )}

                          {/* High-Visibility Floating Answer Controls: Font Size & Minimize */}
                          <div className="flex items-center gap-1 bg-[#0a0b12]/95 border border-white/20 backdrop-blur-2xl px-2.5 py-1 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.6)]">
                            <button
                              onClick={() => {
                                const next = Math.max(10, aiAnswerTextSize - 1);
                                setAiAnswerTextSize(next);
                                localStorage.setItem('clueai_answer_size', next.toString());
                              }}
                              className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all font-bold flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95"
                            >
                              <Minus size={13} className="text-white" />
                            </button>

                            <span className="text-[11px] font-mono font-bold text-cyan-300 px-1 select-none">
                              {aiAnswerTextSize}px
                            </span>

                            <button
                              onClick={() => {
                                const next = Math.min(40, aiAnswerTextSize + 1);
                                setAiAnswerTextSize(next);
                                localStorage.setItem('clueai_answer_size', next.toString());
                              }}
                              className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all font-bold flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95"
                            >
                              <Plus size={13} className="text-white" />
                            </button>

                            <div className="w-[1px] h-4 bg-white/20 mx-0.5" />

                            <button
                              onClick={() => setIsAnswerMinimized(true)}
                              className="p-1.5 rounded-lg bg-white/10 hover:bg-cyan-500/20 text-white hover:text-cyan-300 transition-all flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95"
                            >
                              <Minimize2 size={13} className="text-white" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {aiAnswer ? (
                        <>
                          {aiAnswer.includes('```') && isCodeSplitView ? (
                            (() => {
                              const codeRegex = /```(\w+)?\n([\s\S]*?)```/g;
                              const matches = [...aiAnswer.matchAll(codeRegex)];
                              const codeOnly = matches.map(m => m[0]).join('\n\n');
                              const explanationOnly = aiAnswer.replace(codeRegex, '').trim();

                              return (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 w-full items-start">
                                  {/* Code Solution Area */}
                                  <div className="flex flex-col bg-[#05060a]/95 border border-cyan-500/30 rounded-2xl p-4 shadow-xl">
                                    <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/10">
                                      <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase tracking-wider">
                                        <Code2 size={16} /> Solution Code ({preferredCodeLanguage})
                                      </div>
                                      <CopyButton text={matches.map(m => m[2]).join('\n\n')} className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs" tooltip="Copy Code" />
                                    </div>
                                    <ReactMarkdown components={markdownComponents}>
                                      {codeOnly}
                                    </ReactMarkdown>
                                  </div>

                                  {/* Technical Info Area */}
                                  <div className="flex flex-col bg-white/[0.03] border border-white/10 rounded-2xl p-4 shadow-xl">
                                    <div className="flex items-center gap-2 text-fuchsia-400 font-bold text-xs uppercase tracking-wider pb-3 mb-2 border-b border-white/10">
                                      <BookOpen size={16} /> Technical Explanation & Info
                                    </div>
                                    <div className="space-y-3 font-medium">
                                      <ReactMarkdown components={markdownComponents}>
                                        {explanationOnly || "Code provided in solution block."}
                                      </ReactMarkdown>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()
                          ) : isVoiceScroll ? (
                            (() => {
                              const cleanAnswer = aiAnswer.replace(/<think>[\s\S]*?(?:<\/think>|$)/g, '').replace(/(?:\r?\n){3,}/g, '\n\n').trim();
                              const paragraphs = cleanAnswer.split(/\n\n+/).filter(p => p.trim().length > 0);

                              let globalWordCounter = 0;
                              const parsedParas = paragraphs.map((para, pIdx) => {
                                const words = para.split(/\s+/).filter(Boolean).map(w => {
                                  const wordObj = { raw: w, idx: globalWordCounter, pIdx };
                                  globalWordCounter++;
                                  return wordObj;
                                });
                                return { pIdx, para, words };
                              });

                              return (
                                <div className="space-y-4">
                                  {liveSpokenText && (
                                    <div className="sticky top-0 z-20 flex items-center gap-2 px-3.5 py-1.5 bg-[#0a0c16]/95 border border-cyan-400/50 rounded-full text-xs text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.3)] backdrop-blur-md mb-2 w-fit">
                                      <Mic size={13} className="text-emerald-400 animate-pulse" />
                                      <span className="text-[10px] uppercase font-bold text-cyan-400/70">Heard:</span>
                                      <span className="font-semibold text-white truncate max-w-lg">"{liveSpokenText}"</span>
                                    </div>
                                  )}
                                  {parsedParas.map(({ pIdx, words }) => (
                                    <div key={pIdx} className="leading-relaxed flex flex-wrap gap-x-2 gap-y-1.5 p-3 rounded-2xl bg-white/[0.01] border border-white/5">
                                      {words.map((w) => {
                                        const isPast = w.idx < readWordIndex;
                                        const isCurrent = w.idx === readWordIndex;
                                        return (
                                          <span
                                            key={w.idx}
                                            id={`teleprompter-word-${w.idx}`}
                                            onClick={() => {
                                              setReadWordIndex(w.idx);
                                              readWordIndexRef.current = w.idx;
                                              readWordProgressRef.current = w.idx;
                                            }}
                                            className={`cursor-pointer transition-all duration-200 select-text ${
                                              isCurrent
                                                ? 'text-cyan-300 font-black bg-cyan-400/25 px-1.5 py-0.5 rounded-lg ring-2 ring-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.6)] scale-105 inline-block'
                                                : isPast
                                                ? 'filter blur-[0.6px] opacity-35 text-white/50 select-none hover:opacity-80 hover:blur-none'
                                                : 'text-white/95 font-semibold hover:text-cyan-200'
                                            }`}
                                          >
                                            {w.raw}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  ))}
                                </div>
                              );
                            })()
                          ) : (
                            <ReactMarkdown components={markdownComponents}>
                              {aiAnswer.replace(/<think>[\s\S]*?(?:<\/think>|$)/g, '').replace(/(?:\r?\n){3,}/g, '\n\n').trim()}
                            </ReactMarkdown>
                          )}
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full opacity-50 py-20">
                          <Loader2 size={48} className="animate-spin text-cyan-500 mb-4" />
                          <p className="text-lg animate-pulse">Generating response...</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="main-screen-container"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className={`flex flex-col w-full h-full overflow-hidden ${stealthMode && isRecording && !isAiFullscreen && !showSettings && !showInfo && !showVirtualKeyboard && !showPreviousQuestions && !showUpdateModal && !showFeedbackModal && !showStorageModal && !showDeleteUserDataConfirm && !showOtpModal && !showExportModal && !showOnboardingModal ? 'pointer-events-none' : 'pointer-events-auto'} rounded-3xl p-4 ${isRecording ? 'bg-transparent' : 'bg-[#09090b]'}`}
          >
            <datalist id="saved-emails">
              {localStorage.getItem('clueai_saved_email') && <option value={localStorage.getItem('clueai_saved_email')!} />}
            </datalist>
            <div className={`flex flex-col ${isRecording ? 'w-full h-full' : 'flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar'}`}>
              {!isRecording && (
                <motion.div
                  key="dashboard-header"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ type: "spring", stiffness: 350, damping: 28 }}
                  className="flex flex-col mb-4 pb-2 border-b border-indigo-500/20"
                  onPointerDown={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest && target.closest('.stealth-exempt')) return;
                    if (target.tagName !== 'BUTTON' && target.tagName !== 'INPUT' && target.tagName !== 'SELECT' && target.closest('button') === null) {
                      ipcRenderer.send('start-drag');
                      target.setPointerCapture(e.pointerId);
                    }
                  }}
                  onPointerUp={(e) => {
                    ipcRenderer.send('stop-drag');
                    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
                  }}
                >
                  {/* MAIN DASHBOARD HEADER: TWO-TIER OBSIDIAN GLASS ARCHITECTURE */}
                  <div className="w-full flex-none bg-[#0a0b12]/95 backdrop-blur-2xl border-b border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.7)] relative z-30 drag-area rounded-t-2xl shrink-0">
                    {/* Top Tier (Tier 1): Titlebar, Identity, Version & Window Controls */}
                    <div className="w-full px-5 py-2.5 flex items-center justify-between border-b border-white/5">
                      {/* Left: Move Handle, Logo, App Name, Version & Profile */}
                      <div className="flex items-center gap-3 no-drag">
                        <div className="p-1.5 bg-white/5 rounded-lg text-white/40 border border-white/10 flex items-center justify-center shrink-0 cursor-grab active:cursor-grabbing hover:text-white/80 transition-colors">
                          <Move size={14} />
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="relative flex items-center justify-center">
                            <img src="./logo.png" alt="Logo" className="w-6 h-6 object-cover rounded-lg shadow-sm border border-cyan-400/30" />
                            <div className="absolute -inset-0.5 rounded-lg bg-cyan-500/20 blur-[2px] -z-10" />
                          </div>

                          <span className="text-base font-black tracking-tight text-white flex items-center gap-1">
                            Clue<span className="text-cyan-400">AI</span>
                          </span>

                          <button
                            onClick={() => setShowUpdateModal(true)}
                            className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 transition-all flex items-center gap-1 cursor-pointer ml-1"
                          >
                            <span>v{appVersion}</span>
                          </button>
                        </div>

                        {username && (
                          <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/10 rounded-xl px-2.5 py-0.5 text-white/90 text-xs font-semibold ml-2">
                            <User size={12} className="text-cyan-400" />
                            <span>{username}</span>
                            <button
                              onClick={() => { setTempUsername(username); setLocalRenameStealth(stealthMode); setShowUsernamePrompt(true); }}
                              className="p-0.5 hover:bg-white/10 text-white/50 hover:text-cyan-300 rounded-md transition-colors ml-0.5 cursor-pointer"
                            >
                              <Edit2 size={11} />
                            </button>
                          </div>
                        )}

                        {/* Top Bar Feedback Button Next to Name */}
                        <button
                          onClick={() => {
                            setFeedbackErrors({});
                            setFeedbackStatus('idle');
                            setFeedbackForm(prev => ({
                              ...prev,
                              name: prev.name || username || '',
                              email: '' // Never prefill email by default
                            }));
                            setShowFeedbackModal(true);
                          }}
                          className="px-2.5 py-1 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)] border border-cyan-400/40 hover:border-cyan-300 flex items-center gap-1.5 transition-all cursor-pointer ml-2 hover:scale-[1.03] active:scale-[0.98]"
                          title="Share feedback or report an issue"
                        >
                          <MessageSquareShare size={12} className="text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
                          <span>Feedback</span>
                        </button>
                      </div>

                      {/* Right: Window Controls */}
                      <div className="flex items-center gap-1 no-drag">
                        <button onClick={handleShrinkWindow} className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors cursor-pointer">
                          <ZoomOut size={14} />
                        </button>
                        <button onClick={() => ipcRenderer.invoke('resize-window', 50, 50)} className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors cursor-pointer">
                          <ZoomIn size={14} />
                        </button>
                        <button onClick={() => ipcRenderer.send('toggle-fullscreen')} className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors cursor-pointer">
                          <Maximize size={14} />
                        </button>
                        <button onClick={restartApp} className="p-1.5 hover:bg-cyan-500/20 rounded-lg text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer">
                          <RefreshCw size={14} />
                        </button>
                        <button onClick={minimizeApp} className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors cursor-pointer">
                          <Minus size={14} />
                        </button>
                        <button onClick={closeApp} className="p-1.5 hover:bg-rose-500/20 rounded-lg text-white/60 hover:text-rose-400 transition-colors cursor-pointer">
                          <X size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Bottom Tier (Tier 2): Command Ribbon & Action Bar */}
                    <div className="w-full px-5 py-2 flex items-center justify-between bg-white/[0.015]">
                      {/* Left: Electric Blue Update Button & Stealth Mode Toggle */}
                      <div className="flex items-center gap-3 no-drag">
                        {/* Always-Visible Electric Blue Update Button matching START INTERVIEW */}
                        <motion.button
                          whileHover={{ scale: 1.04, boxShadow: "0 0 25px rgba(6,182,212,0.6)" }}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => {
                            if (updateStatus === 'available') {
                              setShowUpdateModal(true);
                              handleDownloadUpdate();
                            } else if (updateStatus === 'downloaded') {
                              handleRestartToInstall();
                            } else {
                              setShowUpdateModal(true);
                              handleCheckForUpdates();
                            }
                          }}
                          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all border cursor-pointer ${
                            (updateStatus === 'available')
                              ? 'bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 text-black shadow-[0_0_25px_rgba(6,182,212,0.85)] border-cyan-200/90 animate-pulse'
                              : (updateStatus === 'downloaded')
                              ? 'bg-gradient-to-r from-emerald-400 to-teal-500 text-black shadow-[0_0_25px_rgba(16,185,129,0.8)] border-emerald-300 animate-bounce'
                              : (updateStatus === 'downloading')
                              ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/50 shadow-[0_0_20px_rgba(6,182,212,0.7)] animate-pulse'
                              : (updateStatus === 'not-available')
                              ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 shadow-sm hover:bg-emerald-500/25'
                              : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white border-cyan-400/50 shadow-[0_0_20px_rgba(6,182,212,0.4)]'
                          }`}
                        >
                          {updateStatus === 'downloading' ? (
                            <>
                              <Loader2 size={13} className="animate-spin text-cyan-200" />
                              <span>Downloading {downloadProgress.percent}%</span>
                            </>
                          ) : updateStatus === 'downloaded' ? (
                            <>
                              <Sparkles size={13} className="text-black" />
                              <span>Restart & Install v{updateInfo.version || appVersion}</span>
                            </>
                          ) : updateStatus === 'available' ? (
                            <>
                              <span className="relative flex h-2.5 w-2.5 mr-0.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-200 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-black"></span>
                              </span>
                              <Sparkles size={13} className="text-black" />
                              <span>Update v{updateInfo.version || appVersion} Ready!</span>
                            </>
                          ) : updateStatus === 'not-available' ? (
                            <>
                              <CheckCircle2 size={13} className="text-emerald-400" />
                              <span>Up to Date (v{appVersion})</span>
                            </>
                          ) : updateStatus === 'checking' ? (
                            <>
                              <RefreshCw size={12} className="animate-spin text-white" />
                              <span>Checking Server...</span>
                            </>
                          ) : (
                            <>
                              <RefreshCw size={12} className="text-white" />
                              <span>Check Updates</span>
                            </>
                          )}
                        </motion.button>

                        {/* Stealth Shield Button - Compact Glowing Icon */}
                        <button
                          onClick={() => {
                            if (stealthMode) {
                              setShowStealthWarning(true);
                            } else {
                              setStealthMode(true);
                              ipcRenderer.invoke('set-stealth', true);
                            }
                          }}
                          className={`p-2 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-sm border cursor-pointer ${stealthMode
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.35)]'
                            : 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.35)] animate-pulse'
                            }`}
                        >
                          {stealthMode ? <ShieldCheck size={16} className="text-emerald-400" /> : <ShieldAlert size={16} className="text-rose-400" />}
                        </button>
                      </div>

                      {/* Middle: Centered Storage Breakdown (Software & User Data with Break) */}
                      <div className="flex items-center justify-center no-drag">
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => setShowStorageModal(true)}
                          className={`flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                            storageInfo.isFull
                              ? 'bg-rose-500/25 border-rose-500 text-rose-300 animate-pulse shadow-[0_0_15px_rgba(244,63,94,0.4)]'
                              : storageInfo.isFilling
                              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                              : 'bg-white/[0.04] hover:bg-white/[0.08] text-white/90 border-white/10 hover:border-cyan-500/40 shadow-sm'
                          }`}
                          title="Click to view software storage, user data breakdown, and manage disk space"
                        >
                          <HardDrive size={13} className={storageInfo.isFull ? 'text-rose-400 animate-bounce' : storageInfo.isFilling ? 'text-amber-400' : 'text-cyan-400'} />
                          <div className="flex items-center gap-2 font-medium">
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] uppercase font-bold text-white/50 tracking-wider">Software:</span>
                              <span className="text-[11px] text-cyan-300 font-mono font-bold">{storageInfo.softwareStorageFormatted || '830 MB'}</span>
                            </div>

                            <span className="h-3.5 w-px bg-white/20 mx-0.5 shrink-0" />

                            <div className="flex items-center gap-1">
                              <span className="text-[10px] uppercase font-bold text-white/50 tracking-wider">User Data:</span>
                              <span className="text-[11px] text-emerald-400 font-mono font-bold">{storageInfo.userDataStorageFormatted || '45 MB'}</span>
                            </div>

                            <span className="h-3.5 w-px bg-white/20 mx-0.5 shrink-0" />

                            <div className="flex items-center gap-1">
                              <span className="text-[10px] uppercase font-bold text-white/50 tracking-wider">Disk Free:</span>
                              <span className={`text-[11px] font-mono font-bold ${storageInfo.isFull ? 'text-rose-400' : storageInfo.isFilling ? 'text-amber-300' : 'text-white/80'}`}>
                                {storageInfo.freeStorageGB} GB
                              </span>
                            </div>
                          </div>

                          {storageInfo.isFilling && !storageInfo.isFull && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-500/30 text-amber-200 border border-amber-400/40 rounded-full animate-pulse ml-1">
                              {storageInfo.usedPercent}% Used
                            </span>
                          )}
                          {storageInfo.isFull && (
                            <span className="px-1.5 py-0.5 text-[9px] font-black bg-rose-500/40 text-rose-200 border border-rose-400/50 rounded-full animate-pulse ml-1">
                              100% FULL
                            </span>
                          )}
                        </motion.button>
                      </div>

                      {/* Right: Info, Settings & Primary START INTERVIEW CTA */}
                      <div className="flex items-center gap-2.5 no-drag">

                        <button
                          onClick={() => setShowInfo(!showInfo)}
                          className={`p-2 rounded-xl transition-all border cursor-pointer ${showInfo ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' : 'bg-white/[0.04] text-white/70 hover:text-white border-white/10 hover:bg-white/10'}`}
                        >
                          <Info size={15} />
                        </button>

                        <button
                          onClick={() => { if (!showSettings) setLocalSettingsStealth(stealthMode); setShowSettings(!showSettings); }}
                          className={`p-2 rounded-xl transition-all border cursor-pointer ${showSettings ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' : 'bg-white/[0.04] text-white/70 hover:text-white border-white/10 hover:bg-white/10'}`}
                        >
                          <Settings size={15} />
                        </button>

                        <button
                          onClick={handleStartCaptureClick}
                          className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white px-5 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] border border-cyan-400/40 cursor-pointer"
                        >
                          <Play size={13} fill="currentColor" /> Start Interview
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Full-Screen Info Modal with Framer Motion */}
              <AnimatePresence>
                {showInfo && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-[300] bg-black/45 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 overflow-hidden pointer-events-auto"
                  >
                    <motion.div
                      initial={{ opacity: 0, scale: 0.94, y: 15 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.94, y: 15 }}
                      transition={{ type: "spring", stiffness: 380, damping: 28 }}
                      className="w-full max-w-4xl max-h-[92vh] h-full bg-[#0a0b12]/95 backdrop-blur-3xl border border-cyan-500/30 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_35px_rgba(6,182,212,0.15)] flex flex-col overflow-hidden"
                    >
                      <div className="w-full flex-shrink-0 bg-brand-bg/95 py-4 px-6 border-b border-brand-border">
                        <div className="max-w-3xl mx-auto flex justify-between items-end">
                          <div>
                            <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
                              <div className="p-2 bg-brand-accent/20 rounded-xl">
                                <Info size={28} className="text-brand-accent" />
                              </div>
                              Information Guide
                            </h2>
                            <p className="text-brand-subtext text-sm mt-2">Everything you need to know to use ClueAI effectively.</p>
                          </div>
                          <button onClick={() => setShowInfo(false)} className="bg-brand-secondary hover:bg-brand-border hover:scale-105 active:scale-95 text-brand-text px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2">
                            Close <X size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                        <div className="max-w-3xl w-full mx-auto space-y-10 pb-10 select-none cursor-default">

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Core Information */}
                            <div className="bg-gradient-to-br from-brand-secondary to-brand-card p-6 rounded-2xl border border-white/5 shadow-lg flex flex-col gap-3 md:col-span-2 group hover:border-white/10 transition-colors">
                              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-2">
                                <Info size={20} />
                              </div>
                              <h3 className="text-lg font-bold text-white">What is ClueAI?</h3>
                              <p className="text-brand-subtext text-sm leading-relaxed">ClueAI is an advanced, ultra-stealthy AI copilot designed to help you ace your interviews and tests. It secretly records system audio and captures screen snapshots, feeding them to state-of-the-art AI models (Groq and Gemini) to provide you with instant, perfectly accurate answers and hints on your screen—all completely invisible to screen sharing software.</p>
                            </div>

                            {/* Keyboard Shortcuts - Full Width with Proper Alignment & No All-Caps */}
                            <div className="bg-gradient-to-br from-brand-secondary to-brand-card p-6 rounded-2xl border border-white/5 shadow-lg flex flex-col gap-5 md:col-span-2 group hover:border-white/10 transition-colors">
                              <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                                  <Keyboard size={20} />
                                </div>
                                <div>
                                  <h3 className="text-lg font-bold text-white">Keyboard Shortcuts Guide</h3>
                                  <p className="text-brand-subtext text-xs">Control ClueAI seamlessly during interviews without touching your mouse.</p>
                                </div>
                              </div>

                              <div className="space-y-5">
                                {/* Interview Controls */}
                                <div>
                                  <h4 className="text-sm font-bold text-cyan-400 tracking-wide mb-1.5 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                                    Interview Controls (Toggleable)
                                  </h4>
                                  <p className="text-brand-subtext text-xs leading-relaxed mb-3">
                                    These shortcuts work during active interview recording. You can toggle them on or off using the Hotkeys switch.
                                  </p>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
                                    <div className="bg-black/40 p-2.5 rounded-xl border border-white/5 flex items-center justify-between">
                                      <span className="text-white/80">Pause / Resume</span>
                                      <span className="bg-white/10 text-cyan-300 font-mono font-bold px-2 py-0.5 rounded border border-white/10">1 / Z</span>
                                    </div>
                                    <div className="bg-black/40 p-2.5 rounded-xl border border-white/5 flex items-center justify-between">
                                      <span className="text-white/80">Ask AI (Trigger)</span>
                                      <span className="bg-white/10 text-cyan-300 font-mono font-bold px-2 py-0.5 rounded border border-white/10">2 / X</span>
                                    </div>
                                    <div className="bg-black/40 p-2.5 rounded-xl border border-white/5 flex items-center justify-between">
                                      <span className="text-white/80">Clear Transcript</span>
                                      <span className="bg-white/10 text-cyan-300 font-mono font-bold px-2 py-0.5 rounded border border-white/10">3 / C</span>
                                    </div>
                                    <div className="bg-black/40 p-2.5 rounded-xl border border-white/5 flex items-center justify-between">
                                      <span className="text-white/80">Snipping Tool</span>
                                      <span className="bg-white/10 text-cyan-300 font-mono font-bold px-2 py-0.5 rounded border border-white/10">4 / A</span>
                                    </div>
                                    <div className="bg-black/40 p-2.5 rounded-xl border border-white/5 flex items-center justify-between">
                                      <span className="text-white/80">Switch AI Model</span>
                                      <span className="bg-white/10 text-cyan-300 font-mono font-bold px-2 py-0.5 rounded border border-white/10">5 / S</span>
                                    </div>
                                    <div className="bg-black/40 p-2.5 rounded-xl border border-white/5 flex items-center justify-between">
                                      <span className="text-white/80">Stop Generation</span>
                                      <span className="bg-white/10 text-cyan-300 font-mono font-bold px-2 py-0.5 rounded border border-white/10">6 / D</span>
                                    </div>
                                    <div className="bg-black/40 p-2.5 rounded-xl border border-white/5 flex items-center justify-between">
                                      <span className="text-white/80">Edit Transcript</span>
                                      <span className="bg-white/10 text-cyan-300 font-mono font-bold px-2 py-0.5 rounded border border-white/10">7 / Q</span>
                                    </div>
                                    <div className="bg-black/40 p-2.5 rounded-xl border border-white/5 flex items-center justify-between">
                                      <span className="text-white/80">Session History</span>
                                      <span className="bg-white/10 text-cyan-300 font-mono font-bold px-2 py-0.5 rounded border border-white/10">8 / H</span>
                                    </div>
                                    <div className="bg-black/40 p-2.5 rounded-xl border border-white/5 flex items-center justify-between">
                                      <span className="text-white/80">Change Code Language</span>
                                      <span className="bg-white/10 text-cyan-300 font-mono font-bold px-2 py-0.5 rounded border border-white/10">9</span>
                                    </div>
                                    <div className="bg-black/40 p-2.5 rounded-xl border border-white/5 flex items-center justify-between">
                                      <span className="text-white/80">Toggle Color</span>
                                      <span className="bg-white/10 text-cyan-300 font-mono font-bold px-2 py-0.5 rounded border border-white/10">0</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Stealth Scrolling & Window Navigation */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 border-t border-white/5">
                                  <div>
                                    <h4 className="text-sm font-bold text-emerald-400 tracking-wide mb-1.5">
                                      Stealth Scrolling (Always Active)
                                    </h4>
                                    <div className="bg-black/40 p-3 rounded-xl border border-white/5 text-xs text-brand-subtext leading-relaxed">
                                      Hold <kbd className="bg-black/60 border border-white/20 px-1.5 py-0.5 rounded font-mono text-white">Alt</kbd> + <kbd className="bg-black/60 border border-white/20 px-1.5 py-0.5 rounded font-mono text-white">↑ / ↓</kbd> or <kbd className="bg-black/60 border border-white/20 px-1.5 py-0.5 rounded font-mono text-white">PgUp / PgDn</kbd> to quietly scroll text during meetings without touching your mouse.
                                    </div>
                                  </div>

                                  <div>
                                    <h4 className="text-sm font-bold text-purple-400 tracking-wide mb-1.5">
                                      Global Launch & App Control
                                    </h4>
                                    <div className="bg-black/40 p-3 rounded-xl border border-white/5 text-xs text-brand-subtext leading-relaxed space-y-2">
                                      <div className="flex items-center justify-between">
                                        <span className="flex flex-col">
                                          <span className="text-white/90 font-medium">Show / Hide ClueAI</span>
                                          <span className="text-[10px] text-white/40">Only hotkey active when minimized</span>
                                        </span>
                                        <kbd className="bg-black/60 border border-white/20 px-1.5 py-0.5 rounded font-mono text-purple-300">Ctrl + Shift + K</kbd>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <span className="flex flex-col">
                                          <span className="text-white/90 font-medium">Safe Reload (Keeps Data)</span>
                                          <span className="text-[10px] text-white/40">Restarts without clearing storage</span>
                                        </span>
                                        <kbd className="bg-black/60 border border-white/20 px-1.5 py-0.5 rounded font-mono text-cyan-300">Ctrl + Shift + R</kbd>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <span className="flex flex-col">
                                          <span className="text-white/90 font-medium">Emergency Close & Kill Processes</span>
                                          <span className="text-[10px] text-white/40">Immediately kills all background tasks</span>
                                        </span>
                                        <kbd className="bg-black/60 border border-white/20 px-1.5 py-0.5 rounded font-mono text-rose-300">Ctrl + Shift + X</kbd>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Sessions */}
                            <div className="bg-gradient-to-br from-brand-secondary to-brand-card p-6 rounded-2xl border border-white/5 shadow-lg flex flex-col gap-3 group hover:border-white/10 transition-colors">
                              <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center mb-2">
                                <FileText size={20} />
                              </div>
                              <h3 className="text-lg font-bold text-white">Sessions & Transcripts</h3>
                              <p className="text-brand-subtext text-sm leading-relaxed">Every time you start an interview, ClueAI creates a <strong>Session</strong>. Sessions automatically save your full transcript and all AI answers locally. You can review past sessions by clicking the <strong>History icon</strong> in the dashboard to review what questions were asked and how the AI answered them.</p>
                            </div>

                            {/* Reminders */}
                            <div className="bg-gradient-to-br from-brand-secondary to-brand-card p-6 rounded-2xl border border-white/5 shadow-lg flex flex-col gap-3 group hover:border-white/10 transition-colors">
                              <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center mb-2">
                                <Layout size={20} />
                              </div>
                              <h3 className="text-lg font-bold text-white">Dashboard Reminders</h3>
                              <p className="text-brand-subtext text-sm leading-relaxed">You can schedule upcoming interviews using Reminders. When you click <strong>"Start Interview"</strong> directly from a Reminder, ClueAI injects the candidate's name, role, and details into the AI prompt, making the answers highly personalized.</p>
                            </div>

                            {/* Settings */}
                            <div className="bg-gradient-to-br from-brand-secondary to-brand-card p-6 rounded-2xl border border-white/5 shadow-lg flex flex-col gap-3 group hover:border-white/10 transition-colors">
                              <div className="w-10 h-10 rounded-xl bg-zinc-500/20 text-zinc-400 flex items-center justify-center mb-2">
                                <Settings size={20} />
                              </div>
                              <h3 className="text-lg font-bold text-white">Settings Configuration</h3>
                              <p className="text-brand-subtext text-sm leading-relaxed">In Settings, you can configure your <strong>API Keys</strong> (Groq/Gemini), choose which screen or window to record, and set up your personal resume context. The AI uses your resume to answer behavioral questions from your personal experience.</p>
                            </div>

                            {/* Stealth Mode */}
                            <div className="bg-gradient-to-br from-brand-secondary to-brand-card p-6 rounded-2xl border border-white/5 shadow-lg flex flex-col gap-3 group hover:border-white/10 transition-colors">
                              <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center mb-2">
                                <EyeOff size={20} />
                              </div>
                              <h3 className="text-lg font-bold text-white">Stealth Mode & Security</h3>
                              <p className="text-brand-subtext text-sm leading-relaxed">ClueAI operates at the OS level to hide its window from Discord, Zoom, Teams, and browser screen-sharing. It also disables copying and standard mouse cursors (no hand pointers) to avoid giving away any hints on video streams.</p>
                            </div>

                            {/* Interview Buttons */}
                            <div className="bg-gradient-to-br from-brand-secondary to-brand-card p-6 rounded-2xl border border-white/5 shadow-lg flex flex-col gap-3 md:col-span-2 group hover:border-white/10 transition-colors">
                              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center mb-2">
                                <Mic size={20} />
                              </div>
                              <h3 className="text-lg font-bold text-white">Interview Section Controls</h3>
                              <ul className="text-brand-subtext text-sm leading-relaxed space-y-2 list-disc pl-4">
                                <li><strong>Next Q. (Pause/Resume):</strong> Temporarily stops audio processing so you can talk to the interviewer without the AI analyzing your voice.</li>
                                <li><strong>Snip UI:</strong> Takes a visual screenshot of your screen to send to Gemini Vision for coding or visual questions.</li>
                                <li><strong>Clear:</strong> Wipes the transcript so the AI doesn't get confused by previous topics.</li>
                                <li><strong>Stop:</strong> Ends the session entirely, saving it to history, and returns you to the Main Dashboard.</li>
                                <li><strong>Model Selector:</strong> Switch between Groq (Fastest Text) and Gemini (Vision capabilities) instantly.</li>
                                <li><strong>Hotkeys Toggle:</strong> Temporarily disables global shortcuts so you can type numbers or letters normally in other applications.</li>
                              </ul>
                            </div>

                            {/* API Keys Guide */}
                            <div className="bg-gradient-to-br from-brand-secondary to-brand-card p-6 rounded-2xl border border-white/5 shadow-lg flex flex-col gap-3 md:col-span-2 group hover:border-white/10 transition-colors">
                              <div className="w-10 h-10 rounded-xl bg-green-500/20 text-green-400 flex items-center justify-center mb-2">
                                <Key size={20} />
                              </div>
                              <h3 className="text-lg font-bold text-white">How to get API Keys (Free)</h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-2">
                                <div className="space-y-2">
                                  <h4 className="text-white font-bold text-sm border-b border-white/10 pb-2">Getting Groq Keys (For Audio & Fast Text)</h4>
                                  <ol className="text-brand-subtext text-xs leading-relaxed space-y-2 list-decimal pl-4">
                                    <li>Go to <a href="#" onClick={(e) => { e.preventDefault(); ipcRenderer.invoke('minimize-window'); shell.openExternal('https://console.groq.com/keys'); }} className="text-blue-400 hover:underline">console.groq.com/keys</a> and log in.</li>
                                    <li>Click on <strong>Create API Key</strong> in the top right.</li>
                                    <li>Copy the key (it starts with `gsk_`).</li>
                                    <li>Paste it into the Groq API Key field in ClueAI Settings.</li>
                                    <li><em>Note: Groq is free but rate-limited. Add multiple keys to avoid interruptions!</em></li>
                                  </ol>
                                </div>
                                <div className="space-y-2">
                                  <h4 className="text-white font-bold text-sm border-b border-white/10 pb-2">Getting Gemini Keys (For Snapshots)</h4>
                                  <ol className="text-brand-subtext text-xs leading-relaxed space-y-2 list-decimal pl-4">
                                    <li>Go to <a href="#" onClick={(e) => { e.preventDefault(); ipcRenderer.invoke('minimize-window'); shell.openExternal('https://aistudio.google.com/app/apikey'); }} className="text-blue-400 hover:underline">aistudio.google.com/app/apikey</a> and log in.</li>
                                    <li>Click <strong>Create API Key</strong> and select an existing project or create a new one.</li>
                                    <li>Copy the generated key (it starts with `AIzaSy` or `AQ.`).</li>
                                    <li>Paste it into the Gemini API Key field in ClueAI Settings.</li>
                                    <li><em>Note: Gemini is extremely powerful for visual coding questions!</em></li>
                                  </ol>
                                </div>
                                <div className="space-y-2">
                                  <h4 className="text-white font-bold text-sm border-b border-white/10 pb-2">Getting Claude Keys (Best for Coding)</h4>
                                  <ol className="text-brand-subtext text-xs leading-relaxed space-y-2 list-decimal pl-4">
                                    <li>Go to <a href="#" onClick={(e) => { e.preventDefault(); ipcRenderer.invoke('minimize-window'); shell.openExternal('https://console.anthropic.com/settings/keys'); }} className="text-blue-400 hover:underline">console.anthropic.com/settings/keys</a> and log in.</li>
                                    <li><strong>Important:</strong> You must verify a <strong>brand new phone number</strong> (not just an email) to get $5 free. If it doesn't give you $5, Anthropic may have stopped the free promotion in your region.</li>
                                    <li>Click <strong>Create Key</strong> and copy it (starts with `sk-ant-`).</li>
                                    <li>Paste it into the Claude API Key field in ClueAI Settings.</li>
                                  </ol>
                                </div>
                                <div className="space-y-2">
                                  <h4 className="text-white font-bold text-sm border-b border-white/10 pb-2">Getting ChatGPT Keys (Smart All-Rounder)</h4>
                                  <ol className="text-brand-subtext text-xs leading-relaxed space-y-2 list-decimal pl-4">
                                    <li>Go to <a href="#" onClick={(e) => { e.preventDefault(); ipcRenderer.invoke('minimize-window'); shell.openExternal('https://platform.openai.com/api-keys'); }} className="text-blue-400 hover:underline">platform.openai.com/api-keys</a> and log in.</li>
                                    <li>Create a new account with a unique phone number for free credits.</li>
                                    <li>Click <strong>Create new secret key</strong> and copy it (starts with `sk-`).</li>
                                    <li>Paste it into the ChatGPT API Key fields (up to 3 for rotation).</li>
                                    <li><em>Note: ChatGPT keys automatically rotate during use to bypass limits.</em></li>
                                  </ol>
                                </div>
                                <div className="space-y-2 md:col-span-2 lg:col-span-1">
                                  <h4 className="text-white font-bold text-sm border-b border-white/10 pb-2">Getting DeepSeek Keys (Lightning Fast Code)</h4>
                                  <ol className="text-brand-subtext text-xs leading-relaxed space-y-2 list-decimal pl-4">
                                    <li>Go to <a href="#" onClick={(e) => { e.preventDefault(); ipcRenderer.invoke('minimize-window'); shell.openExternal('https://platform.deepseek.com/api_keys'); }} className="text-blue-400 hover:underline">platform.deepseek.com/api_keys</a> and log in.</li>
                                    <li>Click <strong>Create new API key</strong> and copy it.</li>
                                    <li>DeepSeek is extremely cheap but requires adding a small balance (Top-up).</li>
                                    <li>Paste it into the DeepSeek API Key fields (up to 3 for rotation).</li>
                                    <li><em>Note: Your DeepSeek account balance is automatically checked and shown!</em></li>
                                  </ol>
                                </div>
                                <div className="space-y-2 md:col-span-2 lg:col-span-1">
                                  <h4 className="text-white font-bold text-sm border-b border-white/10 pb-2">Getting NVIDIA / GLM Keys (Free Llama 3)</h4>
                                  <ol className="text-brand-subtext text-xs leading-relaxed space-y-2 list-decimal pl-4">
                                    <li>Go to <a href="#" onClick={(e) => { e.preventDefault(); ipcRenderer.invoke('minimize-window'); shell.openExternal('https://build.nvidia.com/meta/llama-3_1-70b-instruct'); }} className="text-blue-400 hover:underline">build.nvidia.com</a> for NVIDIA NIM or <a href="#" onClick={(e) => { e.preventDefault(); ipcRenderer.invoke('minimize-window'); shell.openExternal('https://bigmodel.cn/'); }} className="text-blue-400 hover:underline">bigmodel.cn</a> for GLM.</li>
                                    <li>NVIDIA NIM gives you 1,000 free API credits automatically upon signup!</li>
                                    <li>GLM gives you 25,000,000 free API tokens upon signup!</li>
                                    <li>Click <strong>Get API Key</strong> on either site and copy the generated key.</li>
                                    <li>Paste it directly into the GLM/NVIDIA API Key fields (it automatically detects which provider you pasted).</li>
                                  </ol>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Compact Startup Update Popup (Work 3) */}
              <AnimatePresence>
                {showStartupUpdatePopup && !showUpdateModal && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    transition={{ type: "spring", stiffness: 400, damping: 28 }}
                    className="fixed bottom-6 right-6 z-50 pointer-events-auto max-w-sm w-full p-4 rounded-2xl bg-[#090b14]/95 border border-cyan-400/50 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_30px_rgba(6,182,212,0.25)] backdrop-blur-2xl flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500/25 to-blue-600/25 border border-cyan-400/40 text-cyan-300 flex items-center justify-center shrink-0 shadow-inner">
                          <Sparkles size={16} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-black text-white">Update Ready</h4>
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-400/40">
                              v{updateInfo.version || '5.6.5'}
                            </span>
                          </div>
                          <p className="text-[11px] text-white/60 mt-0.5">A new version of ClueAI is ready to install.</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowStartupUpdatePopup(false)}
                        className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                        title="Dismiss"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-white/10">
                      <button
                        onClick={() => setShowStartupUpdatePopup(false)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                      >
                        Later
                      </button>
                      <button
                        onClick={() => {
                          setShowStartupUpdatePopup(false);
                          setShowUpdateModal(true);
                          handleDownloadUpdate();
                        }}
                        className="px-4 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black shadow-[0_0_15px_rgba(6,182,212,0.5)] transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <Download size={13} /> Update Now
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Modern Horizontal Update Center Modal with Framer Motion */}
              <AnimatePresence>
                {showUpdateModal && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-[400] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4 md:p-6 overflow-hidden pointer-events-auto"
                  >
                    <motion.div
                      initial={{ scale: 0.94, opacity: 0, y: 15 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.94, opacity: 0, y: 15 }}
                      transition={{ type: "spring", stiffness: 380, damping: 28 }}
                      className="bg-[#0a0b12]/95 backdrop-blur-3xl border border-cyan-500/40 w-full max-w-4xl rounded-3xl p-6 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95),0_0_50px_rgba(6,182,212,0.2)] flex flex-col gap-4 relative max-h-[88vh] overflow-hidden"
                    >
                      {/* Modal Header */}
                      <div className="flex items-center justify-between pb-3.5 border-b border-white/10 shrink-0">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center shadow-inner">
                            <Sparkles size={20} className="text-cyan-300" />
                          </div>
                          <div>
                            <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                              ClueAI Update Center
                            </h2>
                            <p className="text-xs text-white/50">Official real-time updates powered by ClueAI Cloud Server</p>
                          </div>
                        </div>

                        <button
                          onClick={() => setShowUpdateModal(false)}
                          className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                        >
                          <X size={18} />
                        </button>
                      </div>

                      {/* Wide Horizontal Dual-Column Body */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 flex-1 min-h-0 overflow-hidden items-stretch">
                        {/* Left Column: Version Info, Progress & Action Controls */}
                        <div className="flex flex-col gap-3.5 justify-between">
                          <div className="space-y-3">
                            {/* Version Comparison Cards */}
                            <div className="grid grid-cols-2 gap-3">
                              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-3.5 flex flex-col gap-1">
                                <span className="text-[10px] font-black uppercase tracking-wider text-white/40">Current Installed</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-2xl font-black text-white">v{appVersion}</span>
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-white/10 text-white/70 border border-white/15">Active</span>
                                </div>
                              </div>

                              <div className={`border rounded-2xl p-3.5 flex flex-col gap-1 ${
                                updateStatus === 'available' || updateStatus === 'downloaded'
                                  ? 'bg-gradient-to-br from-cyan-500/10 to-blue-600/10 border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.15)]'
                                  : 'bg-white/[0.03] border-white/10'
                              }`}>
                                <span className="text-[10px] font-black uppercase tracking-wider text-white/40">Latest Available</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-2xl font-black text-white">
                                    v{updateInfo.version || appVersion}
                                  </span>
                                  {updateStatus === 'available' || updateStatus === 'downloaded' ? (
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 animate-pulse">
                                      New Release
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                      Up to Date
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Status Display Banner */}
                            {updateStatus === 'checking' && (
                              <div className="bg-cyan-500/10 border border-cyan-500/25 rounded-2xl p-3.5 flex items-center gap-3">
                                <Loader2 size={18} className="animate-spin text-cyan-400 shrink-0" />
                                <span className="text-xs text-cyan-200 font-medium">Connecting to update server... Verifying latest release...</span>
                              </div>
                            )}

                            {updateStatus === 'not-available' && (
                              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3.5 flex items-center gap-3">
                                <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                                <div>
                                  <p className="text-xs text-emerald-200 font-bold">You are using the latest version of ClueAI!</p>
                                  <p className="text-[11px] text-emerald-200/60 mt-0.5">Your system is fully up to date.</p>
                                </div>
                              </div>
                            )}

                            {updateStatus === 'error' && (
                              <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-3.5 flex items-center gap-3">
                                <AlertTriangle size={18} className="text-rose-400 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-rose-200 font-bold">Update Notice</p>
                                  <p className="text-[11px] text-rose-200/70 truncate">{updateInfo.message || 'Could not connect to update server'}</p>
                                </div>
                                <button
                                  onClick={handleCheckForUpdates}
                                  className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-bold rounded-lg transition-colors shrink-0 cursor-pointer"
                                >
                                  Retry
                                </button>
                              </div>
                            )}

                            {/* Real-Time Download Progress Bar */}
                            {updateStatus === 'downloading' && (
                              <div className="bg-white/[0.04] border border-cyan-500/40 rounded-2xl p-4 flex flex-col gap-2.5 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-bold text-white flex items-center gap-2">
                                    <Loader2 size={15} className="animate-spin text-cyan-400" />
                                    Downloading Update Package...
                                  </span>
                                  <span className="font-mono text-cyan-300 font-bold px-2 py-0.5 rounded-md bg-cyan-500/20 border border-cyan-500/30">
                                    {downloadProgress.percent}%
                                  </span>
                                </div>

                                {/* Progress track */}
                                <div className="w-full h-3 bg-black/60 rounded-full overflow-hidden border border-white/10 p-0.5 relative">
                                  <div
                                    className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 rounded-full transition-all duration-200 shadow-[0_0_12px_rgba(6,182,212,0.8)]"
                                    style={{ width: `${Math.max(downloadProgress.percent, 3)}%` }}
                                  />
                                </div>

                                <div className="flex items-center justify-between text-[11px] text-white/60 font-mono">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
                                    Speed: {downloadProgress.bytesPerSecond > 1024 * 1024
                                      ? `${(downloadProgress.bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`
                                      : `${Math.round(downloadProgress.bytesPerSecond / 1024)} KB/s`}
                                  </span>
                                  <span>
                                    {(downloadProgress.transferred / (1024 * 1024)).toFixed(1)} MB / {(downloadProgress.total / (1024 * 1024)).toFixed(1)} MB
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Primary CTA Buttons for Left Column */}
                          <div className="pt-2 flex flex-col gap-2.5">
                            {isInstallingUpdate ? (
                              <div className="bg-[#05060b] border border-cyan-400/60 rounded-2xl p-4 flex flex-col gap-3 shadow-[0_0_30px_rgba(6,182,212,0.35)]">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-bold text-white flex items-center gap-2">
                                    <Sparkles size={16} className="text-cyan-400 animate-spin" />
                                    {installStageText}
                                  </span>
                                  <span className="font-mono text-cyan-300 font-black px-2.5 py-0.5 rounded-md bg-cyan-500/20 border border-cyan-500/40 text-xs">
                                    {installProgress}%
                                  </span>
                                </div>
                                <div className="w-full h-3.5 bg-black/80 rounded-full overflow-hidden border border-cyan-500/30 p-0.5 relative">
                                  <div
                                    className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 rounded-full transition-all duration-300 shadow-[0_0_18px_rgba(6,182,212,0.9)]"
                                    style={{ width: `${installProgress}%` }}
                                  />
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-cyan-200/80 font-mono">
                                  <span>Auto-relaunching in seconds...</span>
                                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                                    Live
                                  </span>
                                </div>
                              </div>
                            ) : updateStatus === 'downloaded' ? (
                              <button
                                onClick={handleRestartToInstall}
                                className="w-full py-3 rounded-2xl text-xs font-black uppercase tracking-wider bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 hover:from-cyan-300 hover:to-blue-400 text-white shadow-[0_0_25px_rgba(6,182,212,0.6)] border border-cyan-300/60 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 animate-pulse cursor-pointer"
                              >
                                <Sparkles size={16} />
                                <span>Restart & Install Now</span>
                              </button>
                            ) : updateStatus === 'available' ? (
                              <button
                                onClick={handleDownloadUpdate}
                                className="w-full py-3 rounded-2xl text-xs font-black uppercase tracking-wider bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-[0_0_25px_rgba(6,182,212,0.5)] border border-cyan-400/50 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                              >
                                <Download size={16} />
                                <span>Download Update Package</span>
                              </button>
                            ) : null}

                            <div className="flex items-center gap-2">
                              <button
                                onClick={handleCheckForUpdates}
                                disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
                                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 hover:border-white/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                              >
                                <RefreshCw size={13} className={updateStatus === 'checking' ? 'animate-spin' : ''} />
                                <span>Check Again</span>
                              </button>

                              <button
                                onClick={() => setShowUpdateModal(false)}
                                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white/60 hover:text-white bg-white/[0.02] hover:bg-white/10 border border-white/5 transition-colors cursor-pointer"
                              >
                                Close
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Right Column: Dedicated "What's New in ClueAI" Pane */}
                        <div className="bg-[#05060b]/90 border border-white/10 rounded-2xl p-4 flex flex-col gap-2.5 h-full min-h-0 overflow-hidden shadow-inner">
                          <div className="flex items-center justify-between pb-2 border-b border-white/10 shrink-0">
                            <h3 className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                              <FileText size={14} />
                              What's New in {updateInfo.version ? `v${updateInfo.version}` : `v${appVersion}`}
                            </h3>
                            <span className="text-[10px] text-white/40 font-mono">Release Notes</span>
                          </div>

                          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-2 leading-relaxed text-xs">
                            {renderReleaseNotes(updateInfo.releaseNotes)}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ClueAI Storage Management Modal */}
              <AnimatePresence>
                {showStorageModal && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-[350] bg-black/45 backdrop-blur-sm flex items-center justify-center px-6 py-4 sm:px-12 md:px-20 overflow-hidden pointer-events-auto"
                  >
                    <motion.div
                      initial={{ scale: 0.94, opacity: 0, y: 15 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.94, opacity: 0, y: 15 }}
                      transition={{ type: "spring", stiffness: 380, damping: 28 }}
                      className="bg-[#0a0b12]/95 backdrop-blur-3xl border border-cyan-500/40 w-full max-w-xl mx-auto rounded-3xl p-5 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95),0_0_50px_rgba(6,182,212,0.2)] flex flex-col gap-4 relative max-h-[85vh] overflow-hidden"
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between pb-3.5 border-b border-white/10 shrink-0">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center shadow-inner">
                            <HardDrive size={20} className="text-cyan-300" />
                          </div>
                          <div>
                            <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                              ClueAI Storage & Disk Center
                            </h2>
                            <p className="text-xs text-white/50 font-medium">
                              Live laptop disk monitoring and application cache management
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => setShowStorageModal(false)}
                          className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                        >
                          <X size={18} />
                        </button>
                      </div>

                      {/* Main Grid: ClueAI Footprint & Laptop Disk */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {/* Card 1: ClueAI Application & User Data Breakdown */}
                        <div className="bg-[#05060b]/90 border border-white/10 rounded-2xl p-3.5 flex flex-col justify-between shadow-inner">
                          <div>
                            {/* Section A: Software Storage Footprint */}
                            <div className="pb-3 border-b border-white/5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400">
                                  Software Footprint
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                                  Core Protected
                                </span>
                              </div>
                              <div className="flex items-baseline gap-2 mt-1.5">
                                <span className="text-2xl font-black text-cyan-300 font-mono tracking-tight">
                                  {storageInfo.softwareStorageFormatted || '830 MB'}
                                </span>
                              </div>
                              <p className="text-[11px] text-white/50 mt-0.5 leading-relaxed">
                                Core Clue AI application binaries, Electron engine, and system packages.
                              </p>
                            </div>

                            {/* Section B: User Data & Sessions Footprint */}
                            <div className="pt-3">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                                  User Data & Sessions
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                  User Content
                                </span>
                              </div>
                              <div className="flex items-baseline gap-2 mt-1.5">
                                <span className="text-2xl font-black text-emerald-300 font-mono tracking-tight">
                                  {storageInfo.userDataStorageFormatted || '45 MB'}
                                </span>
                              </div>
                              <p className="text-[11px] text-white/50 mt-0.5 leading-relaxed">
                                Saved interview sessions, transcripts, audio caches, and cookies.
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-2">
                            {/* Delete User Data Button */}
                            <button
                              onClick={() => {
                                setDeleteUserDataInput('');
                                setShowDeleteUserDataConfirm(true);
                              }}
                              className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-rose-500/20 to-red-600/20 hover:from-rose-500/30 hover:to-red-600/30 text-rose-300 border border-rose-500/40 hover:border-rose-400 transition-all text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm hover:scale-[1.01]"
                              title="Delete user interview sessions, transcripts, and local caches while keeping the software intact"
                            >
                              <Trash2 size={13} className="text-rose-400" />
                              <span>Delete User Data</span>
                            </button>

                            {/* Clear Cache Quick Action */}
                            <button
                              onClick={() => {
                                setDeleteConfirmInput('');
                                setShowClearStorageConfirm(true);
                              }}
                              disabled={isClearingCache}
                              className={`py-2 px-3 rounded-xl border transition-all text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                                cacheClearedSuccess
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border-white/10'
                              }`}
                              title="Purge temporary buffer files and cache only"
                            >
                              {isClearingCache ? (
                                <Loader2 size={12} className="animate-spin text-cyan-400" />
                              ) : cacheClearedSuccess ? (
                                <CheckCircle2 size={12} className="text-emerald-400" />
                              ) : (
                                <RefreshCcw size={12} className="text-white/60" />
                              )}
                              <span>{cacheClearedSuccess ? "Cleared!" : "Cache"}</span>
                            </button>
                          </div>
                        </div>

                        {/* Card 2: Laptop Hard Drive Capacity */}
                        <div className="bg-[#05060b]/90 border border-white/10 rounded-2xl p-3.5 flex flex-col justify-between shadow-inner">
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black uppercase tracking-wider text-white/50">
                                Laptop Disk Status
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                storageInfo.isFull
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                  : storageInfo.isFilling
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              }`}>
                                {storageInfo.usedPercent}% Used
                              </span>
                            </div>

                            <div className="flex items-baseline gap-2 mt-2">
                              <span className="text-3xl font-black text-white font-mono tracking-tight">
                                {storageInfo.freeStorageGB}
                              </span>
                              <span className="text-xs text-white/50 font-bold uppercase">GB Free</span>
                            </div>
                            <p className="text-xs text-white/50 mt-1 leading-relaxed">
                              Total Capacity: {storageInfo.totalStorageGB} GB | Used: {storageInfo.usedStorageGB} GB
                            </p>
                          </div>

                          <div className="mt-4 pt-3 border-t border-white/5">
                            {/* Storage Gauge Bar */}
                            <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden p-0.5">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  storageInfo.isFull
                                    ? 'bg-gradient-to-r from-rose-500 to-red-600 shadow-[0_0_12px_rgba(244,63,94,0.6)]'
                                    : storageInfo.isFilling
                                    ? 'bg-gradient-to-r from-amber-400 to-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                                    : 'bg-gradient-to-r from-cyan-400 to-blue-500 shadow-[0_0_12px_rgba(6,182,212,0.5)]'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(5, storageInfo.usedPercent))}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Storage Alert Notice */}
                      {storageInfo.isFull ? (
                        <div className="bg-rose-500/15 border border-rose-500/40 rounded-2xl p-3.5 flex items-center gap-3 text-rose-200 text-xs">
                          <AlertTriangle size={18} className="text-rose-400 shrink-0 animate-bounce" />
                          <div className="leading-snug">
                            <strong className="text-rose-100 block">Critical Warning: Laptop Storage is 100% Full!</strong>
                            ClueAI cannot store temporary caches or audio recordings. Please clear cache or free drive space immediately.
                          </div>
                        </div>
                      ) : storageInfo.isFilling ? (
                        <div className="bg-amber-500/15 border border-amber-500/40 rounded-2xl p-3.5 flex items-center gap-3 text-amber-200 text-xs">
                          <AlertTriangle size={18} className="text-amber-400 shrink-0" />
                          <div className="leading-snug">
                            <strong className="text-amber-100 block">Notice: Laptop Storage Is Filling Up ({storageInfo.usedPercent}%)</strong>
                            Your primary disk is above 90% capacity. We recommend clearing ClueAI cache or Windows temp files.
                          </div>
                        </div>
                      ) : (
                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3.5 flex items-center gap-3 text-emerald-200 text-xs">
                          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                          <div className="leading-snug">
                            <strong className="text-emerald-100 block">Storage Healthy & Optimized</strong>
                            Plenty of high-speed NVMe/SSD headroom available for AI streaming and transcripts.
                          </div>
                        </div>
                      )}

                      {/* Footer Controls */}
                      <div className="flex items-center justify-between pt-2 border-t border-white/10 shrink-0">
                        <button
                          onClick={() => {
                            ipcRenderer.invoke('minimize-window');
                            shell.openExternal('ms-settings:storagesense');
                          }}
                          className="px-4 py-2 rounded-xl text-xs font-bold text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <Settings size={13} />
                          <span>Windows Storage Settings</span>
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleRefreshStorage}
                            disabled={isRefreshingStorage}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60 ${
                              storageRefreshedMsg
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                                : 'text-cyan-300 hover:text-cyan-200 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30'
                            }`}
                          >
                            <RefreshCw size={13} className={isRefreshingStorage ? "animate-spin text-cyan-300" : storageRefreshedMsg ? "text-emerald-400" : ""} />
                            <span>{isRefreshingStorage ? "Refreshing..." : storageRefreshedMsg ? "Refreshed!" : "Refresh"}</span>
                          </button>

                          <button
                            onClick={() => setShowStorageModal(false)}
                            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-white/10 hover:bg-white/20 border border-white/10 transition-colors cursor-pointer"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Clear Storage Cache Confirmation Modal */}
              <AnimatePresence>
                {showClearStorageConfirm && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[700] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto select-none"
                  >
                    <motion.div
                      initial={{ scale: 0.94, opacity: 0, y: 10 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.94, opacity: 0, y: 10 }}
                      transition={{ type: "spring", stiffness: 400, damping: 28 }}
                      className="bg-[#0e090c] border border-rose-500/50 w-full max-w-md rounded-2xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_35px_rgba(244,63,94,0.25)] flex flex-col gap-4 text-center"
                    >
                      <div className="w-12 h-12 rounded-xl bg-rose-500/20 border border-rose-500/50 flex items-center justify-center mx-auto text-rose-400">
                        <AlertTriangle size={24} />
                      </div>

                      <div>
                        <h3 className="text-lg font-black text-white">Confirm Storage Cache Purge</h3>
                        <p className="text-xs text-rose-200/70 mt-1.5 leading-relaxed">
                          This will purge temporary audio buffers, cache files, and logs ({storageInfo.appStorageFormatted}). Your API keys and interview preferences will remain intact.
                        </p>
                      </div>

                      <div className="bg-black/40 border border-white/10 rounded-xl p-3 text-left">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 block mb-1">
                          Type <span className="text-rose-400 font-mono font-black">DELETE</span> to confirm:
                        </label>
                        <input
                          type="text"
                          value={deleteConfirmInput}
                          onChange={(e) => setDeleteConfirmInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && deleteConfirmInput.trim().toUpperCase() === 'DELETE') {
                              e.preventDefault();
                              setShowClearStorageConfirm(false);
                              handleClearCache();
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              setShowClearStorageConfirm(false);
                            }
                          }}
                          placeholder="DELETE"
                          autoFocus
                          className="w-full bg-white/5 border border-white/15 focus:border-rose-400 rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-white/30 outline-none transition-colors"
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => setShowClearStorageConfirm(false)}
                          className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            if (deleteConfirmInput.trim().toUpperCase() === 'DELETE') {
                              setShowClearStorageConfirm(false);
                              handleClearCache();
                            }
                          }}
                          disabled={deleteConfirmInput.trim().toUpperCase() !== 'DELETE' || isClearingCache}
                          className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                            deleteConfirmInput.trim().toUpperCase() === 'DELETE'
                              ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-[0_0_20px_rgba(244,63,94,0.5)] border border-rose-400'
                              : 'bg-white/10 text-white/40 border border-white/5'
                          }`}
                        >
                          <Trash2 size={13} />
                          <span>Delete Cache</span>
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* User Data Deletion Safety Confirmation Modal */}
              <AnimatePresence>
                {showDeleteUserDataConfirm && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[800] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto select-none"
                  >
                    <motion.div
                      initial={{ scale: 0.94, opacity: 0, y: 12 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.94, opacity: 0, y: 12 }}
                      transition={{ type: "spring", stiffness: 380, damping: 28 }}
                      className="bg-[#0e090f] border border-rose-500/50 w-full max-w-md rounded-3xl p-6 shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_40px_rgba(244,63,94,0.3)] flex flex-col gap-4 text-center"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/50 flex items-center justify-center mx-auto text-rose-400 shadow-[0_0_25px_rgba(244,63,94,0.35)]">
                        <Trash2 size={26} className={isDeletingUserData ? "animate-pulse" : ""} />
                      </div>

                      <div>
                        <h3 className="text-xl font-black text-white">Delete User Data Only</h3>
                        <p className="text-xs text-rose-200/75 mt-1.5 leading-relaxed">
                          This will permanently delete your stored interview sessions, transcripts, audio caches, and local cookies ({storageInfo.userDataStorageFormatted || '45 MB'}).
                          <br />
                          <strong className="text-white mt-1 block font-bold">
                            Your ClueAI software installation ({storageInfo.softwareStorageFormatted || '830 MB'}) and core engine will remain 100% safe.
                          </strong>
                        </p>
                      </div>

                      {isDeletingUserData ? (
                        <div className="bg-black/50 border border-rose-500/30 rounded-2xl p-5 flex flex-col items-center justify-center gap-3">
                          <div className="relative w-12 h-12 flex items-center justify-center">
                            <div className="absolute inset-0 rounded-full border-2 border-rose-500/20 border-t-rose-400 animate-spin" />
                            <Loader2 size={20} className="text-rose-400 animate-spin" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-white block">
                              {userDataPurgeStage === 'clearing-cache' && "1/3: Purging audio buffers & caches..."}
                              {userDataPurgeStage === 'clearing-sessions' && "2/3: Deleting interview sessions & transcripts..."}
                              {userDataPurgeStage === 'rebuilding' && "3/3: Rebuilding clean user profile..."}
                              {userDataPurgeStage === 'done' && "User data deleted!"}
                            </span>
                            <span className="text-[10px] text-white/40 mt-0.5 block">
                              Deleting user data with zero interruption to software...
                            </span>
                          </div>
                        </div>
                      ) : userDataDeletedSuccess ? (
                        <div className="bg-emerald-500/15 border border-emerald-500/40 rounded-2xl p-5 flex flex-col items-center justify-center gap-2 text-emerald-200">
                          <CheckCircle2 size={32} className="text-emerald-400 animate-bounce" />
                          <span className="text-sm font-bold text-white">User Data Deleted Successfully!</span>
                          <span className="text-[11px] text-emerald-300/80">Software is clean, fresh, and fully intact.</span>
                        </div>
                      ) : (
                        <div className="bg-black/40 border border-white/10 rounded-2xl p-3.5 text-left">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 block mb-1.5">
                            Type <span className="text-rose-400 font-mono font-black">DELETE</span> to confirm:
                          </label>
                          <input
                            type="text"
                            value={deleteUserDataInput}
                            onChange={(e) => setDeleteUserDataInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && deleteUserDataInput.trim().toUpperCase() === 'DELETE' && !isDeletingUserData) {
                                e.preventDefault();
                                handleDeleteUserData();
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                setShowDeleteUserDataConfirm(false);
                              }
                            }}
                            placeholder="DELETE"
                            autoFocus
                            className="w-full bg-white/5 border border-white/15 focus:border-rose-400 rounded-xl px-3.5 py-2 text-sm font-mono text-white placeholder-white/30 outline-none transition-colors"
                          />
                        </div>
                      )}

                      {!isDeletingUserData && !userDataDeletedSuccess && (
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setShowDeleteUserDataConfirm(false)}
                            className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleDeleteUserData}
                            disabled={deleteUserDataInput.trim().toUpperCase() !== 'DELETE'}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                              deleteUserDataInput.trim().toUpperCase() === 'DELETE'
                                ? 'bg-gradient-to-r from-rose-600 via-rose-500 to-red-600 text-white shadow-[0_0_25px_rgba(244,63,94,0.6)] border border-rose-400 hover:scale-[1.02] active:scale-[0.98]'
                                : 'bg-white/10 text-white/40 border border-white/5'
                            }`}
                          >
                            <Trash2 size={13} />
                            <span>Delete User Data</span>
                          </button>
                        </div>
                      )}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Critical 100% Storage Full Full-Screen Blocking Modal */}
              <AnimatePresence>
                {storageInfo.isFull && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[99999] bg-[#05060b]/98 backdrop-blur-3xl flex items-center justify-center p-6 select-none pointer-events-auto"
                  >
                    <motion.div
                      initial={{ scale: 0.9, y: 20 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0.9, y: 20 }}
                      transition={{ type: "spring", stiffness: 350, damping: 25 }}
                      className="bg-gradient-to-b from-[#18080d] to-[#090507] border-2 border-rose-500/70 rounded-3xl p-8 max-w-lg w-full shadow-[0_0_80px_rgba(244,63,94,0.4)] flex flex-col items-center text-center gap-5"
                    >
                      <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/60 flex items-center justify-center shadow-[0_0_30px_rgba(244,63,94,0.5)] animate-bounce">
                        <AlertTriangle size={36} className="text-rose-400" />
                      </div>

                      <div>
                        <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/25 text-rose-300 border border-rose-500/50 inline-block mb-2 animate-pulse">
                          Storage Critical • Controls Locked
                        </span>
                        <h2 className="text-2xl font-black text-white tracking-tight">Laptop Storage 100% Full</h2>
                        <p className="text-rose-200/80 text-sm mt-2 leading-relaxed">
                          Your laptop's primary storage is completely full ({storageInfo.usedPercent}% used, {storageInfo.freeStorageGB} GB free).
                          All ClueAI controls are blocked to prevent data loss or crashes. Please clear storage cache to continue.
                        </p>
                      </div>

                      {/* Quick Stats */}
                      <div className="w-full bg-white/[0.03] border border-white/10 rounded-2xl p-4 flex items-center justify-between text-left">
                        <div>
                          <p className="text-[11px] text-white/50 uppercase tracking-wider font-semibold">ClueAI Footprint</p>
                          <p className="text-base font-bold text-cyan-400 font-mono">{storageInfo.appStorageFormatted}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] text-white/50 uppercase tracking-wider font-semibold">Laptop Drive</p>
                          <p className="text-base font-bold text-rose-400 font-mono">{storageInfo.freeStorageGB} GB Free / {storageInfo.totalStorageGB} GB</p>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="w-full flex flex-col gap-2.5">
                        <button
                          onClick={() => {
                            setDeleteConfirmInput('');
                            setShowClearStorageConfirm(true);
                          }}
                          disabled={isClearingCache}
                          className="w-full py-3.5 rounded-xl font-black text-sm bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white shadow-[0_0_25px_rgba(244,63,94,0.5)] transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                        >
                          {isClearingCache ? (
                            <>
                              <Loader2 size={16} className="animate-spin text-white" />
                              <span>Clearing ClueAI Storage Cache...</span>
                            </>
                          ) : (
                            <>
                              <Trash2 size={16} />
                              <span>Clear ClueAI Storage Cache Now</span>
                            </>
                          )}
                        </button>

                        <div className="flex items-center gap-2 w-full">
                          <button
                            onClick={() => {
                              ipcRenderer.invoke('minimize-window');
                              shell.openExternal('ms-settings:storagesense');
                            }}
                            className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Settings size={13} />
                            <span>Windows Storage</span>
                          </button>
                          <button
                            onClick={handleRefreshStorage}
                            disabled={isRefreshingStorage}
                            className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 ${
                              storageRefreshedMsg
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                                : 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                            }`}
                          >
                            <RefreshCw size={13} className={isRefreshingStorage ? "animate-spin text-cyan-300" : storageRefreshedMsg ? "text-emerald-400" : ""} />
                            <span>{isRefreshingStorage ? "Checking Disk..." : storageRefreshedMsg ? "Refreshed!" : "Re-check Disk Space"}</span>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Animated User Feedback Modal with Horizontal Ergonomic Redesign */}
              <AnimatePresence>
                {showFeedbackModal && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[500] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto select-none"
                  >
                    <motion.div
                      initial={{ scale: 0.94, opacity: 0, y: 15 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.94, opacity: 0, y: 15 }}
                      transition={{ type: "spring", stiffness: 380, damping: 28 }}
                      className="bg-[#090b14]/95 border border-cyan-500/40 w-full max-w-4xl rounded-3xl p-6 sm:p-7 shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_40px_rgba(6,182,212,0.25)] flex flex-col gap-4 text-left max-h-[92vh] overflow-y-auto custom-scrollbar relative stealth-exempt"
                      onPaste={handleFeedbackPaste}
                    >
                      {/* Top Cyberpunk Ambient Glow Bar */}
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent blur-[1px]"></div>

                      {/* Hidden File Input for Image Upload (Images Only) */}
                      <input
                        ref={feedbackFileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={handleFeedbackImageSelect}
                      />

                      {/* Header */}
                      <div className="flex items-center justify-between pb-3.5 border-b border-white/10 shrink-0">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.5)]">
                            <MessageSquareShare size={20} className="text-white" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-black text-white tracking-tight">Share Your Feedback</h3>
                              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                                Clue AI Support
                              </span>
                            </div>
                            <p className="text-xs text-white/50 mt-0.5">
                              Report issues, suggest improvements, or communicate directly with engineering.
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => setShowFeedbackModal(false)}
                          className="p-2 hover:bg-white/10 rounded-xl text-white/50 hover:text-white transition-colors cursor-pointer"
                        >
                          <X size={18} />
                        </button>
                      </div>

                      {/* Feedback Status / Alerts */}
                      {feedbackStatus === 'success' && (
                        <div className="bg-emerald-500/15 border border-emerald-500/40 rounded-2xl p-3.5 flex items-start gap-3 text-emerald-200 text-xs shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                          <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                          <div className="leading-relaxed">
                            <strong className="text-emerald-100 block font-bold mb-0.5">Feedback Dispatched Successfully!</strong>
                            {feedbackStatusMsg}
                          </div>
                        </div>
                      )}

                      {feedbackStatus === 'error' && (
                        <div className="bg-rose-500/15 border border-rose-500/40 rounded-2xl p-3.5 flex items-start gap-3 text-rose-200 text-xs shadow-[0_0_20px_rgba(244,63,94,0.2)]">
                          <AlertTriangle size={18} className="text-rose-400 shrink-0 mt-0.5" />
                          <div className="leading-relaxed">
                            <strong className="text-rose-100 block font-bold mb-0.5">Dispatch Error</strong>
                            {feedbackStatusMsg}
                          </div>
                        </div>
                      )}

                      {/* Horizontal 2-Column Form Body */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
                        {/* Left Column: Name, Email, Category & Screenshot */}
                        <div className="md:col-span-5 flex flex-col gap-3.5">
                          {/* User Name */}
                          <div>
                            <label className="text-[11px] font-bold uppercase tracking-wider text-white/70 block mb-1">
                              Your Name <span className="text-white/40 normal-case font-normal">(optional)</span>
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Farhan Khalid"
                              value={feedbackForm.name}
                              onChange={(e) => setFeedbackForm(prev => ({ ...prev, name: e.target.value }))}
                              className="w-full bg-white/5 border border-white/10 focus:border-cyan-400 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/30 outline-none transition-colors shadow-inner"
                            />
                          </div>

                          {/* Email Address with Autocomplete Suggestions */}
                          <div className="relative">
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[11px] font-bold uppercase tracking-wider text-white/70">
                                Your Email ID <span className="text-rose-400">*</span>
                              </label>
                              {feedbackForm.email.trim() && isEmailVerified(feedbackForm.email.trim()) && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold animate-in fade-in duration-200">
                                  <CheckCircle2 size={12} className="text-emerald-400" /> Verified
                                </span>
                              )}
                            </div>
                            <input
                              type="email"
                              placeholder="e.g. your.email@example.com"
                              value={feedbackForm.email}
                              onChange={(e) => {
                                setFeedbackForm(prev => ({ ...prev, email: e.target.value }));
                                if (feedbackErrors.email) setFeedbackErrors(prev => ({ ...prev, email: undefined }));
                                const saved = JSON.parse(localStorage.getItem('clueai_saved_emails') || '[]');
                                const matches = e.target.value ? saved.filter((s: string) => s.toLowerCase().includes(e.target.value.toLowerCase())) : saved;
                                setShowFeedbackEmailSuggest(matches.length > 0);
                              }}
                              onFocus={() => {
                                const saved = JSON.parse(localStorage.getItem('clueai_saved_emails') || '[]');
                                if (saved.length > 0) setShowFeedbackEmailSuggest(true);
                              }}
                              onBlur={() => setTimeout(() => setShowFeedbackEmailSuggest(false), 200)}
                              className={`w-full bg-white/5 border ${feedbackErrors.email ? 'border-rose-500/60 focus:border-rose-400' : 'border-white/10 focus:border-cyan-400'} rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/30 outline-none transition-colors shadow-inner`}
                            />
                            {showFeedbackEmailSuggest && JSON.parse(localStorage.getItem('clueai_saved_emails') || '[]').length > 0 && (
                              <div className="absolute top-full left-0 w-full mt-1.5 bg-[#0e1122]/95 backdrop-blur-xl border border-cyan-500/30 rounded-xl shadow-2xl overflow-hidden z-50 max-h-36 overflow-y-auto custom-scrollbar">
                                <div className="px-3 py-1.5 bg-black/40 border-b border-white/10 flex items-center justify-between">
                                  <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-wider">Saved Emails</span>
                                  <span className="text-[9px] text-white/40">Auto-verify</span>
                                </div>
                                {(JSON.parse(localStorage.getItem('clueai_saved_emails') || '[]') as string[])
                                  .filter(s => !feedbackForm.email || s.toLowerCase().includes(feedbackForm.email.toLowerCase()))
                                  .map((email, idx) => {
                                    const verified = isEmailVerified(email);
                                    return (
                                      <div
                                        key={idx}
                                        className="px-3 py-2 hover:bg-white/10 cursor-pointer text-xs text-white/90 border-b border-white/5 last:border-0 flex items-center justify-between transition-colors"
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          setFeedbackForm(prev => ({ ...prev, email }));
                                          setShowFeedbackEmailSuggest(false);
                                          if (feedbackErrors.email) setFeedbackErrors(prev => ({ ...prev, email: undefined }));
                                        }}
                                      >
                                        <span className="font-mono text-white/90">{email}</span>
                                        {verified && (
                                          <span className="inline-flex items-center gap-1 text-[9px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-bold">
                                            <CheckCircle2 size={10} className="text-emerald-400" /> Verified
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                              </div>
                            )}
                            {feedbackErrors.email && (
                              <p className="text-rose-400 text-[10px] font-bold mt-1 pl-1">
                                {feedbackErrors.email}
                              </p>
                            )}
                          </div>

                          {/* Category Dropdown */}
                          <div>
                            <label className="text-[11px] font-bold uppercase tracking-wider text-white/70 block mb-1">
                              Feedback Category
                            </label>
                            <select
                              value={feedbackForm.category}
                              onChange={(e) => setFeedbackForm(prev => ({ ...prev, category: e.target.value }))}
                              className="w-full bg-[#121526] border border-white/10 focus:border-cyan-400 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-colors cursor-pointer"
                            >
                              <option value="Bug / Issue" className="bg-[#121526] text-white">Bug / Issue</option>
                              <option value="Feature Request" className="bg-[#121526] text-white">Feature Request</option>
                              <option value="Audio & Voice Scroll" className="bg-[#121526] text-white">Audio & Voice Scroll</option>
                              <option value="UI & Controls" className="bg-[#121526] text-white">UI & Controls</option>
                              <option value="Performance & Stability" className="bg-[#121526] text-white">Performance & Stability</option>
                              <option value="General Feedback" className="bg-[#121526] text-white">General Feedback</option>
                            </select>
                          </div>

                          {/* Screenshot / Image Attachment */}
                          <div>
                            <label className="text-[11px] font-bold uppercase tracking-wider text-white/70 block mb-1">
                              Attach Screenshot / Image <span className="text-white/40 normal-case font-normal">(images only)</span>
                            </label>

                            {isUploadingFeedbackImage ? (
                              <div className="rounded-2xl border-2 border-cyan-400/60 bg-cyan-500/10 p-4 flex flex-col items-center justify-center gap-2 text-center animate-pulse shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                                <Loader2 size={24} className="animate-spin text-cyan-400" />
                                <span className="text-xs font-bold text-white">Uploading & Optimizing Screenshot...</span>
                                <span className="text-[10px] text-cyan-300 font-mono">Encoding high-resolution image data</span>
                              </div>
                            ) : feedbackForm.imageBase64 ? (
                              <div className="relative rounded-2xl border border-cyan-500/40 bg-black/40 p-2.5 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 overflow-hidden">
                                  <img
                                    src={feedbackForm.imageBase64}
                                    alt="Screenshot Preview"
                                    className="w-14 h-14 object-cover rounded-xl border border-cyan-400/30 shrink-0"
                                  />
                                  <div className="text-left overflow-hidden">
                                    <div className="text-xs font-bold text-white truncate">Screenshot Attached</div>
                                    <div className="text-[10px] text-cyan-300 font-mono">Ready for email upload</div>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setFeedbackForm(prev => ({ ...prev, imageBase64: '' }))}
                                  className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                                >
                                  <Trash2 size={12} />
                                  <span>Remove</span>
                                </button>
                              </div>
                            ) : (
                              <div
                                onClick={() => feedbackFileInputRef.current?.click()}
                                className="border border-dashed border-white/20 hover:border-cyan-400/60 rounded-2xl p-3.5 bg-white/[0.02] hover:bg-white/[0.05] transition-all cursor-pointer flex flex-col items-center justify-center gap-1 text-center group"
                              >
                                <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                                  <ImageIcon size={14} />
                                </div>
                                <span className="text-xs font-bold text-white/80 group-hover:text-cyan-300 transition-colors">
                                  Browse image or press Ctrl+V to paste
                                </span>
                                <span className="text-[10px] text-white/40">
                                  PNG, JPG, WebP up to 5 MB (Images Only)
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right Column: Problem Details / Description (Full Height) */}
                        <div className="md:col-span-7 flex flex-col">
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-white/70">
                              Problem Details / Feedback <span className="text-rose-400">*</span>
                            </label>
                            <span className="text-[10px] text-white/40 font-mono">
                              {feedbackForm.description.length} chars (min 8)
                            </span>
                          </div>
                          <textarea
                            placeholder="Please describe what happened, what you expected, or any improvements you'd like to see in detail..."
                            value={feedbackForm.description}
                            onChange={(e) => {
                              setFeedbackForm(prev => ({ ...prev, description: e.target.value }));
                              if (feedbackErrors.description) setFeedbackErrors(prev => ({ ...prev, description: undefined }));
                            }}
                            className={`w-full flex-1 min-h-[190px] md:min-h-[220px] bg-white/5 border ${feedbackErrors.description ? 'border-rose-500/60 focus:border-rose-400' : 'border-white/10 focus:border-cyan-400'} rounded-2xl p-3.5 text-xs text-white placeholder-white/30 outline-none transition-colors resize-none shadow-inner custom-scrollbar leading-relaxed`}
                          />
                          {feedbackErrors.description && (
                            <p className="text-rose-400 text-[10px] font-bold mt-1 pl-1">
                              {feedbackErrors.description}
                            </p>
                          )}

                          <div className="mt-2.5 p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-2 text-[11px] text-white/50">
                            <Info size={14} className="text-cyan-400 shrink-0" />
                            <span>Your submission will be delivered directly to the engineers with your app diagnostic state.</span>
                          </div>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="flex items-center justify-between pt-3.5 border-t border-white/10 shrink-0 mt-1">
                        <div className="text-[11px] text-white/40">
                          Support Email: <span className="text-cyan-400 font-mono">clueai.support@gmail.com</span>
                        </div>

                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => setShowFeedbackModal(false)}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>

                          <button
                            type="button"
                            disabled={feedbackStatus === 'sending'}
                            onClick={handleSendFeedback}
                            className="px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white shadow-[0_0_18px_rgba(6,182,212,0.4)] border border-cyan-400/40 hover:border-cyan-300 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                          >
                            {feedbackStatus === 'sending' ? (
                              <>
                                <Loader2 size={14} className="animate-spin text-white" />
                                <span>Sending Feedback...</span>
                              </>
                            ) : (
                              <>
                                <Send size={14} className="text-white" />
                                <span>Submit Feedback</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Universal 6-Digit Email OTP Verification Modal with Blur Backdrop & Animations */}
              <AnimatePresence>
                {showOtpModal && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center p-4 sm:p-6 pointer-events-auto select-none"
                  >
                    <motion.div
                      initial={{ scale: 0.92, opacity: 0, y: 15 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.92, opacity: 0, y: 15 }}
                      transition={{ type: "spring", stiffness: 420, damping: 28 }}
                      className="w-full max-w-md bg-[#080911]/95 border border-cyan-500/35 rounded-3xl p-6 sm:p-7 shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_40px_rgba(6,182,212,0.2)] flex flex-col items-center text-center relative overflow-hidden stealth-exempt"
                    >
                      {/* Top Cyberpunk Ambient Glow Bar */}
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent blur-[1px]"></div>

                      {/* Close button */}
                      <button
                        onClick={() => {
                          setShowOtpModal(false);
                          setOtpError(false);
                          setOtpSuccess(false);
                          setOnboardingIsSubmitting(false);
                        }}
                        className="absolute top-4 right-4 p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                        title="Cancel Verification"
                      >
                        <X size={18} />
                      </button>

                      {/* Header Icon */}
                      <div className="w-14 h-14 rounded-2xl bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center mb-3.5 text-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.25)]">
                        <ShieldCheck size={28} />
                      </div>

                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-xl font-black text-white tracking-tight">
                          Email Security Verification
                        </h3>
                        {otpPendingType && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                            {otpPendingType === 'feedback' ? 'Feedback' : otpPendingType === 'reminder' ? 'Reminder' : otpPendingType === 'note' ? 'Notes' : otpPendingType === 'onboarding' ? 'Onboarding' : otpPendingType === 'export' ? 'Export' : 'Settings'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/60 mb-2 leading-relaxed max-w-xs">
                        Enter the 6-digit verification code dispatched to:
                      </p>
                      <div className="px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-cyan-300 font-mono text-xs font-bold mb-5 flex items-center gap-2 shadow-inner">
                        <span>{otpTargetEmail}</span>
                      </div>

                      {/* 6 Digit Input Boxes */}
                      <div className="flex items-center justify-center gap-2 sm:gap-2.5 mb-4 w-full">
                        {otpDigits.map((digit, index) => (
                          <input
                            key={index}
                            ref={(el) => { otpInputsRef.current[index] = el; }}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            disabled={otpSuccess || otpIsSending}
                            value={digit}
                            onChange={(e) => handleOtpDigitChange(index, e.target.value)}
                            onKeyDown={(e) => handleOtpKeyDown(index, e)}
                            onPaste={handleOtpPaste}
                            className={`w-11 h-14 sm:w-12 sm:h-16 text-center text-2xl font-black rounded-2xl font-mono outline-none transition-all duration-200 select-none ${
                              otpSuccess
                                ? 'bg-black/90 border-2 border-emerald-400 text-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.4)] scale-105'
                                : otpError
                                ? 'animate-shake bg-rose-500/20 border-2 border-rose-500 text-rose-300 shadow-[0_0_18px_rgba(244,63,94,0.4)]'
                                : digit
                                ? 'bg-black/70 border-2 border-cyan-400 text-cyan-200 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                                : 'bg-white/5 border border-white/15 text-white focus:border-cyan-400 focus:bg-cyan-500/10 focus:shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                            }`}
                          />
                        ))}
                      </div>

                      {/* Status Messages */}
                      <div className="min-h-[34px] flex items-center justify-center mb-4">
                        {otpSuccess && (
                          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs bg-emerald-500/15 border border-emerald-500/35 px-4 py-2 rounded-xl animate-in zoom-in-95 duration-200">
                            <CheckCircle2 size={16} className="text-emerald-400" />
                            <span>Code Verified! Completing your request...</span>
                          </div>
                        )}
                        {otpError && !otpSuccess && (
                          <div className="flex items-center gap-2 text-rose-400 font-bold text-xs bg-rose-500/15 border border-rose-500/35 px-4 py-2 rounded-xl animate-in zoom-in-95 duration-200">
                            <AlertTriangle size={16} className="text-rose-400" />
                            <span>Invalid code. Please check your inbox and try again.</span>
                          </div>
                        )}
                        {otpIsSending && (
                          <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
                            <Loader2 size={16} className="animate-spin" />
                            <span>Dispatching secure 6-digit code...</span>
                          </div>
                        )}
                      </div>

                      {/* Verify Button & Resend Option */}
                      <div className="w-full space-y-3">
                        <button
                          type="button"
                          onClick={() => validateOtpCode(otpDigits.join(''))}
                          disabled={otpDigits.some((d) => !d) || otpSuccess || otpIsSending}
                          className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                        >
                          {otpSuccess ? (
                            <>
                              <CheckCircle2 size={16} /> Verified Successfully
                            </>
                          ) : (
                            'Verify & Continue'
                          )}
                        </button>

                        <div className="flex items-center justify-between text-xs text-white/50 px-1 pt-1">
                          <span>Didn&apos;t receive code?</span>
                          {otpCountdown > 0 ? (
                            <span className="text-cyan-400 font-mono font-medium">
                              Resend in {otpCountdown}s
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={handleResendOtp}
                              disabled={otpIsSending}
                              className="text-cyan-400 hover:text-cyan-300 font-bold underline underline-offset-2 transition-colors cursor-pointer"
                            >
                              Resend Code
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* In-App Session Export Modal with Direct Download (HTML & PDF) and Email Dispatch */}
              <AnimatePresence>
                {showExportModal && exportTargetSession && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="fixed inset-0 z-[450] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto select-none"
                  >
                    <motion.div
                      initial={{ scale: 0.94, opacity: 0, y: 15 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.94, opacity: 0, y: 15 }}
                      transition={{ type: "spring", stiffness: 380, damping: 28 }}
                      className="bg-[#090b14]/95 border border-cyan-500/40 w-full max-w-xl rounded-3xl p-6 sm:p-7 shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_40px_rgba(6,182,212,0.25)] flex flex-col gap-5 text-left max-h-[92vh] overflow-y-auto custom-scrollbar relative stealth-exempt"
                    >
                      {/* Top Cyberpunk Ambient Glow Bar */}
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent blur-[1px]"></div>

                      {/* Header */}
                      <div className="flex items-center justify-between pb-3 border-b border-white/10">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600/30 to-cyan-500/30 border border-cyan-500/40 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                            <Download size={20} className="text-cyan-400" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-black tracking-tight text-white">Export Session</h3>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 max-w-[160px] truncate">
                                {exportTargetSession.title || exportTargetSession.name || 'Session'}
                              </span>
                            </div>
                            <p className="text-xs text-white/50 mt-0.5">
                              Download locally in HTML or PDF, or email the formatted report directly.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowExportModal(false)}
                          className="p-2 hover:bg-white/10 rounded-xl text-white/50 hover:text-white transition-colors cursor-pointer"
                        >
                          <X size={18} />
                        </button>
                      </div>

                      {/* Section 1: Direct Download */}
                      <div className="flex flex-col gap-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
                            1. Direct Local Download
                          </span>
                          <span className="text-[10px] text-white/40">Instant offline files</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* HTML Download Card */}
                          <button
                            type="button"
                            onClick={() => downloadSessionHtml(exportTargetSession)}
                            disabled={isExportingHtml}
                            className={`group p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border ${htmlExportSuccess ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-white/10 hover:border-cyan-500/50'} flex flex-col items-start gap-2 text-left transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                                {isExportingHtml ? (
                                  <Loader2 size={16} className="animate-spin text-cyan-400" />
                                ) : htmlExportSuccess ? (
                                  <CheckCircle2 size={16} className="text-emerald-400" />
                                ) : (
                                  <FileCode size={16} />
                                )}
                              </div>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/60">
                                {htmlExportSuccess ? 'SAVED' : '.HTML'}
                              </span>
                            </div>
                            <div>
                              <div className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">
                                {isExportingHtml ? 'Generating HTML Report...' : htmlExportSuccess ? 'HTML Downloaded Successfully!' : 'Download HTML Report'}
                              </div>
                              <div className="text-[11px] text-white/50 mt-0.5 leading-snug">
                                Full interactive report with syntax highlights and expandable questions.
                              </div>
                            </div>
                          </button>

                          {/* PDF Download Card */}
                          <button
                            type="button"
                            onClick={() => downloadSessionPdf(exportTargetSession)}
                            disabled={isExportingPdf}
                            className={`group p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border ${pdfExportSuccess ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-white/10 hover:border-blue-500/50'} flex flex-col items-start gap-2 text-left transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                                {isExportingPdf ? (
                                  <Loader2 size={16} className="animate-spin text-blue-400" />
                                ) : pdfExportSuccess ? (
                                  <CheckCircle2 size={16} className="text-emerald-400" />
                                ) : (
                                  <FileText size={16} />
                                )}
                              </div>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/60">
                                {pdfExportSuccess ? 'SAVED' : '.PDF'}
                              </span>
                            </div>
                            <div>
                              <div className="text-xs font-bold text-white group-hover:text-blue-300 transition-colors">
                                {isExportingPdf ? 'Generating PDF Document...' : pdfExportSuccess ? 'PDF Downloaded Successfully!' : 'Download PDF Report'}
                              </div>
                              <div className="text-[11px] text-white/50 mt-0.5 leading-snug">
                                Clean formatted A4 document layout directly saved to your computer.
                              </div>
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* Section 2: Send to Email */}
                      <div className="flex flex-col gap-2.5 pt-2 border-t border-white/10">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
                            2. Send to Email Address
                          </span>
                          {exportEmailInput.trim() && isEmailVerified(exportEmailInput.trim()) ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                              <CheckCircle2 size={11} /> Verified Address
                            </span>
                          ) : (
                            <span className="text-[10px] text-white/40">
                              {exportEmailInput.trim() ? 'Requires OTP verification' : 'Auto-verified with OTP'}
                            </span>
                          )}
                        </div>

                        <div className="relative">
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <input
                                type="email"
                                value={exportEmailInput}
                                onChange={(e) => {
                                  setExportEmailInput(e.target.value);
                                  setExportEmailMsg('');
                                  const saved = JSON.parse(localStorage.getItem('clueai_saved_emails') || '[]');
                                  const matches = e.target.value ? saved.filter((s: string) => s.toLowerCase().includes(e.target.value.toLowerCase())) : saved;
                                  setShowExportEmailSuggest(matches.length > 0);
                                }}
                                onFocus={() => {
                                  const saved = JSON.parse(localStorage.getItem('clueai_saved_emails') || '[]');
                                  if (saved.length > 0) setShowExportEmailSuggest(true);
                                }}
                                onBlur={() => setTimeout(() => setShowExportEmailSuggest(false), 200)}
                                placeholder="Enter recipient email (e.g. name@gmail.com)"
                                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-400 focus:outline-none text-xs text-white placeholder-white/30 transition-all font-mono"
                              />
                            </div>

                            <button
                              type="button"
                              disabled={exportEmailStatus === 'sending' || !exportEmailInput.trim()}
                              onClick={handleSendExportEmail}
                              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white shadow-[0_0_18px_rgba(6,182,212,0.4)] border border-cyan-400/40 hover:border-cyan-300 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0 hover:scale-[1.02] active:scale-[0.98]"
                            >
                              {exportEmailStatus === 'sending' ? (
                                <>
                                  <Loader2 size={14} className="animate-spin text-white" />
                                  <span>Dispatching...</span>
                                </>
                              ) : (
                                <>
                                  <Mail size={14} className="text-white" />
                                  <span>Send to Email</span>
                                </>
                              )}
                            </button>
                          </div>

                          {/* Autocomplete dropdown for Saved Emails */}
                          {showExportEmailSuggest && JSON.parse(localStorage.getItem('clueai_saved_emails') || '[]').length > 0 && (
                            <div className="absolute top-full left-0 w-full mt-1.5 bg-[#0e1122]/95 backdrop-blur-xl border border-cyan-500/30 rounded-xl shadow-2xl overflow-hidden z-50 max-h-36 overflow-y-auto custom-scrollbar">
                              <div className="px-3 py-1.5 bg-black/40 border-b border-white/10 flex items-center justify-between">
                                <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-wider">Saved & Verified Addresses</span>
                                <span className="text-[9px] text-white/40">Select to fill</span>
                              </div>
                              {(JSON.parse(localStorage.getItem('clueai_saved_emails') || '[]') as string[])
                                .filter(s => !exportEmailInput || s.toLowerCase().includes(exportEmailInput.toLowerCase()))
                                .map((email, idx) => {
                                  const verified = isEmailVerified(email);
                                  return (
                                    <div
                                      key={idx}
                                      className="px-3 py-2 hover:bg-white/10 cursor-pointer text-xs text-white/90 border-b border-white/5 last:border-0 flex items-center justify-between transition-colors"
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        setExportEmailInput(email);
                                        setShowExportEmailSuggest(false);
                                        setExportEmailMsg('');
                                      }}
                                    >
                                      <span className="font-mono text-white/90">{email}</span>
                                      {verified && (
                                        <span className="inline-flex items-center gap-1 text-[9px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-bold">
                                          <CheckCircle2 size={10} className="text-emerald-400" /> Verified
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                            </div>
                          )}
                        </div>

                        {/* Email Status Message */}
                        {exportEmailMsg && (
                          <div
                            className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                              exportEmailStatus === 'success'
                                ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                                : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                            }`}
                          >
                            {exportEmailStatus === 'success' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                            <span>{exportEmailMsg}</span>
                          </div>
                        )}
                      </div>

                      {/* Modal Footer */}
                      <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                        <span className="text-[11px] text-white/40">
                          Session contains {exportTargetSession.history?.length || 0} interaction{(exportTargetSession.history?.length || 0) === 1 ? '' : 's'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowExportModal(false)}
                          className="px-4 py-2 rounded-xl text-xs font-bold text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
                        >
                          Close
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Full-Screen Settings Modal with Framer Motion & Perfect Sizing */}
              <AnimatePresence>
                {showSettings && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-[300] bg-black/45 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 overflow-hidden pointer-events-auto"
                  >
                    <motion.div
                      initial={{ opacity: 0, scale: 0.94, y: 15 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.94, y: 15 }}
                      transition={{ type: "spring", stiffness: 380, damping: 28 }}
                      className={`w-full max-w-4xl max-h-[86vh] h-full min-h-0 bg-[#0a0b12]/95 backdrop-blur-3xl border border-cyan-500/30 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_35px_rgba(6,182,212,0.15)] flex flex-col overflow-hidden ${!localSettingsStealth ? 'stealth-exempt' : ''}`}>
                      <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-white/5">
                        <div className="flex items-center gap-4">
                          <div>
                            <div className="flex items-center gap-3">
                              <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2"><Settings size={24} className="text-cyan-400" /> Settings</h2>
                              <button onClick={() => setLocalSettingsStealth(!localSettingsStealth)} className={`shield-toggle-btn p-1.5 rounded-lg transition-all hover:scale-105 active:scale-95 ${localSettingsStealth ? 'bg-green-500/20 text-green-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                {localSettingsStealth ? <Shield size={16} /> : <ShieldAlert size={16} />}
                              </button>
                            </div>
                            <p className="text-white/50 text-xs mt-1">Configure your AI models, audio devices, and application preferences.</p>
                          </div>
                          <span className="hidden md:flex px-2.5 py-1 rounded-md border border-white/10 bg-black/30 text-[10px] font-bold text-white/50 tracking-wider uppercase items-center gap-1.5 pointer-events-none select-none">
                            <Keyboard size={12} /> Ctrl+Shift+K to minimize/restore
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          {deleteMsg && <span className="text-rose-400 font-bold text-xs bg-rose-500/10 px-3 py-1.5 rounded border border-rose-500/20">{deleteMsg}</span>}
                          <button onClick={() => setShowSettings(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-colors shadow-sm">
                            <X size={18} />
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-black/[0.02]">
                        <div className="max-w-3xl w-full mx-auto space-y-8 pb-10 select-none cursor-default">

                          {/* User Profile & Verified Email Settings */}
                          <section>
                            <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                              <User size={16} /> User Profile & Verified Email
                            </h3>
                            <div className="bg-brand-card p-5 rounded-2xl border border-brand-border space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-xs font-bold text-brand-subtext uppercase mb-1.5">Candidate Name</label>
                                  <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setUsername(val);
                                      localStorage.setItem('clueai_username', val);
                                    }}
                                    placeholder="e.g. Farhan Khalid"
                                    className="w-full bg-brand-secondary border border-brand-border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                                  />
                                </div>
                                <div className="relative">
                                  <label className="block text-xs font-bold text-brand-subtext uppercase mb-1.5 flex items-center justify-between">
                                    <span>Primary Email ID</span>
                                    {userEmail && isEmailVerified(userEmail) && (
                                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                                        <CheckCircle2 size={11} /> Verified
                                      </span>
                                    )}
                                  </label>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="email"
                                      value={userEmail}
                                      onChange={(e) => {
                                        setUserEmail(e.target.value);
                                        localStorage.setItem('clueai_user_email', e.target.value);
                                        const saved = JSON.parse(localStorage.getItem('clueai_saved_emails') || '[]');
                                        const matches = e.target.value ? saved.filter((s: string) => s.toLowerCase().includes(e.target.value.toLowerCase())) : saved;
                                        setShowSettingsEmailSuggest(matches.length > 0);
                                      }}
                                      onFocus={() => {
                                        const saved = JSON.parse(localStorage.getItem('clueai_saved_emails') || '[]');
                                        if (saved.length > 0) setShowSettingsEmailSuggest(true);
                                      }}
                                      onBlur={() => setTimeout(() => setShowSettingsEmailSuggest(false), 200)}
                                      placeholder="e.g. farhan@example.com"
                                      className="flex-1 bg-brand-secondary border border-brand-border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-400 font-mono"
                                    />
                                    {(!userEmail || !isEmailVerified(userEmail)) && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (!userEmail || !userEmail.includes('@')) return;
                                          triggerOtpVerification('settings', userEmail, () => {
                                            localStorage.setItem('clueai_user_email', userEmail);
                                            markEmailVerified(userEmail);
                                            setModelChangeMsg('Email verified and saved to profile!');
                                            setTimeout(() => setModelChangeMsg(''), 3000);
                                          });
                                        }}
                                        className="px-3 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white rounded-lg text-xs font-bold transition-all shadow-md shrink-0 cursor-pointer"
                                      >
                                        Verify Email
                                      </button>
                                    )}
                                  </div>
                                  {showSettingsEmailSuggest && JSON.parse(localStorage.getItem('clueai_saved_emails') || '[]').length > 0 && (
                                    <div className="absolute top-full left-0 w-full mt-1.5 bg-[#0e1122]/95 backdrop-blur-xl border border-cyan-500/30 rounded-xl shadow-2xl overflow-hidden z-50 max-h-36 overflow-y-auto custom-scrollbar">
                                      <div className="px-3 py-1.5 bg-black/40 border-b border-white/10 flex items-center justify-between">
                                        <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-wider">Saved Emails</span>
                                        <span className="text-[9px] text-white/40">Verified Status</span>
                                      </div>
                                      {(JSON.parse(localStorage.getItem('clueai_saved_emails') || '[]') as string[])
                                        .filter(s => !userEmail || s.toLowerCase().includes(userEmail.toLowerCase()))
                                        .map((email, idx) => {
                                          const verified = isEmailVerified(email);
                                          return (
                                            <div
                                              key={idx}
                                              className="px-3 py-2 hover:bg-white/10 cursor-pointer text-xs text-white/90 border-b border-white/5 last:border-0 flex items-center justify-between transition-colors"
                                              onMouseDown={(e) => {
                                                e.preventDefault();
                                                setUserEmail(email);
                                                localStorage.setItem('clueai_user_email', email);
                                                setShowSettingsEmailSuggest(false);
                                              }}
                                            >
                                              <span className="font-mono text-white/90">{email}</span>
                                              {verified && (
                                                <span className="inline-flex items-center gap-1 text-[9px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-bold">
                                                  <CheckCircle2 size={10} className="text-emerald-400" /> Verified
                                                </span>
                                              )}
                                            </div>
                                          );
                                        })}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <p className="text-[11px] text-white/40 leading-relaxed">
                                This verified email is automatically pre-filled across your interview reminders, feedback reports, and saved notes.
                              </p>
                            </div>
                          </section>


                          <section>
                            <h3 className="text-sm font-bold text-brand-accentSec uppercase tracking-wider mb-4 flex items-center gap-2"><Settings size={16} /> Provider & Display</h3>
                            <div className="grid grid-cols-2 gap-6 bg-brand-card p-5 rounded-2xl border border-brand-border">
                              <div>
                                <label className="block text-xs font-bold text-brand-subtext uppercase mb-1.5">Default AI Provider</label>
                                <CustomSelect
                                  value={provider}
                                  onChange={(val: 'groq' | 'gemini-flash' | 'claude' | 'chatgpt' | 'deepseek') => {
                                    if (val === 'groq' && !groqKeys.some(k => k.trim())) {
                                      setModelChangeMsg('No API key found in Groq');
                                      setTimeout(() => setModelChangeMsg(''), 3000);
                                      return;
                                    }
                                    if (val === 'gemini-flash' && !geminiKeys.some(k => k.trim())) {
                                      setModelChangeMsg('No API key found in Gemini Flash');
                                      setTimeout(() => setModelChangeMsg(''), 3000);
                                      return;
                                    }
                                    if (val === 'claude' && !claudeKeys.some(k => k.key.trim())) {
                                      setModelChangeMsg('No API key found in Claude');
                                      setTimeout(() => setModelChangeMsg(''), 3000);
                                      return;
                                    }
                                    if (val === 'chatgpt' && !chatgptKeys.some(k => k.key.trim())) {
                                      setModelChangeMsg('No API key found in ChatGPT');
                                      setTimeout(() => setModelChangeMsg(''), 3000);
                                      return;
                                    }
                                    if (val === 'deepseek' && !deepseekKeys.some(k => k.key.trim())) {
                                      setModelChangeMsg('No API key found in DeepSeek');
                                      setTimeout(() => setModelChangeMsg(''), 3000);
                                      return;
                                    }

                                    setProvider(val);
                                    switchProvider(val);
                                    const nameMap: any = { 'groq': 'Groq', 'gemini-flash': 'Gemini Flash', 'claude': 'Claude', 'chatgpt': 'ChatGPT', 'deepseek': 'DeepSeek', 'glm': 'GLM / NVIDIA' };
                                    setModelChangeMsg(`Switched to ${nameMap[val]}`);
                                    setTimeout(() => setModelChangeMsg(''), 3000);
                                  }}
                                  options={[
                                    { value: 'groq', label: 'Groq (GPT-OSS 20B)' },
                                    { value: 'gemini-flash', label: 'Gemini 2.5 Flash' },
                                    { value: 'claude', label: 'Claude 3.5 Sonnet' },
                                    { value: 'chatgpt', label: 'ChatGPT (GPT-4o)' },
                                    { value: 'deepseek', label: 'DeepSeek Coder' }, { value: 'glm', label: 'GLM / NVIDIA' }]}
                                  className="w-full bg-brand-secondary border border-brand-border rounded-lg px-3 py-2 text-sm text-white transition-all"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-brand-subtext uppercase mb-1.5 flex items-center justify-between">
                                  <span>Default Code Language</span>
                                  <span className="text-[10px] text-cyan-400 font-mono">
                                    {preferredCodeLanguage === 'Java' ? 'Default: Java' : `Current: ${preferredCodeLanguage}`}
                                  </span>
                                </label>
                                <CustomSelect
                                  value={preferredCodeLanguage}
                                  onChange={(val: string) => {
                                    setPreferredCodeLanguage(val);
                                    localStorage.setItem('clueai_code_language', val);
                                  }}
                                  options={[
                                    { value: 'Java', label: 'Java (Default)' },
                                    { value: 'Python', label: 'Python' },
                                    { value: 'C++', label: 'C++' },
                                    { value: 'JavaScript', label: 'JavaScript' },
                                    { value: 'TypeScript', label: 'TypeScript' },
                                    { value: 'C#', label: 'C#' },
                                    { value: 'Go', label: 'Go' },
                                    { value: 'Rust', label: 'Rust' },
                                    { value: 'Auto', label: 'Auto-detect' }
                                  ]}
                                  className="w-full bg-brand-secondary border border-brand-border rounded-lg px-3 py-2 text-sm text-white transition-all"
                                />
                              </div>
                              <div className="col-span-2 pt-2 border-t border-white/5">
                                <label className="block text-sm font-medium text-brand-subtext mb-2">Stealth Mode (Hide from Screen Share)</label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                  <div className="relative">
                                    <input type="checkbox" className="sr-only" checked={stealthMode} onChange={e => {
                                      const val = e.target.checked;
                                      if (!val) {
                                        setShowStealthWarning(true);
                                      } else {
                                        setStealthMode(true);
                                        ipcRenderer.invoke('set-stealth', true);
                                      }
                                    }} />
                                    <div className={`block w-12 h-6 rounded-full transition-colors ${stealthMode ? 'bg-brand-accentSec' : 'bg-brand-border'}`}></div>
                                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${stealthMode ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                  </div>
                                  <span className="text-sm text-brand-subtext">
                                    {stealthMode ? 'Enabled (May cause crashes on some PCs)' : 'Disabled (App is visible in screen share)'}
                                  </span>
                                </label>
                              </div>
                            </div>
                          </section>

                          {/* Interview Content Settings */}
                          <section>
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                              <Layout size={16} /> Interview Layout & Content
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Transcript Size */}
                              <div className="bg-gradient-to-br from-brand-secondary to-brand-card p-5 rounded-2xl border border-white/5 shadow-lg flex flex-col group hover:border-white/10 transition-colors">
                                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center mb-3">
                                  <FileText size={16} />
                                </div>
                                <label className="block text-xs font-bold text-white uppercase mb-2">Transcript Font Size</label>
                                <div className="flex items-center gap-2 mt-auto">
                                  <input
                                    type="range"
                                    min="10"
                                    max="40"
                                    value={transcriptTextSize}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value) || 15;
                                      setTranscriptTextSize(val);
                                      localStorage.setItem('clueai_transcript_size', val.toString());
                                    }}
                                    className="flex-1 accent-brand-accent h-1.5 bg-brand-bg rounded-lg appearance-none cursor-pointer"
                                  />
                                  <span className="text-sm font-mono font-bold text-brand-accent bg-brand-bg px-2 py-1 rounded-md border border-brand-border">{transcriptTextSize}px</span>
                                </div>
                              </div>


                            </div>
                          </section>

                          {/* API Keys Configuration */}
                          <section>
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-sm font-bold text-brand-accent uppercase tracking-wider flex items-center gap-2"><Cpu size={16} /> API Keys</h3>
                              <div className="flex items-center gap-3">
                                <div className="flex flex-col items-end gap-1">
                                  {saveMessages.map((msg, i) => (
                                    <span key={i} className={`text-xs font-bold animate-in fade-in ${msg.type === 'invalid' ? 'text-rose-500' :
                                      msg.type === 'duplicate' ? 'text-yellow-500' :
                                        'text-green-400'
                                      }`}>
                                      {msg.text}
                                    </span>
                                  ))}
                                </div>
                                <button onClick={saveApiKeys} className="flex items-center gap-1.5 bg-brand-accent hover:bg-brand-accentSec text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                                  <Save size={14} /> Save API Keys
                                </button>
                              </div>
                            </div>
                            <div className="bg-brand-accent/10 border border-brand-accent/30 rounded-xl p-4 mb-4 flex items-start gap-3 shadow-sm">
                              <Info className="text-brand-accent mt-0.5 shrink-0" size={18} />
                              <div className="text-sm text-brand-subtext leading-relaxed">
                                <strong className="text-white block mb-1">Why 15 API Keys?</strong>
                                To bypass rate limits and keep your usage completely free, ClueAI distributes requests across multiple API keys.
                                If you provide 6 keys, ClueAI will intelligently rotate through all 6 to keep you safely within free limits.
                                The more keys you provide, the more seamless and free your interview experience will be!
                              </div>
                            </div>
                            <div className="bg-brand-card rounded-2xl border border-brand-border overflow-hidden">
                              {/* Groq Accordion */}
                              <div className="border-b border-brand-border last:border-b-0">
                                <button onClick={() => setApiAccordion(apiAccordion === 'groq' ? 'none' : 'groq')} className="w-full flex items-center justify-between p-5 bg-brand-secondary/50 hover:bg-brand-secondary transition-colors text-left">
                                  <div>
                                    <h4 className="text-sm font-bold text-white flex items-center gap-2">Groq Keys</h4>
                                    <p className="text-xs text-brand-subtext mt-1">{groqKeys.filter(k => k.trim()).length} keys loaded (Used for STT & LLM)</p>
                                  </div>
                                  {apiAccordion === 'groq' ? <ChevronDown size={20} className="text-brand-subtext" /> : <ChevronRight size={20} className="text-brand-subtext" />}
                                </button>

                                {apiAccordion === 'groq' && (
                                  <div className="p-5 bg-brand-card space-y-3">
                                    {Array.from({ length: 15 }).map((_, i) => (
                                      <div key={`groq-${i}`}>
                                        <label className="block text-[10px] font-bold text-brand-subtext uppercase mb-1">Key {i + 1} {i === 0 ? '(Mandatory)' : '(Optional)'}</label>
                                        <div className="relative">
                                          <input
                                            type={showGroqKeys[i] ? "text" : "password"}
                                            value={groqKeys[i]}
                                            onChange={e => {
                                              const newKeys = [...groqKeys];
                                              newKeys[i] = e.target.value;
                                              setGroqKeys(newKeys);
                                            }}
                                            className="w-full bg-brand-secondary border border-brand-border rounded-lg pl-3 pr-[100px] py-2 text-sm outline-none focus:border-brand-accent text-white transition-all"
                                            placeholder={`gsk_...`}
                                          />
                                          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                            {groqKeyStatus[i] === 'validating' && <div><Loader2 size={16} className="animate-spin text-brand-subtext" /></div>}
                                            {groqKeyStatus[i] === 'valid' && <div><CheckCircle2 size={16} className="text-green-500" /></div>}
                                            {groqKeyStatus[i] === 'invalid' && <div><XCircle size={16} className="text-rose-500" /></div>}
                                            {groqKeyStatus[i] === 'duplicate' && <div><AlertTriangle size={16} className="text-yellow-500" /></div>}
                                            <button onClick={() => {
                                              const newShow = [...showGroqKeys];
                                              newShow[i] = !newShow[i];
                                              setShowGroqKeys(newShow);
                                            }} className="text-brand-subtext hover:text-white transition-colors">
                                              {showGroqKeys[i] ? <Eye size={14} /> : <EyeOff size={14} />}
                                            </button>
                                            <button onClick={() => {
                                              if (groqKeys[i]) {
                                                clipboard.writeText(groqKeys[i]);
                                              }
                                            }} className="text-brand-subtext hover:text-green-400 transition-colors">
                                              <Copy size={14} />
                                            </button>
                                            <button onClick={async () => {
                                              try {
                                                const text = clipboard.readText();
                                                if (text && text.trim()) {
                                                  const newKeys = [...groqKeys];
                                                  newKeys[i] = text.trim();
                                                  setGroqKeys(newKeys);
                                                }
                                              } catch (e) { }
                                            }} className="text-brand-subtext hover:text-blue-400 transition-colors">
                                              <ClipboardPaste size={14} />
                                            </button>
                                            <button onClick={() => {
                                              const newKeys = [...groqKeys];
                                              newKeys[i] = '';
                                              setGroqKeys(newKeys);
                                              setDeleteMessage({ provider: 'groq', index: i });
                                              setTimeout(() => setDeleteMessage(null), 3000);
                                            }} className="text-rose-500 hover:text-rose-400 transition-colors">
                                              <Trash2 size={14} />
                                            </button>
                                          </div>
                                        </div>
                                        {deleteMessage?.provider === 'groq' && deleteMessage?.index === i && (
                                          <p className="text-rose-400 text-[10px] mt-1 font-bold animate-in fade-in">API Key deleted</p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Gemini Accordion */}
                              <div className="border-b border-brand-border last:border-b-0">
                                <button onClick={() => setApiAccordion(apiAccordion === 'gemini' ? 'none' : 'gemini')} className="w-full flex items-center justify-between p-5 bg-brand-secondary/50 hover:bg-brand-secondary transition-colors text-left">
                                  <div>
                                    <h4 className="text-sm font-bold text-white flex items-center gap-2">Gemini Keys</h4>
                                    <p className="text-xs text-brand-subtext mt-1">{geminiKeys.filter(k => k.trim()).length} keys loaded (Used for LLM)</p>
                                  </div>
                                  {apiAccordion === 'gemini' ? <ChevronDown size={20} className="text-brand-subtext" /> : <ChevronRight size={20} className="text-brand-subtext" />}
                                </button>

                                {apiAccordion === 'gemini' && (
                                  <div className="p-5 bg-brand-card space-y-3">
                                    {Array.from({ length: 15 }).map((_, i) => (
                                      <div key={`gemini-${i}`}>
                                        <label className="block text-[10px] font-bold text-brand-subtext uppercase mb-1">Key {i + 1} {i === 0 ? '(Mandatory)' : '(Optional)'}</label>
                                        <div className="relative">
                                          <input
                                            type={showGeminiKeys[i] ? "text" : "password"}
                                            value={geminiKeys[i]}
                                            onChange={e => {
                                              const newKeys = [...geminiKeys];
                                              newKeys[i] = e.target.value;
                                              setGeminiKeys(newKeys);
                                            }}
                                            className="w-full bg-brand-secondary border border-brand-border rounded-lg pl-3 pr-[100px] py-2 text-sm outline-none focus:border-brand-accent text-white transition-all"
                                            placeholder={`AIza... or AQ...`}
                                          />
                                          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                            {geminiKeyStatus[i] === 'validating' && <div><Loader2 size={16} className="animate-spin text-brand-subtext" /></div>}
                                            {geminiKeyStatus[i] === 'valid' && <div><CheckCircle2 size={16} className="text-green-500" /></div>}
                                            {geminiKeyStatus[i] === 'invalid' && <div><XCircle size={16} className="text-rose-500" /></div>}
                                            {geminiKeyStatus[i] === 'duplicate' && <div><AlertTriangle size={16} className="text-yellow-500" /></div>}
                                            <button onClick={() => {
                                              const newShow = [...showGeminiKeys];
                                              newShow[i] = !newShow[i];
                                              setShowGeminiKeys(newShow);
                                            }} className="text-brand-subtext hover:text-white transition-colors">
                                              {showGeminiKeys[i] ? <Eye size={14} /> : <EyeOff size={14} />}
                                            </button>
                                            <button onClick={() => {
                                              if (geminiKeys[i]) {
                                                clipboard.writeText(geminiKeys[i]);
                                              }
                                            }} className="text-brand-subtext hover:text-green-400 transition-colors">
                                              <Copy size={14} />
                                            </button>
                                            <button onClick={async () => {
                                              try {
                                                const text = clipboard.readText();
                                                if (text && text.trim()) {
                                                  const newKeys = [...geminiKeys];
                                                  newKeys[i] = text.trim();
                                                  setGeminiKeys(newKeys);
                                                }
                                              } catch (e) { }
                                            }} className="text-brand-subtext hover:text-blue-400 transition-colors">
                                              <ClipboardPaste size={14} />
                                            </button>
                                            <button onClick={() => {
                                              const newKeys = [...geminiKeys];
                                              newKeys[i] = '';
                                              setGeminiKeys(newKeys);
                                              setDeleteMessage({ provider: 'gemini', index: i });
                                              setTimeout(() => setDeleteMessage(null), 3000);
                                            }} className="text-rose-500 hover:text-rose-400 transition-colors">
                                              <Trash2 size={14} />
                                            </button>
                                          </div>
                                        </div>
                                        {deleteMessage?.provider === 'gemini' && deleteMessage?.index === i && (
                                          <p className="text-rose-400 text-[10px] mt-1 font-bold animate-in fade-in">API Key deleted</p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Claude Accordion */}
                              <div className="border-b border-brand-border last:border-b-0">
                                <button onClick={() => setApiAccordion(apiAccordion === 'claude' ? 'none' : 'claude')} className="w-full flex items-center justify-between p-5 bg-brand-secondary/50 hover:bg-brand-secondary transition-colors text-left">
                                  <div>
                                    <h4 className="text-sm font-bold text-white flex items-center gap-2">Claude Keys (Anthropic)</h4>
                                    <p className="text-xs text-brand-subtext mt-1">{claudeKeys.filter(k => k.key.trim()).length} key loaded (14 Day Limit)</p>
                                  </div>
                                  {apiAccordion === 'claude' ? <ChevronDown size={20} className="text-brand-subtext" /> : <ChevronRight size={20} className="text-brand-subtext" />}
                                </button>
                                {apiAccordion === 'claude' && (
                                  <div className="p-5 bg-brand-card space-y-3">
                                    {Array.from({ length: 2 }).map((_, i) => {
                                      return (
                                        <div key={`claude-${i}`}>
                                          <div className="flex justify-between items-center mb-1">
                                            <label className="text-[10px] font-bold text-brand-subtext uppercase">Key {i + 1} {i === 0 ? '(Mandatory)' : '(Optional)'}</label>
                                          </div>
                                          <div className="relative">
                                            <input
                                              type={showClaudeKeys[i] ? "text" : "password"}
                                              value={claudeKeys[i].key}
                                              onChange={e => {
                                                const newKeys = [...claudeKeys];
                                                newKeys[i] = { key: e.target.value, addedAt: e.target.value ? Date.now() : 0 };
                                                setClaudeKeys(newKeys);
                                              }}
                                              className="w-full bg-brand-secondary border border-brand-border rounded-lg pl-3 pr-[100px] py-2 text-sm outline-none focus:border-brand-accent text-white transition-all"
                                              placeholder={`sk-ant-...`}
                                            />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                              {claudeKeyStatus[i] === 'validating' && <div><Loader2 size={16} className="animate-spin text-brand-subtext" /></div>}
                                              {claudeKeyStatus[i] === 'valid' && <div><CheckCircle2 size={16} className="text-green-500" /></div>}
                                              {claudeKeyStatus[i] === 'invalid' && <div><XCircle size={16} className="text-rose-500" /></div>}
                                              <button onClick={() => {
                                                const newShow = [...showClaudeKeys];
                                                newShow[i] = !newShow[i];
                                                setShowClaudeKeys(newShow);
                                              }} className="text-brand-subtext hover:text-white transition-colors">
                                                {showClaudeKeys[i] ? <Eye size={14} /> : <EyeOff size={14} />}
                                              </button>
                                              <button onClick={async () => {
                                                try {
                                                  const text = clipboard.readText();
                                                  if (text && text.trim()) {
                                                    const newKeys = [...claudeKeys];
                                                    newKeys[i] = { key: text.trim(), addedAt: Date.now() };
                                                    setClaudeKeys(newKeys);
                                                  }
                                                } catch (e) { }
                                              }} className="text-brand-subtext hover:text-blue-400 transition-colors">
                                                <ClipboardPaste size={14} />
                                              </button>
                                              <button onClick={() => {
                                                const newKeys = [...claudeKeys];
                                                newKeys[i] = { key: '', addedAt: 0 };
                                                setClaudeKeys(newKeys);
                                                setDeleteMessage({ provider: 'claude', index: i });
                                                setTimeout(() => setDeleteMessage(null), 3000);
                                              }} className="text-rose-500 hover:text-rose-400 transition-colors">
                                                <Trash2 size={14} />
                                              </button>
                                            </div>
                                          </div>
                                          {deleteMessage?.provider === 'claude' && deleteMessage?.index === i && (
                                            <p className="text-rose-400 text-[10px] mt-1 font-bold animate-in fade-in">API Key deleted</p>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                              {/* GLM Accordion */}
                              <div className="border-b border-brand-border last:border-b-0">
                                <button onClick={() => setApiAccordion(apiAccordion === 'glm' ? 'none' : 'glm')} className="w-full flex items-center justify-between p-5 bg-brand-secondary/50 hover:bg-brand-secondary transition-colors text-left">
                                  <div>
                                    <h4 className="text-sm font-bold text-white flex items-center gap-2">GLM / NVIDIA Keys</h4>
                                    <p className="text-xs text-brand-subtext mt-1">{glmKeys.filter(k => k.key.trim()).length} keys loaded (Used for LLM)</p>
                                  </div>
                                  {apiAccordion === 'glm' ? <ChevronDown size={20} className="text-brand-subtext" /> : <ChevronRight size={20} className="text-brand-subtext" />}
                                </button>

                                {apiAccordion === 'glm' && (
                                  <div className="p-5 bg-brand-card space-y-3">
                                    {Array.from({ length: 3 }).map((_, i) => (
                                      <div key={`glm-${i}`}>
                                        <label className="block text-[10px] font-bold text-brand-subtext uppercase mb-1">Key {i + 1} {i === 0 ? '(Mandatory)' : '(Optional)'}</label>
                                        <div className="relative">
                                          <input
                                            type={showGlmKeys[i] ? "text" : "password"}
                                            value={glmKeys[i].key}
                                            onChange={e => {
                                              const newKeys = [...glmKeys];
                                              newKeys[i] = { key: e.target.value, addedAt: e.target.value ? Date.now() : 0 };
                                              setGlmKeys(newKeys);
                                            }}

                                            className="w-full bg-brand-secondary border border-brand-border rounded-lg pl-3 pr-[100px] py-2 text-sm outline-none focus:border-brand-accent text-white transition-all"
                                            placeholder={`nvapi- or Zhipu key`}
                                          />
                                          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                            {glmKeyStatus[i] === 'validating' && <div><Loader2 size={16} className="animate-spin text-brand-subtext" /></div>}
                                            {glmKeyStatus[i] === 'valid' && <div><CheckCircle2 size={16} className="text-green-500" /></div>}
                                            {glmKeyStatus[i] === 'invalid' && <div><XCircle size={16} className="text-rose-500" /></div>}
                                            {glmKeyStatus[i] === 'duplicate' && <div><AlertTriangle size={16} className="text-yellow-500" /></div>}
                                            <button onClick={() => {
                                              const newShow = [...showGlmKeys];
                                              newShow[i] = !newShow[i];
                                              setShowGlmKeys(newShow);
                                            }} className="text-brand-subtext hover:text-white transition-colors">
                                              {showGlmKeys[i] ? <Eye size={14} /> : <EyeOff size={14} />}
                                            </button>
                                            <button onClick={async () => {
                                              try {
                                                const text = clipboard.readText();
                                                if (text && text.trim()) {
                                                  const newKeys = [...glmKeys];
                                                  newKeys[i] = { key: text.trim(), addedAt: Date.now() };
                                                  setGlmKeys(newKeys);
                                                }
                                              } catch (e) { }
                                            }} className="text-brand-subtext hover:text-blue-400 transition-colors">
                                              <ClipboardPaste size={14} />
                                            </button>
                                            <button onClick={() => {
                                              const newKeys = [...glmKeys];
                                              newKeys[i] = { key: '', addedAt: 0 };
                                              setGlmKeys(newKeys);
                                              setDeleteMessage({ provider: 'glm', index: i });
                                              setTimeout(() => setDeleteMessage(null), 3000);
                                            }} className="text-rose-500 hover:text-rose-400 transition-colors">
                                              <Trash2 size={14} />
                                            </button>
                                          </div>
                                        </div>
                                        {deleteMessage?.provider === 'glm' && deleteMessage?.index === i && (
                                          <p className="text-rose-400 text-[10px] mt-1 font-bold animate-in fade-in">API Key deleted</p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>


                              {/* ChatGPT Accordion */}
                              <div className="border-b border-brand-border last:border-b-0">
                                <button onClick={() => setApiAccordion(apiAccordion === 'chatgpt' ? 'none' : 'chatgpt')} className="w-full flex items-center justify-between p-5 bg-brand-secondary/50 hover:bg-brand-secondary transition-colors text-left">
                                  <div>
                                    <h4 className="text-sm font-bold text-white flex items-center gap-2">ChatGPT Keys (OpenAI)</h4>
                                    <p className="text-xs text-brand-subtext mt-1">{chatgptKeys.filter(k => k.key.trim()).length} keys loaded (90 Day Limit)</p>
                                  </div>
                                  {apiAccordion === 'chatgpt' ? <ChevronDown size={20} className="text-brand-subtext" /> : <ChevronRight size={20} className="text-brand-subtext" />}
                                </button>
                                {apiAccordion === 'chatgpt' && (
                                  <div className="p-5 bg-brand-card space-y-3">
                                    {Array.from({ length: 3 }).map((_, i) => {
                                      return (
                                        <div key={`chatgpt-${i}`}>
                                          <div className="flex justify-between items-center mb-1">
                                            <label className="text-[10px] font-bold text-brand-subtext uppercase">Key {i + 1} {i === 0 ? '(Mandatory)' : '(Optional)'}</label>
                                          </div>
                                          <div className="relative">
                                            <input
                                              type={showChatgptKeys[i] ? "text" : "password"}
                                              value={chatgptKeys[i].key}
                                              onChange={e => {
                                                const newKeys = [...chatgptKeys];
                                                newKeys[i] = { key: e.target.value, addedAt: e.target.value ? Date.now() : 0 };
                                                setChatgptKeys(newKeys);
                                              }}
                                              className="w-full bg-brand-secondary border border-brand-border rounded-lg pl-3 pr-[100px] py-2 text-sm outline-none focus:border-brand-accent text-white transition-all"
                                              placeholder={`sk-...`}
                                            />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                              {chatgptKeyStatus[i] === 'validating' && <div><Loader2 size={16} className="animate-spin text-brand-subtext" /></div>}
                                              {chatgptKeyStatus[i] === 'valid' && <div><CheckCircle2 size={16} className="text-green-500" /></div>}
                                              {chatgptKeyStatus[i] === 'invalid' && <div><XCircle size={16} className="text-rose-500" /></div>}
                                              <button onClick={() => {
                                                const newShow = [...showChatgptKeys];
                                                newShow[i] = !newShow[i];
                                                setShowChatgptKeys(newShow);
                                              }} className="text-brand-subtext hover:text-white transition-colors">
                                                {showChatgptKeys[i] ? <Eye size={14} /> : <EyeOff size={14} />}
                                              </button>
                                              <button onClick={async () => {
                                                try {
                                                  const text = clipboard.readText();
                                                  if (text && text.trim()) {
                                                    const newKeys = [...chatgptKeys];
                                                    newKeys[i] = { key: text.trim(), addedAt: Date.now() };
                                                    setChatgptKeys(newKeys);
                                                  }
                                                } catch (e) { }
                                              }} className="text-brand-subtext hover:text-blue-400 transition-colors">
                                                <ClipboardPaste size={14} />
                                              </button>
                                              <button onClick={() => {
                                                const newKeys = [...chatgptKeys];
                                                newKeys[i] = { key: '', addedAt: 0 };
                                                setChatgptKeys(newKeys);
                                                setDeleteMessage({ provider: 'chatgpt', index: i });
                                                setTimeout(() => setDeleteMessage(null), 3000);
                                              }} className="text-rose-500 hover:text-rose-400 transition-colors">
                                                <Trash2 size={14} />
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>

                              {/* DeepSeek Accordion */}
                              <div className="border-b border-brand-border last:border-b-0">
                                <button onClick={() => setApiAccordion(apiAccordion === 'deepseek' ? 'none' : 'deepseek')} className="w-full flex items-center justify-between p-5 bg-brand-secondary/50 hover:bg-brand-secondary transition-colors text-left">
                                  <div>
                                    <h4 className="text-sm font-bold text-white flex items-center gap-2">DeepSeek Keys</h4>
                                    <p className="text-xs text-brand-subtext mt-1">{deepseekKeys.filter(k => k.key.trim()).length} keys loaded</p>
                                  </div>
                                  {apiAccordion === 'deepseek' ? <ChevronDown size={20} className="text-brand-subtext" /> : <ChevronRight size={20} className="text-brand-subtext" />}
                                </button>
                                {apiAccordion === 'deepseek' && (
                                  <div className="p-5 bg-brand-card space-y-3">
                                    {Array.from({ length: 3 }).map((_, i) => {
                                      return (
                                        <div key={`deepseek-${i}`}>
                                          <div className="flex justify-between items-center mb-1">
                                            <label className="text-[10px] font-bold text-brand-subtext uppercase">Key {i + 1} {i === 0 ? '(Mandatory)' : '(Optional)'}</label>
                                            <div className="flex gap-2">
                                              {deepseekBalances[i] && <span className="text-[10px] font-bold text-green-400">Bal: ${deepseekBalances[i]}</span>}
                                            </div>
                                          </div>
                                          <div className="relative">
                                            <input
                                              type={showDeepseekKeys[i] ? "text" : "password"}
                                              value={deepseekKeys[i].key}
                                              onChange={e => {
                                                const newKeys = [...deepseekKeys];
                                                newKeys[i] = { key: e.target.value, addedAt: e.target.value ? Date.now() : 0 };
                                                setDeepseekKeys(newKeys);
                                              }}
                                              className="w-full bg-brand-secondary border border-brand-border rounded-lg pl-3 pr-[100px] py-2 text-sm outline-none focus:border-brand-accent text-white transition-all"
                                              placeholder={`sk-...`}
                                            />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                              {deepseekKeyStatus[i] === 'validating' && <div><Loader2 size={16} className="animate-spin text-brand-subtext" /></div>}
                                              {deepseekKeyStatus[i] === 'valid' && <div><CheckCircle2 size={16} className="text-green-500" /></div>}
                                              {deepseekKeyStatus[i] === 'invalid' && <div><XCircle size={16} className="text-rose-500" /></div>}
                                              <button onClick={() => {
                                                const newShow = [...showDeepseekKeys];
                                                newShow[i] = !newShow[i];
                                                setShowDeepseekKeys(newShow);
                                              }} className="text-brand-subtext hover:text-white transition-colors">
                                                {showDeepseekKeys[i] ? <Eye size={14} /> : <EyeOff size={14} />}
                                              </button>
                                              <button onClick={async () => {
                                                try {
                                                  const text = clipboard.readText();
                                                  if (text && text.trim()) {
                                                    const newKeys = [...deepseekKeys];
                                                    newKeys[i] = { key: text.trim(), addedAt: Date.now() };
                                                    setDeepseekKeys(newKeys);
                                                  }
                                                } catch (e) { }
                                              }} className="text-brand-subtext hover:text-blue-400 transition-colors">
                                                <ClipboardPaste size={14} />
                                              </button>
                                              <button onClick={() => {
                                                const newKeys = [...deepseekKeys];
                                                newKeys[i] = { key: '', addedAt: 0 };
                                                setDeepseekKeys(newKeys);

                                                const newBals = [...deepseekBalances];
                                                newBals[i] = '';
                                                setDeepseekBalances(newBals);

                                                setDeleteMessage({ provider: 'deepseek', index: i });
                                                setTimeout(() => setDeleteMessage(null), 3000);
                                              }} className="text-rose-500 hover:text-rose-400 transition-colors">
                                                <Trash2 size={14} />
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          </section>

                          {/* Interview Context */}
                          <section>
                            <h3 className="text-sm font-bold text-brand-accent uppercase tracking-wider mb-4 flex items-center gap-2"><FileText size={16} /> Interview Context</h3>
                            <div className="bg-brand-card p-6 rounded-2xl border border-brand-border shadow-lg">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Interview Title */}
                                <div className="md:col-span-2">
                                  <label className="block text-xs font-black text-brand-subtext uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <Layout size={14} className="text-brand-accent" /> Title of Interview
                                  </label>
                                  <input
                                    type="text"
                                    value={interviewTitle}
                                    onChange={e => setInterviewTitle(e.target.value)}
                                    className="w-full bg-brand-bg/50 border border-brand-border rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent/50 text-white transition-all placeholder:text-white/20"
                                    placeholder="e.g. Senior Backend Developer"
                                  />
                                </div>

                                {/* Resume Context 1 */}
                                <div className="bg-brand-bg/30 p-4 rounded-xl border border-white/5 group hover:border-brand-accent/30 transition-all duration-150">
                                  <div className="flex items-center justify-between mb-4">
                                    <label className="text-xs font-black text-brand-subtext uppercase tracking-widest flex items-center gap-2">
                                      <FileText size={14} className="text-blue-400" /> Resume Context 1
                                    </label>
                                    <label className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-brand-text cursor-pointer hover:text-brand-accent transition-colors">
                                      <input type="radio" name="resumePriority" checked={resumePriority === 1} onChange={() => setResumePriority(1)} className="accent-brand-accent cursor-pointer" />
                                      <span className={resumePriority === 1 ? 'text-brand-accent' : ''}>High Priority</span>
                                    </label>
                                  </div>

                                  <div className="flex flex-col gap-3">
                                    <div className="flex items-center gap-3">
                                      <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg cursor-pointer transition-all text-xs font-bold">
                                        {isUploadingResume ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                                        {isUploadingResume ? 'Analyzing...' : 'Upload PDF/TXT'}
                                        <input type="file" accept=".pdf,.txt" className="hidden" onChange={(e) => handleFileUpload(e, 'resume1')} disabled={isUploadingResume} />
                                      </label>
                                      {resumeFileName && !isUploadingResume && (
                                        <div className="flex-1 flex items-center gap-2 overflow-hidden bg-green-500/10 border border-green-500/20 rounded-lg px-2 py-1.5">
                                          <span className="text-[10px] text-green-400 font-medium truncate flex-1 flex items-center gap-1.5">
                                            <FileText size={12} className="shrink-0" /> {resumeFileName}
                                          </span>
                                          <button onClick={() => handleDeleteFile('resume1')} className="text-rose-400 hover:text-rose-300 shrink-0 p-1 bg-rose-500/20 rounded hover:bg-rose-500/30 transition-colors">
                                            <Trash2 size={12} />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                    <textarea
                                      value={resumeText}
                                      onChange={(e) => setResumeText(e.target.value)}
                                      className="w-full h-32 bg-black/40 border border-white/5 rounded-lg p-3 text-[11px] text-white/80 font-mono resize-y outline-none focus:border-blue-400/50 custom-scrollbar whitespace-pre-wrap placeholder:text-white/20"
                                      placeholder="Paste your resume text here or upload a file..."
                                    />
                                  </div>
                                </div>

                                {/* Resume Context 2 */}
                                <div className="bg-brand-bg/30 p-4 rounded-xl border border-white/5 group hover:border-brand-accent/30 transition-all duration-150">
                                  <div className="flex items-center justify-between mb-4">
                                    <label className="text-xs font-black text-brand-subtext uppercase tracking-widest flex items-center gap-2">
                                      <FileText size={14} className="text-cyan-400" /> Resume Context 2
                                    </label>
                                    <label className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-brand-text cursor-pointer hover:text-brand-accent transition-colors">
                                      <input type="radio" name="resumePriority" checked={resumePriority === 2} onChange={() => setResumePriority(2)} className="accent-brand-accent cursor-pointer" />
                                      <span className={resumePriority === 2 ? 'text-brand-accent' : ''}>High Priority</span>
                                    </label>
                                  </div>

                                  <div className="flex flex-col gap-3">
                                    <div className="flex items-center gap-3">
                                      <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 rounded-lg cursor-pointer transition-all text-xs font-bold">
                                        {isUploadingResume2 ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                                        {isUploadingResume2 ? 'Analyzing...' : 'Upload PDF/TXT'}
                                        <input type="file" accept=".pdf,.txt" className="hidden" onChange={(e) => handleFileUpload(e, 'resume2')} disabled={isUploadingResume2} />
                                      </label>
                                      {resumeFileName2 && !isUploadingResume2 && (
                                        <div className="flex-1 flex items-center gap-2 overflow-hidden bg-green-500/10 border border-green-500/20 rounded-lg px-2 py-1.5">
                                          <span className="text-[10px] text-green-400 font-medium truncate flex-1 flex items-center gap-1.5">
                                            <FileText size={12} className="shrink-0" /> {resumeFileName2}
                                          </span>
                                          <button onClick={() => handleDeleteFile('resume2')} className="text-rose-400 hover:text-rose-300 shrink-0 p-1 bg-rose-500/20 rounded hover:bg-rose-500/30 transition-colors">
                                            <Trash2 size={12} />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                    <textarea
                                      value={resumeText2}
                                      onChange={(e) => setResumeText2(e.target.value)}
                                      className="w-full h-32 bg-black/40 border border-white/5 rounded-lg p-3 text-[11px] text-white/80 font-mono resize-y outline-none focus:border-cyan-400/50 custom-scrollbar whitespace-pre-wrap placeholder:text-white/20"
                                      placeholder="Paste your second resume text here or upload a file..."
                                    />
                                  </div>
                                </div>

                                {/* Personal Context */}
                                <div className="md:col-span-2 bg-brand-bg/30 p-4 rounded-xl border border-white/5 group hover:border-brand-accent/30 transition-all duration-150">
                                  <div className="mb-4">
                                    <label className="text-xs font-black text-brand-subtext uppercase tracking-widest flex items-center gap-2 mb-1">
                                      <User size={14} className="text-fuchsia-400" /> Personal Context
                                    </label>
                                    <p className="text-[10px] text-brand-subtext/70 italic">High Priority: This document should contain information about yourself (strengths, weaknesses, hobbies, background).</p>
                                  </div>

                                  <div className="flex flex-col gap-3">
                                    <div className="flex items-center gap-3 w-1/2">
                                      <label className="flex items-center justify-center gap-2 px-4 py-2 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 border border-fuchsia-500/30 text-fuchsia-400 rounded-lg cursor-pointer transition-all text-xs font-bold shrink-0">
                                        {isUploadingPersonalContext ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                                        {isUploadingPersonalContext ? 'Analyzing...' : 'Upload PDF/TXT'}
                                        <input type="file" accept=".pdf,.txt" className="hidden" onChange={(e) => handleFileUpload(e, 'personal')} disabled={isUploadingPersonalContext} />
                                      </label>
                                      {personalContextFileName && !isUploadingPersonalContext && (
                                        <div className="flex-1 flex items-center gap-2 overflow-hidden bg-green-500/10 border border-green-500/20 rounded-lg px-2 py-1.5">
                                          <span className="text-[10px] text-green-400 font-medium truncate flex-1 flex items-center gap-1.5">
                                            <FileText size={12} className="shrink-0" /> {personalContextFileName}
                                          </span>
                                          <button onClick={() => handleDeleteFile('personal')} className="text-rose-400 hover:text-rose-300 shrink-0 p-1 bg-rose-500/20 rounded hover:bg-rose-500/30 transition-colors">
                                            <Trash2 size={12} />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                    <textarea
                                      value={personalContextText}
                                      onChange={(e) => setPersonalContextText(e.target.value)}
                                      className="w-full h-32 bg-black/40 border border-white/5 rounded-lg p-3 text-[11px] text-white/80 font-mono resize-y outline-none focus:border-fuchsia-400/50 custom-scrollbar whitespace-pre-wrap placeholder:text-white/20"
                                      placeholder="Paste your personal context here (strengths, weaknesses, background) or upload a file..."
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </section>

                          {/* Sound Settings */}
                          <section>
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-sm font-bold text-brand-subtext uppercase tracking-wider flex items-center gap-2">
                                <Mic size={16} className="text-cyan-400" /> Audio & Microphone Settings
                              </h3>
                              <button
                                onClick={fetchAudioDevices}
                                className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-white/5"
                              >
                                <RefreshCw size={12} /> Re-scan Devices
                              </button>
                            </div>

                            <div className="bg-brand-card p-5 rounded-2xl border border-brand-border space-y-5">
                              {/* Microphone Input Device Selection */}
                              <div className="pb-4 border-b border-brand-border">
                                <div className="flex items-center justify-between mb-2">
                                  <div>
                                    <h4 className="text-sm font-bold text-white mb-0.5 flex items-center gap-2">
                                      Active Microphone (Input)
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                        {availableMics.length} Available
                                      </span>
                                    </h4>
                                    <p className="text-xs text-brand-subtext">Choose which microphone ClueAI listens to during meetings</p>
                                  </div>
                                </div>
                                <div className="mt-2.5">
                                  <select
                                    value={selectedMicId}
                                    onChange={(e) => setSelectedMicId(e.target.value)}
                                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-medium text-white/90 outline-none focus:border-cyan-400/60 transition-colors cursor-pointer"
                                  >
                                    <option value="default">Default System Microphone ({activeMicName})</option>
                                    {availableMics.filter(m => m.deviceId !== 'default').map((m) => (
                                      <option key={m.deviceId} value={m.deviceId}>
                                        {m.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              {/* Live Voice Activity Meter (Voice Tester) */}
                              <div className="pb-4 border-b border-brand-border">
                                <div className="flex items-center justify-between mb-2">
                                  <div>
                                    <h4 className="text-sm font-bold text-white mb-0.5">Live Voice Activity Meter</h4>
                                    <p className="text-xs text-brand-subtext">Speak now to test your voice pickup in real-time</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${sysMicMuted ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]' : liveVoiceLevel > 15 ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse' : 'bg-white/20'}`} />
                                    <span className="text-xs font-mono font-bold text-white/80">
                                      {sysMicMuted ? 'Muted' : liveVoiceLevel > 15 ? 'Speaking' : 'Listening...'} ({liveVoiceLevel}%)
                                    </span>
                                  </div>
                                </div>
                                <div className="mt-2 w-full bg-black/60 h-3.5 rounded-full border border-white/10 overflow-hidden p-0.5 flex items-center">
                                  <div
                                    className={`h-full rounded-full transition-all duration-75 ${sysMicMuted ? 'bg-rose-500/50' : 'bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 shadow-[0_0_12px_rgba(6,182,212,0.6)]'}`}
                                    style={{ width: sysMicMuted ? '0%' : `${Math.max(3, liveVoiceLevel)}%` }}
                                  />
                                </div>
                              </div>

                              {/* Headphones / Audio Output Devices */}
                              <div className="pb-4 border-b border-brand-border">
                                <div className="flex items-center justify-between mb-2">
                                  <div>
                                    <h4 className="text-sm font-bold text-white mb-0.5 flex items-center gap-2">
                                      Connected Headphones / Speakers (Output)
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-white/70">
                                        {availableOutputs.length} Detected
                                      </span>
                                    </h4>
                                    <p className="text-xs text-brand-subtext">Where meeting and interviewer voices are currently playing</p>
                                  </div>
                                </div>
                                <div className="mt-2.5">
                                  <select
                                    value={selectedOutputId}
                                    onChange={(e) => setSelectedOutputId(e.target.value)}
                                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-medium text-white/90 outline-none focus:border-cyan-400/60 transition-colors cursor-pointer"
                                  >
                                    <option value="default">Default System Audio Output</option>
                                    {availableOutputs.filter(o => o.deviceId !== 'default').map((o) => (
                                      <option key={o.deviceId} value={o.deviceId}>
                                        {o.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              {/* Microphone Volume Slider */}
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="text-sm font-bold text-white mb-1">Microphone Volume</h4>
                                  <p className="text-xs text-brand-subtext">Synced directly with Windows system audio</p>
                                </div>
                                <div className="flex items-center gap-3 w-1/2">
                                  <span className="text-xs font-mono text-cyan-300 font-bold w-10 text-right">{sysMicVolume}%</span>
                                  <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={sysMicVolume}
                                    onChange={handleMicVolumeChange}
                                    className="w-full accent-cyan-400 cursor-pointer"
                                    disabled={sysMicMuted}
                                  />
                                </div>
                              </div>

                              {/* Microphone Mute Toggle & Windows Sound Link */}
                              <div className="flex items-center justify-between pt-4 border-t border-brand-border">
                                <div>
                                  <h4 className="text-sm font-bold text-white mb-1">Microphone Mute Status</h4>
                                  <p className="text-xs text-brand-subtext">Toggle microphone on or off at the system level</p>
                                </div>
                                <div className="flex items-center gap-2.5">
                                  <button
                                    onClick={() => {
                                      minimizeApp();
                                      shell.openExternal('ms-settings:sound');
                                    }}
                                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-brand-border text-white/80 hover:text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
                                  >
                                    Windows Sound Settings
                                  </button>
                                  <button
                                    onClick={handleMicMuteToggle}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-md ${sysMicMuted ? 'bg-rose-500/25 text-rose-300 border border-rose-500/50 hover:bg-rose-500/35' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'}`}
                                  >
                                    {sysMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </section>

                          {/* Software Updates Section */}
                          <section>
                            <h3 className="text-sm font-bold text-brand-subtext uppercase tracking-wider mb-4 flex items-center gap-2"><Sparkles size={16} className="text-cyan-400" /> Software Updates</h3>
                            <div className="bg-brand-card p-5 rounded-2xl border border-brand-border flex items-center justify-between">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-bold text-white">ClueAI Version</span>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                                    v{appVersion}
                                  </span>
                                  {(updateStatus === 'available' || updateStatus === 'downloaded') && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                                      Update Available: v{updateInfo.version}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-brand-subtext">Free on-demand updates powered directly via ClueAI Cloud Server.</p>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    setShowSettings(false);
                                    setShowUpdateModal(true);
                                    if (updateStatus === 'idle') handleCheckForUpdates();
                                  }}
                                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer ${updateStatus === 'available' || updateStatus === 'downloaded'
                                    ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:scale-105 active:scale-95 animate-pulse border border-emerald-400/50 shadow-[0_0_15px_rgba(16,185,129,0.35)]'
                                    : 'bg-white/10 hover:bg-white/20 text-white border border-white/10 hover:border-cyan-400/40'
                                    }`}
                                >
                                  <Sparkles size={13} />
                                  <span>{updateStatus === 'available' || updateStatus === 'downloaded' ? 'View & Install Update' : 'Check for Updates'}</span>
                                </button>
                              </div>
                            </div>
                          </section>

                          {/* Display */}
                          <section className="pb-10">
                            <h3 className="text-sm font-bold text-brand-subtext uppercase tracking-wider mb-4 flex items-center gap-2"><LayoutPanelTop size={16} /> Display Settings</h3>
                            <div className="grid grid-cols-2 gap-6 bg-brand-card p-5 rounded-2xl border border-brand-border">
                              <div>
                                <label className="block text-xs font-bold text-brand-subtext uppercase mb-3">Window Opacity ({Math.round(opacity * 100)}%)</label>
                                <input type="range" min="0.2" max="1.0" step="0.05" value={opacity} onChange={(e) => setOpacity(parseFloat(e.target.value))} className="w-full accent-brand-accent" />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-brand-subtext uppercase mb-3">Layout Style</label>
                                <button onClick={() => setLayout(layout === 'vertical' ? 'horizontal' : 'vertical')} className="w-full bg-brand-secondary border border-brand-border hover:bg-white/10 py-2.5 rounded-lg text-xs font-bold text-brand-text transition-all">Toggle Vertical / Horizontal</button>
                              </div>
                            </div>
                          </section>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Audio Error Modal */}
              {showAudioErrorModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                  <div className="bg-brand-bg rounded-2xl w-full max-w-md shadow-2xl border border-rose-500/50 flex flex-col overflow-hidden relative">
                    <div className="bg-rose-500/10 p-6 flex flex-col items-center text-center border-b border-rose-500/20">
                      <div className="w-16 h-16 bg-rose-500/20 rounded-full flex items-center justify-center mb-4">
                        <AlertTriangle size={32} className="text-rose-500" />
                      </div>
                      <h2 className="text-xl font-black text-rose-500 uppercase tracking-wide mb-2">Critical Audio Error</h2>
                      <p className="text-brand-subtext text-sm mb-4 leading-relaxed">
                        Your microphone is currently {sysMicMuted ? 'muted' : `too quiet (Volume: ${sysMicVolume}%)`}.
                        <br /><br />
                        The AI will not be able to hear you properly during the interview. Please adjust your system settings.
                      </p>
                      <button
                        onClick={() => {
                          setShowAudioErrorModal(false);
                          minimizeApp();
                          setTimeout(() => {
                            try {
                              const { exec } = (window as any).require('child_process');
                              exec('powershell -Command "Start-Process \'ms-settings:sound\' -WindowStyle Maximized"');
                            } catch (e) {
                              shell.openExternal('ms-settings:sound');
                            }
                          }, 500);
                        }}
                        className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 rounded-lg shadow-lg shadow-rose-500/20 transition-all uppercase tracking-widest text-sm"
                      >
                        Correct It Now
                      </button>
                    </div>
                    <button
                      onClick={() => setShowAudioErrorModal(false)}
                      className="absolute top-3 right-3 p-1.5 bg-black/20 hover:bg-black/40 rounded-lg text-white/50 hover:text-white transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* Dashboard Empty State with Scroll-Collapsing Top Sections */}
              {!isRecording && (
                <div className="flex-1 min-h-0 flex flex-col mt-2 px-2 pb-4 overflow-hidden">
                  {/* Upper Two Sections with Smooth Scroll-Collapse Transition */}
                  <motion.div 
                    animate={{ 
                      height: isHistoryScrolled ? 74 : 205,
                      marginBottom: isHistoryScrolled ? 10 : 18
                    }}
                    transition={{ type: "spring", stiffness: 380, damping: 28 }}
                    className="grid grid-cols-2 gap-4 shrink-0 overflow-hidden"
                  >
                    {/* Card 1: Farhan Khalid Portfolio Card */}
                    <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl px-5 py-3 relative overflow-hidden shadow-lg border border-blue-500/30 flex flex-col justify-center text-center cursor-default h-full transition-all">
                      <div className="absolute -top-12 -right-12 w-28 h-28 bg-cyan-400/20 rounded-full blur-2xl pointer-events-none" />
                      {!isHistoryScrolled ? (
                        <>
                          <h2 className="text-2xl font-bold text-white mb-1.5 tracking-tight">Made by Farhan Khalid</h2>
                          <p className="text-blue-100/80 text-xs mb-4 leading-relaxed font-medium">Developer & Engineer<br />Development driven by real users • Faster iteration on features</p>
                          <button onClick={() => { ipcRenderer.invoke('minimize-window'); shell.openExternal('https://farhan-khalid-portfolio.vercel.app/'); }} className="bg-[#FDE047] text-yellow-900 px-5 py-2 rounded-full font-bold text-xs shadow-md flex items-center justify-center gap-2 hover:bg-yellow-300 hover:scale-105 active:scale-95 transition-all self-center cursor-pointer">✨ View Portfolio &rarr;</button>
                        </>
                      ) : (
                        <div className="flex items-center justify-between w-full px-2">
                          <div className="text-left">
                            <h2 className="text-sm font-black text-white tracking-tight flex items-center gap-2">
                              <span>Made by Farhan Khalid</span>
                              <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-normal">Engineer</span>
                            </h2>
                            <p className="text-blue-200/80 text-[11px] mt-0.5">Development driven by real users</p>
                          </div>
                          <button onClick={() => { ipcRenderer.invoke('minimize-window'); shell.openExternal('https://farhan-khalid-portfolio.vercel.app/'); }} className="bg-[#FDE047] text-yellow-900 px-3.5 py-1.5 rounded-full font-bold text-[11px] shadow flex items-center gap-1.5 hover:bg-yellow-300 hover:scale-105 active:scale-95 transition-all cursor-pointer">✨ Portfolio &rarr;</button>
                        </div>
                      )}
                    </div>

                    {/* Card 2: Interview and Notes Reminder Card */}
                    <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl px-5 py-3 relative overflow-hidden shadow-lg border border-blue-400/30 flex flex-col justify-center cursor-default h-full transition-all">
                      {!isHistoryScrolled ? (
                        <>
                          <div className="flex flex-col mb-2 w-full shrink-0">
                            <h3 className="font-bold text-white tracking-tight flex items-center justify-center gap-2 text-lg w-full mb-2">
                              <div className="w-5 h-5 rounded bg-white/20 text-white flex items-center justify-center">
                                <CheckCircle2 size={12} />
                              </div>
                              Interview and Notes Reminder
                            </h3>
                            <div className="flex justify-center items-center gap-3 w-full px-2">
                              <button
                                onClick={() => {
                                  setReminderForm({ id: '', name: '', jobTitle: '', email: userEmail || '', phone: '', date: '', time: '', ampm: 'AM' });
                                  setLocalReminderStealth(stealthMode);
                                  setReminderPopupMode('create');
                                  setShowReminderPopup(true);
                                }}
                                className="bg-white/20 text-white hover:bg-white px-3 py-1 rounded-lg font-bold hover:text-blue-600 transition-all flex items-center gap-1.5 text-xs shadow-sm cursor-pointer"
                              >
                                <Plus size={13} /> Create Reminder
                              </button>
                              <button
                                onClick={() => {
                                  setNotesForm({ id: '', notes: '', email: userEmail || '', date: '', time: '', ampm: 'AM' });
                                  setLocalNotesStealth(stealthMode);
                                  setNotesPopupMode('create');
                                  setShowNotesPopup(true);
                                }}
                                className="bg-teal-500/80 text-white hover:bg-teal-400 px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 text-xs shadow-sm cursor-pointer"
                              >
                                <Plus size={13} /> New Note
                              </button>
                            </div>
                          </div>

                          <div className="w-full space-y-1.5 flex-1 overflow-y-auto pr-1 custom-scrollbar max-h-24">
                            {(() => {
                              const combined = [
                                ...reminderProfiles.map(p => ({ ...p, type: 'reminder' as const })),
                                ...notesProfiles.map(p => ({ ...p, type: 'note' as const }))
                              ].sort((a, b) => Number(b.id) - Number(a.id));

                              if (combined.length === 0) {
                                return <p className="text-blue-100/50 text-xs italic py-2 text-center h-full flex items-center justify-center">No reminders or notes saved yet.</p>;
                              }

                              return combined.map(prof => {
                                let isPast = false;
                                try {
                                  const [d, m, y] = prof.date.split('-');
                                  const [h, min] = prof.time.split(':');
                                  let hours = parseInt(h);
                                  if (prof.ampm === 'PM' && hours < 12) hours += 12;
                                  if (prof.ampm === 'AM' && hours === 12) hours = 0;
                                  const targetDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d), hours, parseInt(min));
                                  isPast = new Date() > targetDate;
                                } catch (e) { }

                                if (prof.type === 'reminder') {
                                  return (
                                    <div
                                      key={prof.id}
                                      className="bg-blue-900/40 hover:bg-blue-900/60 rounded-xl p-2 backdrop-blur-md flex justify-between items-center w-full border border-blue-400/20 group cursor-pointer transition-colors text-left shrink-0"
                                      onClick={() => {
                                        setReminderForm(prof as any);
                                        setLocalReminderStealth(stealthMode);
                                        setReminderPopupMode('preview');
                                        setShowReminderPopup(true);
                                      }}
                                    >
                                      <div className="flex flex-col flex-1 min-w-0 pr-2">
                                        <span className="font-bold text-xs text-white truncate flex items-center gap-1.5">
                                          {prof.name}
                                          {isPast ? <span className="px-1 py-0.2 rounded bg-green-500/20 text-green-400 border border-green-500/30 text-[8.5px] uppercase">Sent</span> : <span className="px-1 py-0.2 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[8.5px] uppercase animate-pulse">Pending</span>}
                                        </span>
                                        <span className="text-[10px] text-blue-200 font-bold truncate">Reminder • <span className="opacity-70 font-normal">{prof.jobTitle}</span></span>
                                      </div>
                                      <span className="text-[10px] text-blue-300 font-medium bg-blue-500/20 px-1.5 py-0.5 rounded shrink-0">{prof.date}</span>
                                    </div>
                                  );
                                } else {
                                  return (
                                    <div
                                      key={prof.id}
                                      className="bg-teal-900/40 hover:bg-teal-900/60 rounded-xl p-2 backdrop-blur-md flex justify-between items-center w-full border border-teal-400/20 group cursor-pointer transition-colors text-left shrink-0"
                                      onClick={() => {
                                        setNotesForm(prof as any);
                                        setLocalNotesStealth(stealthMode);
                                        setNotesPopupMode('preview');
                                        setShowNotesPopup(true);
                                      }}
                                    >
                                      <div className="flex flex-col flex-1 min-w-0 pr-2">
                                        <span className="font-bold text-xs text-white truncate flex items-center gap-1.5">
                                          Note
                                          {isPast ? <span className="px-1 py-0.2 rounded bg-green-500/20 text-green-400 border border-green-500/30 text-[8.5px] uppercase">Sent</span> : <span className="px-1 py-0.2 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[8.5px] uppercase animate-pulse">Pending</span>}
                                        </span>
                                        <span className="text-[10px] text-teal-200 font-bold truncate">Note • <span className="opacity-70 font-normal">{prof.email}</span></span>
                                      </div>
                                      <span className="text-[10px] text-teal-300 font-medium bg-teal-500/20 px-1.5 py-0.5 rounded shrink-0">{prof.time} {prof.ampm}</span>
                                    </div>
                                  );
                                }
                              });
                            })()}
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-between w-full px-2">
                          <div className="text-left flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-white/20 text-white flex items-center justify-center shrink-0">
                              <CheckCircle2 size={14} />
                            </div>
                            <div>
                              <h3 className="font-black text-sm text-white tracking-tight">Interview & Reminders</h3>
                              <p className="text-blue-200/80 text-[11px]">{reminderProfiles.length + notesProfiles.length} active scheduled</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setReminderForm({ id: '', name: '', jobTitle: '', email: userEmail || '', phone: '', date: '', time: '', ampm: 'AM' });
                                setLocalReminderStealth(stealthMode);
                                setReminderPopupMode('create');
                                setShowReminderPopup(true);
                              }}
                              className="bg-white/20 text-white hover:bg-white hover:text-blue-600 px-2.5 py-1 rounded-lg font-bold transition-all text-xs flex items-center gap-1 cursor-pointer"
                            >
                              <Plus size={12} /> Reminder
                            </button>
                            <button
                              onClick={() => {
                                setNotesForm({ id: '', notes: '', email: userEmail || '', date: '', time: '', ampm: 'AM' });
                                setLocalNotesStealth(stealthMode);
                                setNotesPopupMode('create');
                                setShowNotesPopup(true);
                              }}
                              className="bg-teal-500/80 text-white hover:bg-teal-400 px-2.5 py-1 rounded-lg font-bold transition-all text-xs flex items-center gap-1 cursor-pointer"
                            >
                              <Plus size={12} /> Note
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>

                  {/* Session History Container with Scroll-Collapse Detection */}
                  <div 
                    className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-3 pb-4"
                    onScroll={(e) => {
                      const top = e.currentTarget.scrollTop;
                      if (top > 20 && !isHistoryScrolled) {
                        setIsHistoryScrolled(true);
                      } else if (top <= 5 && isHistoryScrolled) {
                        setIsHistoryScrolled(false);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between px-2 mb-2 sticky top-0 bg-[#09090b]/90 backdrop-blur-md py-1.5 z-20">
                      <h3 className="text-brand-subtext font-bold text-sm flex items-center gap-2">
                        <span>Yesterday</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 font-mono text-white/50">{sessions.length} sessions</span>
                      </h3>
                      {isHistoryScrolled && (
                        <button
                          onClick={() => setIsHistoryScrolled(false)}
                          className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 bg-cyan-500/10 hover:bg-cyan-500/20 px-2.5 py-1 rounded-full border border-cyan-500/30 transition-all cursor-pointer"
                        >
                          <ChevronUp size={12} /> Expand Cards
                        </button>
                      )}
                    </div>
                    
                    <div className="space-y-3">
                      {sessions.length === 0 ? (
                        <div className="text-brand-subtext text-sm italic px-2 py-4">No sessions saved yet. Start capturing to see history here!</div>
                      ) : sessions.map((session) => (
                        <div key={session.id} className={`flex flex-col bg-brand-secondary/30 rounded-xl transition-colors border border-brand-border group relative ${openMenuId === session.id ? "z-50 overflow-visible" : "z-10 overflow-hidden"}`}>
                          <div
                            className="flex justify-between items-center py-3 px-4 hover:bg-brand-secondary/80 cursor-pointer"
                            onClick={() => setExpandedSessionId(expandedSessionId === session.id ? null : session.id)}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              {expandedSessionId === session.id ? <ChevronDown size={16} className="text-brand-subtext shrink-0" /> : <ChevronRight size={16} className="text-brand-subtext shrink-0" />}
                              <span className="text-brand-text font-bold text-sm truncate">{session.name}</span>
                            </div>

                            <div className="flex items-center gap-6 text-brand-subtext text-xs font-mono shrink-0">
                              <span>{session.time}</span>
                              <button onClick={(e) => {
                                e.stopPropagation();
                                if (openMenuId === session.id) {
                                  setOpenMenuId(null);
                                  setMenuPos(null);
                                } else {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setOpenMenuId(session.id);
                                  setMenuPos({ top: rect.bottom, right: window.innerWidth - rect.right });
                                }
                              }} className="p-1 hover:bg-white/10 rounded-md transition-colors">
                                <MoreVertical size={16} />
                              </button>
                            </div>

                            {openMenuId === session.id && menuPos && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); setMenuPos(null); }}></div>
                                <div
                                  className="fixed bg-brand-secondary border border-brand-border rounded-lg shadow-xl z-[100] overflow-hidden min-w-[120px]"
                                  style={{ top: menuPos.top + 4, right: menuPos.right }}
                                >
                                  <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setEditingSessionId(session.id); setEditingSessionName(session.name); setOpenMenuId(null); setMenuPos(null); }} className="w-full text-left px-4 py-2 text-sm text-brand-text hover:bg-brand-accentSec flex items-center gap-2 transition-colors">
                                    <FileText size={14} /> Rename
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); exportSession(session); setOpenMenuId(null); setMenuPos(null); }} className="w-full text-left px-4 py-2 text-sm text-brand-text hover:bg-brand-accentSec flex items-center gap-2 transition-colors border-t border-brand-border">
                                    <Download size={14} /> Export
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); deleteSession(session.id); setOpenMenuId(null); setMenuPos(null); }} className="w-full text-left px-4 py-2 text-sm text-rose-400 hover:bg-rose-500 hover:text-white flex items-center gap-2 transition-colors border-t border-brand-border">
                                    <Trash2 size={14} /> Delete
                                  </button>
                                </div>
                              </>
                            )}
                          </div>

                          {/* Expanded Session History Accordion */}
                          {expandedSessionId === session.id && (
                            <div className="border-t border-brand-border bg-black/40 p-4 space-y-4 cursor-default" onClick={(e) => e.stopPropagation()}>
                              {(!session.history || session.history.length === 0) ? (
                                <div className="text-white/30 text-xs italic">No questions recorded in this session.</div>
                              ) : session.history.map((item, idx) => {
                                const stateKey = `${session.id}-${idx}`;
                                const isTranscriptExpanded = expandedHistoryItems[stateKey]?.transcript;
                                const isAnswerExpanded = expandedHistoryItems[stateKey]?.answer;

                                return (
                                  <div key={idx} className="bg-white/5 border border-white/5 rounded-lg overflow-hidden">

                                    {/* Transcript Header */}
                                    <div
                                      className="px-4 py-3 bg-white/5 hover:bg-white/10 cursor-pointer flex justify-between items-center transition-colors"
                                      onClick={() => toggleHistoryItem(session.id, idx, 'transcript')}
                                    >
                                      <h4 className="text-xs font-bold text-cyan-400 flex items-center gap-2">
                                        {isTranscriptExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        {idx + 1}st question - Transcript
                                      </h4>
                                      {item.modelInfo && (
                                        <span className="text-[10px] font-mono text-fuchsia-400 bg-fuchsia-400/10 border border-fuchsia-400/20 px-2 py-0.5 rounded-full">
                                          {item.modelInfo}
                                        </span>
                                      )}
                                    </div>

                                    {/* Transcript Body */}
                                    {isTranscriptExpanded && (
                                      <div className="p-4 text-xs text-white/80 whitespace-pre-wrap font-medium border-t border-white/5">
                                        {item.images && item.images.length > 0 && (
                                          <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                                            {item.images.map((img, i) => (
                                              <img key={i} src={img} className="h-24 rounded border border-white/10" alt="snapshot" />
                                            ))}
                                          </div>
                                        )}
                                        {item.question || "No transcript"}
                                      </div>
                                    )}

                                    {/* Answer Header */}
                                    <div
                                      className="px-4 py-3 bg-brand-accentSec/30 hover:bg-brand-accentSec/50 cursor-pointer flex items-center gap-2 transition-colors border-t border-white/5"
                                      onClick={() => toggleHistoryItem(session.id, idx, 'answer')}
                                    >
                                      <h4 className="text-xs font-bold text-brand-accent flex items-center gap-2">
                                        {isAnswerExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        Answer of {idx + 1} - Generate Ai
                                      </h4>
                                    </div>

                                    {/* Answer Body */}
                                    {isAnswerExpanded && (
                                      <div className="p-4 text-xs text-white/90 border-t border-white/5 bg-black/50 overflow-x-auto">
                                        <ReactMarkdown
                                          components={{
                                            code({ node, inline, className, children, ...props }: any) {
                                              const match = /language-(\w+)/.exec(className || '');
                                              return !inline && match ? (
                                                <SyntaxHighlighter
                                                  style={vscDarkPlus as any}
                                                  language={match[1]}
                                                  PreTag="div"
                                                  {...props}
                                                >
                                                  {String(children).replace(/\n$/, '')}
                                                </SyntaxHighlighter>
                                              ) : (
                                                <code className="bg-brand-secondary/80 text-brand-accent px-1.5 py-0.5 rounded text-[11px]" {...props}>
                                                  {children}
                                                </code>
                                              )
                                            }
                                          }}
                                        >
                                          {item.answer ? item.answer.replace(/(?:\r?\n){3,}/g, '\n\n').trim() : "No answer generated"}
                                        </ReactMarkdown>
                                      </div>
                                    )}

                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Main UI */}
              {isRecording && (
                <motion.div
                  key="command-dock-view"
                  initial={{ opacity: 0, scale: 0.98, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, y: -8 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className="flex-1 flex flex-col gap-4 min-h-0 relative px-4 pointer-events-auto"
                >
                  {/* Redesigned Sleek, Low-Profile Ultra-Wide Command Dock with Framer Motion */}
                  <div className="w-full flex justify-center items-center relative z-20">
                    <AnimatePresence mode="popLayout" initial={false}>
                      {isTranscriptMinimized ? (
                        <motion.div
                          key="minimized-dock"
                          layout
                          initial={{ opacity: 0, scale: 0.85, y: -8 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.85, y: -8 }}
                          transition={{ type: "spring", stiffness: 450, damping: 30 }}
                          onClick={() => setIsTranscriptMinimized(false)}
                          className="drag-area cursor-pointer group bg-[#0a0b12]/95 backdrop-blur-3xl border border-cyan-500/40 rounded-full px-5 py-2.5 shadow-[0_12px_35px_rgba(0,0,0,0.85),0_0_20px_rgba(6,182,212,0.25)] flex items-center gap-3.5 hover:border-cyan-400 hover:scale-105 transition-all select-none"
                        >
                          <div className="flex items-center gap-1.5 text-cyan-400">
                            <span className="relative flex h-2.5 w-2.5">
                              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${!isPaused ? 'bg-cyan-400' : 'bg-amber-400'}`}></span>
                              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${!isPaused ? 'bg-cyan-500' : 'bg-amber-500'}`}></span>
                            </span>
                            <div className="flex items-end gap-0.5 h-3">
                              <span className="w-0.5 h-2 bg-cyan-400 animate-pulse rounded-full" />
                              <span className="w-0.5 h-3 bg-cyan-300 animate-pulse delay-75 rounded-full" />
                              <span className="w-0.5 h-1.5 bg-cyan-500 animate-pulse delay-150 rounded-full" />
                            </div>
                          </div>
                          <span className="text-xs font-black text-white/90 tracking-wide uppercase flex items-center gap-1.5">
                            {!isPaused ? "Live STT Active" : "STT Paused"}
                          </span>
                          <span className="text-[10px] font-bold text-cyan-400/90 bg-cyan-500/15 border border-cyan-500/30 px-2.5 py-0.5 rounded-full group-hover:bg-cyan-500/30 group-hover:text-cyan-200 transition-colors flex items-center gap-1">
                            Expand ▾
                          </span>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="expanded-dock"
                          layout
                          initial={{ opacity: 0, scale: 0.96, y: -8 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.96, y: -8 }}
                          transition={{ type: "spring", stiffness: 420, damping: 28 }}
                          className="w-full max-w-[1040px] bg-[#0a0b12]/95 backdrop-blur-3xl border border-cyan-500/30 rounded-2xl p-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.85),0_0_30px_rgba(6,182,212,0.12)] flex flex-col gap-2 drag-area"
                        >
                          {/* 1. COMMAND DOCK TWO-TIER ARCHITECTURE */}
                          {/* Tier 1: Identity, Brand, Stealth, Hotkeys, Model & Window Controls */}
                          <div className="flex items-center justify-between w-full no-drag px-1 pb-1 border-b border-white/5">
                            {/* Left: Drag Handle, Brand, Timer, Stealth, Hotkeys, Model Selector */}
                            <div className="flex items-center gap-2">
                              <div className="p-1 bg-white/5 hover:bg-white/10 rounded text-white/40 hover:text-white/80 cursor-grab active:cursor-grabbing shrink-0">
                                <Move size={13} />
                              </div>

                              {/* Brand Logo & Live Recording Timer */}
                              <div className="flex items-center gap-1.5 shrink-0 bg-white/[0.04] px-2 py-0.5 rounded-lg border border-white/10 shadow-sm">
                                <img src="./logo.png" alt="Logo" className="w-4 h-4 object-cover rounded shadow-sm border border-cyan-400/30" />
                                <span className="text-[11px] font-black text-white">Clue<span className="text-cyan-400">AI</span></span>
                                <span className="text-cyan-300 font-mono font-bold text-[10px] ml-1 bg-white/10 px-1.5 py-0.5 rounded border border-white/20">{formatTimer(recordingSeconds)}</span>
                              </div>

                              {(updateStatus === 'available' || updateStatus === 'downloaded') && (
                                <button
                                  onClick={() => setShowUpdateModal(true)}
                                  className="px-2 py-0.5 rounded-lg font-black text-[9px] flex items-center gap-1 uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/50 shadow-[0_0_10px_rgba(16,185,129,0.3)] animate-pulse shrink-0 cursor-pointer"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                                  <Sparkles size={10} />
                                  <span>Update</span>
                                </button>
                              )}

                              {/* Stealth Shield Toggle Button - Compact Glowing Icon */}
                              <button
                                onClick={() => {
                                  if (stealthMode) {
                                    setShowStealthWarning(true);
                                  } else {
                                    setStealthMode(true);
                                    ipcRenderer.invoke('set-stealth', true);
                                  }
                                }}
                                className={`p-1.5 rounded-lg flex items-center justify-center border transition-all cursor-pointer ${stealthMode
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                                  : 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.3)] animate-pulse'
                                  }`}
                              >
                                {stealthMode ? <ShieldCheck size={13} className="text-emerald-400" /> : <ShieldAlert size={13} className="text-rose-400" />}
                              </button>

                              {/* Global Hotkeys Toggle */}
                              <div className="flex items-center gap-1 bg-white/[0.04] border border-white/10 px-1.5 py-0.5 rounded-lg shrink-0">
                                <button
                                  onClick={() => {
                                    const next = !globalHotkeysEnabled;
                                    setGlobalHotkeysEnabled(next);
                                    if (typeof ipcRenderer !== 'undefined') {
                                      ipcRenderer.invoke('toggle-global-hotkeys', next);
                                    }
                                  }}
                                  className={`relative w-6 h-3 rounded-full transition-colors flex items-center px-0.5 ${globalHotkeysEnabled ? 'bg-green-500/80' : 'bg-rose-500/80'}`}
                                >
                                  <div className={`w-2 h-2 bg-white rounded-full transition-transform ${globalHotkeysEnabled ? 'translate-x-3' : 'translate-x-0'}`} />
                                </button>
                                <span className="text-[8.5px] font-bold uppercase tracking-wider text-white/60">Hotkeys</span>
                              </div>

                              {/* Model Selector Dropdown & Hotkey 5 Indicator */}
                              <div className="flex items-center gap-1 shrink-0">
                                <div className="shrink-0">
                                  <CustomSelect
                                    value={provider}
                                    onChange={(val: any) => {
                                      if (val === 'none') return;
                                      setProvider(val);
                                      switchProvider(val);
                                      localStorage.setItem('selected_provider', val);
                                      const nameMap: any = { 'groq': 'Groq', 'gemini-flash': 'Gemini Flash', 'claude': 'Claude', 'chatgpt': 'ChatGPT', 'deepseek': 'DeepSeek' };
                                      setModelChangeMsg(`Switched to ${nameMap[val] || val}`);
                                      setTimeout(() => setModelChangeMsg(''), 3000);
                                    }}
                                    options={availableModelOptions.length > 0 ? availableModelOptions : [
                                      { value: 'none', label: 'No API Key (Set in ⚙)' }
                                    ]}
                                    className="bg-brand-secondary/50 hover:bg-brand-secondary border border-brand-border/50 rounded-full pl-6 pr-2 py-0.5 text-[10px] font-semibold text-white min-w-[130px]"
                                    icon={<Cpu size={10} className="text-brand-accent pointer-events-none" />}
                                  />
                                </div>
                                <button
                                  onClick={cycleNextModel}
                                  className="h-[22px] px-1.5 bg-white/[0.04] hover:bg-cyan-500/20 text-white/70 hover:text-cyan-300 border border-white/10 hover:border-cyan-500/40 rounded-md font-mono text-[9px] font-bold flex items-center gap-0.5 transition-all cursor-pointer shadow-sm"
                                  title="Switch Model (Press 5 or S)"
                                >
                                  <RefreshCw size={8} />
                                  <span>5</span>
                                </button>
                              </div>
                            </div>

                            {/* Right: Window Controls */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              {/* Settings Button */}
                              <button
                                onClick={() => { setLocalSettingsStealth(stealthMode); setShowSettings(true); }}
                                className="p-1 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white rounded-md border border-white/10 transition-colors"
                              >
                                <Settings size={12} />
                              </button>

                              {/* Minimize Dock Button */}
                              <button
                                onClick={() => setIsTranscriptMinimized(true)}
                                className="p-1 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white rounded-md border border-white/10 transition-colors"
                              >
                                <Minus size={12} />
                              </button>

                              {/* Close Window */}
                              <button
                                onClick={closeApp}
                                className="p-1 bg-white/5 hover:bg-rose-500/20 text-white/50 hover:text-rose-400 rounded-md border border-white/10 transition-colors"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </div>

                          {/* Tier 2: Interview Action Ribbon (Live STT, Controls & STOP) */}
                          <div className="flex items-center justify-between w-full no-drag px-1 py-0.5">
                            {/* Left: Live STT, Mic Controls, Snip, Clear, Edit, History */}
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                                <span className="relative flex h-1.5 w-1.5">
                                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${!isPaused ? 'bg-cyan-400' : 'bg-amber-400'}`}></span>
                                  <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${!isPaused ? 'bg-cyan-500' : 'bg-amber-500'}`}></span>
                                </span>
                                <span className="text-[9.5px] font-black uppercase tracking-wider">{!isPaused ? "Live STT" : "Paused"}</span>
                              </div>

                              <button
                                onClick={handlePauseToggle}
                                className={`px-2.5 py-1 rounded-md font-bold text-[10px] flex items-center gap-1.5 transition-all ${isPaused ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30' : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10'}`}
                              >
                                {isPaused ? <Play size={10} fill="currentColor" /> : <Pause size={10} fill="currentColor" />}
                                <span>{isPaused ? 'Resume' : 'Pause'}</span>
                                <span className="text-[8px] opacity-60 font-mono">1</span>
                              </button>

                              <button
                                onClick={handleSnipClick}
                                className="px-2.5 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-md font-bold text-[10px] flex items-center gap-1.5 transition-all"
                              >
                                <Crop size={10} />
                                <span>Snip</span>
                                <span className="text-[8px] opacity-60 font-mono">4</span>
                              </button>

                              <button
                                onClick={handleClearAll}
                                className="px-2.5 py-1 bg-white/5 hover:bg-rose-500/20 text-white/60 hover:text-rose-300 border border-white/10 hover:border-rose-500/30 rounded-md font-bold text-[10px] flex items-center gap-1.5 transition-all"
                              >
                                <Trash2 size={10} />
                                <span>Clear</span>
                                <span className="text-[8px] opacity-60 font-mono">3</span>
                              </button>

                              <button
                                onClick={() => setShowVirtualKeyboard(true)}
                                className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10 rounded-md text-[10px] font-semibold flex items-center gap-1.5 transition-colors"
                              >
                                <Edit2 size={10} /> Edit <span className="text-[8px] opacity-60 font-mono">7</span>
                              </button>

                              {currentSessionHistory.length > 0 && (
                                <button
                                  onClick={() => setShowPreviousQuestions(true)}
                                  className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10 rounded-md text-[10px] font-semibold flex items-center gap-1.5 transition-colors"
                                >
                                  <Clock size={10} /> {currentSessionHistory.length} Qs <span className="text-[8px] opacity-60 font-mono">8</span>
                                </button>
                              )}
                            </div>

                            {/* Right: Prominent RESTART & STOP Recording Buttons */}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={restartApp}
                                className="px-2.5 py-1 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 rounded-md font-bold text-[10px] flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                              >
                                <RefreshCw size={9} /> RESTART <span className="text-[8.5px] opacity-75 font-mono">^R</span>
                              </button>
                              <button
                                onClick={stopRecording}
                                className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/50 hover:border-rose-400 rounded-md font-black text-[10px] flex items-center gap-1.5 transition-all shadow-sm"
                              >
                                <Square size={9} fill="currentColor" /> STOP SESSION <span className="text-[8.5px] opacity-75 font-mono">6</span>
                              </button>
                            </div>
                          </div>

                          {/* 2. Main Stage: Ultra-Wide Transcript Reading Box + Integrated Generate Button */}
                          <div className="flex items-center gap-2.5 w-full no-drag">
                            <div
                              ref={transcriptScrollRef}
                              className="flex-1 min-h-[48px] max-h-[110px] overflow-y-auto custom-scrollbar bg-black/80 border border-cyan-500/25 hover:border-cyan-400/50 rounded-xl px-4 py-2.5 select-text transition-[height] duration-200 shadow-inner flex flex-col justify-center"
                              style={{ fontSize: `${transcriptTextSize}px` }}
                            >
                              {finalizedText || interimText || transcript ? (
                                <div className="leading-relaxed tracking-wide select-text">
                                  {finalizedText && (
                                    <span className="text-white font-medium">
                                      {finalizedText}
                                      {interimText ? ' ' : ''}
                                    </span>
                                  )}
                                  {interimText ? (
                                    <span className="text-cyan-300 font-semibold drop-shadow-[0_0_8px_rgba(6,182,212,0.4)] animate-pulse inline-flex items-center gap-1">
                                      {interimText}
                                      <span className="inline-block w-1.5 h-3 bg-cyan-400 rounded-xs animate-ping align-middle" />
                                    </span>
                                  ) : !finalizedText && transcript ? (
                                    <span className="text-white font-medium">
                                      {transcript}
                                    </span>
                                  ) : null}
                                </div>
                              ) : (
                                <div className="text-white/40 italic flex items-center gap-2 select-none text-xs">
                                  <span className="inline-block w-2 h-2 rounded-full bg-cyan-400/60 animate-ping"></span>
                                  Listening to conversation... (Interviewer questions appear here)
                                </div>
                              )}
                            </div>

                            {/* High-Impact Integrated Generate Answer Button */}
                            <button
                              onClick={() => { if (!isGenerating) manualTriggerAI(); }}
                              disabled={isGenerating}
                              className="h-[48px] px-6 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-black text-xs tracking-wider uppercase rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] border border-cyan-400/40 flex items-center justify-center gap-2 active:scale-95 transition-all shrink-0 cursor-pointer min-w-[180px]"
                            >
                              {isGenerating ? (
                                <>
                                  <Loader2 size={13} className="animate-spin text-white" />
                                  <span>Generating...</span>
                                </>
                              ) : (
                                <>
                                  <Cpu size={13} className="text-cyan-200" />
                                  <span>Generate Answer</span>
                                  <span className="bg-black/30 text-[9px] font-mono px-1.5 py-0.5 rounded border border-white/20 ml-0.5">2 / X</span>
                                </>
                              )}
                            </button>
                          </div>

                          {/* Snapshots Strip (if any exist) */}
                          {currentSnapshots.length > 0 && (
                            <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar py-1.5 px-2.5 bg-black/60 rounded-xl border border-cyan-500/20 no-drag mt-0.5 shadow-md">
                              <span className="text-[9.5px] text-cyan-400 font-bold uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
                                <Crop size={10} /> Snips:
                              </span>
                              {currentSnapshots.map((snap, idx) => (
                                <div key={idx} className="relative h-[40px] aspect-video rounded-lg overflow-hidden border border-cyan-500/40 bg-black/80 group shrink-0 shadow-md ring-1 ring-cyan-500/20">
                                  <img src={snap} alt={`Snapshot ${idx + 1}`} className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                                    <button onClick={() => setPreviewSnapshot(snap)} className="p-1 bg-white/20 hover:bg-white/30 text-white rounded transition-colors" title="Preview">
                                      <Eye size={10} />
                                    </button>
                                    <button onClick={() => setCurrentSnapshots(prev => prev.filter((_, i) => i !== idx))} className="p-1 bg-rose-500/80 hover:bg-rose-500 text-white rounded transition-colors" title="Delete">
                                      <Trash2 size={10} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                              {currentSnapshots.length > 1 && (
                                <button onClick={() => setCurrentSnapshots([])} className="h-[40px] px-2.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 transition-colors flex items-center justify-center gap-1 text-[9.5px] font-bold shrink-0">
                                  <Trash2 size={11} /> Clear
                                </button>
                              )}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}

              {/* API Key Missing Error Modal */}
              {showApiKeyMissingError && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-in fade-in duration-200">
                  <div className="relative w-full max-w-sm animate-in zoom-in-95 duration-200">
                    <div className="relative bg-brand-bg border border-brand-border rounded-2xl w-full p-6 shadow-2xl">
                      <h3 className="font-black text-lg text-white mb-3 flex items-center gap-2">
                        <AlertTriangle className="text-rose-500" size={20} /> Missing API Keys
                      </h3>
                      <p className="text-brand-subtext text-sm mb-6 leading-relaxed">
                        Please provide at least one valid API key (Gemini, Groq, Claude, ChatGPT, or DeepSeek) before starting the interview. Go to Settings and add your API keys to continue.
                      </p>
                      <button
                        onClick={() => {
                          setShowApiKeyMissingError(false);
                          setLocalSettingsStealth(stealthMode);
                          setShowSettings(true);
                        }}
                        className="w-full bg-brand-accent hover:bg-brand-accentSec text-white py-2.5 rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                      >
                        Open Settings
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Minimum Size Warning Modal */}
              {showMinSizeWarning && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 select-none">
                  <div className="bg-[#09090b]/90 border border-brand-border rounded-3xl w-full max-w-sm overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-6 py-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
                      <h3 className="font-black text-lg text-white flex items-center gap-2"><ZoomOut size={18} className="text-brand-accent" /> Size Limit Reached</h3>
                    </div>
                    <div className="p-6">
                      <p className="text-brand-subtext text-sm mb-6 text-center">
                        The window cannot be decreased further without hiding essential buttons and breaking the layout.
                      </p>
                      <button
                        onClick={() => setShowMinSizeWarning(false)}
                        className="w-full bg-brand-accent hover:bg-brand-accent/90 text-white py-2.5 rounded-xl font-bold transition-colors"
                      >
                        Okay
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Stealth Mode Warning Modal (For Starting Interview) */}
              {showStartStealthWarning && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4">
                  <div className="relative w-full max-w-md animate-in fade-in zoom-in-95 duration-150">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-rose-500 via-red-500 to-rose-500 rounded-3xl blur opacity-40"></div>

                    <div className="relative bg-[#09090b]/90 border border-red-500/30 rounded-3xl w-full overflow-hidden shadow-[0_0_80px_rgba(225,29,72,0.3)]">
                      <div className="px-8 py-6 border-b border-red-500/20 flex justify-between items-center bg-red-500/10">
                        <h3 className="font-black text-xl text-rose-500 tracking-wide flex items-center gap-2"><AlertTriangle size={20} /> Warning</h3>
                        <button onClick={() => setShowStartStealthWarning(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-colors"><X size={16} /></button>
                      </div>

                      <div className="p-8 space-y-6">
                        <div className="text-sm text-white/80 leading-relaxed">
                          <p className="mb-4">You are about to start the interview with <strong className="text-white">Stealth Mode OFF</strong>.</p>
                          <p className="mb-4 text-rose-400"><strong>Impact:</strong> Without Stealth Mode enabled, anti-cheat software (like MS Teams or Zoom screen sharing) may detect this application running in the background.</p>
                          <p><strong>How to fix:</strong> Click Cancel, go to <span className="bg-white/10 px-2 py-0.5 rounded text-white text-xs font-bold inline-flex items-center gap-1">Settings <Settings size={12} /></span>, and turn on <strong>Stealth Mode</strong> to hide the app securely.</p>
                        </div>

                        <div className="flex gap-3 pt-4 border-t border-white/5">
                          <button
                            onClick={() => setShowStartStealthWarning(false)}
                            className="flex-1 bg-[#18181b] hover:bg-white/10 text-white py-3.5 rounded-xl font-bold transition-all border border-white/10"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={proceedWithInterview}
                            className="flex-1 bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-400 hover:to-red-400 text-white py-3.5 rounded-xl font-black shadow-[0_0_20px_rgba(225,29,72,0.4)] transition-all"
                          >
                            Start Anyway
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Rename Session Modal */}
              {editingSessionId !== null && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4">
                  <div className="relative w-full max-w-sm animate-in fade-in zoom-in-95 duration-150">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-accent via-cyan-400 to-brand-accent rounded-3xl blur opacity-30"></div>

                    <div className="relative bg-[#09090b]/90 border border-white/10 rounded-3xl w-full shadow-[0_0_80px_rgba(0,0,0,1)]">
                      <div className="px-8 py-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                        <h3 className="font-black text-xl text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70 tracking-wide">Rename Session</h3>
                        <button onClick={() => setEditingSessionId(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-colors"><X size={16} /></button>
                      </div>

                      <div className="p-8 space-y-4">
                        <div>
                          <label className="block text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em] mb-3">New Session Name</label>
                          <input
                            type="text"
                            autoFocus
                            value={editingSessionName}
                            onChange={e => setEditingSessionName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleRenameSession(editingSessionId); }}
                            className="stealth-exempt w-full bg-[#18181b] border border-cyan-500/30 rounded-xl px-5 py-4 text-sm text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all shadow-[0_0_15px_rgba(34,211,238,0.05)]"
                          />
                        </div>
                      </div>

                      <div className="px-8 py-5 bg-[#18181b]/50 flex justify-end gap-3 border-t border-white/5 backdrop-blur-md rounded-b-3xl">
                        <button onClick={() => setEditingSessionId(null)} className="px-5 py-2.5 rounded-xl text-xs font-bold text-white/50 hover:text-white hover:bg-white/5 transition-colors">Cancel</button>
                        <button onClick={() => handleRenameSession(editingSessionId)} className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:shadow-[0_0_30px_rgba(34,211,238,0.5)]">
                          Save Name
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Session Name Prompt Modal Redesign with Framer Motion & Blur */}
              <AnimatePresence>
                {showSessionPrompt && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4 pointer-events-auto"
                  >
                    <motion.div
                      initial={{ scale: 0.92, opacity: 0, y: 15 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.92, opacity: 0, y: 15 }}
                      transition={{ type: "spring", stiffness: 350, damping: 28 }}
                      className="relative w-full max-w-lg bg-[#0a0c16]/95 border border-cyan-500/40 rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95),0_0_40px_rgba(6,182,212,0.25)] overflow-hidden"
                    >
                      <div className="px-6 py-5 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                            <Play size={16} fill="currentColor" />
                          </div>
                          <div>
                            <h3 className="font-black text-lg text-white tracking-wide">Initialize Session</h3>
                            <p className="text-[11px] text-white/50">Setup interview context and candidate details</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setShowSessionPrompt(false)} 
                          className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      <div className="p-6 space-y-4">
                        {/* Session Mode Selector Tabs */}
                        <div className="grid grid-cols-2 gap-2 p-1 bg-black/50 border border-white/10 rounded-2xl">
                          <button
                            type="button"
                            onClick={() => {
                              setSessionModalMode('new');
                              setCurrentSessionId('');
                              setSessionNameInput('');
                              setSessionError('');
                            }}
                            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                              sessionModalMode === 'new'
                                ? 'bg-gradient-to-r from-cyan-500/30 to-blue-500/25 text-cyan-300 border border-cyan-400/50 shadow-[0_0_15px_rgba(34,211,238,0.2)]'
                                : 'text-white/60 hover:text-white hover:bg-white/5'
                            }`}
                          >
                            <Plus size={14} />
                            <span>Create New Session</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSessionModalMode('resume');
                              if (sessions.length > 0 && !currentSessionId) {
                                setCurrentSessionId(sessions[0].id);
                                setSessionNameInput(sessions[0].name);
                              }
                              setSessionError('');
                            }}
                            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                              sessionModalMode === 'resume'
                                ? 'bg-gradient-to-r from-cyan-500/30 to-blue-500/25 text-cyan-300 border border-cyan-400/50 shadow-[0_0_15px_rgba(34,211,238,0.2)]'
                                : 'text-white/60 hover:text-white hover:bg-white/5'
                            }`}
                          >
                            <Clock size={14} />
                            <span>Resume Past Session ({sessions.length})</span>
                          </button>
                        </div>

                        {sessionModalMode === 'new' ? (
                          <div className="space-y-3 animate-in fade-in duration-150">
                            <div>
                              <label className="block text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em] mb-2">New Session Name</label>
                              <input
                                type="text"
                                autoFocus
                                value={sessionNameInput}
                                onChange={e => { setSessionNameInput(e.target.value); setSessionError(''); }}
                                placeholder="e.g. Meta / Google Final Round"
                                onKeyDown={e => { if (e.key === 'Enter') startRecording(); }}
                                className="stealth-exempt w-full bg-[#18181b] border border-cyan-500/30 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all shadow-[0_0_15px_rgba(34,211,238,0.05)]"
                              />
                            </div>
                            <p className="text-[11px] text-white/40 leading-relaxed">
                              Each session maintains its own discrete transcript history, uploaded snapshots, and coding questions.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2.5 animate-in fade-in duration-150">
                            {sessions.length > 3 && (
                              <input
                                type="text"
                                value={sessionSearchTerm}
                                onChange={e => setSessionSearchTerm(e.target.value)}
                                placeholder="Search past sessions..."
                                className="w-full bg-[#18181b] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-white/30 outline-none focus:border-cyan-400/50"
                              />
                            )}

                            <div className="max-h-52 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                              {sessions.length === 0 ? (
                                <div className="text-center py-6 text-white/40 text-xs">
                                  No past sessions found. Start a new session above!
                                </div>
                              ) : (
                                sessions
                                  .filter(s => !sessionSearchTerm || s.name.toLowerCase().includes(sessionSearchTerm.toLowerCase()))
                                  .map(s => {
                                    const isSelected = currentSessionId === s.id;
                                    return (
                                      <div
                                        key={s.id}
                                        onClick={() => {
                                          setCurrentSessionId(s.id);
                                          setSessionNameInput(s.name);
                                          setSessionError('');
                                        }}
                                        onDoubleClick={() => startRecording()}
                                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                                          isSelected
                                            ? 'bg-cyan-500/15 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.2)]'
                                            : 'bg-white/[0.03] hover:bg-white/[0.07] border-white/10'
                                        }`}
                                      >
                                        <div className="truncate pr-2">
                                          <div className={`text-xs font-bold truncate ${isSelected ? 'text-cyan-300' : 'text-white'}`}>
                                            {s.name}
                                          </div>
                                          <div className="text-[10px] text-white/40 mt-0.5">
                                            {s.date || 'Saved Session'}
                                          </div>
                                        </div>
                                        <div className="shrink-0 flex items-center gap-2">
                                          {isSelected ? (
                                            <span className="w-5 h-5 rounded-full bg-cyan-400 text-black flex items-center justify-center font-bold text-xs">✓</span>
                                          ) : (
                                            <span className="w-5 h-5 rounded-full border border-white/20" />
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })
                              )}
                            </div>
                          </div>
                        )}

                        {sessionError && (
                          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">
                            <p className="text-rose-400 text-xs font-bold flex items-center gap-2">
                              <X size={14} className="bg-rose-500/20 rounded-full p-0.5" /> {sessionError}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="px-6 py-4 bg-[#14151f]/80 flex justify-end gap-3 border-t border-white/10 backdrop-blur-md rounded-b-3xl">
                        <button onClick={() => setShowSessionPrompt(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-white/50 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">Cancel</button>
                        <button onClick={startRecording} className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] flex items-center gap-2 cursor-pointer active:scale-95">
                          Start AI Interview <Play size={12} fill="currentColor" />
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>


              {/* Stealth Warning Modal */}
              {showStealthWarning && (
                <div className="absolute inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                  <div className="bg-brand-bg border border-rose-500/30 rounded-2xl p-6 max-w-sm w-full shadow-[0_0_40px_rgba(225,29,72,0.2)] animate-in zoom-in-95 duration-200">
                    <h3 className="text-xl font-black text-rose-400 mb-3 flex items-center gap-2">
                      <AlertTriangle size={24} /> Warning!
                    </h3>
                    <p className="text-brand-subtext text-sm mb-6 leading-relaxed">
                      Disabling Stealth Mode will make ClueAI visible to screen sharing software like Zoom, Microsoft Teams, or Google Meet!
                      <br /><br />
                      Only turn this off if you are absolutely sure you want the app to be visible on your screen during a meeting.
                    </p>
                    <div className="flex gap-3 justify-end">
                      <button
                        onClick={() => setShowStealthWarning(false)}
                        className="px-4 py-2 bg-brand-secondary hover:bg-brand-border text-white rounded-lg font-bold text-sm transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          setStealthMode(false);
                          ipcRenderer.invoke('set-stealth', false);
                          setShowStealthWarning(false);
                        }}
                        className="px-4 py-2 bg-rose-500 hover:bg-rose-400 text-white rounded-lg font-bold text-sm transition-colors shadow-[0_0_15px_rgba(225,29,72,0.4)]"
                      >
                        OK, Disable it
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Snapshot Fullscreen Preview Modal */}
              {previewSnapshot && (
                <div
                  className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-in fade-in duration-200 select-none stealth-exempt pointer-events-auto"
                  onClick={() => setPreviewSnapshot(null)}
                >
                  {/* Top Bar for Preview Screen with explicit Close & Escape indicator */}
                  <div className="absolute top-4 right-6 flex items-center gap-3 z-30 stealth-exempt pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                    <span className="text-[11px] font-mono text-white/50 bg-black/60 px-2.5 py-1 rounded-lg border border-white/10 select-none">
                      Press <kbd className="text-cyan-400 font-bold">Esc</kbd> to close preview
                    </span>
                    <button
                      className="p-2.5 bg-white/10 hover:bg-rose-500/80 text-white rounded-xl transition-all border border-white/10 shadow-lg cursor-pointer flex items-center justify-center stealth-exempt pointer-events-auto"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewSnapshot(null);
                      }}
                      title="Close Preview Screen (Esc)"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <img
                    src={previewSnapshot}
                    alt="Snapshot Preview"
                    className="max-w-[95%] max-h-[85%] object-contain rounded-2xl shadow-2xl border border-cyan-500/30 animate-in zoom-in-95 duration-150 stealth-exempt pointer-events-auto cursor-default"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              )}

              {itemToDelete && (
                <div className="fixed inset-0 z-[400] bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center p-8 animate-in fade-in duration-200">
                  <div className="w-full max-w-md bg-brand-secondary border border-rose-500/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-black/20">
                      <h2 className="text-xl font-bold text-white flex items-center gap-2"><Trash2 size={18} className="text-rose-400" /> Confirm Deletion</h2>
                      <button onClick={() => setItemToDelete(null)} className="text-white/50 hover:text-white transition-colors"><X size={20} /></button>
                    </div>
                    <div className="p-6 text-center">
                      <p className="text-sm text-gray-300 mb-4">Are you sure you want to delete this {itemToDelete.type}?</p>
                      <div className="bg-black/30 p-3 rounded-lg border border-white/5 mb-6 text-left">
                        <span className="font-bold text-white block">{itemToDelete.name}</span>
                      </div>
                      {!itemToDelete.isPast && (
                        <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-3 text-xs text-rose-300 font-medium text-left flex items-start gap-2 mb-6">
                          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                          <p>On deleting, it will cancel the scheduled email and it will not send it again.</p>
                        </div>
                      )}
                      <div className="flex justify-end gap-3">
                        <button onClick={() => setItemToDelete(null)} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-bold text-sm transition-colors">Cancel</button>
                        <button
                          onClick={() => {
                            const { id, type, isPast } = itemToDelete;
                            if (type === 'reminder') {
                              setReminderProfiles(prev => prev.filter(r => r.id !== id));
                            } else {
                              setNotesProfiles(prev => prev.filter(r => r.id !== id));
                            }
                            if (!isPast) {
                              fetch(GOOGLE_SCRIPT_URL, {
                                method: 'POST',
                                mode: 'no-cors',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'delete', id })
                              }).catch(console.error);
                            }
                            setItemToDelete(null);
                          }}
                          className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold text-sm transition-colors"
                        >
                          Confirm Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Reminder Popup Editor */}
              {showReminderPopup && (
                <div className="fixed inset-0 z-[300] bg-black/45 backdrop-blur-sm flex flex-col items-center justify-center p-8 animate-in fade-in duration-200">
                  <div className={`w-full max-w-2xl bg-brand-secondary border border-brand-border rounded-2xl shadow-2xl flex flex-col overflow-hidden ${!localReminderStealth ? 'stealth-exempt' : ''}`}>
                    <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-black/20">
                      <div className="flex items-center gap-4">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2"><Settings size={18} className="text-blue-400" /> Reminder Profile Setup</h2>
                        <button onClick={() => setLocalReminderStealth(!localReminderStealth)} className={`shield-toggle-btn p-1.5 rounded-lg transition-all hover:scale-105 active:scale-95 ${localReminderStealth ? 'bg-green-500/20 text-green-400' : 'bg-rose-500/20 text-rose-400'}`}>
                          {localReminderStealth ? <Shield size={16} /> : <ShieldAlert size={16} />}
                        </button>
                      </div>
                      <button onClick={() => setShowReminderPopup(false)} className="text-white/50 hover:text-white transition-colors"><X size={20} /></button>
                    </div>
                    <div className="p-6 grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="block text-xs font-bold text-brand-subtext uppercase mb-1">Company Name</label>
                        <input type="text" placeholder="e.g. Amazon" disabled={reminderPopupMode === 'preview'} className={`w-full bg-black/40 border ${showReminderErrors && !reminderForm.name ? 'border-rose-500/50' : 'border-brand-border'} rounded-lg p-3 text-sm text-white outline-none focus:border-blue-500 transition-colors disabled:opacity-50`} value={reminderForm.name} onChange={e => setReminderForm({ ...reminderForm, name: e.target.value })} />
                        {showReminderErrors && !reminderForm.name && <p className="text-rose-500 text-[10px] mt-1 font-bold">This field is required.</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-brand-subtext uppercase mb-1">Job Title</label>
                        <input type="text" placeholder="e.g. Software Engineer" disabled={reminderPopupMode === 'preview'} className={`w-full bg-black/40 border ${showReminderErrors && !reminderForm.jobTitle ? 'border-rose-500/50' : 'border-brand-border'} rounded-lg p-3 text-sm text-white outline-none focus:border-blue-500 transition-colors disabled:opacity-50`} value={reminderForm.jobTitle} onChange={e => setReminderForm({ ...reminderForm, jobTitle: e.target.value })} />
                        {showReminderErrors && !reminderForm.jobTitle && <p className="text-rose-500 text-[10px] mt-1 font-bold">This field is required.</p>}
                      </div>
                      <div className="relative">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-bold text-brand-subtext uppercase">Email ID</label>
                          {reminderForm.email.trim() && isEmailVerified(reminderForm.email.trim()) && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold animate-in fade-in duration-200">
                              <ShieldCheck size={11} className="text-emerald-400" /> Verified
                            </span>
                          )}
                        </div>
                        <input
                          type="email"
                          disabled={reminderPopupMode !== 'create'}
                          placeholder="e.g. user@example.com"
                          className={`w-full bg-black/40 border ${showReminderErrors && (!reminderForm.email || !/^\S+@\S+\.\S+$/.test(reminderForm.email)) ? 'border-rose-500/50' : 'border-brand-border'} rounded-lg p-3 text-sm text-white outline-none focus:border-blue-500 transition-colors disabled:opacity-50`}
                          value={reminderForm.email}
                          onChange={e => {
                            setReminderForm({ ...reminderForm, email: e.target.value });
                            const saved = JSON.parse(localStorage.getItem('clueai_saved_emails') || '[]');
                            const matches = e.target.value ? saved.filter((s: string) => s.toLowerCase().includes(e.target.value.toLowerCase())) : saved;
                            setShowReminderEmailSuggest(matches.length > 0);
                          }}
                          onFocus={() => {
                            const saved = JSON.parse(localStorage.getItem('clueai_saved_emails') || '[]');
                            if (saved.length > 0) {
                              setShowReminderEmailSuggest(true);
                            }
                          }}
                          onBlur={() => setTimeout(() => setShowReminderEmailSuggest(false), 200)}
                        />
                        {showReminderEmailSuggest && JSON.parse(localStorage.getItem('clueai_saved_emails') || '[]').length > 0 && (
                          <div className="absolute top-full left-0 w-full mt-2 bg-brand-bg/95 backdrop-blur-xl border border-brand-border rounded-lg shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200 max-h-40 overflow-y-auto custom-scrollbar">
                            <div className="px-4 py-2 bg-black/20 border-b border-brand-border/50 flex items-center justify-between">
                              <span className="text-[10px] font-bold text-brand-accent uppercase tracking-wider mb-0.5">Suggested Emails</span>
                              <span className="text-[9px] text-white/40">Verified Status</span>
                            </div>
                            {(JSON.parse(localStorage.getItem('clueai_saved_emails') || '[]') as string[])
                              .filter(s => !reminderForm.email || s.toLowerCase().includes(reminderForm.email.toLowerCase()))
                              .map((email, idx) => {
                                const verified = isEmailVerified(email);
                                return (
                                  <div
                                    key={idx}
                                    className="px-4 py-2 hover:bg-white/10 cursor-pointer flex items-center justify-between transition-colors border-b border-brand-border/30 last:border-0"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      setReminderForm({ ...reminderForm, email });
                                      setShowReminderEmailSuggest(false);
                                    }}
                                  >
                                    <span className="text-sm text-white font-mono">{email}</span>
                                    {verified && (
                                      <span className="inline-flex items-center gap-1 text-[9px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-bold">
                                        <ShieldCheck size={10} className="text-emerald-400" /> Verified
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        )}
                        {showReminderErrors && !reminderForm.email && <p className="text-rose-500 text-[10px] mt-1 font-bold">This field is required.</p>}
                        {showReminderErrors && reminderForm.email && !/^\S+@\S+\.\S+$/.test(reminderForm.email) && <p className="text-rose-500 text-[10px] mt-1 font-bold">Please enter a valid email address.</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-brand-subtext uppercase mb-1 flex justify-between">
                          <span>Date</span>
                          {getDayOfWeek(reminderForm.date) && <span className="text-blue-400 capitalize">{getDayOfWeek(reminderForm.date)}</span>}
                        </label>
                        <input type="text" placeholder="DD-MM-YYYY" disabled={reminderPopupMode === 'preview'} className={`w-full bg-black/40 border ${(showReminderErrors && !reminderForm.date) || validateDateTime(reminderForm.date, reminderForm.time, reminderForm.ampm).dateError ? 'border-rose-500/50' : 'border-brand-border'} rounded-lg p-3 text-sm text-white outline-none focus:border-blue-500 transition-colors disabled:opacity-50`} value={reminderForm.date} onChange={e => handleDateChange(e.target.value, reminderForm, setReminderForm)} />
                        {showReminderErrors && !reminderForm.date && <p className="text-rose-500 text-[10px] mt-1 font-bold">This field is required.</p>}
                        {validateDateTime(reminderForm.date, reminderForm.time, reminderForm.ampm).dateError && <p className="text-rose-500 text-[10px] mt-1 font-bold">{validateDateTime(reminderForm.date, reminderForm.time, reminderForm.ampm).dateError}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-brand-subtext uppercase mb-1">Time</label>
                        <div className="relative">
                          <input type="text" placeholder="HH:MM" disabled={reminderPopupMode === 'preview'} className={`w-full bg-black/40 border ${(showReminderErrors && !reminderForm.time) || (reminderPopupMode !== 'preview' && validateDateTime(reminderForm.date, reminderForm.time, reminderForm.ampm).timeError) ? 'border-rose-500/50' : 'border-brand-border'} rounded-lg p-3 text-sm text-white outline-none focus:border-blue-500 transition-colors pr-16 disabled:opacity-50`} value={reminderForm.time} onChange={e => handleTimeChange(e.target.value, reminderForm, setReminderForm)} />
                          <button
                            disabled={reminderPopupMode === 'preview'}
                            onClick={() => setReminderForm({ ...reminderForm, ampm: reminderForm.ampm === 'AM' ? 'PM' : 'AM' })}
                            className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs font-bold flex items-center gap-1 hover:bg-blue-500/30 transition-colors disabled:opacity-50"
                          >
                            {reminderForm.ampm} <RefreshCcw size={10} />
                          </button>
                        </div>
                        {showReminderErrors && !reminderForm.time && <p className="text-rose-500 text-[10px] mt-1 font-bold">This field is required.</p>}
                        {reminderPopupMode !== 'preview' && validateDateTime(reminderForm.date, reminderForm.time, reminderForm.ampm).timeError && <p className="text-rose-500 text-[10px] mt-1 font-bold">{validateDateTime(reminderForm.date, reminderForm.time, reminderForm.ampm).timeError}</p>}
                      </div>
                    </div>
                    <div className="px-6 py-4 border-t border-white/5 flex justify-end gap-3 bg-black/20">
                      {reminderPopupMode === 'preview' ? (() => {
                        let isPast = false;
                        try {
                          const [d, m, y] = reminderForm.date.split('-');
                          const [h, min] = reminderForm.time.split(':');
                          let hours = parseInt(h);
                          if (reminderForm.ampm === 'PM' && hours < 12) hours += 12;
                          if (reminderForm.ampm === 'AM' && hours === 12) hours = 0;
                          const targetDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d), hours, parseInt(min));
                          isPast = new Date() > targetDate;
                        } catch (e) { }

                        return (
                          <button
                            onClick={() => setReminderPopupMode('edit')}
                            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg"
                          >
                            <Edit2 size={16} /> {isPast ? 'Resend' : 'Edit'}
                          </button>
                        );
                      })() : (
                        <>
                          {emailSendStatus === 'sending' && (
                            <div className="px-5 py-2.5 flex items-center justify-center h-[44px]">
                              <Loader2 size={24} className="text-blue-500 animate-spin" />
                            </div>
                          )}
                          {emailSendStatus === 'success' && (
                            <div className="px-5 py-2.5 flex items-center justify-center h-[44px] gap-2 text-green-500 font-bold">
                              <CheckCircle2 size={24} /> Scheduled
                            </div>
                          )}
                          {emailSendStatus === 'idle' && (
                            <button
                              onClick={() => {
                                const { dateError, timeError } = validateDateTime(reminderForm.date, reminderForm.time, reminderForm.ampm);
                                const dateValid = !dateError && reminderForm.date;
                                const timeValid = !timeError && reminderForm.time;
                                const emailValid = /^\S+@\S+\.\S+$/.test(reminderForm.email);

                                if (!reminderForm.name || !reminderForm.jobTitle || !emailValid || !dateValid || !timeValid) {
                                  setShowReminderErrors(true);
                                  return;
                                }
                                setShowReminderErrors(false);

                                const emailTrimmed = reminderForm.email.trim();
                                const executeSchedule = () => {
                                  markEmailVerified(emailTrimmed);
                                  const currentId = reminderForm.id || Date.now().toString();
                                  const templateParams = {
                                    id: currentId,
                                    type: 'reminder',
                                    to_name: reminderForm.name,
                                    to_email: emailTrimmed,
                                    company_name: reminderForm.name,
                                    job_title: reminderForm.jobTitle,
                                    date: reminderForm.date,
                                    time: `${reminderForm.time} ${reminderForm.ampm}`,
                                  };

                                  setEmailSendStatus('sending');
                                  const doSchedule = () => {
                                    fetch(GOOGLE_SCRIPT_URL, {
                                      method: 'POST',
                                      mode: 'no-cors',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify(templateParams)
                                    })
                                      .then(() => {
                                        setEmailSendStatus('success');
                                        setReminderProfiles(prev => {
                                          if (prev.some(p => p.id === currentId)) {
                                            return prev.map(p => p.id === currentId ? { ...reminderForm, id: currentId } : p);
                                          }
                                          return [{ ...reminderForm, id: currentId }, ...prev];
                                        });

                                        setTimeout(() => {
                                          setShowReminderPopup(false);
                                          setEmailSendStatus('idle');
                                        }, 1500);
                                      })
                                      .catch(err => {
                                        setEmailSendStatus('idle');
                                        console.error('Google Script Error:', err);
                                        setAlertMessage({ title: 'Email Error', message: `Failed to schedule. Error: ${err.message}`, type: 'error' });
                                      });
                                  };

                                  if (reminderForm.id) {
                                    fetch(GOOGLE_SCRIPT_URL, {
                                      method: 'POST', mode: 'no-cors',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ action: 'delete', id: reminderForm.id })
                                    }).then(doSchedule).catch(doSchedule);
                                  } else {
                                    doSchedule();
                                  }
                                };

                                if (isEmailVerified(emailTrimmed)) {
                                  executeSchedule();
                                } else {
                                  triggerOtpVerification('reminder', emailTrimmed, executeSchedule);
                                }
                              }}
                              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg"
                            >
                              Send Reminder via Email
                            </button>
                          )}
                          <button
                            onClick={() => {
                              const { dateError, timeError } = validateDateTime(reminderForm.date, reminderForm.time, reminderForm.ampm);
                              const dateValid = !dateError && reminderForm.date;
                              const timeValid = !timeError && reminderForm.time;
                              const emailValid = /^\S+@\S+\.\S+$/.test(reminderForm.email);

                              if (!reminderForm.name || !reminderForm.jobTitle || !emailValid || !dateValid || !timeValid) {
                                setShowReminderErrors(true);
                                return;
                              }
                              setShowReminderErrors(false);
                              const currentEmails = JSON.parse(localStorage.getItem('clueai_saved_emails') || '[]');
                              if (!currentEmails.includes(reminderForm.email)) {
                                currentEmails.unshift(reminderForm.email);
                                localStorage.setItem('clueai_saved_emails', JSON.stringify(currentEmails));
                              }
                              localStorage.setItem('clueai_saved_email', reminderForm.email);

                              const currentId = reminderForm.id || Date.now().toString();
                              setReminderProfiles(prev => {
                                if (prev.some(p => p.id === currentId)) {
                                  return prev.map(p => p.id === currentId ? { ...reminderForm, id: currentId } : p);
                                }
                                return [{ ...reminderForm, id: currentId }, ...prev];
                              });
                              setShowReminderPopup(false);
                            }}
                            className="px-5 py-2.5 bg-brand-accent hover:bg-brand-accent/80 text-white rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg"
                          >
                            <Save size={16} /> Save Profile
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {/* Notes Popup Editor */}
              {showNotesPopup && (
                <div className="fixed inset-0 z-[300] bg-black/45 backdrop-blur-sm flex flex-col items-center justify-center p-8 animate-in fade-in duration-200">
                  <div className={`w-full max-w-md bg-brand-secondary border border-teal-500/30 rounded-2xl shadow-[0_0_80px_rgba(20,184,166,0.15)] flex flex-col overflow-hidden ${!localNotesStealth ? 'stealth-exempt' : ''}`}>
                    <div className="px-6 py-4 border-b border-teal-500/10 flex justify-between items-center bg-black/20">
                      <div className="flex items-center gap-4">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2"><FileText size={18} className="text-teal-400" /> Note Profile Setup</h2>
                        <button onClick={() => setLocalNotesStealth(!localNotesStealth)} className={`shield-toggle-btn p-1.5 rounded-lg transition-all hover:scale-105 active:scale-95 ${localNotesStealth ? 'bg-green-500/20 text-green-400' : 'bg-rose-500/20 text-rose-400'}`}>
                          {localNotesStealth ? <Shield size={16} /> : <ShieldAlert size={16} />}
                        </button>
                      </div>
                      <button onClick={() => setShowNotesPopup(false)} className="text-white/50 hover:text-white transition-colors"><X size={20} /></button>
                    </div>

                    <div className="p-6 flex flex-col gap-4 overflow-y-auto max-h-[60vh] custom-scrollbar">
                      <div>
                        <label className="block text-xs font-bold text-brand-subtext uppercase mb-1">Notes</label>
                        <textarea
                          placeholder="e.g. Discussed system design..."
                          disabled={notesPopupMode === 'preview'}
                          className={`w-full bg-black/40 border ${showNotesErrors && !notesForm.notes ? 'border-rose-500/50' : 'border-brand-border'} rounded-lg p-3 text-sm text-white outline-none focus:border-teal-500 transition-colors h-24 resize-none disabled:opacity-50`}
                          value={notesForm.notes}
                          onChange={e => setNotesForm({ ...notesForm, notes: e.target.value })}
                        />
                        {showNotesErrors && !notesForm.notes && <p className="text-rose-500 text-[10px] mt-1 font-bold">This field is required.</p>}
                      </div>
                      <div className="relative">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-bold text-brand-subtext uppercase">Email ID</label>
                          {notesForm.email.trim() && isEmailVerified(notesForm.email.trim()) && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold animate-in fade-in duration-200">
                              <ShieldCheck size={11} className="text-emerald-400" /> Verified
                            </span>
                          )}
                        </div>
                        <input
                          type="email"
                          disabled={notesPopupMode !== 'create'}
                          placeholder="e.g. user@example.com"
                          className={`w-full bg-black/40 border ${showNotesErrors && (!notesForm.email || !/^\S+@\S+\.\S+$/.test(notesForm.email)) ? 'border-rose-500/50' : 'border-brand-border'} rounded-lg p-3 text-sm text-white outline-none focus:border-teal-500 transition-colors disabled:opacity-50`}
                          value={notesForm.email}
                          onChange={e => {
                            setNotesForm({ ...notesForm, email: e.target.value });
                            const saved = JSON.parse(localStorage.getItem('clueai_saved_emails') || '[]');
                            const matches = e.target.value ? saved.filter((s: string) => s.toLowerCase().includes(e.target.value.toLowerCase())) : saved;
                            setShowNotesEmailSuggest(matches.length > 0);
                          }}
                          onFocus={() => {
                            const saved = JSON.parse(localStorage.getItem('clueai_saved_emails') || '[]');
                            if (saved.length > 0) {
                              setShowNotesEmailSuggest(true);
                            }
                          }}
                          onBlur={() => setTimeout(() => setShowNotesEmailSuggest(false), 200)}
                        />
                        {showNotesEmailSuggest && JSON.parse(localStorage.getItem('clueai_saved_emails') || '[]').length > 0 && (
                          <div className="absolute top-full left-0 w-full mt-2 bg-brand-bg/95 backdrop-blur-xl border border-brand-border rounded-lg shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200 max-h-40 overflow-y-auto custom-scrollbar">
                            <div className="px-4 py-2 bg-black/20 border-b border-brand-border/50 flex items-center justify-between">
                              <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider mb-0.5">Suggested Emails</span>
                              <span className="text-[9px] text-white/40">Verified Status</span>
                            </div>
                            {(JSON.parse(localStorage.getItem('clueai_saved_emails') || '[]') as string[])
                              .filter(s => !notesForm.email || s.toLowerCase().includes(notesForm.email.toLowerCase()))
                              .map((email, idx) => {
                                const verified = isEmailVerified(email);
                                return (
                                  <div
                                    key={idx}
                                    className="px-4 py-2 hover:bg-white/10 cursor-pointer flex items-center justify-between transition-colors border-b border-brand-border/30 last:border-0"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      setNotesForm({ ...notesForm, email });
                                      setShowNotesEmailSuggest(false);
                                    }}
                                  >
                                    <span className="text-sm text-white font-mono">{email}</span>
                                    {verified && (
                                      <span className="inline-flex items-center gap-1 text-[9px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-bold">
                                        <ShieldCheck size={10} className="text-emerald-400" /> Verified
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        )}
                        {showNotesErrors && !notesForm.email && <p className="text-rose-500 text-[10px] mt-1 font-bold">This field is required.</p>}
                        {showNotesErrors && notesForm.email && !/^\S+@\S+\.\S+$/.test(notesForm.email) && <p className="text-rose-500 text-[10px] mt-1 font-bold">Please enter a valid email address.</p>}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-brand-subtext uppercase mb-1 flex justify-between">
                            <span>Date</span>
                            {getDayOfWeek(notesForm.date) && <span className="text-teal-400 capitalize">{getDayOfWeek(notesForm.date)}</span>}
                          </label>
                          <input type="text" placeholder="DD-MM-YYYY" disabled={notesPopupMode === 'preview'} className={`w-full bg-black/40 border ${(showNotesErrors && !notesForm.date) || validateDateTime(notesForm.date, notesForm.time, notesForm.ampm).dateError ? 'border-rose-500/50' : 'border-brand-border'} rounded-lg p-3 text-sm text-white outline-none focus:border-teal-500 transition-colors disabled:opacity-50`} value={notesForm.date} onChange={e => handleDateChange(e.target.value, notesForm, setNotesForm)} />
                          {showNotesErrors && !notesForm.date && <p className="text-rose-500 text-[10px] mt-1 font-bold">Required.</p>}
                          {validateDateTime(notesForm.date, notesForm.time, notesForm.ampm).dateError && <p className="text-rose-500 text-[10px] mt-1 font-bold">{validateDateTime(notesForm.date, notesForm.time, notesForm.ampm).dateError}</p>}
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-brand-subtext uppercase mb-1">Time</label>
                          <div className="relative">
                            <input type="text" placeholder="HH:MM" disabled={notesPopupMode === 'preview'} className={`w-full bg-black/40 border ${(showNotesErrors && !notesForm.time) || (notesPopupMode !== 'preview' && validateDateTime(notesForm.date, notesForm.time, notesForm.ampm).timeError) ? 'border-rose-500/50' : 'border-brand-border'} rounded-lg p-3 text-sm text-white outline-none focus:border-teal-500 transition-colors pr-16 disabled:opacity-50`} value={notesForm.time} onChange={e => handleTimeChange(e.target.value, notesForm, setNotesForm)} />
                            <button
                              disabled={notesPopupMode === 'preview'}
                              onClick={() => setNotesForm({ ...notesForm, ampm: notesForm.ampm === 'AM' ? 'PM' : 'AM' })}
                              className="absolute right-2 top-1/2 -translate-y-1/2 bg-teal-500/20 text-teal-400 px-2 py-1 rounded text-xs font-bold flex items-center gap-1 hover:bg-teal-500/30 transition-colors disabled:opacity-50"
                            >
                              {notesForm.ampm} <RefreshCcw size={10} />
                            </button>
                          </div>
                          {showNotesErrors && !notesForm.time && <p className="text-rose-500 text-[10px] mt-1 font-bold">Required.</p>}
                          {notesPopupMode !== 'preview' && validateDateTime(notesForm.date, notesForm.time, notesForm.ampm).timeError && <p className="text-rose-500 text-[10px] mt-1 font-bold">{validateDateTime(notesForm.date, notesForm.time, notesForm.ampm).timeError}</p>}
                        </div>
                      </div>
                    </div>

                    <div className="px-6 py-4 border-t border-white/5 flex justify-end gap-3 bg-black/20">
                      {notesPopupMode === 'preview' ? (() => {
                        let isPast = false;
                        try {
                          const [d, m, y] = notesForm.date.split('-');
                          const [h, min] = notesForm.time.split(':');
                          let hours = parseInt(h);
                          if (notesForm.ampm === 'PM' && hours < 12) hours += 12;
                          if (notesForm.ampm === 'AM' && hours === 12) hours = 0;
                          const targetDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d), hours, parseInt(min));
                          isPast = new Date() > targetDate;
                        } catch (e) { }

                        return (
                          <button
                            onClick={() => setNotesPopupMode('edit')}
                            className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg"
                          >
                            <Edit2 size={16} /> {isPast ? 'Resend' : 'Edit'}
                          </button>
                        );
                      })() : (
                        <>
                          {emailSendStatus === 'sending' && (
                            <div className="px-5 py-2.5 bg-teal-600/50 text-white rounded-xl font-bold flex items-center gap-2 border border-teal-500/50">
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Sending & Saving...
                            </div>
                          )}
                          {emailSendStatus === 'success' && (
                            <div className="px-5 py-2.5 bg-green-500/20 text-green-400 rounded-xl font-bold flex items-center gap-2 border border-green-500/50">
                              <CheckCircle2 size={16} /> Sent & Saved!
                            </div>
                          )}
                          {emailSendStatus === 'idle' && (
                            <button
                              onClick={() => {
                                const { dateError, timeError } = validateDateTime(notesForm.date, notesForm.time, notesForm.ampm);
                                const dateValid = !dateError && notesForm.date;
                                const timeValid = !timeError && notesForm.time;
                                const emailValid = /^\S+@\S+\.\S+$/.test(notesForm.email);

                                if (!notesForm.notes || !emailValid || !dateValid || !timeValid) {
                                  setShowNotesErrors(true);
                                  return;
                                }
                                setShowNotesErrors(false);

                                const emailTrimmed = notesForm.email.trim();
                                const executeNotesSchedule = () => {
                                  markEmailVerified(emailTrimmed);
                                  const currentId = notesForm.id || Date.now().toString();
                                  const templateParams = {
                                    id: currentId,
                                    type: 'note',
                                    email: emailTrimmed,
                                    date: notesForm.date,
                                    time: `${notesForm.time} ${notesForm.ampm}`,
                                    notes: notesForm.notes,
                                  };

                                  setEmailSendStatus('sending');
                                  const doSchedule = () => {
                                    fetch(GOOGLE_SCRIPT_URL, {
                                      method: 'POST',
                                      mode: 'no-cors',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify(templateParams)
                                    })
                                      .then(() => {
                                        setEmailSendStatus('success');
                                        setNotesProfiles(prev => {
                                          if (prev.some(p => p.id === currentId)) {
                                            return prev.map(p => p.id === currentId ? { ...notesForm, id: currentId } : p);
                                          }
                                          return [{ ...notesForm, id: currentId }, ...prev];
                                        });

                                        setTimeout(() => {
                                          setShowNotesPopup(false);
                                          setEmailSendStatus('idle');
                                        }, 1500);
                                      })
                                      .catch(err => {
                                        setEmailSendStatus('idle');
                                        console.error('Google Script Error:', err);
                                        setAlertMessage({ title: 'Email Error', message: `Failed to send. Error: ${err.message}`, type: 'error' });
                                      });
                                  };

                                  if (notesForm.id) {
                                    fetch(GOOGLE_SCRIPT_URL, {
                                      method: 'POST', mode: 'no-cors',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ action: 'delete', id: notesForm.id })
                                    }).then(doSchedule).catch(doSchedule);
                                  } else {
                                    doSchedule();
                                  }
                                };

                                if (isEmailVerified(emailTrimmed)) {
                                  executeNotesSchedule();
                                } else {
                                  triggerOtpVerification('note', emailTrimmed, executeNotesSchedule);
                                }
                              }}
                              className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg"
                            >
                              Send & Save Notes
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Virtual Keyboard Transcript Editor with Framer Motion & Native Physical Keyboard Support */}
              <AnimatePresence>
                {showVirtualKeyboard && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-2xl flex flex-col items-center justify-center p-6 md:p-8"
                  >
                    <motion.div
                      initial={{ opacity: 0, scale: 0.94, y: 15 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.94, y: 15 }}
                      transition={{ type: "spring", stiffness: 400, damping: 28 }}
                      className="w-full max-w-4xl bg-[#0a0b12]/95 border border-cyan-500/30 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_35px_rgba(6,182,212,0.15)] flex flex-col overflow-hidden stealth-exempt"
                    >
                      <div className="flex justify-between items-center bg-white/[0.03] px-6 py-4 border-b border-white/10">
                        <h2 className="text-base font-black text-white flex items-center gap-2">
                          <FileText size={18} className="text-cyan-400" /> Virtual & Physical Keyboard Editor
                        </h2>
                        <div className="flex gap-2 text-[10.5px] text-white/50 uppercase font-black tracking-wider">
                          <span className="bg-black/40 border border-white/10 px-2 py-1 rounded">Enter: Save</span>
                          <span className="bg-black/40 border border-white/10 px-2 py-1 rounded">Shift+Enter: New Line</span>
                          <span className="bg-black/40 border border-white/10 px-2 py-1 rounded text-cyan-300">Physical Keyboard Ready</span>
                        </div>
                        <button
                          onClick={() => {
                            setShowVirtualKeyboard(false);
                            if (globalHotkeysEnabled && isRecording) ipcRenderer.invoke('toggle-global-hotkeys', true);
                          }}
                          className="text-white/60 hover:text-white transition-colors bg-white/5 hover:bg-rose-500/80 rounded-lg px-3.5 py-1.5 flex items-center gap-1.5 text-xs font-bold border border-white/10"
                        >
                          <X size={15} /> Cancel (Esc)
                        </button>
                      </div>

                      <textarea
                        ref={virtualKeyboardTextareaRef}
                        autoFocus
                        onFocus={() => {
                          ipcRenderer.invoke('toggle-global-hotkeys', false);
                        }}
                        className="w-full h-56 bg-transparent text-white p-6 outline-none resize-none text-lg font-medium leading-relaxed custom-scrollbar placeholder-white/20 select-text"
                        value={editTranscript}
                        onChange={(e) => setEditTranscript(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            setShowVirtualKeyboard(false);
                            if (globalHotkeysEnabled && isRecording) ipcRenderer.invoke('toggle-global-hotkeys', true);
                          } else if (e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.ctrlKey) {
                            e.preventDefault();
                            setTranscript(editTranscript);
                            setFinalizedText(editTranscript);
                            setInterimText('');
                            finalizedTranscriptRef.current = editTranscript;
                            interimTranscriptRef.current = '';
                            clearAudioBuffer();
                            setShowVirtualKeyboard(false);
                            if (globalHotkeysEnabled && isRecording) ipcRenderer.invoke('toggle-global-hotkeys', true);
                          }
                          // Shift+Enter, Alt+Enter, Ctrl+Enter and all physical typing keys work natively with 0 interference!
                        }}
                        placeholder="Type question or prompt with your physical keyboard, or click on-screen buttons below..."
                      />

                      <div className="bg-black/60 p-4 flex flex-col gap-2 items-center border-t border-white/10 select-none">
                        <div className="flex flex-col gap-1.5 w-full max-w-4xl">
                          {/* Special characters row */}
                          <div className="flex gap-1.5 w-full justify-center mb-1">
                            {['@', '#', '$', '%', '&', '*', '(', ')', '{', '}', '[', ']', '<', '>', '_', '+', '-', '=', '/', '\\', '|'].map(key => (
                              <button
                                key={key}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  const ta = virtualKeyboardTextareaRef.current;
                                  if (ta) {
                                    const start = ta.selectionStart ?? editTranscript.length;
                                    const end = ta.selectionEnd ?? editTranscript.length;
                                    const updated = editTranscript.slice(0, start) + key + editTranscript.slice(end);
                                    setEditTranscript(updated);
                                    requestAnimationFrame(() => {
                                      ta.focus();
                                      ta.selectionStart = ta.selectionEnd = start + key.length;
                                    });
                                  } else {
                                    setEditTranscript(prev => prev + key);
                                  }
                                }}
                                className="w-8 h-8 bg-cyan-500/10 hover:bg-cyan-500/30 text-cyan-300 rounded-lg font-bold text-sm transition-all flex items-center justify-center border border-cyan-500/20 active:scale-95"
                              >
                                {key}
                              </button>
                            ))}
                          </div>
                          {[
                            ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
                            ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
                            ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'"],
                            ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '?']
                          ].map((row, i) => (
                            <div key={i} className="flex gap-1.5 w-full justify-center">
                              {row.map(key => (
                                <button
                                  key={key}
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    const ta = virtualKeyboardTextareaRef.current;
                                    if (ta) {
                                      const start = ta.selectionStart ?? editTranscript.length;
                                      const end = ta.selectionEnd ?? editTranscript.length;
                                      const updated = editTranscript.slice(0, start) + key + editTranscript.slice(end);
                                      setEditTranscript(updated);
                                      requestAnimationFrame(() => {
                                        ta.focus();
                                        ta.selectionStart = ta.selectionEnd = start + key.length;
                                      });
                                    } else {
                                      setEditTranscript(prev => prev + key);
                                    }
                                  }}
                                  className="w-10 h-10 bg-white/5 hover:bg-white/20 active:bg-white/30 text-white rounded-lg font-bold uppercase text-sm border border-white/5 shadow-sm transition-all flex items-center justify-center"
                                >
                                  {key}
                                </button>
                              ))}
                            </div>
                          ))}

                          <div className="flex gap-2 w-full justify-center mt-2">
                            <button
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                const ta = virtualKeyboardTextareaRef.current;
                                if (ta) {
                                  const start = ta.selectionStart ?? editTranscript.length;
                                  const end = ta.selectionEnd ?? editTranscript.length;
                                  if (start === end && start > 0) {
                                    const updated = editTranscript.slice(0, start - 1) + editTranscript.slice(end);
                                    setEditTranscript(updated);
                                    requestAnimationFrame(() => {
                                      ta.focus();
                                      ta.selectionStart = ta.selectionEnd = start - 1;
                                    });
                                  } else if (start !== end) {
                                    const updated = editTranscript.slice(0, start) + editTranscript.slice(end);
                                    setEditTranscript(updated);
                                    requestAnimationFrame(() => {
                                      ta.focus();
                                      ta.selectionStart = ta.selectionEnd = start;
                                    });
                                  }
                                } else {
                                  setEditTranscript(prev => prev.slice(0, -1));
                                }
                              }}
                              className="px-6 py-3 bg-white/5 hover:bg-rose-500/80 text-white rounded-xl font-bold flex-[1] border border-white/10 transition-all active:scale-95"
                            >
                              Backspace
                            </button>
                            <button
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                const ta = virtualKeyboardTextareaRef.current;
                                if (ta) {
                                  const start = ta.selectionStart ?? editTranscript.length;
                                  const end = ta.selectionEnd ?? editTranscript.length;
                                  const updated = editTranscript.slice(0, start) + '\n' + editTranscript.slice(end);
                                  setEditTranscript(updated);
                                  requestAnimationFrame(() => {
                                    ta.focus();
                                    ta.selectionStart = ta.selectionEnd = start + 1;
                                  });
                                } else {
                                  setEditTranscript(prev => prev + '\n');
                                }
                              }}
                              className="px-6 py-3 bg-white/5 hover:bg-white/20 text-white rounded-xl font-bold flex-[1] border border-white/10 transition-all flex flex-col items-center justify-center gap-0.5 leading-none active:scale-95"
                            >
                              <span>Next Line</span>
                              <span className="text-[10px] opacity-70 font-normal">(Shift+Enter)</span>
                            </button>
                            <button
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                const ta = virtualKeyboardTextareaRef.current;
                                if (ta) {
                                  const start = ta.selectionStart ?? editTranscript.length;
                                  const end = ta.selectionEnd ?? editTranscript.length;
                                  const updated = editTranscript.slice(0, start) + ' ' + editTranscript.slice(end);
                                  setEditTranscript(updated);
                                  requestAnimationFrame(() => {
                                    ta.focus();
                                    ta.selectionStart = ta.selectionEnd = start + 1;
                                  });
                                } else {
                                  setEditTranscript(prev => prev + ' ');
                                }
                              }}
                              className="px-6 py-3 bg-white/5 hover:bg-white/20 text-white rounded-xl font-bold flex-[2] border border-white/10 transition-all active:scale-95"
                            >
                              Space
                            </button>
                            <button
                              onClick={() => {
                                setTranscript(editTranscript);
                                setFinalizedText(editTranscript);
                                setInterimText('');
                                finalizedTranscriptRef.current = editTranscript;
                                interimTranscriptRef.current = '';
                                clearAudioBuffer();
                                setShowVirtualKeyboard(false);
                                if (globalHotkeysEnabled && isRecording) ipcRenderer.invoke('toggle-global-hotkeys', true);
                              }}
                              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-[0_0_20px_rgba(6,182,212,0.4)] rounded-xl font-bold flex-[1] border border-cyan-400/40 transition-all flex flex-col items-center justify-center gap-0.5 leading-none active:scale-95"
                            >
                              <span>Done / Save</span>
                              <span className="text-[10px] opacity-90 font-normal">(Enter)</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Alert Message Modal */}

              {stealthWarningToast && (
                <div
                  className="fixed z-[9999] bg-rose-500/90 text-white px-3 py-1.5 rounded-lg shadow-xl font-bold flex items-center justify-center gap-2 text-[11px] animate-in zoom-in duration-200 backdrop-blur-md pointer-events-none whitespace-nowrap"
                  style={{
                    top: Math.max(10, stealthWarningToast.y) + 'px',
                    left: stealthWarningToast.x + 'px',
                    transform: 'translateX(-50%)'
                  }}
                >
                  {stealthWarningToast.isShieldToast && <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-b-[6px] border-l-transparent border-r-transparent border-b-rose-500/90" />}
                  {stealthWarningToast.isShieldToast ? (
                    <><ShieldAlert size={14} /> Turn OFF the shield above to type.</>
                  ) : (
                    <><ShieldAlert size={14} /> Shield is ON. Cannot type here.</>
                  )}
                </div>
              )}

              {alertMessage && (
                <div className="fixed inset-0 z-[400] bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center p-8 animate-in fade-in duration-200">
                  <div className={`w-full max-w-md bg-brand-secondary border ${alertMessage.type === 'error' ? 'border-rose-500/50' : alertMessage.type === 'success' ? 'border-green-500/50' : 'border-brand-accent/50'} rounded-2xl shadow-2xl flex flex-col overflow-hidden`}>
                    <div className="px-6 py-4 flex flex-col gap-3 mt-2">
                      <h3 className={`font-black text-xl tracking-wide flex items-center gap-2 ${alertMessage.type === 'error' ? 'text-rose-500' : alertMessage.type === 'success' ? 'text-green-400' : 'text-brand-accent'}`}>
                        {alertMessage.type === 'error' ? <XCircle size={20} /> : alertMessage.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
                        {alertMessage.title}
                      </h3>
                      <p className="text-sm font-medium leading-relaxed text-white/80 pb-2">
                        {alertMessage.message}
                      </p>
                    </div>
                    <div className="bg-black/40 px-6 py-4 border-t border-brand-border/50 flex justify-end gap-2.5">
                      <button
                        onClick={restartApp}
                        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-bold text-sm transition-colors shadow-lg flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw size={14} />
                        Restart ClueAI
                      </button>
                      <button
                        onClick={() => setAlertMessage(null)}
                        className={`px-6 py-2 ${alertMessage.type === 'error' ? 'bg-rose-500 hover:bg-rose-400' : alertMessage.type === 'success' ? 'bg-green-600 hover:bg-green-500' : 'bg-brand-accent hover:bg-brand-accentSec'} text-white rounded-lg font-bold text-sm transition-colors shadow-lg cursor-pointer`}
                      >
                        OK
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* First-Time User Onboarding & Email Verification Modal (v5.8.9 - Horizontal Minimal Redesign) */}
              <AnimatePresence>
                {showOnboardingModal && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[600] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 pointer-events-auto select-none stealth-exempt"
                  >
                    <motion.div
                      initial={{ scale: 0.94, opacity: 0, y: 16 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.94, opacity: 0, y: 16 }}
                      transition={{ type: "spring", stiffness: 360, damping: 28 }}
                      className="onboarding-modal-container relative w-full max-w-3xl bg-[#080b15]/98 border border-cyan-500/40 rounded-3xl shadow-[0_25px_80px_rgba(0,0,0,0.95),0_0_50px_rgba(6,182,212,0.22)] overflow-hidden flex flex-col"
                    >
                      {/* Top Cyberpunk Accent Line */}
                      <div className="h-1.5 w-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 shadow-[0_0_15px_rgba(34,211,238,0.5)]" />

                      {/* Top-Right Window Control Icons for Starting Panel */}
                      <div className="absolute top-3.5 right-3.5 z-40 flex items-center gap-1.5 bg-black/60 border border-white/10 rounded-xl p-1 backdrop-blur-md">
                        <button
                          onClick={restartApp}
                          title="Restart Clue AI (Ctrl + Shift + R)"
                          className="p-1.5 hover:bg-cyan-500/20 text-white/60 hover:text-cyan-300 rounded-lg transition-colors cursor-pointer"
                        >
                          <RefreshCw size={13} />
                        </button>
                        <button
                          onClick={minimizeApp}
                          title="Minimize Window (Ctrl + Shift + K)"
                          className="p-1.5 hover:bg-white/10 text-white/60 hover:text-white rounded-lg transition-colors cursor-pointer"
                        >
                          <Minus size={13} />
                        </button>
                        <button
                          onClick={closeApp}
                          title="Close & Terminate Processes (Ctrl + Shift + X)"
                          className="p-1.5 hover:bg-rose-500/20 text-white/60 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                        >
                          <X size={13} />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 min-h-[420px]">
                        {/* Left Column: Branding, Logo & Stealth Status */}
                        <div className="md:col-span-5 bg-gradient-to-b from-[#0d1322] via-[#090d1a] to-[#070a14] p-7 sm:p-8 flex flex-col justify-between border-b md:border-b-0 md:border-r border-white/[0.08] relative overflow-hidden">
                          {/* Ambient Glow Orbs */}
                          <div className="absolute -top-16 -left-16 w-44 h-44 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
                          <div className="absolute -bottom-16 -right-16 w-44 h-44 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

                          <div className="relative z-10">
                            {/* Clue AI Logo & App Identity */}
                            <div className="flex items-center gap-3.5 mb-5">
                              <div className="w-13 h-13 rounded-2xl bg-[#0b1020] border border-cyan-400/40 p-2 flex items-center justify-center shadow-[0_0_25px_rgba(6,182,212,0.35)] shrink-0">
                                <img src="./logo.png" alt="Clue AI" className="w-9 h-9 object-contain" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xl font-black text-white tracking-tight">Clue AI</span>
                                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/40">v{appVersion}</span>
                                </div>
                                <p className="text-[11px] text-cyan-300/70 font-medium">Next-Gen Stealth Workspace</p>
                              </div>
                            </div>

                            {/* Key Highlights */}
                            <div className="space-y-3.5 my-5">
                              <div className="flex items-start gap-2.5">
                                <div className="w-5 h-5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0 mt-0.5">
                                  <Sparkles size={11} className="text-cyan-300" />
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-white/90">Zero-Footprint Stealth</p>
                                  <p className="text-[10px] text-white/50 leading-tight">Invisible to screen share and recording utilities.</p>
                                </div>
                              </div>

                              <div className="flex items-start gap-2.5">
                                <div className="w-5 h-5 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0 mt-0.5">
                                  <Mail size={11} className="text-blue-300" />
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-white/90">Instant Cloud Dispatches</p>
                                  <p className="text-[10px] text-white/50 leading-tight">Interview reminders and verified notes sent directly to your inbox.</p>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Shield Protection Status Pill (OFF during setup) */}
                          <div className="relative z-10 pt-4 border-t border-white/[0.08]">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-bold shadow-sm">
                              <ShieldAlert size={14} className="text-amber-400 shrink-0" />
                              <span>Protection: Shield OFF</span>
                            </div>
                            <p className="text-[10px] text-white/45 leading-normal mt-1.5">
                              Shield is kept OFF on this setup page so you can type freely. Full anti-detection engages once setup completes.
                            </p>
                          </div>
                        </div>

                        {/* Right Column: Setup Form */}
                        <div className="md:col-span-7 p-7 sm:p-8 bg-[#080b15] flex flex-col justify-center relative">
                          <div className="mb-5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400 bg-cyan-950/60 border border-cyan-500/30 px-2.5 py-0.5 rounded-md inline-block mb-1.5">
                              Candidate Setup
                            </span>
                            <h2 className="text-xl font-black text-white tracking-tight">
                              Welcome to Clue AI
                            </h2>
                            <p className="text-xs text-white/60 mt-1">
                              Configure your profile and verify your inbox to get started.
                            </p>
                          </div>

                          <div className="space-y-4">
                            {/* Full Name Input */}
                            <div>
                              <label className="block text-[11px] font-bold text-cyan-400/90 uppercase tracking-wider mb-1.5">
                                Your Full Name <span className="text-rose-400">*</span>
                              </label>
                              <div className="relative">
                                <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                                <input
                                  type="text"
                                  value={onboardingName}
                                  onChange={(e) => {
                                    setOnboardingName(e.target.value);
                                    if (onboardingError) setOnboardingError('');
                                  }}
                                  placeholder="e.g. Farhan Khalid"
                                  autoFocus
                                  className="w-full bg-white/[0.04] border border-white/10 focus:border-cyan-400 focus:bg-white/[0.07] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-white/30 outline-none transition-all shadow-inner"
                                />
                              </div>
                            </div>

                            {/* Email Address Input */}
                            <div className="relative">
                              <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-[11px] font-bold text-cyan-400/90 uppercase tracking-wider">
                                  Your Email Address <span className="text-rose-400">*</span>
                                </label>
                                {isEmailVerified(onboardingEmail.trim().toLowerCase()) && (
                                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                                    <ShieldCheck size={11} className="text-emerald-400" /> Verified
                                  </span>
                                )}
                              </div>
                              <div className="relative">
                                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                                <input
                                  type="email"
                                  value={onboardingEmail}
                                  onChange={(e) => {
                                    setOnboardingEmail(e.target.value);
                                    if (onboardingError) setOnboardingError('');
                                  }}
                                  onFocus={() => setShowOnboardingEmailSuggest(true)}
                                  onBlur={() => setTimeout(() => setShowOnboardingEmailSuggest(false), 200)}
                                  placeholder="e.g. farhan@example.com"
                                  className="w-full bg-white/[0.04] border border-white/10 focus:border-cyan-400 focus:bg-white/[0.07] rounded-xl pl-10 pr-24 py-2.5 text-xs text-white placeholder-white/30 outline-none transition-all shadow-inner font-mono"
                                />
                                {isEmailVerified(onboardingEmail.trim().toLowerCase()) && (
                                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-400 pointer-events-none flex items-center gap-1 font-bold text-[11px]" title="Email Verified">
                                    <CheckCircle2 size={16} className="text-emerald-400" />
                                  </span>
                                )}
                              </div>

                              {/* Saved Email Auto-suggestions */}
                              {showOnboardingEmailSuggest && (JSON.parse(localStorage.getItem('clueai_saved_emails') || '[]') as string[]).length > 0 && (
                                <div className="absolute left-0 right-0 top-full mt-1.5 p-2 bg-[#0d1222] border border-cyan-500/30 rounded-xl shadow-2xl z-30 max-h-36 overflow-y-auto">
                                  <div className="text-[10px] font-bold text-cyan-400/80 uppercase px-2 py-0.5 mb-1">Saved Inboxes</div>
                                  {(JSON.parse(localStorage.getItem('clueai_saved_emails') || '[]') as string[]).map((email) => (
                                    <button
                                      key={email}
                                      type="button"
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        setOnboardingEmail(email);
                                        setShowOnboardingEmailSuggest(false);
                                        if (onboardingError) setOnboardingError('');
                                      }}
                                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-cyan-500/15 text-left text-xs font-mono text-white/80 transition-all cursor-pointer"
                                    >
                                      <span>{email}</span>
                                      {isEmailVerified(email) && (
                                        <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-sans font-semibold">
                                          <ShieldCheck size={11} /> Verified
                                        </span>
                                      )}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Error Alert */}
                            {onboardingError && (
                              <div className="bg-rose-500/15 border border-rose-500/30 rounded-xl p-2.5 flex items-center gap-2 text-rose-300 text-xs font-semibold">
                                <AlertTriangle size={14} className="shrink-0 text-rose-400" />
                                <span>{onboardingError}</span>
                              </div>
                            )}

                            {/* Submit CTA */}
                            <button
                              onClick={handleCompleteOnboarding}
                              disabled={onboardingIsSubmitting}
                              className="w-full mt-2 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 hover:from-cyan-300 hover:to-blue-400 text-white shadow-[0_0_25px_rgba(6,182,212,0.45)] border border-cyan-300/50 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                              {onboardingIsSubmitting ? (
                                <>
                                  <Loader2 size={15} className="animate-spin" />
                                  <span>Configuring Profile...</span>
                                </>
                              ) : (
                                <>
                                  <ShieldCheck size={15} />
                                  <span>{isEmailVerified(onboardingEmail.trim().toLowerCase()) ? 'Launch Clue AI' : 'Verify & Launch Clue AI'}</span>
                                </>
                              )}
                            </button>

                            <p className="text-[10px] text-white/40 text-center leading-normal pt-1">
                              {isEmailVerified(onboardingEmail.trim().toLowerCase())
                                ? 'Your email is already verified. Clue AI will launch immediately.'
                                : 'A 6-digit verification code will be sent to your inbox for instant confirmation.'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {showUsernamePrompt && (
                <div className="fixed inset-0 z-[500] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-8 animate-in fade-in zoom-in duration-200">
                  <div className={`w-full max-w-sm bg-brand-secondary border border-brand-border rounded-3xl shadow-2xl flex flex-col overflow-hidden ${!localRenameStealth ? 'stealth-exempt' : ''}`}>
                    <div className="p-8 pb-6 bg-[#18181b]/50">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <h2 className="text-lg font-bold tracking-tight text-white m-0">Your Name</h2>
                            <button onClick={() => setLocalRenameStealth(!localRenameStealth)} className={`shield-toggle-btn p-1.5 rounded-lg transition-all hover:scale-105 active:scale-95 ${localRenameStealth ? 'bg-green-500/20 text-green-400' : 'bg-rose-500/20 text-rose-400'}`}>
                              {localRenameStealth ? <Shield size={16} /> : <ShieldAlert size={16} />}
                            </button>
                          </div>
                          <p className="text-xs text-brand-subtext leading-relaxed">This name will be attached to your exported sessions.</p>
                        </div>
                      </div>
                      <div className="w-full">
                        <input
                          type="text"
                          value={tempUsername}
                          onChange={(e) => setTempUsername(e.target.value)}
                          placeholder="e.g. John Doe"
                          className="w-full bg-black/50 border border-brand-border rounded-lg px-4 py-2.5 text-sm font-medium text-white outline-none focus:border-brand-accent transition-colors"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && tempUsername.trim()) {
                              setUsername(tempUsername.trim());
                              localStorage.setItem('clueai_username', tempUsername.trim());
                              setShowUsernamePrompt(false);
                              setStealthWarningToast(null);
                              if ((window as any).stealthToastTimeout) clearTimeout((window as any).stealthToastTimeout);
                            }
                          }}
                        />
                      </div>
                      <div className="flex justify-end mt-4">
                        <button
                          disabled={!tempUsername.trim()}
                          onClick={() => {
                            setUsername(tempUsername.trim());
                            localStorage.setItem('clueai_username', tempUsername.trim());
                            setShowUsernamePrompt(false);
                            setStealthWarningToast(null);
                            if ((window as any).stealthToastTimeout) clearTimeout((window as any).stealthToastTimeout);
                          }}
                          className="px-6 py-2 bg-brand-accent hover:bg-brand-accentSec disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold text-sm transition-all shadow-sm"
                        >
                          Save Name
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Previous Questions Modal with Framer Motion */}
              <AnimatePresence>
                {showPreviousQuestions && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-xl flex items-center justify-center p-4 md:p-8 overflow-hidden pointer-events-auto"
                  >
                    <motion.div
                      initial={{ opacity: 0, scale: 0.94, y: 15 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.94, y: 15 }}
                      transition={{ type: "spring", stiffness: 380, damping: 28 }}
                      className="w-full max-w-4xl max-h-[90vh] h-full bg-[#0a0b12]/95 backdrop-blur-3xl border border-cyan-500/30 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_35px_rgba(6,182,212,0.15)] flex flex-col overflow-hidden"
                    >
                      <div className="px-8 py-5 border-b border-white/5 flex justify-between items-center bg-white/5">
                        <h2 className="font-black text-xl text-white tracking-tight flex items-center gap-2">
                          <FileText size={20} className="text-white/60" />
                          Previous Questions (Active Session)
                        </h2>
                        <button onClick={() => setShowPreviousQuestions(false)} className="text-white/50 hover:text-white p-2 bg-white/5 hover:bg-rose-500 rounded-xl transition-colors shadow-sm">
                          <X size={20} />
                        </button>
                      </div>

                      <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar bg-black/[0.02]">
                        {currentSessionHistory.length === 0 ? (
                          <div className="text-center text-white/30 font-medium italic mt-10">No questions asked in this session yet.</div>
                        ) : currentSessionHistory.map((item, idx) => (
                          <div key={idx} className="bg-white/5 border border-white/5 rounded-[1.5rem] p-6 space-y-6 shadow-sm">
                            <div>
                              <div className="flex justify-between items-center mb-3">
                                <h3 className="text-[11px] font-black text-cyan-400 uppercase tracking-wider flex items-center gap-1.5"><Mic size={14} /> Transcript {idx + 1}</h3>
                                <CopyButton text={item.question} className="text-white/40 hover:text-white transition-colors" tooltip="Copy Transcript" />
                              </div>

                              {item.images && item.images.length > 0 && (
                                <div className="flex gap-2 overflow-x-auto custom-scrollbar mb-4 pb-2">
                                  {item.images.map((img, i) => (
                                    <img key={i} src={img} alt="Snapshot" className="h-[80px] aspect-video object-cover rounded-lg border border-white/10" />
                                  ))}
                                </div>
                              )}

                              <textarea
                                value={item.question}
                                onChange={(e) => {
                                  const updated = [...currentSessionHistory];
                                  updated[idx].question = e.target.value;
                                  setCurrentSessionHistory(updated);
                                }}
                                className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white/90 text-sm font-medium focus:border-cyan-500/50 outline-none transition-colors min-h-[100px] resize-y"
                              />

                              {/* Quick Add per Transcript */}
                              <div className="mt-3 flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2">
                                <span className="text-[10px] font-black text-white/40 uppercase tracking-wider whitespace-nowrap shrink-0">Quick Add:</span>
                                {['Explain this clearly', 'What are the main types?', 'Give an example', 'Optimize this code', 'Find the bug'].map((tag, tagIdx) => (
                                  <button
                                    key={tagIdx}
                                    onClick={() => {
                                      const updated = [...currentSessionHistory];
                                      updated[idx].question += (updated[idx].question ? '\n' : '') + tag;
                                      setCurrentSessionHistory(updated);
                                    }}
                                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 text-white/70 hover:text-white text-[11px] font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1"
                                  >
                                    <Plus size={12} className="opacity-50" /> {tag}
                                  </button>
                                ))}
                              </div>

                              <div className="mt-4 flex justify-between items-center border-t border-white/5 pt-4">
                                <button
                                  onClick={() => setExpandedAnswers(prev => ({ ...prev, [idx]: !prev[idx] }))}
                                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg font-bold text-xs transition-all flex items-center gap-2"
                                >
                                  {expandedAnswers[idx] ? <EyeOff size={14} /> : <Eye size={14} />}
                                  {expandedAnswers[idx] ? "Hide AI Answer" : "View AI Answer"}
                                </button>

                                <button
                                  onClick={() => {
                                    setTranscript(item.question);
                                    setFinalizedText(item.question);
                                    setInterimText('');
                                    finalizedTranscriptRef.current = item.question;
                                    interimTranscriptRef.current = '';
                                    let snaps: string[] = [];
                                    if (item.images && item.images.length > 0) {
                                      snaps = item.images;
                                      setCurrentSnapshots(snaps);
                                    }
                                    setShowPreviousQuestions(false);
                                    if (!isGenerating) {
                                      manualTriggerAIRef.current(snaps, item.question);
                                    }
                                  }}
                                  className="px-4 py-2 bg-brand-accent hover:bg-cyan-400 text-white rounded-lg font-bold text-xs shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all flex items-center gap-2"
                                >
                                  <RefreshCw size={14} /> Generate Answer
                                </button>
                              </div>
                            </div>

                            {expandedAnswers[idx] && (
                              <div className="pt-6 border-t border-white/5 animate-in slide-in-from-top-2 fade-in duration-200">
                                <div className="flex justify-between items-center mb-4">
                                  <h3 className="text-[11px] font-black text-fuchsia-400 uppercase tracking-wider flex items-center gap-1.5"><Cpu size={14} /> AI Answer</h3>
                                  <CopyButton text={item.answer.replace(/<think>[\s\S]*?(?:<\/think>|$)/g, '').replace(/(?:\r?\n){3,}/g, '\n\n').trim()} className="text-white/40 hover:text-white transition-colors" tooltip="Copy Answer" />
                                </div>
                                <div className="text-white/90 font-bold text-sm leading-relaxed">
                                  <ReactMarkdown components={markdownComponents}>
                                    {item.answer.replace(/<think>[\s\S]*?(?:<\/think>|$)/g, '').replace(/(?:\r?\n){3,}/g, '\n\n').trim()}
                                  </ReactMarkdown>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
        {/* Full-Screen Samsung One UI Style Update Installation Screen */}
        <AnimatePresence>
          {isInstallingUpdate && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[99999] bg-[#05060b] flex flex-col items-center justify-center p-8 select-none text-white overflow-hidden pointer-events-auto"
            >
              {/* Ambient radial glow */}
              <div className="absolute w-[600px] h-[600px] rounded-full bg-cyan-500/15 blur-[140px] pointer-events-none" />

              <div className="relative z-10 flex flex-col items-center max-w-md w-full text-center">
                {/* Glowing Clue AI emblem */}
                <div className="relative mb-8">
                  <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-cyan-500/20 via-blue-500/30 to-indigo-500/20 border border-cyan-400/50 flex items-center justify-center shadow-[0_0_60px_rgba(6,182,212,0.4)] animate-pulse">
                    <Sparkles size={44} className="text-cyan-400 animate-spin" style={{ animationDuration: '6s' }} />
                  </div>
                  <div className="absolute -inset-2 rounded-3xl border border-cyan-500/20 animate-ping" style={{ animationDuration: '3s' }} />
                </div>

                <h2 className="text-2xl font-black text-white tracking-tight mb-1">
                  Installing Clue AI Update
                </h2>
                <p className="text-xs text-cyan-400/80 font-mono font-bold uppercase tracking-widest mb-8">
                  Upgrading to Version {updateInfo.version || '5.8.9'}
                </p>

                {/* High-tech Progress Bar */}
                <div className="w-full bg-black/80 rounded-full border border-cyan-500/40 p-1 mb-4 shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)]">
                  <div
                    className="h-3.5 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 rounded-full transition-all duration-100 shadow-[0_0_20px_rgba(6,182,212,0.9)] relative"
                    style={{ width: `${Math.max(installProgress, 2)}%` }}
                  >
                    <div className="absolute right-0 top-0 bottom-0 w-2.5 bg-white rounded-full shadow-[0_0_8px_white]" />
                  </div>
                </div>

                {/* Percentage & Live Stage Text */}
                <div className="flex items-center justify-between w-full text-xs font-mono mb-2">
                  <span className="text-white/80 font-medium text-left">
                    {installStageText}
                  </span>
                  <span className="text-cyan-300 font-black text-sm">
                    {installProgress}%
                  </span>
                </div>

                <div className="mt-8 text-[11px] text-white/50 flex items-center gap-2 font-mono">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  Please do not close Clue AI. Relaunching automatically upon completion.
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {modelChangeMsg && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none">
            <span className="text-emerald-400 text-sm font-bold animate-in zoom-in slide-in-from-bottom-5 duration-150 flex items-center gap-2 bg-black/90 px-4 py-2 rounded-xl border border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.3)] backdrop-blur-xl">
              <CheckCircle2 size={16} /> {modelChangeMsg}
            </span>
          </div>
        )}

      </div>
    </>
  );
}

export default App;


