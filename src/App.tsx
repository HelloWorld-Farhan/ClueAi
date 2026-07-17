import { useEffect, useState, useRef } from 'react';
import { Play, Square, Mic, Upload, Cpu, FileText, Pause, Settings, LayoutPanelTop, Trash2, X, Minus, Loader2, Maximize, MoreVertical, Download, Plus, Move, Eye, EyeOff, ChevronDown, ChevronRight, Save, Crop, CheckCircle2, XCircle, AlertTriangle, Info, Edit2, Layout, ZoomIn, ZoomOut, Key, RefreshCcw, RefreshCw, ArrowUp, ArrowDown, User, MessageSquare, ChevronUp, Clock } from 'lucide-react';
import { initAIClient, getInterviewAnswer, switchProvider } from './AIClient';
import { initSTT, transcribeAudioChunk, setSTTApiKey } from './STTClient';
// @ts-ignore
const { ipcRenderer, shell } = window.require('electron');
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyWqhztb7GbVlghFBJeusoJ-YcYx-9WPsADg9JbUXTOY-QKTpjR1ivKNyJP3iJ3wzpgKw/exec';



const CopyButton = ({ text, className, tooltip, size = 14 }: { text: string, className?: string, tooltip?: string, size?: number }) => {
  const [copied, setCopied] = useState(false);
  const [empty, setEmpty] = useState(false);
  
  const handleCopy = () => {
    if (!text || text.trim() === "") {
      setEmpty(true);
      setTimeout(() => setEmpty(false), 2000);
      return;
    }
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className="flex items-center gap-2">
      {copied && <span className="text-green-500 text-[10px] font-bold animate-pulse">Copied!</span>}
      {empty && <span className="text-rose-500 text-[10px] font-bold animate-pulse">No Text</span>}
      <button 
        onClick={handleCopy}
        className={className}
        title={tooltip}
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

const validateGroqKey = async (key: string): Promise<boolean> => {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${key}` }
    });
    return res.ok;
  } catch {
    return false;
  }
};

const validateGeminiKey = async (key: string): Promise<boolean> => {
  const trimmed = key.trim();
  if (trimmed.startsWith('AQ.') && trimmed.length === 39) {
    return true;
  }
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    return res.ok;
  } catch {
    return false;
  }
};

type KeyValidationState = 'idle' | 'validating' | 'valid' | 'invalid' | 'duplicate';

const CustomSelect = ({ value, onChange, options, className, icon, listClassName }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((o: any) => o.value === value) || options[0];
  
  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-[100]" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} />
      )}
      <div className={`relative ${className || ''}`} onClick={() => setIsOpen(!isOpen)}>
        <div className="flex items-center justify-between h-full cursor-pointer select-none">
          <div className="flex items-center gap-2">
            {icon && icon}
            <span className="truncate">{selectedOption?.label || value}</span>
          </div>
          <ChevronDown size={14} className={`text-brand-subtext transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
        {isOpen && (
          <div className={`absolute z-[110] left-0 right-0 top-full mt-1.5 bg-[#18181b] border border-white/10 rounded-xl overflow-hidden shadow-2xl max-h-60 overflow-y-auto ${listClassName || ''}`}>
            {options.map((opt: any) => (
              <div 
                key={opt.value} 
                className={`px-4 py-3 hover:bg-white/10 cursor-pointer text-sm transition-colors ${opt.value === value ? 'bg-brand-accent/20 text-white font-bold' : 'text-brand-subtext hover:text-white'}`}
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
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  const [provider, setProvider] = useState<'groq' | 'gemini'>('groq');
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

  const [sysMicVolume, setSysMicVolume] = useState(100);
  const [sysMicMuted, setSysMicMuted] = useState(false);
  const [showAudioErrorModal, setShowAudioErrorModal] = useState(false);
  const [activeMicName, setActiveMicName] = useState('Default Microphone');

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

  const [apiAccordion, setApiAccordion] = useState<'none' | 'groq' | 'gemini'>('none');

  const [isRecording, setIsRecording] = useState(false);
  // const [isAnswerMaximized, setIsAnswerMaximized] = useState(false);
  const [showReminderEmailSuggest, setShowReminderEmailSuggest] = useState(false);
  const [showNotesEmailSuggest, setShowNotesEmailSuggest] = useState(false);

  const isRecordingRef = useRef(false);
  const isRecoveringRef = useRef(false);
  isRecordingRef.current = isRecording;
  const [isPaused, setIsPaused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [transcript, setTranscript] = useState('');
  const finalizedTranscriptRef = useRef('');
  const interimTranscriptRef = useRef('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [sources, setSources] = useState<any[]>([]);
  const [selectedSource, setSelectedSource] = useState('');
  const [altColor, setAltColor] = useState(false);
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
  const virtualKeyboardTextareaRef = useRef<HTMLTextAreaElement>(null);
  
  const [transcriptTextSize, setTranscriptTextSize] = useState(() => {
    try { return parseInt(localStorage.getItem('clueai_transcript_size') || '15'); } catch { return 15; }
  });
  const [aiAnswerTextSize, setAiAnswerTextSize] = useState(() => {
    try { return parseInt(localStorage.getItem('clueai_answer_size') || '15'); } catch { return 15; }
  });
  const [currentSessionHistory, setCurrentSessionHistory] = useState<{question: string, answer: string, images?: string[]}[]>([]);
  const [showPreviousQuestions, setShowPreviousQuestions] = useState(false);
  const [expandedAnswers, setExpandedAnswers] = useState<Record<number, boolean>>({});
  
  const transcriptScrollRef = useRef<HTMLDivElement>(null);
  const aiAnswerScrollRef = useRef<HTMLDivElement>(null);
  
  const [editTranscript, setEditTranscript] = useState('');
  
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionName, setEditingSessionName] = useState('');

  const [username, setUsername] = useState(() => {
    try { return localStorage.getItem('clueai_username') || ''; } catch { return ''; }
  });
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(() => {
    try { return !localStorage.getItem('clueai_username'); } catch { return true; }
  });
  const [tempUsername, setTempUsername] = useState(username);

  // Reminders
  // The old reminders state is completely removed in favor of reminderProfiles
  const [showReminderPopup, setShowReminderPopup] = useState(false);
  const [showReminderErrors, setShowReminderErrors] = useState(false);
  
  const [showNotesPopup, setShowNotesPopup] = useState(false);
  const [showNotesErrors, setShowNotesErrors] = useState(false);
  const [notesForm, setNotesForm] = useState({ id: '', notes: '', email: '', date: '', time: '', ampm: 'AM' });
  const [notesProfiles, setNotesProfiles] = useState<{id: string, notes: string, email: string, date: string, time: string, ampm: string}[]>(() => {
    try { return JSON.parse(localStorage.getItem('notes_profiles') || '[]'); } catch { return []; }
  });

  const [alertMessage, setAlertMessage] = useState<{title: string, message: string, type: 'error' | 'success' | 'warning'} | null>(null);
  const [reminderProfiles, setReminderProfiles] = useState<{id: string, name: string, jobTitle: string, email: string, phone: string, date: string, time: string, ampm: string}[]>(() => {
    try { return JSON.parse(localStorage.getItem('reminder_profiles') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem('reminder_profiles', JSON.stringify(reminderProfiles));
  }, [reminderProfiles]);

  useEffect(() => {
    localStorage.setItem('notes_profiles', JSON.stringify(notesProfiles));
  }, [notesProfiles]);
  
  const [reminderForm, setReminderForm] = useState({id: '', name: '', jobTitle: '', email: '', phone: '', date: '', time: '', ampm: 'AM'});
  const [emailSendStatus, setEmailSendStatus] = useState<'idle' | 'sending' | 'success'>('idle');
  
  const handleDateChange = (val: string, form: any, setForm: any) => {
    // Let them backspace without auto-filling everything back
    if (val.length < form.date.length) {
      setForm({...form, date: val});
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
    
    setForm({...form, date: formatted.substring(0, 10)});
  };

  const handleTimeChange = (val: string, form: any, setForm: any) => {
    if (val.length < form.time.length) {
      setForm({...form, time: val});
      return;
    }
    
    let formatted = val.replace(/[^\d:]/g, '');
    
    if (formatted.length === 1 && parseInt(formatted) > 1) {
      formatted = '0' + formatted + ':';
    }
    
    if (formatted.length === 2 && !formatted.includes(':')) {
      formatted = formatted + ':';
    }
    
    setForm({...form, time: formatted.substring(0, 5)});
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
  const [snapshotHistory, setSnapshotHistory] = useState<{id: string, image: string, transcriptContext: string}[]>([]);
  const [previewSnapshot, setPreviewSnapshot] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{x: number, y: number, id: string | null}>({x: 0, y: 0, id: null});

  // Session History
  const [sessions, setSessions] = useState<{id: string, name: string, time: string, transcript: string, aiAnswer: string, date?: string, snapshotHistory?: {id: string, image: string, transcriptContext: string}[]}[]>(() => {
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
  
  const [saveMessages, setSaveMessages] = useState<{type: 'success' | 'invalid' | 'duplicate', text: string}[]>([]);
  const [deleteMessage, setDeleteMessage] = useState<{provider: string, index: number} | null>(null);

  const [activeAIInfo, setActiveAIInfo] = useState<{provider: string, index: number} | null>(null);
  const [modelChangeMsg, setModelChangeMsg] = useState('');
  const [globalHotkeysEnabled, setGlobalHotkeysEnabled] = useState(true);
  const [showInfo, setShowInfo] = useState(false);

  const groqValidationCache = useRef<Record<string, boolean>>({});
  const geminiValidationCache = useRef<Record<string, boolean>>({});

  const saveApiKeys = () => {
    const dupGroq = groqKeyStatus.map((s, i) => s === 'duplicate' ? i + 1 : -1).filter(i => i !== -1);
    const dupGem = geminiKeyStatus.map((s, i) => s === 'duplicate' ? i + 1 : -1).filter(i => i !== -1);
    const invGroq = groqKeyStatus.map((s, i) => s === 'invalid' ? i + 1 : -1).filter(i => i !== -1);
    const invGem = geminiKeyStatus.map((s, i) => s === 'invalid' ? i + 1 : -1).filter(i => i !== -1);
    
    let msgs: {type: 'success' | 'invalid' | 'duplicate', text: string}[] = [];
    if (dupGroq.length > 0) msgs.push({ type: 'duplicate', text: `Warning: Groq Key ${dupGroq.join(' and ')} are duplicates.` });
    if (dupGem.length > 0) msgs.push({ type: 'duplicate', text: `Warning: Gemini Key ${dupGem.join(' and ')} are duplicates.` });
    if (invGroq.length > 0) msgs.push({ type: 'invalid', text: `Error: Groq Key ${invGroq.join(' and ')} are invalid.` });
    if (invGem.length > 0) msgs.push({ type: 'invalid', text: `Error: Gemini Key ${invGem.join(' and ')} are invalid.` });

    if (invGroq.length > 0 || invGem.length > 0) {
      setSaveMessages(msgs);
      setTimeout(() => setSaveMessages([]), 8000);
      return;
    }

    localStorage.setItem('groq_api_keys', JSON.stringify(groqKeys));
    localStorage.setItem('gemini_api_keys', JSON.stringify(geminiKeys));
    initAIClient(provider, groqKeys, geminiKeys);
    setSTTApiKey(groqKeys.filter(k => k.trim()));
    
    if (msgs.length === 0) {
      msgs.push({ type: 'success', text: 'Saved successfully!' });
    }
    
    setSaveMessages(msgs);
    setTimeout(() => setSaveMessages([]), 8000);
  };

  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      const keysToValidate = new Set<string>();
      
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

      for (let i = 0; i < 15; i++) {
        const key = groqKeys[i].trim();
        if (key && groqKeys.findIndex((k, idx) => idx !== i && k.trim() === key) === -1) {
          if (groqValidationCache.current[key] === undefined) {
            keysToValidate.add(key);
          }
        }
      }

      if (keysToValidate.size > 0) {
        await Promise.all(Array.from(keysToValidate).map(async (key) => {
          groqValidationCache.current[key] = await validateGroqKey(key);
        }));

        setGroqKeyStatus(prev => {
          const next = [...prev];
          for (let i = 0; i < 15; i++) {
            const key = groqKeys[i].trim();
            if (key && groqKeys.findIndex((k, idx) => idx !== i && k.trim() === key) === -1) {
               next[i] = groqValidationCache.current[key] ? 'valid' : 'invalid';
            }
          }
          return next;
        });
      }
    }, 800);
    return () => clearTimeout(timeoutId);
  }, [groqKeys]);

  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      const keysToValidate = new Set<string>();
      
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

      for (let i = 0; i < 15; i++) {
        const key = geminiKeys[i].trim();
        if (key && geminiKeys.findIndex((k, idx) => idx !== i && k.trim() === key) === -1) {
          if (geminiValidationCache.current[key] === undefined) {
            keysToValidate.add(key);
          }
        }
      }

      if (keysToValidate.size > 0) {
        await Promise.all(Array.from(keysToValidate).map(async (key) => {
          geminiValidationCache.current[key] = await validateGeminiKey(key);
        }));

        setGeminiKeyStatus(prev => {
          const next = [...prev];
          for (let i = 0; i < 15; i++) {
            const key = geminiKeys[i].trim();
            if (key && geminiKeys.findIndex((k, idx) => idx !== i && k.trim() === key) === -1) {
               next[i] = geminiValidationCache.current[key] ? 'valid' : 'invalid';
            }
          }
          return next;
        });
      }
    }, 800);
    return () => clearTimeout(timeoutId);
  }, [geminiKeys]);

  useEffect(() => {
    const fetchMicName = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const mics = devices.filter(d => d.kind === 'audioinput');
        if (mics.length > 0) {
           const defaultMic = mics.find(m => m.deviceId === 'default') || mics[0];
           setActiveMicName(defaultMic.label || 'Default Microphone');
        }
      } catch (e) {}
    };
    fetchMicName();
    
    const audioSyncInterval = setInterval(async () => {
      try {
        const state = await ipcRenderer.invoke('get-mic-state');
        setSysMicVolume(state.volume);
        setSysMicMuted(state.muted);
      } catch (e) {}
    }, 500);
    return () => clearInterval(audioSyncInterval);
  }, []);

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


  useEffect(() => {
    localStorage.setItem('reminder_profiles', JSON.stringify(reminderProfiles));
  }, [reminderProfiles]);

  useEffect(() => {
    if (isRecording) {
      ipcRenderer.invoke('set-layout', layout);
    }
  }, [layout]);

  useEffect(() => {
    localStorage.setItem('sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('interview_title', interviewTitle);
  }, [interviewTitle]);
  
  
    

  const [isGenerating, setIsGenerating] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const timerIntervalRef = useRef<any>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioDataRef = useRef<Float32Array>(new Float32Array(0));
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    localStorage.setItem('appStealthMode', stealthMode.toString());
    ipcRenderer.invoke('set-stealth', stealthMode);
  }, [stealthMode]);

  useEffect(() => {
    localStorage.setItem('appOpacity', opacity.toString());
  }, [opacity]);

  useEffect(() => {
    ipcRenderer.invoke('get-desktop-sources').then((s: any) => {
      setSources(s);
      if (s.length > 0) setSelectedSource(s[0].id);
    });
    
    // ALWAYS default to Stealth Mode ON every time the app opens for maximum safety
    setStealthMode(true);
    ipcRenderer.invoke('set-stealth', true);
  }, []);

  // Dynamically allow focus ONLY when the user needs to type text.
  // When these modals are closed, the app becomes a non-focusable Ghost Overlay to bypass anti-cheat checks.
  useEffect(() => {
    const wantsFocus = showSessionPrompt || showSettings || showUsernamePrompt || showReminderPopup || showVirtualKeyboard || showNotesPopup || (editingSessionId !== null);
    // If stealth mode is ON, the app must NEVER take focus, otherwise anti-cheat will detect it!
    const needsFocus = stealthMode ? false : wantsFocus;
    ipcRenderer.invoke('set-focusable', needsFocus);
    // When focusable, we use normal React key events. When in Ghost Mode, we must hijack them globally!
    // But ONLY hijack them globally if an interview is actually running (isRecording)!
    ipcRenderer.invoke('toggle-global-hotkeys', !needsFocus && isRecording);
  }, [showSessionPrompt, showSettings, showUsernamePrompt, showReminderPopup, showVirtualKeyboard, showNotesPopup, editingSessionId, isRecording, stealthMode]);

  useEffect(() => {
    if (showVirtualKeyboard) {
      setEditTranscript(transcript);
      
      const focusTextarea = () => {
        if (virtualKeyboardTextareaRef.current) {
          virtualKeyboardTextareaRef.current.focus();
          virtualKeyboardTextareaRef.current.selectionStart = virtualKeyboardTextareaRef.current.value.length;
          virtualKeyboardTextareaRef.current.selectionEnd = virtualKeyboardTextareaRef.current.value.length;
        }
      };
      
      // Try multiple times to beat the IPC window focus
      setTimeout(focusTextarea, 50);
      setTimeout(focusTextarea, 150);
      setTimeout(focusTextarea, 300);

      const handleGlobalKeydown = (e: KeyboardEvent) => {
        // If they start typing and the textarea isn't focused, focus it
        if (document.activeElement !== virtualKeyboardTextareaRef.current && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
          focusTextarea();
        }
      };
      
      window.addEventListener('keydown', handleGlobalKeydown);
      return () => window.removeEventListener('keydown', handleGlobalKeydown);
    }
  }, [showVirtualKeyboard]);

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
      setShowUsernamePrompt(true);
      return;
    }

    const activeKeys = provider === 'groq' ? groqKeys : geminiKeys;
    const hasActiveKey = activeKeys.some(k => k.trim() !== '');
    const hasGroqKey = groqKeys.some(k => k.trim() !== '');

    if (!hasActiveKey || !hasGroqKey) {
      if (!hasActiveKey) setAlertMessage({ title: 'API Key Missing', message: 'Please add at least one valid Gemini or Groq API key.', type: 'warning' });
      else if (!hasGroqKey) setAlertMessage({ title: 'Groq Key Missing', message: 'Please add at least one valid Groq API key for Transcription.', type: 'warning' });
      setShowSettings(true);
      return;
    }
    
    if (!selectedSource) {
      setAlertMessage({ title: 'Source Missing', message: 'Please select a screen to capture.', type: 'warning' });
      return;
    }

    // PRE-FLIGHT AUDIO CHECK
    try {
      const state = await ipcRenderer.invoke('get-mic-state');
      if (state.muted || state.volume < 80) {
        setShowAudioErrorModal(true);
        return;
      }
    } catch(e) {}

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
      } catch(e) {}
      
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
    if (!selectedSource) {
      setAlertMessage({ title: 'Source Missing', message: 'Screen capture source is missing. Trying to fetch it again... Please wait a moment and try again.', type: 'warning' });
      ipcRenderer.invoke('get-desktop-sources').then((s: any) => {
        setSources(s);
        if (s.length > 0) setSelectedSource(s[0].id);
      });
      return;
    }

    if (!silent) {
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
          
          if (currentSessionId) {
             const existing = sessions.find(s => s.id === currentSessionId);
             if (existing) {
                 setSessionLog(existing.transcript + `\n\n[SESSION_START:${new Date().toLocaleTimeString()}]\n\n`);
             }
          } else {
             setSessionLog(`\n\n[SESSION_START:${new Date().toLocaleTimeString()}]\n\n`);
             setCurrentSessionId(Date.now().toString());
          }
        }
      } else if (!currentSessionId) {
        setCurrentSessionId(Date.now().toString());
        setSessionLog(`\n\n[SESSION_START:${new Date().toLocaleTimeString()}]\n\n`);
      }

      setTranscript('');
      finalizedTranscriptRef.current = '';
      interimTranscriptRef.current = '';
      // Reset to current interview layout dimensions and position exactly when recording starts
      ipcRenderer.invoke('start-interview-window', layout);
      setIsRecording(true);
      setIsPaused(false);
    }
    
    setSessionError('');
    setShowSessionPrompt(false);

    const validGroqKeys = groqKeys.filter(k => k.trim());
    
    initAIClient(provider, groqKeys, geminiKeys);
    setSTTApiKey(validGroqKeys);

    await initSTT(() => {});
    audioDataRef.current = new Float32Array(0);

    try {      
      const freshSources = await ipcRenderer.invoke('get-desktop-sources');
      let activeSourceId = selectedSource;
      if (freshSources && freshSources.length > 0) {
         const found = freshSources.find((s: any) => s.id === selectedSource);
         if (!found) activeSourceId = freshSources[0].id;
      }
      
      const desktopStream = await navigator.mediaDevices.getUserMedia({
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
      });

      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });

      streamRef.current = new MediaStream([...desktopStream.getTracks(), ...micStream.getTracks()]);

      const handleDeviceBreak = () => {
        if (!isRecordingRef.current || isRecoveringRef.current) return;
        isRecoveringRef.current = true;
        console.log("Audio device changed/disconnected. Auto-recovering...");
        stopRecording(true);
        setTimeout(() => {
          startRecording(true).finally(() => {
            isRecoveringRef.current = false;
          });
        }, 3000); // Wait 3s for Windows to fully route Bluetooth audio
      };

      micStream.getTracks().forEach(track => track.addEventListener('ended', handleDeviceBreak));
      desktopStream.getTracks().forEach(track => track.addEventListener('ended', handleDeviceBreak));
      navigator.mediaDevices.ondevicechange = handleDeviceBreak;

      const audioCtx = new window.AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;

      const desktopSource = audioCtx.createMediaStreamSource(desktopStream);
      const micSource = audioCtx.createMediaStreamSource(micStream);
      
      const mixer = audioCtx.createGain();
      desktopSource.connect(mixer);
      micSource.connect(mixer);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      
      processor.onaudioprocess = (e) => {
        if (isPausedRef.current) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        const newData = new Float32Array(audioDataRef.current.length + inputData.length);
        newData.set(audioDataRef.current);
        newData.set(inputData, audioDataRef.current.length);
        audioDataRef.current = newData;
      };

      mixer.connect(processor);
      const silencer = audioCtx.createGain();
      silencer.gain.value = 0.0001;
      processor.connect(silencer);
      silencer.connect(audioCtx.destination);

      intervalRef.current = setInterval(() => {
        processAudioRef.current();
      }, 500);

      if (!silent) {
        setRecordingSeconds(0);
      }
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } catch (e) {
      if (stealthMode) ipcRenderer.invoke('set-stealth', true);
      console.error(e);
      if (silent) {
        setTimeout(() => startRecording(true).finally(() => { isRecoveringRef.current = false; }), 2000);
        return;
      }
      setAlertMessage({ title: 'Capture Failed', message: 'Failed to capture audio.', type: 'error' });
      setIsRecording(false);
      setShowSessionPrompt(false);
    }
  };

  const processAudioRef = useRef<() => void>(() => {});
  const isProcessingRef = useRef(false);
  const silenceFramesRef = useRef(0);
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
  
  const processAudio = async () => {
    if (!streamRef.current) return; 
    if (isPausedRef.current) {
      console.log('Paused');
      return;
    }
    if (isProcessingRef.current) return;

    if (audioDataRef.current.length < 16000 * 0.5) {
      return; 
    }

    isProcessingRef.current = true;
    try {
      const currentAudio = audioDataRef.current;
      if (currentAudio.length > 16000 * 30) {
         audioDataRef.current = currentAudio.slice(currentAudio.length - 16000 * 30);
      }

      // Only calculate max volume on the most recent ~1.2 seconds to know if they are speaking RIGHT NOW
      const recentAudio = currentAudio.slice(Math.max(0, currentAudio.length - 16000 * 1.2));
      let maxVal = 0;
      for (let i = 0; i < recentAudio.length; i++) {
        if (Math.abs(recentAudio[i]) > maxVal) maxVal = Math.abs(recentAudio[i]);
      }
      
      // Dynamic noise gate threshold. Raised to 0.04 to correctly ignore MS Teams static/hum (which sits at ~0.02)
      if (maxVal < 0.04) {
        silenceFramesRef.current += 1;
        // If silent for more than 2 seconds (4 frames of 500ms) and buffer is not empty
        if (silenceFramesRef.current > 4 && audioDataRef.current.length > 0) {
           logEvent("Silence >2s detected. Committing sentence and flushing STT buffer.");
           
           if (interimTranscriptRef.current) {
             finalizedTranscriptRef.current = (finalizedTranscriptRef.current + ' ' + interimTranscriptRef.current).trim();
           }
           
           audioDataRef.current = new Float32Array(0); // FLUSH buffer!
           interimTranscriptRef.current = ''; // Reset interim
           silenceFramesRef.current = 0;
           
           if (!isPausedRef.current) {
             setTranscript(finalizedTranscriptRef.current);
           }
        }
        isProcessingRef.current = false;
        return;
      }
      
      logEvent(`Triggering STT. Buffer size: ${(currentAudio.length / 16000).toFixed(2)}s, Max Volume: ${maxVal.toFixed(4)}`);
      
      silenceFramesRef.current = 0; // Reset silence counter since they are speaking
      
      // FORCE COMMIT: If the buffer exceeds 12 seconds, Whisper large-v3-turbo might start dropping earlier sentences.
      // We force a commit here to start a fresh sentence chunk.
      if (currentAudio.length > 16000 * 12) {
         logEvent("Buffer exceeded 12s. Force-committing to prevent Whisper summarization loss.");
         if (interimTranscriptRef.current) {
            finalizedTranscriptRef.current = (finalizedTranscriptRef.current + ' ' + interimTranscriptRef.current).trim();
         }
         audioDataRef.current = new Float32Array(0);
         interimTranscriptRef.current = '';
         if (!isPausedRef.current) {
            setTranscript(finalizedTranscriptRef.current);
         }
         isProcessingRef.current = false;
         return; // Skip this STT cycle, the next cycle will grab the fresh audio
      }
      
      const sttStart = Date.now();
      let text = await transcribeAudioChunk(currentAudio, resumeText + ' ' + personalContextText);
      const latency = Date.now() - sttStart;
      
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
            setTranscript((finalizedTranscriptRef.current + ' ' + text).trim());
         }
      }
    } finally {
      isProcessingRef.current = false;
    }
  };
  
  processAudioRef.current = processAudio;

  const manualTriggerAI = async () => {
    if (!interimTranscriptRef.current && !finalizedTranscriptRef.current && !transcript) {
      return;
    }
    
    setIsPaused(true);
    isPausedRef.current = true;
    setIsGenerating(true);
    
    if (transcript.trim() || aiAnswer.trim()) {
      setCurrentSessionHistory(prev => [...prev, { question: transcript, answer: aiAnswer, images: [...currentSnapshots] }]);
    }
    
    setAiAnswer('');
    let finalAnswer = '';
    let currentProviderInfo = '';

    await getInterviewAnswer(
      transcript, 
      resumeText,
      resumeText2,
      resumePriority,
      personalContextText,
      interviewTitle, 
      currentSnapshots,
      (chunk) => {
        finalAnswer += chunk;
        setAiAnswer(prev => prev + chunk);
      },
      (info) => {
        currentProviderInfo = `${info.provider.toUpperCase()} (Key ${info.index})`;
        setActiveAIInfo(info);
        if (activeAITimeoutRef.current) clearTimeout(activeAITimeoutRef.current);
        activeAITimeoutRef.current = setTimeout(() => setActiveAIInfo(null), 5000);
      }
    );
    
    if (finalAnswer.trim()) {
      setSessionLog(prev => prev + `\n\n--- QUESTION ---\n${currentSnapshots.length > 0 ? `[IMAGE_BASE64: MULTIPLE_IMAGES]\n` : ''}${transcript}\n\n--- AI ANSWER ---\n[MODEL:${currentProviderInfo}]\n${finalAnswer}\n\n`);
    }

    setIsGenerating(false);
  };

  const handleSnipClick = async () => {
    setIsPaused(true);
    isPausedRef.current = true;
    const base64Img = await ipcRenderer.invoke('start-snipping', selectedSource);
    if (!base64Img) {
      setIsPaused(false);
      isPausedRef.current = false;
      return; // User cancelled
    }
    
    if (currentSnapshots.length > 0) {
      setSnapshotHistory(prev => {
        const newHistory = [...prev, { id: Date.now().toString(), image: currentSnapshots[currentSnapshots.length-1], transcriptContext: transcript }];
        if (newHistory.length > 4) return newHistory.slice(newHistory.length - 4);
        return newHistory;
      });
    }

    setTranscript('');
    finalizedTranscriptRef.current = '';
    interimTranscriptRef.current = '';
    setAiAnswer('');
    setCurrentSnapshots(prev => [...prev.slice(-2), base64Img]);
  };

  const stopRecording = (isSilentRestart: boolean | any = false) => {
    const silent = typeof isSilentRestart === 'boolean' ? isSilentRestart : false;
    
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    // Reset to default main menu size cleanly
    ipcRenderer.invoke('stop-interview-window');

    if (!silent) {
      setIsRecording(false);
      setIsPaused(false);
      setSnapshotHistory([]);
      setCurrentSnapshots([]);
      setCurrentSessionHistory([]);
    }
    
    if (processorRef.current) processorRef.current.disconnect();
    if (audioContextRef.current) audioContextRef.current.close();
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    navigator.mediaDevices.ondevicechange = null;
    streamRef.current = null;
    audioDataRef.current = new Float32Array(0);
    
    if (!silent) {
      console.log('Idle');
      const finalLog = sessionLog + `\n\n[SESSION_END:${new Date().toLocaleTimeString()}|DURATION:${formatTimer(recordingSeconds)}]\n\n`;

      if (finalLog.trim()) {
        const newSession = {
          id: currentSessionId || Date.now().toString(),
          name: sessionNameInput || 'Untitled Session',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          date: new Date().toLocaleDateString(),
          transcript: finalLog.trim(),
          aiAnswer: '' 
        };
        setSessions(prev => [newSession, ...prev.filter(s => s.id !== newSession.id)]);
      }
      
      // Clear everything from the screen so it's perfectly fresh
      setTranscript('');
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

  const exportSession = (session: any) => {
    let htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ClueAI Session - ${session.name}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #09090b; color: #ffffff; line-height: 1.6; margin: 0; padding: 0; }
          .container { max-width: 900px; margin: 0 auto; padding: 40px 20px; }
          .header { text-align: center; border-bottom: 2px solid rgba(6, 182, 212, 0.3); padding-bottom: 30px; margin-bottom: 40px; }
          .header h1 { color: #22d3ee; margin: 0 0 10px 0; font-size: 2.5rem; text-transform: uppercase; letter-spacing: 2px; }
          .meta { color: #a1a1aa; font-size: 0.9rem; }
          .meta b { color: #e4e4e7; }
          .session-marker { background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); padding: 10px 15px; border-radius: 8px; margin: 30px 0; text-align: center; color: #a1a1aa; font-family: monospace; font-size: 0.85rem; letter-spacing: 1px; }
          .block { background: rgba(24, 24, 27, 0.8); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 12px; margin-bottom: 25px; overflow: hidden; box-shadow: 0 10px 30px -10px rgba(0,0,0,0.5); }
          .question { padding: 20px; border-left: 4px solid #22d3ee; }
          .question-label { font-size: 0.75rem; font-weight: 900; color: #22d3ee; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 10px; }
          .answer { padding: 20px; border-left: 4px solid #e879f9; background: rgba(232, 121, 249, 0.03); border-top: 1px solid rgba(255, 255, 255, 0.05); }
          .answer-label { font-size: 0.75rem; font-weight: 900; color: #e879f9; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
          .text-content { white-space: pre-wrap; font-size: 0.95rem; }
          .snapshot { max-width: 100%; border-radius: 8px; margin-bottom: 15px; border: 1px solid rgba(255,255,255,0.1); }
          .footer { text-align: center; margin-top: 50px; color: #52525b; font-size: 0.8rem; border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>ClueAI Session</h1>
            <div class="meta">
              <p><b>Name:</b> ${session.name}</p>
              <p><b>Date:</b> ${session.date || new Date().toLocaleDateString()} | <b>Time:</b> ${session.time}</p>
              ${session.interviewTitle ? `<p><b>Interview:</b> ${session.interviewTitle}</p>` : ''}
            </div>
          </div>
          <div class="transcript">
    `;

    // Parse transcript
    const lines = session.transcript.split('\n');
    let currentBlockType = ''; // 'question', 'answer'
    let currentBlockContent = '';
    let currentImage = '';
    let currentModelInfo = '';

    const closeBlock = () => {
      if (currentBlockType === 'question') {
        htmlContent += `<div class="block"><div class="question"><div class="question-label">Question context</div>`;
        if (currentImage) htmlContent += `<img src="${currentImage}" class="snapshot" />`;
        htmlContent += `<div class="text-content">${currentBlockContent.trim()}</div></div>`;
      } else if (currentBlockType === 'answer') {
        htmlContent += `<div class="answer"><div class="answer-label">AI Output</div>`;
        if (currentModelInfo) {
           htmlContent += `<div style="font-size: 0.65rem; color: #a1a1aa; margin-bottom: 8px; font-family: monospace; letter-spacing: 0.5px;">GENERATED BY: <span style="color: #e879f9; border: 1px solid rgba(232, 121, 249, 0.3); padding: 2px 6px; border-radius: 4px; background: rgba(232, 121, 249, 0.1); font-weight: bold;">${currentModelInfo}</span></div>`;
        }
        
        // Format markdown code blocks (```) to have a sleek black background in the export
        let formattedContent = currentBlockContent.trim();
        formattedContent = formattedContent.replace(/```[a-z]*\n([\s\S]*?)```/gi, '<pre style="background-color: #000000; padding: 15px; border-radius: 8px; border: 1px solid #27272a; overflow-x: auto; font-family: monospace; font-size: 0.85rem; color: #e2e8f0; margin-top: 10px; margin-bottom: 10px;">$1</pre>');
        formattedContent = formattedContent.replace(/```([\s\S]*?)```/g, '<pre style="background-color: #000000; padding: 15px; border-radius: 8px; border: 1px solid #27272a; overflow-x: auto; font-family: monospace; font-size: 0.85rem; color: #e2e8f0; margin-top: 10px; margin-bottom: 10px;">$1</pre>');
        // Format inline code backticks to also stand out slightly
        formattedContent = formattedContent.replace(/`([^`]+)`/g, '<code style="background-color: #000000; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.85rem; color: #38bdf8; border: 1px solid #27272a;">$1</code>');

        htmlContent += `<div class="text-content">${formattedContent}</div></div></div>`;
      }
      currentBlockContent = '';
      currentImage = '';
      currentModelInfo = '';
      currentBlockType = '';
    };

    for (let line of lines) {
      if (line.includes('[SESSION_START:')) {
        closeBlock();
        const time = line.match(/\[SESSION_START:(.*?)\]/)?.[1] || '';
        htmlContent += `<div class="session-marker">▶ SESSION STARTED AT ${time}</div>`;
      } else if (line.includes('[SESSION_END:')) {
        closeBlock();
        const match = line.match(/\[SESSION_END:(.*?)\|DURATION:(.*?)\]/);
        const time = match?.[1] || '';
        const dur = match?.[2] || '';
        htmlContent += `<div class="session-marker">■ SESSION ENDED AT ${time} (DURATION: ${dur})</div>`;
      } else if (line.includes('--- QUESTION ---')) {
        closeBlock();
        currentBlockType = 'question';
      } else if (line.includes('--- AI ANSWER ---')) {
        if (currentBlockType === 'question') {
           // We don't close block yet because answer goes in the same card
           htmlContent += `<div class="block"><div class="question"><div class="question-label">Question context</div>`;
           if (currentImage) htmlContent += `<img src="${currentImage}" class="snapshot" />`;
           htmlContent += `<div class="text-content">${currentBlockContent.trim()}</div></div>`;
           currentBlockContent = '';
           currentImage = '';
        }
        currentBlockType = 'answer';
      } else if (line.startsWith('[MODEL:')) {
        const match = line.match(/\[MODEL:(.*?)\]/);
        if (match) currentModelInfo = match[1];
      } else if (line.startsWith('[IMAGE_BASE64:')) {
        const match = line.match(/\[IMAGE_BASE64:(.*?)\]/);
        if (match) currentImage = match[1];
      } else {
        if (currentBlockType) {
          currentBlockContent += line + '\n';
        }
      }
    }
    closeBlock(); // Close any trailing blocks

    htmlContent += `
          </div>
          <div class="footer">
            Generated by Clue AI & Farhan Khalid &copy; ${new Date().getFullYear()} <br/>
            <div style="margin-top: 8px;">
              <a href="mailto:farhankhalid17968@gmail.com" style="color: #22d3ee; text-decoration: none;">Contact: farhankhalid17968@gmail.com</a> | 
              <a href="https://farhan-khalid-portfolio.vercel.app/" target="_blank" style="color: #22d3ee; text-decoration: none;">Portfolio Website</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };



  const resumeListening = () => {
    if (currentSnapshots.length > 0) {
      setSnapshotHistory(prev => {
        const newHistory = [...prev, { id: Date.now().toString(), image: currentSnapshots[currentSnapshots.length-1], transcriptContext: transcript }];
        if (newHistory.length > 4) return newHistory.slice(newHistory.length - 4);
        return newHistory;
      });
    }
    
    setTranscript('');
    finalizedTranscriptRef.current = '';
    interimTranscriptRef.current = '';
    audioDataRef.current = new Float32Array(0);
    
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
      finalizedTranscriptRef.current = '';
      interimTranscriptRef.current = '';
      audioDataRef.current = new Float32Array(0);
    }
  };

  const handleClearAll = () => {
    if (currentSnapshots.length > 0) {
      setSnapshotHistory(prev => {
        const newHistory = [...prev, { id: Date.now().toString(), image: currentSnapshots[currentSnapshots.length-1], transcriptContext: transcript }];
        return newHistory.length > 4 ? newHistory.slice(newHistory.length - 4) : newHistory;
      });
    }
    setTranscript(''); 
    finalizedTranscriptRef.current = '';
    interimTranscriptRef.current = '';
    audioDataRef.current = new Float32Array(0); 
    setCurrentSnapshots([]);
    setAiAnswer('');
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
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

      if (!isRecording) return;
      
      if (key === '7' || key === 'q') {
        e.preventDefault();
        setShowVirtualKeyboard(true);
      } else if (key === 'escape') {
        if (showVirtualKeyboard) {
          e.preventDefault();
          setShowVirtualKeyboard(false);
          if (globalHotkeysEnabled) ipcRenderer.invoke('toggle-global-hotkeys', true);
        }
      } else if (key === '0') {
        e.preventDefault();
      } else if (key === 'x' || key === '2') {
        e.preventDefault();
        if (!isGenerating) manualTriggerAI();
      } else if (key === 'z' || key === '1') {
        e.preventDefault();
        handlePauseToggle();
      } else if (key === 'c' || key === '3') {
        e.preventDefault();
        handleClearAll();
      } else if (key === 's' || key === '5') {
        e.preventDefault();
        const newProvider = provider === 'groq' ? 'gemini' : 'groq';
        setProvider(newProvider);
        switchProvider(newProvider);
        setModelChangeMsg(`Switched to ${newProvider === 'groq' ? 'Groq' : 'Gemini'}`);
        setTimeout(() => setModelChangeMsg(''), 3000);
      } else if (key === 'd' || key === '6') {
        e.preventDefault();
        stopRecording();
      } else if (key === 'a' || key === '4') {
        e.preventDefault();
        handleSnipClick();
      }
    };

    const handleIPCHotkey = (_event: any, action: string) => {
      if (action === 'toggle-color') {
        setAltColor(prev => !prev);
      } else if (action === 'toggle-pause') {
        handlePauseToggle();
      } else if (action === 'force-ai') {
        if (!isGenerating) manualTriggerAI();
      } else if (action === 'clear-all') {
        handleClearAll();
      } else if (action === 'show-size-warning') {
        setShowMinSizeWarning(true);
      } else if (action === 'snapshot') {
        handleSnipClick();
      } else if (action === 'switch-model') {
        const newProvider = provider === 'groq' ? 'gemini' : 'groq';
        setProvider(newProvider);
        switchProvider(newProvider);
        setModelChangeMsg(`Switched to ${newProvider === 'groq' ? 'Groq' : 'Gemini'}`);
        setTimeout(() => setModelChangeMsg(''), 3000);
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
  }, [isRecording, isPaused, isGenerating, manualTriggerAI, currentSnapshots, transcript, provider]);

  const closeApp = () => window.close();
  const minimizeApp = () => {
     ipcRenderer.invoke('minimize-window');
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

  return (
    <>
      {showSplash && (
        <div className="fixed inset-0 z-[9999] bg-[#09090b] flex flex-col items-center justify-center animate-out fade-out duration-500 delay-[1500ms] fill-mode-forwards rounded-3xl overflow-hidden border border-white/10">
           <div className="relative flex flex-col items-center animate-in zoom-in-95 fade-in duration-1000">
              <img src="./logo.png" alt="ClueAI Logo" className="w-24 h-24 object-cover rounded-3xl shadow-[0_0_50px_rgba(6,182,212,0.5)] mb-6 animate-pulse border border-white/10" />
              <h1 className="text-4xl font-black text-white tracking-tight mb-2">Clue<span className="text-cyan-400">AI</span></h1>
              <p className="text-brand-subtext text-[10px] font-bold tracking-[0.2em] uppercase">The Ultimate Interview Assistant</p>
              
              <div className="w-48 h-1 bg-white/10 rounded-full mt-12 overflow-hidden relative">
                 <div className="absolute inset-y-0 left-0 bg-cyan-400 w-1/2 rounded-full animate-ping" />
              </div>
           </div>
        </div>
      )}
      
      <div 
        className="flex flex-col h-screen text-brand-text p-4 font-sans overflow-y-auto overflow-x-hidden rounded-3xl select-none animate-in fade-in duration-1000 delay-[1500ms] fill-mode-both"
        style={{ backgroundColor: !isRecording ? '#09090b' : 'transparent', transition: 'none' }}
      >
      <datalist id="saved-emails">
        {localStorage.getItem('clueai_saved_email') && <option value={localStorage.getItem('clueai_saved_email')!} />}
      </datalist>
      <div 
        className="flex flex-col mb-4 pb-2 border-b border-indigo-500/20"
        onPointerDown={(e) => {
          const target = e.target as HTMLElement;
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
        {/* Header Container */}
      {isRecording ? (
        // --- INTERVIEW PAGE HEADER (2 ROWS) ---
        <div className="w-full flex-none bg-brand-bg/80 backdrop-blur-3xl px-4 py-3 border-b border-brand-border flex flex-col gap-3 shadow-[0_2px_20px_rgba(0,0,0,0.5)] relative z-30 drag-area rounded-t-2xl shrink-0">
          
          {/* ROW 1: Status Tags and Window Controls */}
          <div className="flex items-center justify-between w-full no-drag">
            <div className="flex items-center gap-2">
              {stealthMode ? (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider flex items-center gap-1 leading-none bg-green-500/10 text-green-400 border-green-500/30">
                  Stealth: ON
                </span>
              ) : (
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wider flex items-center gap-1 leading-none bg-red-600 text-white border-red-400 animate-[pulse_1s_ease-in-out_infinite] shadow-[0_0_10px_rgba(220,38,38,0.8)]">
                  <AlertTriangle size={10} /> STEALTH OFF: YOU CAN BE SEEN!
                </span>
              )}
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-white/5 text-white/70 border-white/10 uppercase tracking-wider leading-none">
                Opacity: {Math.round(opacity * 100)}%
              </span>
              <span className="text-[9px] font-bold px-2 py-1 rounded border bg-brand-accent/20 text-brand-accent border-brand-accent/30 uppercase tracking-wider leading-none">
                Press 7 or Q to edit Transcript
              </span>
              <span className="text-[9px] font-bold px-2 py-1 rounded border bg-white text-black border-white uppercase tracking-wider leading-none">
                Press 0 to change text color
              </span>
              <span className="text-[9px] font-bold px-2 py-1 rounded border bg-blue-500/20 text-blue-300 border-blue-500/30 uppercase tracking-wider leading-none flex items-center gap-1">
                <ArrowUp size={10} /><ArrowDown size={10} /> Alt + Arrows to Scroll
              </span>
            </div>
            
            {/* Minimize / Maximize / Close (Row 1) */}
            <div className="flex items-center gap-1">
              <button onClick={handleShrinkWindow} className="p-1.5 hover:bg-white/10 rounded-lg text-brand-subtext hover:text-white transition-colors" title="Shrink Window (Alt -)">
                <ZoomOut size={16} />
              </button>
              <button onClick={() => ipcRenderer.invoke('resize-window', 50, 50)} className="p-1.5 hover:bg-white/10 rounded-lg text-brand-subtext hover:text-white transition-colors" title="Enlarge Window (Alt +)">
                <ZoomIn size={16} />
              </button>
              <button onClick={() => ipcRenderer.send('toggle-fullscreen')} className="p-1.5 hover:bg-white/10 rounded-lg text-brand-subtext hover:text-white transition-colors">
                <Maximize size={16} />
              </button>
              <button onClick={minimizeApp} className="p-1.5 hover:bg-white/10 rounded-lg text-brand-subtext hover:text-white transition-colors">
                <Minus size={16} />
              </button>
              <button onClick={closeApp} className="p-1.5 hover:bg-rose-500/20 rounded-lg text-brand-subtext hover:text-rose-400 transition-colors">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* ROW 2: Logo and Primary Controls */}
          <div className="flex items-center justify-between w-full no-drag">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-white/5 rounded-md text-white/50 shadow-sm border border-white/5 flex items-center justify-center cursor-default shrink-0">
                <Move size={16} />
              </div>
              <div className="flex flex-col justify-center shrink-0">
                <h1 className="text-xl font-black tracking-tighter flex items-center gap-2 text-brand-accent leading-none">
                  <img src="./logo.png" alt="Logo" className="w-7 h-7 object-cover rounded-md shadow-sm border border-brand-accent/20" /> 
                  <span>ClueAI</span>
                  <span className="text-white font-mono font-bold text-sm ml-2 px-2 py-0.5 bg-white/10 rounded-md border border-white/20 shadow-inner leading-none">{formatTimer(recordingSeconds)}</span>
                </h1>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-3 mr-2 relative">
                <div className="flex flex-col items-center justify-center mr-2">
                  <button 
                    onClick={() => {
                      const newState = !globalHotkeysEnabled;
                      setGlobalHotkeysEnabled(newState);
                      ipcRenderer.invoke('toggle-global-hotkeys', newState);
                    }} 
                    className={`relative w-10 h-5 rounded-full transition-colors flex items-center px-0.5 ${globalHotkeysEnabled ? 'bg-green-500/80' : 'bg-rose-500/80'}`}
                    title="Toggle Global Hotkeys"
                  >
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${globalHotkeysEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                  <span className="text-[9px] font-black uppercase text-white/70 mt-1">Hotkeys</span>
                </div>
                <div className="relative group">
                  <div className="flex flex-col items-center group">
                    <CustomSelect 
                      value={provider} 
                      onChange={(val: 'groq' | 'gemini') => {
                        setProvider(val);
                        switchProvider(val);
                        setModelChangeMsg(`Switched to ${val === 'groq' ? 'Groq' : 'Gemini'}`);
                        setTimeout(() => setModelChangeMsg(''), 3000);
                      }} 
                      options={[
                        { value: 'groq', label: '⚡ Groq API' },
                        { value: 'gemini', label: '🧠 Gemini Flash' }
                      ]}
                      className="bg-brand-secondary/50 hover:bg-brand-secondary border border-brand-border/50 hover:border-brand-accent/30 rounded-full pl-8 pr-3 py-1.5 text-xs font-semibold text-white transition-all shadow-[0_0_10px_rgba(0,0,0,0.2)] min-w-[140px]"
                      icon={<Cpu size={13} className="text-brand-accent pointer-events-none" />}
                    />
                    <span className="text-[8px] font-medium text-white/50 mt-0.5 absolute -bottom-3.5 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">Press S or 5</span>
                  </div>
                  

                </div>
              </div>
              
              {isPaused ? (
                <button onClick={handlePauseToggle} title="Next Question (Press Z or 1)" className="flex items-center gap-1.5 bg-green-500 hover:bg-green-400 text-black px-3 py-1.5 rounded-lg font-black text-[10px] tracking-wide transition-all shadow-[0_0_10px_rgba(34,197,94,0.3)] shrink-0">
                  <Play size={12} fill="currentColor" /> NEXT Q. <span className="opacity-70 text-[8px] bg-black/20 px-1 rounded ml-0.5">1</span>
                </button>
              ) : (
                <button onClick={handlePauseToggle} title="Pause (Press Z or 1)" className="flex items-center gap-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-3 py-1.5 rounded-lg font-bold text-[10px] transition-all shrink-0">
                  <Pause size={12} fill="currentColor" /> PAUSE <span className="opacity-70 text-[8px] border border-yellow-500/30 px-1 rounded ml-0.5">1</span>
                </button>
              )}
              <button onClick={handleSnipClick} title="Snip UI (Press A or 4)" className="flex items-center gap-1.5 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/30 px-3 py-1.5 rounded-lg font-bold text-[10px] transition-all shrink-0">
                <Crop size={12} /> SNIP <span className="opacity-70 text-[8px] border border-cyan-500/30 px-1 rounded ml-0.5">4</span>
              </button>
              <button onClick={handleClearAll} title="Clear Transcript (Press C or 3)" className="flex items-center gap-1.5 bg-slate-500/10 hover:bg-slate-500/20 text-brand-subtext border border-slate-500/30 px-3 py-1.5 rounded-lg font-bold text-[10px] transition-all shrink-0">
                <Trash2 size={12} fill="currentColor" /> CLEAR <span className="opacity-70 text-[8px] border border-slate-500/30 px-1 rounded ml-0.5">3</span>
              </button>
              <button onClick={stopRecording} title="Stop Session (Press D or 6)" className="flex items-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 px-3 py-1.5 rounded-lg font-bold text-[10px] transition-all shrink-0">
                <Square size={12} fill="currentColor" /> STOP <span className="opacity-70 text-[8px] border border-rose-500/30 px-1 rounded ml-0.5">6</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        // --- MAIN DASHBOARD HEADER (1 ROW) ---
        <div className="w-full flex-none bg-brand-bg/80 backdrop-blur-3xl px-4 py-3 border-b border-brand-border flex items-center justify-between shadow-[0_2px_20px_rgba(0,0,0,0.5)] relative z-30 drag-area rounded-t-2xl shrink-0">
          <div className="flex items-center gap-3 no-drag">
            <div className="p-1.5 bg-white/5 rounded-md text-white/50 shadow-sm border border-white/5 flex items-center justify-center cursor-default shrink-0">
              <Move size={16} />
            </div>
            <div className="flex flex-col justify-center shrink-0">
              <h1 className="text-xl font-black tracking-tighter flex items-center gap-2 text-brand-accent leading-none">
                <img src="./logo.png" alt="Logo" className="w-7 h-7 object-cover rounded-md shadow-sm border border-brand-accent/20" /> 
                <span>ClueAI</span>
                {username && (
                  <span className="text-white text-lg font-bold ml-1 tracking-tight flex items-center gap-2 opacity-90 transition-opacity">
                    <span className="mx-2 text-white/30">|</span> {username}
                    <button 
                      onClick={() => { setTempUsername(username); setShowUsernamePrompt(true); }}
                      className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-md transition-colors shadow-sm ml-1"
                      title="Rename"
                    >
                      <Edit2 size={13} />
                    </button>
                  </span>
                )}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 no-drag">
            <button onClick={() => setShowInfo(!showInfo)} className={`p-1.5 mr-2 rounded-lg transition-all hover:scale-105 active:scale-95 ${showInfo ? 'bg-brand-accent text-white' : 'hover:bg-white/10 text-brand-subtext hover:text-white'}`}>
              <Info size={16} />
            </button>
            <button onClick={() => setShowSettings(!showSettings)} className={`p-1.5 mr-2 rounded-lg transition-all hover:scale-105 active:scale-95 ${showSettings ? 'bg-brand-accent text-white' : 'hover:bg-white/10 text-brand-subtext hover:text-white'}`}>
              <Settings size={16} />
            </button>
            <button onClick={handleStartCaptureClick} className="flex items-center gap-2 bg-brand-accentSec hover:bg-brand-accentSec text-white px-4 py-1.5 rounded-lg font-bold text-sm hover:scale-105 active:scale-95 transition-all duration-300 shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] border border-cyan-400/30">
              <Play size={14} fill="currentColor" /> Start Interview
            </button>
            {/* Minimize / Maximize / Close */}
            <div className="flex items-center gap-1 ml-4 pl-4 border-l border-brand-border shrink-0">
              <button onClick={handleShrinkWindow} className="p-1.5 hover:bg-white/10 rounded-lg text-brand-subtext hover:text-white transition-colors" title="Shrink Window (Alt -)">
                <ZoomOut size={16} />
              </button>
              <button onClick={() => ipcRenderer.invoke('resize-window', 50, 50)} className="p-1.5 hover:bg-white/10 rounded-lg text-brand-subtext hover:text-white transition-colors" title="Enlarge Window (Alt +)">
                <ZoomIn size={16} />
              </button>
              <button onClick={() => ipcRenderer.send('toggle-fullscreen')} className="p-1.5 hover:bg-white/10 rounded-lg text-brand-subtext hover:text-white transition-colors">
                <Maximize size={16} />
              </button>
              <button onClick={minimizeApp} className="p-1.5 hover:bg-white/10 rounded-lg text-brand-subtext hover:text-white transition-colors">
                <Minus size={16} />
              </button>
              <button onClick={closeApp} className="p-1.5 hover:bg-rose-500/20 rounded-lg text-brand-subtext hover:text-rose-400 transition-colors">
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Full-Screen Info Modal */}
      {!isRecording && showInfo && (
        <div className="absolute inset-2 z-40 bg-brand-bg/95 backdrop-blur-3xl rounded-2xl border border-brand-border/50 flex flex-col animate-in fade-in duration-200 overflow-hidden shadow-2xl">
          <div className="w-full flex-shrink-0 bg-brand-bg/95 pt-8 pb-4 px-8 border-b border-brand-border">
            <div className="max-w-3xl mx-auto flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
                  <div className="p-2 bg-brand-accent/20 rounded-xl">
                    <Info size={28} className="text-brand-accent" />
                  </div>
                  Information Guide
                </h2>
                <p className="text-brand-subtext text-sm mt-2">Everything you need to know to use ClueAI effectively.</p>
              </div>
              <button onClick={() => setShowInfo(false)} className="bg-brand-secondary hover:bg-brand-border hover:scale-105 active:scale-95 text-brand-text px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2">
                Close <X size={16}/>
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

              {/* Keyboard Shortcuts */}
              <div className="bg-gradient-to-br from-brand-secondary to-brand-card p-6 rounded-2xl border border-white/5 shadow-lg flex flex-col gap-4 group hover:border-white/10 transition-colors">
                <div className="flex items-center gap-3 border-b border-white/10 pb-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-green-500/20 text-green-400 flex items-center justify-center">
                    <Settings size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Keyboard Shortcuts</h3>
                    <p className="text-brand-subtext text-xs">Control ClueAI instantly without clicking.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* General Hotkeys */}
                  <div>
                    <h4 className="text-sm font-bold text-brand-accentSec uppercase tracking-wider mb-2">Interview Controls (Toggleable)</h4>
                    <p className="text-brand-subtext text-xs leading-relaxed mb-2">
                      <strong>When active, these block you from typing those specific keys elsewhere.</strong> Toggle them ON/OFF in the Interview Screen.
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-[10px]">
                      <div className="bg-black/30 p-2 rounded-lg border border-white/5"><strong>0 / Num0</strong>: Text color</div>
                      <div className="bg-black/30 p-2 rounded-lg border border-white/5"><strong>1, Z / Num1</strong>: Pause / Resume</div>
                      <div className="bg-black/30 p-2 rounded-lg border border-white/5"><strong>2, X / Num2</strong>: Ask AI</div>
                      <div className="bg-black/30 p-2 rounded-lg border border-white/5"><strong>3, C / Num3</strong>: Clear Transcript</div>
                      <div className="bg-black/30 p-2 rounded-lg border border-white/5"><strong>4, A / Num4</strong>: Snipping Tool</div>
                      <div className="bg-black/30 p-2 rounded-lg border border-white/5"><strong>5, S / Num5</strong>: Switch Model</div>
                      <div className="bg-black/30 p-2 rounded-lg border border-white/5"><strong>6, D / Num6</strong>: Stop Gen</div>
                      <div className="bg-black/30 p-2 rounded-lg border border-white/5"><strong>7, Q / Num7</strong>: Edit Text</div>
                    </div>
                  </div>

                  {/* Scrolling Shortcuts */}
                  <div>
                    <h4 className="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-2">Stealth Scrolling (Always Active)</h4>
                    <div className="bg-black/30 p-3 rounded-lg border border-white/5">
                      <p className="text-xs text-brand-subtext leading-relaxed">
                        Hold <kbd className="bg-black/40 border border-white/10 px-1 py-0.5 rounded font-mono text-white shadow-sm">Alt</kbd> + <kbd className="bg-black/40 border border-white/10 px-1 py-0.5 rounded font-mono text-white shadow-sm">↑/↓</kbd> or <kbd className="bg-black/40 border border-white/10 px-1 py-0.5 rounded font-mono text-white shadow-sm">PgUp/PgDn</kbd> to scroll the text boxes during an interview without using your mouse.
                      </p>
                    </div>
                  </div>

                  {/* Global Launch Shortcut */}
                  <div>
                    <h4 className="text-sm font-bold text-purple-400 uppercase tracking-wider mb-2">Global Launch (Always Active)</h4>
                    <div className="bg-black/30 p-3 rounded-lg border border-white/5">
                      <p className="text-xs text-brand-subtext leading-relaxed">
                        Press <kbd className="bg-black/40 border border-white/10 px-1 py-0.5 rounded font-mono text-white shadow-sm">Ctrl + Shift + K</kbd> anywhere on your computer to instantly hide/minimize or show ClueAI.
                      </p>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                  <div className="space-y-2">
                    <h4 className="text-white font-bold text-sm border-b border-white/10 pb-2">Getting Groq Keys (For Audio & Fast Text)</h4>
                    <ol className="text-brand-subtext text-xs leading-relaxed space-y-2 list-decimal pl-4">
                      <li>Go to <a href="https://console.groq.com/keys" target="_blank" className="text-blue-400 hover:underline">console.groq.com/keys</a> and log in.</li>
                      <li>Click on <strong>Create API Key</strong> in the top right.</li>
                      <li>Copy the key (it starts with `gsk_`).</li>
                      <li>Paste it into the Groq API Key field in ClueAI Settings.</li>
                      <li><em>Note: Groq is free but rate-limited. Add multiple keys to avoid interruptions!</em></li>
                    </ol>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-white font-bold text-sm border-b border-white/10 pb-2">Getting Gemini Keys (For Snapshots)</h4>
                    <ol className="text-brand-subtext text-xs leading-relaxed space-y-2 list-decimal pl-4">
                      <li>Go to <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-blue-400 hover:underline">aistudio.google.com/app/apikey</a> and log in.</li>
                      <li>Click <strong>Create API Key</strong> and select an existing project or create a new one.</li>
                      <li>Copy the generated key (it starts with `AIzaSy` or `AQ.`).</li>
                      <li>Paste it into the Gemini API Key field in ClueAI Settings.</li>
                      <li><em>Note: Gemini is extremely powerful for visual coding questions!</em></li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Full-Screen Settings Modal */}
      {showSettings && (
        <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-xl flex flex-col animate-in fade-in duration-200 overflow-hidden">
          <div className="w-full max-w-4xl mx-auto my-auto bg-black/80 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-2xl flex flex-col h-[90vh] overflow-hidden">
            <div className="px-8 py-6 border-b border-white/5 flex justify-between items-center bg-white/5">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2"><Info size={24} className="text-cyan-400" /> Info & Settings</h2>
                <p className="text-white/50 text-xs mt-1">Configure your shortcuts, AI models, and stealth mode.</p>
              </div>
              <div className="flex items-center gap-3">
                {deleteMsg && <span className="text-rose-400 font-bold text-xs bg-rose-500/10 px-3 py-1.5 rounded border border-rose-500/20">{deleteMsg}</span>}
                <button onClick={() => setShowSettings(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-colors shadow-sm">
                  <X size={18}/>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-black/[0.02]">
              <div className="max-w-3xl w-full mx-auto space-y-8 pb-10 select-none cursor-default">
              

            <section>
              <h3 className="text-sm font-bold text-brand-accentSec uppercase tracking-wider mb-4 flex items-center gap-2"><Settings size={16}/> Provider & Display</h3>
              <div className="grid grid-cols-2 gap-6 bg-brand-card p-5 rounded-2xl border border-brand-border">
                <div>
                  <label className="block text-xs font-bold text-brand-subtext uppercase mb-1.5">Default AI Provider</label>
                  <CustomSelect 
                    value={provider} 
                    onChange={(val: any) => setProvider(val)} 
                    options={[
                      { value: 'groq', label: 'Groq (Llama 3 - Default)' },
                      { value: 'gemini', label: 'Google Gemini (1.5 Flash)' }
                    ]}
                    className="w-full bg-brand-secondary border border-brand-border rounded-lg px-3 py-2 text-sm text-white transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-brand-subtext uppercase mb-1.5">Capture Screen</label>
                  <CustomSelect 
                    value={selectedSource} 
                    onChange={(val: any) => setSelectedSource(val)} 
                    options={sources.map(s => ({ value: s.id, label: s.name }))}
                    className="w-full bg-brand-secondary border border-brand-border rounded-lg px-3 py-2 text-sm text-white transition-all"
                  />
                </div>
                <div>
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
                  <Layout size={16}/> Interview Layout & Content
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

                  {/* AI Answer Size */}
                  <div className="bg-gradient-to-br from-brand-secondary to-brand-card p-5 rounded-2xl border border-white/5 shadow-lg flex flex-col group hover:border-white/10 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-fuchsia-500/20 text-fuchsia-400 flex items-center justify-center mb-3">
                      <Cpu size={16} />
                    </div>
                    <label className="block text-xs font-bold text-white uppercase mb-2">AI Answer Font Size</label>
                    <div className="flex items-center gap-2 mt-auto">
                      <input 
                        type="range" 
                        min="10" 
                        max="40"
                        value={aiAnswerTextSize}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 15;
                          setAiAnswerTextSize(val);
                          localStorage.setItem('clueai_answer_size', val.toString());
                        }}
                        className="flex-1 accent-brand-accent h-1.5 bg-brand-bg rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="text-sm font-mono font-bold text-fuchsia-400 bg-brand-bg px-2 py-1 rounded-md border border-brand-border">{aiAnswerTextSize}px</span>
                    </div>
                  </div>
                </div>
            </section>

            {/* API Keys Configuration */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-brand-accent uppercase tracking-wider flex items-center gap-2"><Cpu size={16}/> API Keys</h3>
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-end gap-1">
                    {saveMessages.map((msg, i) => (
                      <span key={i} className={`text-xs font-bold animate-in fade-in ${
                        msg.type === 'invalid' ? 'text-rose-500' :
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
                      <p className="text-xs text-brand-subtext mt-1">{groqKeys.filter(k=>k.trim()).length} keys loaded (Used for STT & LLM)</p>
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
                              className="w-full bg-brand-secondary border border-brand-border rounded-lg pl-3 pr-16 py-2 text-sm outline-none focus:border-brand-accent text-white transition-all" 
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
                      <p className="text-xs text-brand-subtext mt-1">{geminiKeys.filter(k=>k.trim()).length} keys loaded (Used for LLM)</p>
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
                              className="w-full bg-brand-secondary border border-brand-border rounded-lg pl-3 pr-16 py-2 text-sm outline-none focus:border-brand-accent text-white transition-all" 
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
              </div>
            </section>

            {/* Interview Context */}
            <section>
              <h3 className="text-sm font-bold text-brand-accent uppercase tracking-wider mb-4 flex items-center gap-2"><FileText size={16}/> Interview Context</h3>
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
                  <div className="bg-brand-bg/30 p-4 rounded-xl border border-white/5 group hover:border-brand-accent/30 transition-all duration-300">
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
                  <div className="bg-brand-bg/30 p-4 rounded-xl border border-white/5 group hover:border-brand-accent/30 transition-all duration-300">
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
                  <div className="md:col-span-2 bg-brand-bg/30 p-4 rounded-xl border border-white/5 group hover:border-brand-accent/30 transition-all duration-300">
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
              <h3 className="text-sm font-bold text-brand-subtext uppercase tracking-wider mb-4 flex items-center gap-2"><Mic size={16}/> System Sound Settings</h3>
              <div className="bg-brand-card p-5 rounded-2xl border border-brand-border space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-brand-border">
                  <div>
                    <h4 className="text-sm font-bold text-white mb-1">Active Microphone</h4>
                    <p className="text-xs text-brand-accentSec font-mono truncate max-w-[250px]">{activeMicName}</p>
                  </div>
                  <button 
                    onClick={() => shell.openExternal('ms-settings:sound')}
                    className="px-4 py-2 bg-brand-secondary hover:bg-white/10 border border-brand-border text-brand-text rounded-lg text-xs font-bold transition-colors"
                  >
                    Change in Windows Settings
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white mb-1">Microphone Volume</h4>
                    <p className="text-xs text-brand-subtext">Automatically synced with Windows system settings</p>
                  </div>
                  <div className="flex items-center gap-3 w-1/2">
                    <span className="text-xs font-mono text-brand-subtext w-8 text-right">{sysMicVolume}%</span>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={sysMicVolume} 
                      onChange={handleMicVolumeChange} 
                      className="w-full accent-brand-accent" 
                      disabled={sysMicMuted}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-brand-border">
                  <div>
                    <h4 className="text-sm font-bold text-white mb-1">Microphone Mute</h4>
                    <p className="text-xs text-brand-subtext">Toggle microphone on or off at the system level</p>
                  </div>
                  <button 
                    onClick={handleMicMuteToggle}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${sysMicMuted ? 'bg-rose-500/20 text-rose-500 border border-rose-500/50' : 'bg-brand-secondary border border-brand-border text-white hover:bg-white/10'}`}
                  >
                    {sysMicMuted ? 'Unmute' : 'Mute'}
                  </button>
                </div>
              </div>
            </section>

            {/* Display */}
            <section>
              <h3 className="text-sm font-bold text-brand-subtext uppercase tracking-wider mb-4 flex items-center gap-2"><LayoutPanelTop size={16}/> Display Settings</h3>
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

            {/* Keyboard Shortcuts */}
            <section className="pb-10">
              <h3 className="text-sm font-bold text-brand-subtext uppercase tracking-wider mb-4 flex items-center gap-2"><Cpu size={16}/> All Shortcut Keys</h3>
              <div className="bg-brand-card p-5 rounded-2xl border border-brand-border space-y-3">
                
                {/* Interview Controls */}
                <div className="space-y-2 mb-6">
                  <h4 className="text-xs font-black text-brand-subtext uppercase tracking-wider mb-3">Interview Controls</h4>
                  <div className="flex justify-between items-center bg-brand-secondary/30 p-3 rounded-xl border border-brand-border/40">
                    <span className="text-sm text-white/90 font-medium flex items-center gap-2">Pause / Resume <span className="text-xs text-white/40 font-normal">(Use 1 or Z)</span></span>
                    <div className="flex gap-2">
                      <span className="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-lg text-xs font-bold border border-yellow-500/30">Z</span>
                      <span className="bg-white/10 text-white/70 px-3 py-1 rounded-lg text-xs font-bold border border-white/20">1</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center bg-brand-secondary/30 p-3 rounded-xl border border-brand-border/40">
                    <span className="text-sm text-white/90 font-medium flex items-center gap-2">Ask AI (Trigger) <span className="text-xs text-white/40 font-normal">(Use 2 or X)</span></span>
                    <div className="flex gap-2">
                      <span className="bg-purple-500/20 text-purple-400 px-3 py-1 rounded-lg text-xs font-bold border border-purple-500/30">X</span>
                      <span className="bg-white/10 text-white/70 px-3 py-1 rounded-lg text-xs font-bold border border-white/20">2</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center bg-brand-secondary/30 p-3 rounded-xl border border-brand-border/40">
                    <span className="text-sm text-white/90 font-medium flex items-center gap-2">Clear Transcript <span className="text-xs text-white/40 font-normal">(Use 3 or C)</span></span>
                    <div className="flex gap-2">
                      <span className="bg-orange-500/20 text-orange-400 px-3 py-1 rounded-lg text-xs font-bold border border-orange-500/30">C</span>
                      <span className="bg-white/10 text-white/70 px-3 py-1 rounded-lg text-xs font-bold border border-white/20">3</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center bg-brand-secondary/30 p-3 rounded-xl border border-brand-border/40">
                    <span className="text-sm text-white/90 font-medium flex items-center gap-2">Snipping Tool <span className="text-xs text-white/40 font-normal">(Use 4 or A)</span></span>
                    <div className="flex gap-2">
                      <span className="bg-cyan-500/20 text-cyan-400 px-3 py-1 rounded-lg text-xs font-bold border border-cyan-500/30">A</span>
                      <span className="bg-white/10 text-white/70 px-3 py-1 rounded-lg text-xs font-bold border border-white/20">4</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center bg-brand-secondary/30 p-3 rounded-xl border border-brand-border/40">
                      <span className="text-sm text-white/90 font-medium flex items-center gap-2">Edit Transcript <span className="text-xs text-white/40 font-normal">(Use 7 or Q)</span></span>
                      <div className="flex gap-2">
                        <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-lg text-xs font-bold border border-emerald-500/30">Q</span>
                        <span className="bg-white/10 text-white/70 px-3 py-1 rounded-lg text-xs font-bold border border-white/20">7</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center bg-brand-secondary/30 p-3 rounded-xl border border-brand-border/40">
                      <span className="text-sm text-white/90 font-medium flex items-center gap-2">Toggle Text Color <span className="text-xs text-white/40 font-normal">(Use 0)</span></span>
                      <div className="flex gap-2">
                        <span className="bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-lg text-xs font-bold border border-indigo-500/30">0</span>
                      </div>
                    </div>
                  <div className="flex justify-between items-center bg-brand-secondary/30 p-3 rounded-xl border border-brand-border/40">
                    <span className="text-sm text-white/90 font-medium flex items-center gap-2">Switch Model <span className="text-xs text-white/40 font-normal">(Use 5 or S)</span></span>
                    <div className="flex gap-2">
                      <span className="bg-brand-accent/20 text-brand-accent px-3 py-1 rounded-lg text-xs font-bold border border-brand-accent/30">S</span>
                      <span className="bg-white/10 text-white/70 px-3 py-1 rounded-lg text-xs font-bold border border-white/20">5</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center bg-brand-secondary/30 p-3 rounded-xl border border-brand-border/40">
                    <span className="text-sm text-white/90 font-medium flex items-center gap-2">Stop Generation <span className="text-xs text-white/40 font-normal">(Use 6 or D)</span></span>
                    <div className="flex gap-2">
                      <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-lg text-xs font-bold border border-red-500/30">D</span>
                      <span className="bg-white/10 text-white/70 px-3 py-1 rounded-lg text-xs font-bold border border-white/20">6</span>
                    </div>
                  </div>
                </div>

                {/* Window Controls */}
                <div className="space-y-2 mb-6">
                  <h4 className="text-xs font-black text-brand-subtext uppercase tracking-wider mb-3 mt-6">Window Controls</h4>
                  <div className="flex justify-between items-center bg-black/20 p-4 rounded-xl border border-white/5 hover:bg-black/30 transition-colors">
                    <span className="text-sm text-white/90 font-medium flex items-center gap-2">Increase Size <span className="text-xs text-white/40 font-normal">(Hold Alt)</span></span>
                    <span className="bg-white/10 text-white px-3 py-1 rounded-lg text-xs font-bold border border-white/20">Alt + +</span>
                  </div>
                  <div className="flex justify-between items-center bg-black/20 p-4 rounded-xl border border-white/5 hover:bg-black/30 transition-colors">
                    <span className="text-sm text-white/90 font-medium flex items-center gap-2">Decrease Size <span className="text-xs text-white/40 font-normal">(Hold Alt)</span></span>
                    <span className="bg-white/10 text-white px-3 py-1 rounded-lg text-xs font-bold border border-white/20">Alt + -</span>
                  </div>
                  <div className="flex justify-between items-center bg-brand-secondary/30 p-3 rounded-xl border border-brand-border/40">
                    <span className="text-sm text-white/90 font-medium">Move Window</span>
                    <div className="flex gap-2">
                      <span className="bg-white/10 text-white px-3 py-1 rounded-lg text-xs font-bold border border-white/20">↑</span>
                      <span className="bg-white/10 text-white px-3 py-1 rounded-lg text-xs font-bold border border-white/20">↓</span>
                      <span className="bg-white/10 text-white px-3 py-1 rounded-lg text-xs font-bold border border-white/20">←</span>
                      <span className="bg-white/10 text-white px-3 py-1 rounded-lg text-xs font-bold border border-white/20">→</span>
                    </div>
                  </div>
                </div>

                {/* Global Launch Shortcut */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mt-6">
                  <h4 className="text-sm font-bold text-blue-400 mb-2 flex items-center gap-2">
                    <Cpu size={16} /> Global Launch Shortcut
                  </h4>
                  <p className="text-xs text-blue-200/70 leading-relaxed mb-3">
                    You can open ClueAI instantly from anywhere using a custom Windows Shortcut Key!
                  </p>
                  <ol className="text-xs text-blue-200/60 list-decimal pl-4 space-y-1.5">
                    <li>Search for <strong>ClueAI</strong> in your Windows Start Menu.</li>
                    <li>Right-click the app and select <strong>Open file location</strong>.</li>
                    <li>Right-click the ClueAI Shortcut file and select <strong>Properties</strong>.</li>
                    <li>In the <strong>Shortcut</strong> tab, click inside the <strong>Shortcut key</strong> box.</li>
                    <li>Press your desired keys (e.g. <code>Ctrl + Alt + L</code>) and click OK.</li>
                  </ol>
                </div>
              </div>
            </section>
            </div>
            </div>
          </div>
        </div>
      )}

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
                <br/><br/>
                The AI will not be able to hear you properly during the interview. Please adjust your system settings.
              </p>
              <button 
                onClick={() => {
                  setShowAudioErrorModal(false);
                  shell.openExternal('ms-settings:sound');
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

      {/* Dashboard Empty State */}
      {!isRecording && !showSettings && !showInfo && (
        <div className="flex-1 flex flex-col gap-6 overflow-hidden mt-2 px-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-6 relative overflow-hidden shadow-lg border border-blue-500/30 flex flex-col items-center justify-center text-center cursor-default h-full">
              <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Made by Farhan Khalid</h2>
              <p className="text-blue-100/80 text-sm mb-6 leading-relaxed font-medium">Developer & Engineer<br/><br/>Development driven by real users<br/>Faster iteration on features that matter</p>
              <button onClick={() => { ipcRenderer.invoke('minimize-window'); shell.openExternal('https://farhan-khalid-portfolio.vercel.app/'); }} className="bg-[#FDE047] text-yellow-900 px-6 py-2.5 rounded-full font-bold text-sm shadow-md flex items-center gap-2 hover:bg-yellow-300 hover:scale-105 active:scale-95 transition-all duration-300">✨ View Portfolio &rarr;</button>
            </div>
            
            <div className="relative h-full w-full">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl p-4 overflow-hidden shadow-lg border border-blue-400/30 flex flex-col cursor-default">
                <div className="flex flex-col mb-3 w-full shrink-0">
                <h3 className="font-bold text-white tracking-tight flex items-center justify-center gap-2 text-xl w-full mb-3">
                  <div className="w-6 h-6 rounded bg-white/20 text-white flex items-center justify-center">
                    <CheckCircle2 size={12} />
                  </div>
                  Interview and Notes Reminder
                </h3>
                <div className="flex justify-center items-center gap-4 w-full px-2">
                  <button 
                    onClick={() => {
                      setReminderForm({id: '', name: '', jobTitle: '', email: '', phone: '', date: '', time: '', ampm: 'AM'});
                      setShowReminderPopup(true);
                    }} 
                    className="bg-white/20 text-white hover:bg-white px-3 py-1.5 rounded-lg font-bold hover:text-blue-600 transition-all flex items-center gap-1.5 text-xs shadow-sm"
                  >
                    <Plus size={14}/> Create Reminder
                  </button>
                  <button 
                    onClick={() => {
                      setNotesForm({id: '', notes: '', email: '', date: '', time: '', ampm: 'AM'});
                      setShowNotesPopup(true);
                    }} 
                    className="bg-teal-500/80 text-white hover:bg-teal-400 px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 text-xs shadow-sm"
                  >
                    <Plus size={14}/> New Note
                  </button>
                </div>
              </div>

              <div className="w-full space-y-2 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                {(() => {
                  const combined = [
                    ...reminderProfiles.map(p => ({ ...p, type: 'reminder' as const })),
                    ...notesProfiles.map(p => ({ ...p, type: 'note' as const }))
                  ].sort((a, b) => Number(b.id) - Number(a.id));
                  
                  if (combined.length === 0) {
                    return <p className="text-blue-100/50 text-xs italic py-2 text-center h-full flex items-center justify-center">No reminders or notes saved yet.</p>;
                  }
                  
                  return combined.map(prof => {
                    // Check status
                    let isPast = false;
                    try {
                      const [d, m, y] = prof.date.split('-');
                      const [h, min] = prof.time.split(':');
                      let hours = parseInt(h);
                      if (prof.ampm === 'PM' && hours < 12) hours += 12;
                      if (prof.ampm === 'AM' && hours === 12) hours = 0;
                      const targetDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d), hours, parseInt(min));
                      isPast = new Date() > targetDate;
                    } catch(e) {}

                    if (prof.type === 'reminder') {
                      return (
                        <div 
                          key={prof.id} 
                          className="bg-blue-900/40 hover:bg-blue-900/60 rounded-xl p-2.5 backdrop-blur-md flex justify-between items-center w-full border border-blue-400/20 group cursor-pointer transition-colors text-left shrink-0"
                          onClick={() => {
                            setReminderForm(prof as any);
                            setShowReminderPopup(true);
                          }}
                        >
                          <div className="flex flex-col flex-1 min-w-0 pr-3">
                            <span className="font-bold text-xs text-white truncate flex items-center gap-2">
                                {prof.name}
                                {isPast ? <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30 text-[9px] uppercase tracking-wider">Sent Successfully</span> : <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[9px] uppercase tracking-wider animate-pulse">In Process</span>}
                            </span>
                            <span className="text-[10px] text-blue-200 font-bold truncate">Reminder <span className="opacity-70 font-normal">• {prof.jobTitle}</span></span>
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-blue-300 font-medium bg-blue-500/20 px-1.5 py-0.5 rounded">{prof.date}</span>
                              <button 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  setReminderProfiles(prev => prev.filter(r => r.id !== prof.id));
                                }} 
                                className="text-blue-300 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X size={14}/>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div 
                          key={prof.id} 
                          className="bg-teal-900/40 hover:bg-teal-900/60 rounded-xl p-2.5 backdrop-blur-md flex justify-between items-center w-full border border-teal-400/20 group cursor-pointer transition-colors text-left shrink-0"
                          onClick={() => {
                            setNotesForm(prof as any);
                            setShowNotesPopup(true);
                          }}
                        >
                          <div className="flex flex-col flex-1 min-w-0 pr-1">
                            <span className="font-bold text-xs text-white truncate flex items-center gap-2">
                                Note
                                {isPast ? <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30 text-[9px] uppercase tracking-wider">Sent Successfully</span> : <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[9px] uppercase tracking-wider animate-pulse">In Process</span>}
                            </span>
                            <span className="text-[10px] text-teal-200 font-bold truncate">Note <span className="opacity-70 font-normal">• {prof.email}</span></span>
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-teal-300 font-medium bg-teal-500/20 px-1.5 py-0.5 rounded">{prof.time} {prof.ampm}</span>
                              <button 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  setNotesProfiles(prev => prev.filter(r => r.id !== prof.id));
                                }} 
                                className="text-teal-300 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity p-0.5 flex-shrink-0"
                              >
                                <X size={14}/>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }
                  });
                })()}
              </div>
            </div>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto mt-4 pb-4">
            <h3 className="text-brand-subtext font-bold mb-3 text-sm px-2">Yesterday</h3>
            <div className="space-y-1">
              {sessions.length === 0 ? (
                <div className="text-brand-subtext text-sm italic px-2 py-4">No sessions saved yet. Start capturing to see history here!</div>
              ) : sessions.map((session) => (
                <div key={session.id} className="flex justify-between items-center py-2.5 px-4 hover:bg-brand-secondary/50 rounded-xl transition-colors border border-transparent hover:border-brand-border group relative">
                  {editingSessionId === session.id ? (
                    <input 
                      type="text" 
                      value={editingSessionName}
                      onChange={(e) => setEditingSessionName(e.target.value)}
                      onBlur={() => handleRenameSession(session.id)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRenameSession(session.id)}
                      autoFocus
                      className="bg-[#090909] text-white px-2 py-1 rounded-md text-sm border border-brand-accent outline-none flex-1 mr-4"
                    />
                  ) : (
                    <span className="text-brand-text font-medium text-sm truncate mr-4">{session.name}</span>
                  )}
                  <div className="flex items-center gap-6 text-brand-subtext text-xs font-mono shrink-0">
                    <span>{session.time}</span>
                    <button onClick={() => setOpenMenuId(openMenuId === session.id ? null : session.id)} className="p-1 hover:bg-white/10 rounded-md transition-colors">
                      <MoreVertical size={16} />
                    </button>
                  </div>
                  
                  {openMenuId === session.id && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)}></div>
                      <div className="absolute right-4 top-10 bg-brand-secondary border border-brand-border rounded-lg shadow-xl z-50 overflow-hidden min-w-[120px]">
                        <button onClick={() => { setEditingSessionId(session.id); setEditingSessionName(session.name); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 text-sm text-brand-text hover:bg-brand-accentSec flex items-center gap-2 transition-colors">
                          <FileText size={14} /> Rename
                        </button>
                        <button onClick={() => { exportSession(session); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 text-sm text-brand-text hover:bg-brand-accentSec flex items-center gap-2 transition-colors border-t border-brand-border">
                          <Download size={14} /> Export
                        </button>
                        <button onClick={() => { deleteSession(session.id); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 text-sm text-rose-400 hover:bg-rose-500 hover:text-white flex items-center gap-2 transition-colors border-t border-brand-border">
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main UI */}
        {isRecording && (
          <div className="flex-1 flex flex-col gap-6 min-h-0 relative">
            {/* 1. Top Toolbar (The "Floating Pill") */}
            <div className="flex items-center justify-between bg-[#09090b]/90 backdrop-blur-md rounded-[2rem] px-4 py-2.5 border border-white/10 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] shrink-0 w-full mx-auto relative z-20">
               {/* Left: Mic / Pause */}
               <button onClick={handlePauseToggle} className="flex items-center justify-center w-11 h-11 rounded-full bg-white/5 hover:bg-white/10 transition-colors shadow-inner">
                  <Mic size={20} className={!isPaused ? "animate-pulse text-cyan-400 drop-shadow-md" : "text-white/50"} />
               </button>

               {/* Center: Fake Search Bar / Status */}
               <div className="flex-1 mx-6 relative group max-w-2xl">
                  <div className="w-full rounded-full py-3 px-6 text-[13px] text-white/50 font-semibold flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors shadow-inner overflow-hidden" style={{ backgroundColor: `rgba(24, 24, 27, ${Math.max(0, opacity)})`, borderColor: `rgba(255, 255, 255, ${0.1 * opacity})`, borderWidth: '1px' }}>
                     <span className={`tracking-wide truncate block max-w-[85%] ${altColor ? 'text-black/40' : 'text-white'}`}>
                       {!isRecording 
                         ? "Ask me anything..." 
                         : (transcript 
                             ? transcript 
                             : (isGenerating ? "Drafting response..." : (isPaused ? "Paused..." : "Listening to conversation...")))}
                     </span>
                     <div className="flex items-center gap-3 shrink-0">
                         {currentSessionHistory.length > 0 && (
                            <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full text-[10px] font-bold text-white shadow-sm tracking-widest">
                               {currentSessionHistory.length} <MessageSquare size={12} />
                            </span>
                         )}
                     </div>
                  </div>
               </div>

               {/* Right: Icons */}
               <div className="flex items-center gap-2">
                  <button onClick={() => setShowPreviousQuestions(true)} className="w-11 h-11 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 transition-all hover:scale-110 active:scale-95 text-white shadow-sm">
                     <Clock size={20} />
                  </button>
                  <button onClick={() => setShowSettings(true)} className="w-11 h-11 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 transition-all hover:scale-110 active:scale-95 text-white shadow-sm">
                     <Settings size={20} />
                  </button>
               </div>
            </div>

            {/* 2. Main Conversation Window */}
            <div 
              className="flex-1 flex flex-col min-h-0 rounded-[2.5rem] overflow-hidden w-full mx-auto relative z-10"
              style={{ 
                backgroundColor: altColor ? `rgba(128, 128, 128, ${0.2 * opacity})` : `rgba(24, 24, 27, ${0.6 * opacity})`,
                backdropFilter: opacity < 0.05 ? "none" : `blur(${opacity * 30}px)`,
                borderColor: altColor ? `rgba(128, 128, 128, ${0.2 * opacity})` : `rgba(255, 255, 255, ${0.1 * opacity})`,
                borderWidth: "1px",
                boxShadow: opacity > 0.1 ? "0 25px 50px -12px rgba(0, 0, 0, 0.5)" : "none"
              }}
            >
               {/* Header */}
               <div className="px-8 py-5 flex justify-between items-center border-b backdrop-blur-md" style={{ backgroundColor: `rgba(0, 0, 0, ${0.4 * opacity})`, borderColor: `rgba(255, 255, 255, ${0.1 * opacity})` }}>
                  <div className="flex items-center gap-3">
                     <h2 className="text-xl font-black text-white tracking-tight drop-shadow-sm">AI Answer</h2>
                     <div className="bg-fuchsia-500/20 backdrop-blur-md px-3 py-1 rounded-md border border-fuchsia-500/30 text-[10px] font-black uppercase tracking-[0.1em] text-fuchsia-300 shadow-sm flex items-center gap-1.5">
                        <Cpu size={12} /> {activeAIInfo ? `${activeAIInfo.provider} (Key ${activeAIInfo.index})` : "AI Answer"}
                     </div>
                     {aiAnswer && <CopyButton text={aiAnswer} className="bg-white/10 hover:bg-white/20 hover:scale-105 backdrop-blur-md px-2 py-1 rounded-md border border-white/10 text-white/60 hover:text-white shadow-sm transition-all" tooltip="Copy Answer" size={12} />}
                     {modelChangeMsg && (
                        <span className="text-emerald-400 text-xs font-bold animate-in fade-in slide-in-from-right-2 duration-300 flex items-center gap-1 bg-emerald-400/10 px-2 py-1 rounded-md border border-emerald-400/20">
                           <CheckCircle2 size={12} /> {modelChangeMsg}
                        </span>
                     )}
                  </div>
                  <div className="flex items-center gap-4">
                     <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1 border border-white/5 shrink-0 shadow-inner">
                        <button onClick={() => {
                          const next = Math.max(10, transcriptTextSize - 1);
                          setTranscriptTextSize(next);
                          setAiAnswerTextSize(next);
                        }} className="px-2 py-1.5 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-colors font-black text-xs" title="Decrease Text Size">A-</button>
                        <span className="text-[11px] text-white/50 font-mono w-4 text-center select-none font-black">{transcriptTextSize}</span>
                        <button onClick={() => {
                          const next = Math.min(40, transcriptTextSize + 1);
                          setTranscriptTextSize(next);
                          setAiAnswerTextSize(next);
                        }} className="px-2 py-1.5 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-colors font-black text-xs" title="Increase Text Size">A+</button>
                     </div>
                     <button onClick={() => { if (!isGenerating) manualTriggerAI(); }} className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white text-[13px] font-bold rounded-[1rem] flex items-center gap-2 transition-all active:scale-95 shadow-[0_0_15px_rgba(6,182,212,0.3)] tracking-wide border border-cyan-400/50">
                        {isGenerating ? <Loader2 size={16} className="animate-spin" /> : "Generate Answer (2)"} <ChevronUp size={16} className="opacity-80" />
                     </button>
                  </div>
               </div>

               <div className="flex-1 flex flex-col min-h-0">
                 {/* Generate Area (Bottom) */}
                 <div className="flex-1 overflow-y-auto custom-scrollbar px-8 pb-8 pt-0 relative" style={{ backgroundColor: altColor ? `rgba(107, 114, 128, ${0.1 * opacity})` : `rgba(0, 0, 0, ${0.1 * opacity})` }} ref={aiAnswerScrollRef}>

                    <div>
                      {/* Snapshots inserted inline if any */}
                      {currentSnapshots.length > 0 && (
                        <div className="flex-none min-h-[120px] max-h-[160px] flex gap-4 overflow-x-auto custom-scrollbar relative items-center pb-4 mb-6">
                          {currentSnapshots.map((snap, idx) => (
                            <div key={idx} className="relative h-[120px] aspect-video rounded-xl overflow-hidden shadow-lg border border-cyan-500/30 bg-black/80 group shrink-0">
                              <img src={snap} alt="Snapshot" className="w-full h-full object-contain" />
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                <button onClick={() => setPreviewSnapshot(snap)} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg backdrop-blur-md transition-colors shadow-lg flex items-center gap-2 font-bold text-xs">
                                  <Eye size={14} /> Preview
                                </button>
                                <button onClick={() => setCurrentSnapshots(prev => prev.filter((_, i) => i !== idx))} className="px-4 py-2 bg-rose-500/80 hover:bg-rose-500 text-white rounded-lg backdrop-blur-md transition-colors shadow-lg flex items-center gap-2 font-bold text-xs">
                                  <Trash2 size={14} /> Remove
                                </button>
                              </div>
                            </div>
                          ))}
                          {currentSnapshots.length > 1 && (
                            <button onClick={() => setCurrentSnapshots([])} className="h-[120px] aspect-square rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-500 transition-colors flex flex-col items-center justify-center gap-2 shrink-0">
                              <Trash2 size={24} />
                              <span className="text-xs font-bold uppercase tracking-wider">Clear</span>
                            </button>
                          )}
                        </div>
                      )}
                      {aiAnswer ? (
                         <div 
                           className={`leading-relaxed whitespace-pre-wrap font-semibold drop-shadow-sm px-2 ${altColor ? 'text-black/40' : 'text-white'}`}
                           style={{ fontSize: aiAnswerTextSize + "px" }}
                         >
                           <ReactMarkdown
                             components={{
                               code(props: any) {
                                 const {node, className, children, ...rest} = props;
                                 const match = /language-(w+)/.exec(className || "");
                                 return match ? (
                                   <div className="w-full flex justify-center my-6">
                                     <div className="relative group/code max-w-3xl w-full">
                                       <CopyButton 
                                         text={String(children).replace(/\n$/, "")}
                                         className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg opacity-0 group-hover/code:opacity-100 transition-opacity z-10"
                                         tooltip="Copy code"
                                       />
                                       <SyntaxHighlighter
                                         {...rest}
                                         children={String(children).replace(/\n$/, "")}
                                         style={vscDarkPlus}
                                         language={match[1]}
                                         PreTag="div"
                                         className={`rounded-2xl border !m-0 !p-6 !shadow-xl text-[14px]`}
                                         customStyle={{ backgroundColor: `rgba(0,0,0,${opacity})`, borderColor: `rgba(255, 255, 255, ${0.1 * opacity})` }}
                                       />
                                     </div>
                                   </div>
                                 ) : (
                                   <code {...rest} className={`${className || ''} bg-white/10 text-fuchsia-300 font-bold rounded-lg px-2 py-1 text-[15px]`}>
                                     {children}
                                   </code>
                                 );
                               }
                             }}
                           >
                             {aiAnswer}
                           </ReactMarkdown>
                         </div>
                      ) : (
                        isGenerating ? (
                          <div className="flex flex-col items-center justify-center text-white/50 text-xs font-bold tracking-wide mt-10 p-12 border-2 border-white/5 border-dashed rounded-[2rem] bg-white/[0.02]">
                            <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-cyan-400 animate-spin mb-4"></div>
                            Drafting response...
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center text-white/30 text-xs font-bold tracking-wide mt-10 p-12 h-full">
                            Waiting for context...
                          </div>
                        )
                      )}
                    </div>
                 </div>
               </div>
            </div>

          {/* Bottom Snapshot History UI */}
          {snapshotHistory.length > 0 && (
            <div className="relative mt-2">
              <div className="flex justify-between items-center mb-1.5 px-2">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <Crop size={10} /> Snap Records
                </h4>
                <span className="text-[9px] font-bold text-brand-subtext uppercase">Max 4 Snaps (Auto-Rotate)</span>
              </div>
              <div className="h-[80px] shrink-0 bg-[#18181b] rounded-2xl border border-white/5 flex items-center p-2 gap-3 overflow-x-auto shadow-inner transition-all duration-300 relative z-10" style={{ 
                backgroundColor: `rgba(24, 24, 27, ${opacity * 0.95})`,
                borderColor: `rgba(255, 255, 255, ${opacity * 0.1})`
              }}>
                {snapshotHistory.map((snap) => (
                  <div key={snap.id} className="relative h-full aspect-video group flex-shrink-0">
                    <div className="w-full h-full rounded-xl overflow-hidden bg-black/50 border border-white/10">
                      <img src={snap.image} alt="History Snapshot" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                    </div>
                    
                    {/* Hover Overlay */}
                    <div className={`absolute inset-0 bg-black/60 transition-opacity flex items-center justify-center rounded-xl ${menuPos.id === snap.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      <button className="p-1.5 hover:bg-white/20 rounded-md text-white transition-colors" onClick={(e) => {
                        if (menuPos.id === snap.id) {
                          setMenuPos({ x: 0, y: 0, id: null });
                        } else {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setMenuPos({ x: rect.left + rect.width / 2, y: rect.top - 10, id: snap.id });
                        }
                      }}>
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Outside Menu Popup to avoid CSS clipping */}
              {menuPos.id && snapshotHistory.find(s => s.id === menuPos.id) && (() => {
                const snap = snapshotHistory.find(s => s.id === menuPos.id)!;
                return (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenuPos({x: 0, y: 0, id: null})}></div>
                    <div style={{ left: menuPos.x + 15, top: menuPos.y - 65, transform: 'translate(0%, -50%)' }} className="fixed bg-[#09090b] border border-brand-border rounded-xl shadow-[0_0_40px_rgba(0,0,0,0.8)] z-50 overflow-hidden min-w-[200px] animate-in slide-in-from-left-2 fade-in duration-200">
                      <div className="text-center px-4 py-3 border-b border-white/5 bg-white/5">
                        <span className="text-[10px] uppercase font-bold text-brand-subtext tracking-widest">Snapshot Options</span>
                      </div>
                      <button onClick={() => { setPreviewSnapshot(snap.image); setMenuPos({x: 0, y: 0, id: null}); }} className="w-full text-left px-4 py-3 text-xs text-white hover:bg-brand-secondary flex items-center gap-3 transition-colors">
                        <Eye size={14} /> Preview Fullscreen
                      </button>
                      <button onClick={() => { 
                        setTranscript(snap.transcriptContext || ''); 
                        setCurrentSnapshots([snap.image]); 
                        setMenuPos({x: 0, y: 0, id: null}); 
                      }} className="w-full text-left px-4 py-3 text-xs text-cyan-400 hover:bg-brand-secondary flex items-center gap-3 transition-colors border-t border-brand-border">
                        <Play size={14} fill="currentColor" /> Ask AI Again
                      </button>
                      <button onClick={() => { 
                        setSnapshotHistory(prev => prev.filter(s => s.id !== snap.id)); 
                        setMenuPos({x: 0, y: 0, id: null}); 
                      }} className="w-full text-left px-4 py-3 text-xs text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 flex items-center gap-3 transition-colors border-t border-brand-border">
                        <Trash2 size={14} /> Delete Snapshot
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
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
                You must provide a valid API key (at least Groq Key 1) before starting the interview. Go to Settings and add your API keys to continue.
              </p>
              <button 
                onClick={() => setShowApiKeyMissingError(false)} 
                className="w-full bg-brand-accent hover:bg-brand-accentSec text-white py-2.5 rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)]"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Minimum Size Warning Modal */}
      {showMinSizeWarning && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 select-none">
          <div className="bg-[#09090b]/90 border border-brand-border rounded-3xl w-full max-w-sm overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 duration-300">
            <div className="px-6 py-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
              <h3 className="font-black text-lg text-white flex items-center gap-2"><ZoomOut size={18} className="text-brand-accent"/> Size Limit Reached</h3>
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
          <div className="relative w-full max-w-md animate-in fade-in zoom-in-95 duration-300">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-rose-500 via-red-500 to-rose-500 rounded-3xl blur opacity-40"></div>
            
            <div className="relative bg-[#09090b]/90 border border-red-500/30 rounded-3xl w-full overflow-hidden shadow-[0_0_80px_rgba(225,29,72,0.3)]">
              <div className="px-8 py-6 border-b border-red-500/20 flex justify-between items-center bg-red-500/10">
                <h3 className="font-black text-xl text-rose-500 tracking-wide flex items-center gap-2"><AlertTriangle size={20} /> Warning</h3>
                <button onClick={() => setShowStartStealthWarning(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-colors"><X size={16}/></button>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="text-sm text-white/80 leading-relaxed">
                  <p className="mb-4">You are about to start the interview with <strong className="text-white">Stealth Mode OFF</strong>.</p>
                  <p className="mb-4 text-rose-400"><strong>Impact:</strong> Without Stealth Mode enabled, anti-cheat software (like MS Teams or Zoom screen sharing) may detect this application running in the background.</p>
                  <p><strong>How to fix:</strong> Click Cancel, go to <span className="bg-white/10 px-2 py-0.5 rounded text-white text-xs font-bold inline-flex items-center gap-1">Settings <Settings size={12}/></span>, and turn on <strong>Stealth Mode</strong> to hide the app securely.</p>
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

      {/* Session Name Prompt Modal Redesign */}
      {showSessionPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4">
          <div className="relative w-full max-w-md animate-in fade-in zoom-in-95 duration-300">
            {/* Glowing Accent Border */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-accent via-cyan-400 to-brand-accent rounded-3xl blur opacity-30"></div>
            
            <div className="relative bg-[#09090b]/90 border border-white/10 rounded-3xl w-full overflow-hidden shadow-[0_0_80px_rgba(0,0,0,1)]">
              <div className="px-8 py-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                <h3 className="font-black text-xl text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70 tracking-wide">Initialize Session</h3>
                <button onClick={() => setShowSessionPrompt(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-colors"><X size={16}/></button>
              </div>
              
              <div className="p-8 space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-brand-subtext uppercase tracking-[0.2em] mb-3">Resume Existing Session</label>
                  <div className="relative">
                    <CustomSelect
                      value={currentSessionId}
                      onChange={(val: string) => {
                        setCurrentSessionId(val);
                        if (val) {
                           const s = sessions.find(x => x.id === val);
                           if (s) setSessionNameInput(s.name);
                           setSessionError('');
                        } else {
                           setSessionNameInput('');
                        }
                      }}
                      options={[
                        { value: '', label: '-- Create a New Session Instead --' },
                        ...sessions.map(s => ({ value: s.id, label: `${s.name} (${s.date || 'Old Session'})` }))
                      ]}
                      className="w-full bg-[#18181b] border border-white/10 rounded-xl px-5 py-3 text-sm text-white transition-all"
                    />
                  </div>
                </div>

                {!currentSessionId && (
                  <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                    <label className="block text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em] mb-3">New Session Name</label>
                    <input 
                      type="text"
                      autoFocus
                      value={sessionNameInput}
                      onChange={e => { setSessionNameInput(e.target.value); setSessionError(''); }}
                      placeholder="e.g. Meta Final Round"
                      onKeyDown={e => { if(e.key === 'Enter') startRecording(); }}
                      className="w-full bg-[#18181b] border border-cyan-500/30 rounded-xl px-5 py-4 text-sm text-white placeholder-white/20 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all shadow-[0_0_15px_rgba(34,211,238,0.05)]"
                    />
                  </div>
                )}
                
                {sessionError && (
                  <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-3 animate-in slide-in-from-top-2">
                    <p className="text-rose-400 text-xs font-bold flex items-center gap-2">
                      <X size={14} className="bg-rose-500/20 rounded-full p-0.5" /> {sessionError}
                    </p>
                  </div>
                )}
              </div>
              
              <div className="px-8 py-5 bg-[#18181b]/50 flex justify-end gap-3 border-t border-white/5 backdrop-blur-md">
                <button onClick={() => setShowSessionPrompt(false)} className="px-5 py-2.5 rounded-xl text-xs font-bold text-white/50 hover:text-white hover:bg-white/5 transition-colors">Cancel</button>
                <button onClick={startRecording} className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:shadow-[0_0_30px_rgba(34,211,238,0.5)] flex items-center gap-2 transform active:scale-95">
                  Start AI Interview <Play size={12} fill="currentColor" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Stealth Warning Modal */}
      {showStealthWarning && (
        <div className="absolute inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-brand-bg border border-rose-500/30 rounded-2xl p-6 max-w-sm w-full shadow-[0_0_40px_rgba(225,29,72,0.2)] animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-rose-400 mb-3 flex items-center gap-2">
              <AlertTriangle size={24} /> Warning!
            </h3>
            <p className="text-brand-subtext text-sm mb-6 leading-relaxed">
              Disabling Stealth Mode will make ClueAI visible to screen sharing software like Zoom, Microsoft Teams, or Google Meet! 
              <br/><br/>
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
          className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex items-center justify-center p-8 animate-in fade-in duration-200"
          onClick={() => setPreviewSnapshot(null)}
        >
          <button 
            className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-md"
            onClick={(e) => { e.stopPropagation(); setPreviewSnapshot(null); }}
          >
            <X size={24} />
          </button>
          <img 
            src={previewSnapshot} 
            alt="Snapshot Preview" 
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl border border-white/10 animate-in zoom-in-95 duration-300" 
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Reminder Popup Editor */}
      {showReminderPopup && (
        <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-8 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-brand-secondary border border-brand-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-black/20">
              <h2 className="text-xl font-bold text-white flex items-center gap-2"><Settings size={18} className="text-blue-400" /> Reminder Profile Setup</h2>
              <button onClick={() => setShowReminderPopup(false)} className="text-white/50 hover:text-white transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-brand-subtext uppercase mb-1">Company Name</label>
                <input type="text" placeholder="e.g. Amazon" className={`w-full bg-black/40 border ${showReminderErrors && !reminderForm.name ? 'border-rose-500/50' : 'border-brand-border'} rounded-lg p-3 text-sm text-white outline-none focus:border-blue-500 transition-colors`} value={reminderForm.name} onChange={e => setReminderForm({...reminderForm, name: e.target.value})} />
                {showReminderErrors && !reminderForm.name && <p className="text-rose-500 text-[10px] mt-1 font-bold">This field is required.</p>}
              </div>
              <div>
                <label className="block text-xs font-bold text-brand-subtext uppercase mb-1">Job Title</label>
                <input type="text" placeholder="e.g. Software Engineer" className={`w-full bg-black/40 border ${showReminderErrors && !reminderForm.jobTitle ? 'border-rose-500/50' : 'border-brand-border'} rounded-lg p-3 text-sm text-white outline-none focus:border-blue-500 transition-colors`} value={reminderForm.jobTitle} onChange={e => setReminderForm({...reminderForm, jobTitle: e.target.value})} />
                {showReminderErrors && !reminderForm.jobTitle && <p className="text-rose-500 text-[10px] mt-1 font-bold">This field is required.</p>}
              </div>
              <div className="relative">
                <label className="block text-xs font-bold text-brand-subtext uppercase mb-1">Email ID</label>
                <input 
                  type="email" 
                  placeholder="e.g. user@example.com" 
                  className={`w-full bg-black/40 border ${showReminderErrors && (!reminderForm.email || !/^\S+@\S+\.\S+$/.test(reminderForm.email)) ? 'border-rose-500/50' : 'border-brand-border'} rounded-lg p-3 text-sm text-white outline-none focus:border-blue-500 transition-colors`} 
                  value={reminderForm.email} 
                  onChange={e => {
                     setReminderForm({...reminderForm, email: e.target.value});
                     const saved = localStorage.getItem('clueai_saved_email');
                     if (saved && e.target.value && saved.toLowerCase().startsWith(e.target.value.toLowerCase()) && e.target.value.toLowerCase() !== saved.toLowerCase()) {
                        setShowReminderEmailSuggest(true);
                     } else {
                        setShowReminderEmailSuggest(false);
                     }
                  }}
                  onFocus={() => {
                     const saved = localStorage.getItem('clueai_saved_email');
                     if (saved && !reminderForm.email) {
                        setShowReminderEmailSuggest(true);
                     }
                  }}
                  onBlur={() => setTimeout(() => setShowReminderEmailSuggest(false), 200)}
                />
                {showReminderEmailSuggest && localStorage.getItem('clueai_saved_email') && (
                  <div className="absolute top-full left-0 w-full mt-2 bg-brand-bg/95 backdrop-blur-xl border border-brand-border rounded-lg shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                    <div 
                      className="px-4 py-3 hover:bg-white/10 cursor-pointer flex flex-col transition-colors"
                      onClick={() => {
                         setReminderForm({...reminderForm, email: localStorage.getItem('clueai_saved_email') || ''});
                         setShowReminderEmailSuggest(false);
                      }}
                    >
                      <span className="text-[10px] font-bold text-brand-accent uppercase tracking-wider mb-0.5">Suggested</span>
                      <span className="text-sm text-white font-medium">{localStorage.getItem('clueai_saved_email')}</span>
                    </div>
                  </div>
                )}
                {showReminderErrors && !reminderForm.email && <p className="text-rose-500 text-[10px] mt-1 font-bold">This field is required.</p>}
                {showReminderErrors && reminderForm.email && !/^\S+@\S+\.\S+$/.test(reminderForm.email) && <p className="text-rose-500 text-[10px] mt-1 font-bold">Please enter a valid email address.</p>}
              </div>
              <div>
                <label className="block text-xs font-bold text-brand-subtext uppercase mb-1">Date</label>
                <input type="text" placeholder="DD-MM-YYYY" className={`w-full bg-black/40 border ${showReminderErrors && (!reminderForm.date || !/^\d{2}-\d{2}-\d{4}$/.test(reminderForm.date)) ? 'border-rose-500/50' : 'border-brand-border'} rounded-lg p-3 text-sm text-white outline-none focus:border-blue-500 transition-colors`} value={reminderForm.date} onChange={e => handleDateChange(e.target.value, reminderForm, setReminderForm)} />
                {showReminderErrors && !reminderForm.date && <p className="text-rose-500 text-[10px] mt-1 font-bold">This field is required.</p>}
                {showReminderErrors && reminderForm.date && !/^\d{2}-\d{2}-\d{4}$/.test(reminderForm.date) && <p className="text-rose-500 text-[10px] mt-1 font-bold">Please follow the example - DD-MM-YYYY format.</p>}
              </div>
              <div>
                <label className="block text-xs font-bold text-brand-subtext uppercase mb-1">Time</label>
                <div className="relative">
                  <input type="text" placeholder="HH:MM" className={`w-full bg-black/40 border ${showReminderErrors && (!reminderForm.time || !/^(0[1-9]|1[0-2]):[0-5]\d$/.test(reminderForm.time)) ? 'border-rose-500/50' : 'border-brand-border'} rounded-lg p-3 text-sm text-white outline-none focus:border-blue-500 transition-colors pr-16`} value={reminderForm.time} onChange={e => handleTimeChange(e.target.value, reminderForm, setReminderForm)} />
                  <button
                    onClick={() => setReminderForm({...reminderForm, ampm: reminderForm.ampm === 'AM' ? 'PM' : 'AM'})}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs font-bold flex items-center gap-1 hover:bg-blue-500/30 transition-colors"
                  >
                    {reminderForm.ampm} <RefreshCcw size={10} />
                  </button>
                </div>
                {showReminderErrors && !reminderForm.time && <p className="text-rose-500 text-[10px] mt-1 font-bold">This field is required.</p>}
                {showReminderErrors && reminderForm.time && !/^(0[1-9]|1[0-2]):[0-5]\d$/.test(reminderForm.time) && <p className="text-rose-500 text-[10px] mt-1 font-bold">Please use HH:MM 12-hour format.</p>}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-white/5 flex justify-end gap-3 bg-black/20">
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
                  const dateValid = /^\d{2}-\d{2}-\d{4}$/.test(reminderForm.date);
                  const timeValid = /^(0[1-9]|1[0-2]):[0-5]\d$/.test(reminderForm.time);
                  const emailValid = /^\S+@\S+\.\S+$/.test(reminderForm.email);
                  
                  if (!reminderForm.name || !reminderForm.jobTitle || !emailValid || !dateValid || !timeValid) {
                    setShowReminderErrors(true);
                    return;
                  }
                  setShowReminderErrors(false);

                  const templateParams = {
                    type: 'reminder',
                    to_name: reminderForm.name,
                    to_email: reminderForm.email,
                    company_name: reminderForm.name,
                    job_title: reminderForm.jobTitle,
                    date: reminderForm.date,
                    time: `${reminderForm.time} ${reminderForm.ampm}`, // Send concatenated time and AM/PM
                  };

                  // Send to Google Apps Script
                  setEmailSendStatus('sending');
                  fetch(GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    mode: 'no-cors', // Essential for Google Apps Script Web Apps
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(templateParams)
                  })
                  .then(() => {
                    setEmailSendStatus('success');
                    // Save Profile
                    if (reminderForm.id) {
                      setReminderProfiles(prev => prev.map(p => p.id === reminderForm.id ? reminderForm : p));
                    } else {
                      setReminderProfiles(prev => [{...reminderForm, id: Date.now().toString()}, ...prev]);
                    }
                    
                    setTimeout(() => {
                      setShowReminderPopup(false);
                      setEmailSendStatus('idle');
                    }, 1500);
                  })
                  .catch(err => {
                    setEmailSendStatus('idle');
                    console.error('Google Script Error:', err);
                    setAlertMessage({ title: 'Email Error', message: `Failed to schedule. Check URL. Error: ${err.message}`, type: 'error' });
                  });
                }}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg"
              >
                Send Reminder via Email
              </button>
              )}
              <button 
                onClick={() => {
                  const dateValid = /^\d{2}-\d{2}-\d{4}$/.test(reminderForm.date);
                  const timeValid = /^(0[1-9]|1[0-2]):[0-5]\d$/.test(reminderForm.time);
                  const emailValid = /^\S+@\S+\.\S+$/.test(reminderForm.email);
                  
                  if (!reminderForm.name || !reminderForm.jobTitle || !emailValid || !dateValid || !timeValid) {
                    setShowReminderErrors(true);
                    return;
                  }
                  setShowReminderErrors(false);
                  localStorage.setItem('clueai_saved_email', reminderForm.email);
                  
                  if (reminderForm.id) {
                    setReminderProfiles(prev => prev.map(p => p.id === reminderForm.id ? reminderForm : p));
                  } else {
                    setReminderProfiles(prev => [{...reminderForm, id: Date.now().toString()}, ...prev]);
                  }
                  setShowReminderPopup(false);
                }}
                className="px-5 py-2.5 bg-brand-accent hover:bg-brand-accent/80 text-white rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg"
              >
                <Save size={16} /> Save Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notes Popup Editor */}
      {showNotesPopup && (
        <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-8 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-brand-secondary border border-teal-500/30 rounded-2xl shadow-[0_0_80px_rgba(20,184,166,0.15)] flex flex-col overflow-hidden">
            <div className="px-6 py-5 border-b border-white/5 flex justify-between items-center bg-teal-500/10">
              <h2 className="text-xl font-bold text-white flex items-center gap-2"><FileText size={18} className="text-teal-400" /> Note Profile Setup</h2>
              <button onClick={() => setShowNotesPopup(false)} className="text-white/50 hover:text-white transition-colors"><X size={20} /></button>
            </div>
            
            <div className="p-6 flex flex-col gap-4 overflow-y-auto max-h-[60vh] custom-scrollbar">
              <div>
                <label className="block text-xs font-bold text-brand-subtext uppercase mb-1">Notes</label>
                <textarea 
                  placeholder="e.g. Discussed system design..." 
                  className={`w-full bg-black/40 border ${showNotesErrors && !notesForm.notes ? 'border-rose-500/50' : 'border-brand-border'} rounded-lg p-3 text-sm text-white outline-none focus:border-teal-500 transition-colors h-24 resize-none`} 
                  value={notesForm.notes} 
                  onChange={e => setNotesForm({...notesForm, notes: e.target.value})} 
                />
                {showNotesErrors && !notesForm.notes && <p className="text-rose-500 text-[10px] mt-1 font-bold">This field is required.</p>}
              </div>
              <div className="relative">
                <label className="block text-xs font-bold text-brand-subtext uppercase mb-1">Email ID</label>
                <input 
                  type="email" 
                  placeholder="e.g. user@example.com" 
                  className={`w-full bg-black/40 border ${showNotesErrors && (!notesForm.email || !/^\S+@\S+\.\S+$/.test(notesForm.email)) ? 'border-rose-500/50' : 'border-brand-border'} rounded-lg p-3 text-sm text-white outline-none focus:border-teal-500 transition-colors`} 
                  value={notesForm.email} 
                  onChange={e => {
                     setNotesForm({...notesForm, email: e.target.value});
                     const saved = localStorage.getItem('clueai_saved_email');
                     if (saved && e.target.value && saved.toLowerCase().startsWith(e.target.value.toLowerCase()) && e.target.value.toLowerCase() !== saved.toLowerCase()) {
                        setShowNotesEmailSuggest(true);
                     } else {
                        setShowNotesEmailSuggest(false);
                     }
                  }}
                  onFocus={() => {
                     const saved = localStorage.getItem('clueai_saved_email');
                     if (saved && !notesForm.email) {
                        setShowNotesEmailSuggest(true);
                     }
                  }}
                  onBlur={() => setTimeout(() => setShowNotesEmailSuggest(false), 200)}
                />
                {showNotesEmailSuggest && localStorage.getItem('clueai_saved_email') && (
                  <div className="absolute top-full left-0 w-full mt-2 bg-brand-bg/95 backdrop-blur-xl border border-brand-border rounded-lg shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                    <div 
                      className="px-4 py-3 hover:bg-white/10 cursor-pointer flex flex-col transition-colors"
                      onClick={() => {
                         setNotesForm({...notesForm, email: localStorage.getItem('clueai_saved_email') || ''});
                         setShowNotesEmailSuggest(false);
                      }}
                    >
                      <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider mb-0.5">Suggested</span>
                      <span className="text-sm text-white font-medium">{localStorage.getItem('clueai_saved_email')}</span>
                    </div>
                  </div>
                )}
                {showNotesErrors && !notesForm.email && <p className="text-rose-500 text-[10px] mt-1 font-bold">This field is required.</p>}
                {showNotesErrors && notesForm.email && !/^\S+@\S+\.\S+$/.test(notesForm.email) && <p className="text-rose-500 text-[10px] mt-1 font-bold">Please enter a valid email address.</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-brand-subtext uppercase mb-1">Date</label>
                  <input type="text" placeholder="DD-MM-YYYY" className={`w-full bg-black/40 border ${showNotesErrors && (!notesForm.date || !/^\d{2}-\d{2}-\d{4}$/.test(notesForm.date)) ? 'border-rose-500/50' : 'border-brand-border'} rounded-lg p-3 text-sm text-white outline-none focus:border-teal-500 transition-colors`} value={notesForm.date} onChange={e => handleDateChange(e.target.value, notesForm, setNotesForm)} />
                  {showNotesErrors && !notesForm.date && <p className="text-rose-500 text-[10px] mt-1 font-bold">Required.</p>}
                  {showNotesErrors && notesForm.date && !/^\d{2}-\d{2}-\d{4}$/.test(notesForm.date) && <p className="text-rose-500 text-[10px] mt-1 font-bold">Invalid format.</p>}
                </div>
                <div>
                  <label className="block text-xs font-bold text-brand-subtext uppercase mb-1">Time</label>
                  <div className="relative">
                    <input type="text" placeholder="HH:MM" className={`w-full bg-black/40 border ${showNotesErrors && (!notesForm.time || !/^(0[1-9]|1[0-2]):[0-5]\d$/.test(notesForm.time)) ? 'border-rose-500/50' : 'border-brand-border'} rounded-lg p-3 text-sm text-white outline-none focus:border-teal-500 transition-colors pr-16`} value={notesForm.time} onChange={e => handleTimeChange(e.target.value, notesForm, setNotesForm)} />
                    <button
                      onClick={() => setNotesForm({...notesForm, ampm: notesForm.ampm === 'AM' ? 'PM' : 'AM'})}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-teal-500/20 text-teal-400 px-2 py-1 rounded text-xs font-bold flex items-center gap-1 hover:bg-teal-500/30 transition-colors"
                    >
                      {notesForm.ampm} <RefreshCcw size={10} />
                    </button>
                  </div>
                  {showNotesErrors && !notesForm.time && <p className="text-rose-500 text-[10px] mt-1 font-bold">Required.</p>}
                  {showNotesErrors && notesForm.time && !/^(0[1-9]|1[0-2]):[0-5]\d$/.test(notesForm.time) && <p className="text-rose-500 text-[10px] mt-1 font-bold">Invalid format.</p>}
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-white/5 flex justify-end gap-3 bg-black/20">
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
                  const dateValid = /^\d{2}-\d{2}-\d{4}$/.test(notesForm.date);
                  const timeValid = /^(0[1-9]|1[0-2]):[0-5]\d$/.test(notesForm.time);
                  const emailValid = /^\S+@\S+\.\S+$/.test(notesForm.email);
                  
                  if (!notesForm.notes || !emailValid || !dateValid || !timeValid) {
                    setShowNotesErrors(true);
                    return;
                  }
                  setShowNotesErrors(false);
                  localStorage.setItem('clueai_saved_email', notesForm.email);

                  const templateParams = {
                    type: 'note',
                    email: notesForm.email,
                    date: notesForm.date,
                    time: `${notesForm.time} ${notesForm.ampm}`, // Send concatenated time and AM/PM
                    notes: notesForm.notes,
                  };

                  // Send to Google Apps Script
                  setEmailSendStatus('sending');
                  fetch(GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(templateParams)
                  })
                  .then(() => {
                    setEmailSendStatus('success');
                    // Save Profile
                    if (notesForm.id) {
                      setNotesProfiles(prev => prev.map(p => p.id === notesForm.id ? notesForm : p));
                    } else {
                      setNotesProfiles(prev => [{...notesForm, id: Date.now().toString()}, ...prev]);
                    }
                    
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
                }}
                className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg"
              >
                Send & Save Notes
              </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Virtual Keyboard Transcript Editor */}
      {showVirtualKeyboard && (
        <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-8 animate-in fade-in duration-200">
          <div className="w-full max-w-4xl bg-brand-secondary border border-brand-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            
            <div className="flex justify-between items-center bg-black/40 px-6 py-4 border-b border-brand-border">
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <FileText size={20} className="text-brand-accent"/> Virtual Keyboard Editor
              </h2>
              <div className="flex gap-2 text-[10px] text-white/50 uppercase font-black tracking-wider">
                <span className="bg-black/30 px-2 py-1 rounded">Enter: Save</span>
                <span className="bg-black/30 px-2 py-1 rounded">Shift/Alt+Enter: New Line</span>
              </div>
              <button 
                onClick={() => {
                  setShowVirtualKeyboard(false);
                  if (globalHotkeysEnabled) ipcRenderer.invoke('toggle-global-hotkeys', true);
                }}
                className="text-white/50 hover:text-white transition-colors bg-white/5 hover:bg-rose-500 rounded-lg px-4 py-2 flex items-center gap-2 text-sm font-bold"
              >
                <X size={16} /> Cancel (Esc)
              </button>
            </div>

            <textarea 
              ref={virtualKeyboardTextareaRef}
              className="w-full h-56 bg-transparent text-white p-6 outline-none resize-none text-lg font-medium leading-relaxed custom-scrollbar placeholder-white/20"
              value={editTranscript}
              onChange={(e) => setEditTranscript(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setShowVirtualKeyboard(false);
                  if (globalHotkeysEnabled) ipcRenderer.invoke('toggle-global-hotkeys', true);
                } else if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
                  e.preventDefault();
                  setTranscript(editTranscript);
                  finalizedTranscriptRef.current = editTranscript;
                  interimTranscriptRef.current = '';
                  audioDataRef.current = new Float32Array(0);
                  setShowVirtualKeyboard(false);
                  if (globalHotkeysEnabled) ipcRenderer.invoke('toggle-global-hotkeys', true);
                } else if (e.key === 'Enter' && e.altKey) {
                  e.preventDefault();
                  setEditTranscript(prev => prev + '\n');
                }
              }}
              placeholder="Start typing..."
              autoFocus
            />

            <div className="bg-black/60 p-4 flex flex-col gap-2 items-center border-t border-brand-border/50 select-none">
              <div className="flex flex-col gap-1.5 w-full max-w-4xl">
                {/* Special characters row */}
                <div className="flex gap-1.5 w-full justify-center mb-1">
                  {['@','#','$','%','&','*','(',')','{','}','[',']','<','>','_','+','-','=','/','\\','|'].map(key => (
                    <button 
                      key={key} 
                      onClick={() => setEditTranscript(prev => prev + key)}
                      className="w-8 h-8 bg-brand-accent/10 hover:bg-brand-accent/30 text-brand-accent rounded-lg font-bold text-sm transition-all flex items-center justify-center border border-brand-accent/20"
                    >
                      {key}
                    </button>
                  ))}
                </div>
                {[
                  ['1','2','3','4','5','6','7','8','9','0'],
                  ['q','w','e','r','t','y','u','i','o','p'],
                  ['a','s','d','f','g','h','j','k','l',';',"'"],
                  ['z','x','c','v','b','n','m',',','.','?']
                ].map((row, i) => (
                  <div key={i} className="flex gap-1.5 w-full justify-center">
                    {row.map(key => (
                      <button 
                        key={key} 
                        onClick={() => setEditTranscript(prev => prev + key)}
                        className="w-10 h-10 bg-white/5 hover:bg-white/20 active:bg-white/30 text-white rounded-lg font-bold uppercase text-sm border border-white/5 shadow-sm transition-all flex items-center justify-center"
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                ))}
                
                <div className="flex gap-2 w-full justify-center mt-2">
                   <button 
                     onClick={() => setEditTranscript(prev => prev.slice(0, -1))} 
                     className="px-6 py-3 bg-white/5 hover:bg-rose-500/80 text-white rounded-xl font-bold flex-[1] border border-white/5 transition-all"
                   >
                     Backspace
                   </button>
                   <button 
                     onClick={() => setEditTranscript(prev => prev + '\n')} 
                     className="px-6 py-3 bg-white/5 hover:bg-white/20 text-white rounded-xl font-bold flex-[1] border border-white/5 transition-all flex flex-col items-center justify-center gap-0.5 leading-none"
                   >
                     <span>Next Line</span>
                     <span className="text-[10px] opacity-70 font-normal">(Alt+Enter)</span>
                   </button>
                   <button 
                     onClick={() => setEditTranscript(prev => prev + ' ')} 
                     className="px-6 py-3 bg-white/5 hover:bg-white/20 text-white rounded-xl font-bold flex-[2] border border-white/5 transition-all"
                   >
                     Space
                   </button>
                   <button 
                     onClick={() => {
                        setTranscript(editTranscript);
                        finalizedTranscriptRef.current = editTranscript;
                        interimTranscriptRef.current = '';
                        audioDataRef.current = new Float32Array(0);
                        setShowVirtualKeyboard(false);
                        if (globalHotkeysEnabled) ipcRenderer.invoke('toggle-global-hotkeys', true);
                     }} 
                     className="px-6 py-3 bg-brand-accent hover:bg-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)] rounded-xl font-bold flex-[1] border border-brand-accent/30 transition-all flex flex-col items-center justify-center gap-0.5 leading-none"
                   >
                     <span>Done / Save</span>
                     <span className="text-[10px] opacity-90 font-normal">(Enter)</span>
                   </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
      {/* Alert Message Modal */}
      {alertMessage && (
        <div className="fixed inset-0 z-[400] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-8 animate-in fade-in duration-200">
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
            <div className="bg-black/40 px-6 py-4 border-t border-brand-border/50 flex justify-end">
              <button 
                onClick={() => setAlertMessage(null)}
                className={`px-6 py-2 ${alertMessage.type === 'error' ? 'bg-rose-500 hover:bg-rose-400' : alertMessage.type === 'success' ? 'bg-green-600 hover:bg-green-500' : 'bg-brand-accent hover:bg-brand-accentSec'} text-white rounded-lg font-bold text-sm transition-colors shadow-lg`}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
      
      {!showSplash && showUsernamePrompt && (
        <div className="fixed inset-0 z-[500] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-8 animate-in fade-in zoom-in duration-200">
          <div className="w-full max-w-sm bg-brand-secondary border border-brand-border rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            <div className="px-6 py-6 flex flex-col gap-4">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-white mb-1">Your Name</h2>
                <p className="text-xs font-medium text-brand-subtext leading-relaxed">
                  Enter your name to personalize your session exports.
                </p>
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
                    }
                  }}
                />
              </div>
              <div className="flex justify-end">
                <button 
                  disabled={!tempUsername.trim()}
                  onClick={() => {
                    setUsername(tempUsername.trim());
                    localStorage.setItem('clueai_username', tempUsername.trim());
                    setShowUsernamePrompt(false);
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

      {/* Previous Questions Modal */}
      {showPreviousQuestions && (
        <div className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-xl flex flex-col p-8 animate-in fade-in duration-200">
          <div className="w-full max-w-4xl mx-auto bg-[#09090b]/80 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-2xl flex flex-col h-full overflow-hidden">
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
                          finalizedTranscriptRef.current = item.question;
                          setShowPreviousQuestions(false);
                          if (!isGenerating) {
                            manualTriggerAI();
                          }
                        }}
                        className="px-4 py-2 bg-brand-accent hover:bg-cyan-400 text-white rounded-lg font-bold text-xs shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all flex items-center gap-2"
                      >
                        <RefreshCw size={14} /> Ask AI Again
                      </button>
                    </div>
                  </div>
                  
                  {expandedAnswers[idx] && (
                    <div className="pt-6 border-t border-white/5 animate-in slide-in-from-top-2 fade-in duration-200">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-[11px] font-black text-fuchsia-400 uppercase tracking-wider flex items-center gap-1.5"><Cpu size={14} /> AI Answer</h3>
                        <CopyButton text={item.answer} className="text-white/40 hover:text-white transition-colors" tooltip="Copy Answer" />
                      </div>
                      <div className="text-white/90 font-bold text-sm whitespace-pre-wrap leading-relaxed">
                        <ReactMarkdown
                          components={{
                            code({inline, children}: any) {
                              return !inline ? (
                                <div className="bg-black/40 rounded-xl p-4 my-3 border border-white/5 font-mono text-xs overflow-x-auto text-white/80">{children}</div>
                              ) : (
                                <code className="bg-white/10 text-fuchsia-300 px-1.5 py-0.5 rounded-lg text-[12px] font-bold">{children}</code>
                              )
                            }
                          }}
                        >
                          {item.answer}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}

export default App;
