import { useEffect, useState, useRef } from 'react';
import { Play, Square, Mic, Upload, Cpu, FileText, Pause, Settings, LayoutPanelTop, Trash2, X, Minus, Loader2, Maximize, MoreVertical, Download, Plus, Move, Copy, Eye, EyeOff, ChevronDown, ChevronRight, Save, Crop, CheckCircle2, XCircle, AlertTriangle, Info, Edit2 } from 'lucide-react';
import { initAIClient, getInterviewAnswer, switchProvider } from './AIClient';
import { initSTT, transcribeAudioChunk, setSTTApiKey } from './STTClient';
// @ts-ignore
const { ipcRenderer, shell } = window.require('electron');
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyWqhztb7GbVlghFBJeusoJ-YcYx-9WPsADg9JbUXTOY-QKTpjR1ivKNyJP3iJ3wzpgKw/exec';

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

  const [apiAccordion, setApiAccordion] = useState<'none' | 'groq' | 'gemini'>('none');
  const [isRecording, setIsRecording] = useState(false);
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
  const [alertMessage, setAlertMessage] = useState<{title: string, message: string, type: 'error' | 'success' | 'warning'} | null>(null);
  const [reminderProfiles, setReminderProfiles] = useState<{id: string, name: string, jobTitle: string, email: string, phone: string, date: string, time: string}[]>(() => {
    try { return JSON.parse(localStorage.getItem('reminder_profiles') || '[]'); } catch { return []; }
  });
  const [reminderForm, setReminderForm] = useState({id: '', name: '', jobTitle: '', email: '', phone: '', date: '', time: ''});
  const [emailSendStatus, setEmailSendStatus] = useState<'idle' | 'sending' | 'success'>('idle');
  
  const [transcriptTextColor, setTranscriptTextColor] = useState<'white' | 'black'>('white');
  
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
  const [layout, setLayout] = useState('horizontal');
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [copiedAnswer, setCopiedAnswer] = useState(false);
  // Snapshot States
  const [currentSnapshot, setCurrentSnapshot] = useState<string | null>(null);
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
  const [showNoInputError, setShowNoInputError] = useState(false);
  const [sessionNameInput, setSessionNameInput] = useState('');
  const [currentSessionId, setCurrentSessionId] = useState('');
  
  const [sessionLog, setSessionLog] = useState('');
  const [interviewTitle, setInterviewTitle] = useState(localStorage.getItem('interview_title') || '');
  const [sessionError, setSessionError] = useState('');
  
  const [saveMessages, setSaveMessages] = useState<{type: 'success' | 'invalid' | 'duplicate', text: string}[]>([]);
  const [deleteMessage, setDeleteMessage] = useState<{provider: string, index: number} | null>(null);

  const [activeAIInfo, setActiveAIInfo] = useState<{provider: string, index: number} | null>(null);
  const [modelChangeMsg, setModelChangeMsg] = useState('');

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
    ipcRenderer.invoke('set-layout', layout);
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

  const handleStartCaptureClick = () => {
    const activeKeys = provider === 'groq' ? groqKeys : geminiKeys;
    const hasActiveKey = activeKeys.some(k => k.trim() !== '');
    const hasGroqKey = groqKeys.some(k => k.trim() !== '');

    if (!hasActiveKey || !hasGroqKey) {
      setShowApiKeyMissingError(true);
      return;
    }
    
    if (!selectedSource) {
      setAlertMessage({ title: 'Source Missing', message: 'Please select a screen to capture.', type: 'warning' });
      return;
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

  const startRecording = async (isSilentRestart: boolean | any = false) => {
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
      if (showSessionPrompt) {
        if (!currentSessionId) {
          const name = sessionNameInput.trim();
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
    if (!transcript && !currentSnapshot) {
      setShowNoInputError(true);
      return;
    }
    
    setIsPaused(true);
    isPausedRef.current = true;
    setIsGenerating(true);
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
      currentSnapshot || '',
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
      setSessionLog(prev => prev + `\n\n--- QUESTION ---\n${currentSnapshot ? `[IMAGE_BASE64:${currentSnapshot}]\n` : ''}${transcript}\n\n--- AI ANSWER ---\n[MODEL:${currentProviderInfo}]\n${finalAnswer}\n\n`);
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
    
    setTranscript('');
    finalizedTranscriptRef.current = '';
    interimTranscriptRef.current = '';
    setAiAnswer('');
    setCurrentSnapshot(base64Img);
  };

  const stopRecording = (isSilentRestart: boolean | any = false) => {
    const silent = typeof isSilentRestart === 'boolean' ? isSilentRestart : false;
    
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    if (!silent) {
      setIsRecording(false);
      setIsPaused(false);
      setSnapshotHistory([]);
      setCurrentSnapshot(null);
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
      setDisplayedAnswer('');
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
    if (currentSnapshot) {
      setSnapshotHistory(prev => {
        const newHistory = [...prev, { id: Date.now().toString(), image: currentSnapshot, transcriptContext: transcript }];
        if (newHistory.length > 4) return newHistory.slice(newHistory.length - 4);
        return newHistory;
      });
    }
    
    setTranscript('');
    finalizedTranscriptRef.current = '';
    interimTranscriptRef.current = '';
    audioDataRef.current = new Float32Array(0);
    
    setAiAnswer('');
    setCurrentSnapshot(null);
    setIsPaused(false);
    setShowNoInputError(false);
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
    if (currentSnapshot) {
      setSnapshotHistory(prev => {
        const newHistory = [...prev, { id: Date.now().toString(), image: currentSnapshot, transcriptContext: transcript }];
        return newHistory.length > 4 ? newHistory.slice(newHistory.length - 4) : newHistory;
      });
    }
    setTranscript(''); 
    finalizedTranscriptRef.current = '';
    interimTranscriptRef.current = '';
    audioDataRef.current = new Float32Array(0); 
    setCurrentSnapshot(null);
    setAiAnswer('');
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setShowVirtualKeyboard(false);
        }
        return;
      }
      
      const key = e.key.toLowerCase();
      
      // Global window movement/resizing (always works)
      if (e.ctrlKey && (key === '=' || key === '+')) {
        e.preventDefault();
        ipcRenderer.send('resize-window', { width: 50, height: 50 });
        return;
      } else if (e.ctrlKey && key === '-') {
        e.preventDefault();
        ipcRenderer.send('resize-window', { width: -50, height: -50 });
        return;
      } else if (key === 'arrowup') {
        e.preventDefault();
        ipcRenderer.send('move-window-by', { x: 0, y: -50 });
        return;
      } else if (key === 'arrowdown') {
        e.preventDefault();
        ipcRenderer.send('move-window-by', { x: 0, y: 50 });
        return;
      } else if (key === 'arrowleft') {
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
        }
      } else if (key === '0') {
        e.preventDefault();
        setTranscriptTextColor(prev => prev === 'white' ? 'black' : 'white');
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

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [isRecording, isPaused, isGenerating, manualTriggerAI, currentSnapshot, transcript, provider]);

  const closeApp = () => window.close();
  const minimizeApp = () => {
     ipcRenderer.invoke('minimize-window');
  };

  return (
    <div 
      className="flex flex-col h-screen text-brand-text p-4 font-sans overflow-hidden rounded-xl"
      style={{ backgroundColor: !isRecording ? '#09090b' : 'transparent' }}
    >
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
        {isRecording && (
          <div className="flex items-center gap-2 mb-3 w-full">
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
          </div>
        )}

        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-white/5 rounded-md text-white/50 shadow-sm border border-white/5 flex items-center justify-center cursor-default">
              <Move size={16} />
            </div>
            <div className="flex flex-col justify-center">
              <h1 className="text-xl font-black tracking-tighter flex items-center gap-2 text-brand-accent leading-none">
                <img src="./logo.png" alt="Logo" className="w-7 h-7 object-cover rounded-md shadow-sm border border-brand-accent/20" /> 
                <span>ClueAI</span>
                {!isRecording && username && (
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
                {isRecording && <span className="text-white font-mono font-bold text-sm ml-2 px-2 py-0.5 bg-white/10 rounded-md border border-white/20 shadow-inner leading-none">{formatTimer(recordingSeconds)}</span>}
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isRecording ? (
            <>
              <div className="flex items-center gap-3 mr-2 relative">
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
                  
                  {modelChangeMsg && (
                    <div className="fixed top-16 right-6 z-[100] bg-green-500/15 backdrop-blur-xl border border-green-500/30 text-green-400 text-[10px] uppercase tracking-widest font-black px-4 py-2 rounded-xl animate-in slide-in-from-top-4 fade-in duration-300 whitespace-nowrap shadow-[0_0_30px_rgba(34,197,94,0.3)] pointer-events-none flex items-center gap-2">
                      <CheckCircle2 size={14} /> {modelChangeMsg}
                    </div>
                  )}
                </div>
              </div>
              
              {isPaused ? (
                <button onClick={handlePauseToggle} className="flex flex-col items-center justify-center bg-green-500 hover:bg-green-400 text-black px-3 py-1 rounded-md transition-all shadow-[0_0_15px_rgba(34,197,94,0.4)] group">
                  <div className="flex items-center gap-1.5 font-black text-[11px] tracking-wide mb-0.5">
                    <Play size={12} fill="currentColor" /> NEXT Q.
                  </div>
                  <span className="text-[8px] font-bold text-white drop-shadow-md">Press Z or 1</span>
                </button>
              ) : (
                <button onClick={handlePauseToggle} className="flex flex-col items-center justify-center bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-3 py-1 rounded-md transition-all group">
                  <div className="flex items-center gap-1.5 font-bold text-xs mb-0.5">
                    <Pause size={12} fill="currentColor" /> Pause
                  </div>
                  <span className="text-[8px] font-medium text-white/70">Press Z or 1</span>
                </button>
              )}
              <button onClick={handleSnipClick} className="flex flex-col items-center justify-center bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/30 px-3 py-1 rounded-md transition-all group">
                <div className="flex items-center gap-1.5 font-bold text-xs mb-0.5">
                  <Crop size={12} /> Snip UI
                </div>
                <span className="text-[8px] font-medium text-white/70">Press A or 4</span>
              </button>
              <button onClick={handleClearAll} className="flex flex-col items-center justify-center bg-slate-500/10 hover:bg-slate-500/20 text-brand-subtext border border-slate-500/30 px-3 py-1 rounded-md transition-all group">
                <div className="flex items-center gap-1.5 font-bold text-xs mb-0.5">
                  <Trash2 size={12} fill="currentColor" /> Clear
                </div>
                <span className="text-[8px] font-medium text-white/70">Press C or 3</span>
              </button>
              <button onClick={stopRecording} className="flex flex-col items-center justify-center bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 px-3 py-1 rounded-md transition-all group">
                <div className="flex items-center gap-1.5 font-bold text-xs mb-0.5">
                  <Square size={12} fill="currentColor" /> Stop
                </div>
                <span className="text-[8px] font-medium text-white/70">Press D or 6</span>
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setShowSettings(!showSettings)} className={`p-1.5 mr-2 rounded-lg transition-colors ${showSettings ? 'bg-brand-accent text-white' : 'hover:bg-white/10 text-brand-subtext hover:text-white'}`}>
                <Settings size={16} />
              </button>
              <button onClick={handleStartCaptureClick} className="flex items-center gap-2 bg-brand-accentSec hover:bg-brand-accentSec text-white px-4 py-1.5 rounded-lg font-bold text-sm transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] border border-cyan-400/30">
                <Play size={14} fill="currentColor" /> Start Interview
              </button>
            </>
          )}

          {/* Minimize / Maximize / Close */}
          <div className="flex items-center gap-1 ml-4 pl-4 border-l border-brand-border">
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
      </div>

      {/* Full-Screen Settings Modal */}
      {!isRecording && showSettings && (
        <div className="absolute inset-2 z-40 bg-brand-bg/95 backdrop-blur-3xl rounded-2xl border border-brand-border/50 flex flex-col pt-12 p-6 animate-in fade-in duration-200 overflow-y-auto shadow-2xl">
          <div className="max-w-3xl w-full mx-auto space-y-8 pb-10">
            <div className="flex justify-between items-end border-b border-brand-border pb-4">
              <div>
                <h2 className="text-3xl font-black tracking-tight text-white">Settings</h2>
                <p className="text-brand-subtext text-sm">Configure your AI model, screen capture, and interview context.</p>
              </div>
              <div className="flex items-center gap-3">
                {deleteMsg && <span className="text-red-400 font-bold text-xs bg-red-500/10 px-3 py-1.5 rounded border border-red-500/20">{deleteMsg}</span>}
                <button onClick={() => setShowSettings(false)} className="bg-brand-secondary hover:bg-brand-border text-brand-text px-4 py-2 rounded-lg font-bold text-sm transition-colors flex items-center gap-2">
                  Done <X size={16}/>
                </button>
              </div>
            </div>

            {/* AI Provider & Capture Screen */}
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
              <div className="bg-brand-card p-5 rounded-2xl border border-brand-border space-y-6">
                <div>
                  <label className="block text-xs font-bold text-brand-subtext uppercase mb-2">Title of Interview</label>
                  <input 
                    type="text" 
                    value={interviewTitle} 
                    onChange={e => setInterviewTitle(e.target.value)} 
                    className="w-full bg-brand-secondary border border-brand-border rounded-lg px-4 py-2.5 text-sm outline-none focus:border-brand-accent text-white transition-all" 
                    placeholder="e.g. Senior Backend Developer" 
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-brand-subtext uppercase">Resume Context 1 (Optional)</label>
                    <label className="flex items-center gap-1.5 text-xs text-brand-text cursor-pointer">
                      <input type="radio" name="resumePriority" checked={resumePriority === 1} onChange={() => setResumePriority(1)} className="accent-brand-accent cursor-pointer" />
                      <span className={resumePriority === 1 ? 'text-brand-accent font-bold' : ''}>High Priority</span>
                    </label>
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 px-5 py-2.5 bg-brand-accent/10 hover:bg-brand-accent/20 border border-brand-accent/30 text-brand-accent rounded-lg cursor-pointer transition-all text-sm font-bold shadow-[0_0_15px_rgba(139,92,246,0.1)]">
                        {isUploadingResume ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} 
                        {isUploadingResume ? 'Analyzing...' : 'Upload PDF/TXT 1'}
                        <input type="file" accept=".pdf,.txt" className="hidden" onChange={(e) => handleFileUpload(e, 'resume1')} disabled={isUploadingResume} />
                      </label>
                      {resumeFileName && !isUploadingResume && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-green-400 flex items-center gap-1.5 truncate max-w-[300px] bg-green-500/10 px-3 py-2 rounded-md border border-green-500/20">
                            <FileText size={14} className="flex-shrink-0" /> {resumeFileName}
                          </span>
                          <button onClick={() => handleDeleteFile('resume1')} className="text-red-400 hover:text-red-300 p-1 bg-red-500/10 hover:bg-red-500/20 rounded border border-red-500/20">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                      <textarea 
                        value={resumeText} 
                        onChange={(e) => setResumeText(e.target.value)} 
                        className="w-full h-32 bg-black/40 border border-brand-border rounded-lg p-3 text-xs text-white/80 font-mono resize-y outline-none custom-scrollbar whitespace-pre-wrap"
                        placeholder="Paste your resume text here or upload a file..."
                      />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-brand-subtext uppercase">Resume Context 2 (Optional)</label>
                    <label className="flex items-center gap-1.5 text-xs text-brand-text cursor-pointer">
                      <input type="radio" name="resumePriority" checked={resumePriority === 2} onChange={() => setResumePriority(2)} className="accent-brand-accent cursor-pointer" />
                      <span className={resumePriority === 2 ? 'text-brand-accent font-bold' : ''}>High Priority</span>
                    </label>
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 px-5 py-2.5 bg-brand-accent/10 hover:bg-brand-accent/20 border border-brand-accent/30 text-brand-accent rounded-lg cursor-pointer transition-all text-sm font-bold shadow-[0_0_15px_rgba(139,92,246,0.1)]">
                        {isUploadingResume2 ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} 
                        {isUploadingResume2 ? 'Analyzing...' : 'Upload PDF/TXT 2'}
                        <input type="file" accept=".pdf,.txt" className="hidden" onChange={(e) => handleFileUpload(e, 'resume2')} disabled={isUploadingResume2} />
                      </label>
                      {resumeFileName2 && !isUploadingResume2 && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-green-400 flex items-center gap-1.5 truncate max-w-[300px] bg-green-500/10 px-3 py-2 rounded-md border border-green-500/20">
                            <FileText size={14} className="flex-shrink-0" /> {resumeFileName2}
                          </span>
                          <button onClick={() => handleDeleteFile('resume2')} className="text-red-400 hover:text-red-300 p-1 bg-red-500/10 hover:bg-red-500/20 rounded border border-red-500/20">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                      <textarea 
                        value={resumeText2} 
                        onChange={(e) => setResumeText2(e.target.value)} 
                        className="w-full h-32 bg-black/40 border border-brand-border rounded-lg p-3 text-xs text-white/80 font-mono resize-y outline-none custom-scrollbar whitespace-pre-wrap"
                        placeholder="Paste your second resume text here or upload a file..."
                      />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-brand-subtext uppercase mb-1">Personal Context</label>
                  <p className="text-xs text-brand-subtext/70 mb-2 italic">HIGH PRIORITY: This document is about yourself (strengths, weaknesses, hobbies).</p>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 px-5 py-2.5 bg-brand-accent/10 hover:bg-brand-accent/20 border border-brand-accent/30 text-brand-accent rounded-lg cursor-pointer transition-all text-sm font-bold shadow-[0_0_15px_rgba(139,92,246,0.1)]">
                        {isUploadingPersonalContext ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} 
                        {isUploadingPersonalContext ? 'Analyzing...' : 'Upload PDF/TXT'}
                        <input type="file" accept=".pdf,.txt" className="hidden" onChange={(e) => handleFileUpload(e, 'personal')} disabled={isUploadingPersonalContext} />
                      </label>
                      {personalContextFileName && !isUploadingPersonalContext && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-green-400 flex items-center gap-1.5 truncate max-w-[300px] bg-green-500/10 px-3 py-2 rounded-md border border-green-500/20">
                            <FileText size={14} className="flex-shrink-0" /> {personalContextFileName}
                          </span>
                          <button onClick={() => handleDeleteFile('personal')} className="text-red-400 hover:text-red-300 p-1 bg-red-500/10 hover:bg-red-500/20 rounded border border-red-500/20">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                    <textarea 
                      value={personalContextText} 
                      onChange={(e) => setPersonalContextText(e.target.value)} 
                      className="w-full h-32 bg-black/40 border border-brand-border rounded-lg p-3 text-xs text-white/80 font-mono resize-y outline-none custom-scrollbar whitespace-pre-wrap mt-2"
                      placeholder="Paste your personal context here (strengths, weaknesses, background) or upload a file..."
                    />
                  </div>
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
                  <div className="flex justify-between items-center bg-brand-secondary/30 p-3 rounded-xl border border-brand-border/40">
                    <span className="text-sm text-white/90 font-medium flex items-center gap-2">Increase Size <span className="text-xs text-white/40 font-normal">(Hold Ctrl)</span></span>
                    <span className="bg-white/10 text-white px-3 py-1 rounded-lg text-xs font-bold border border-white/20">Ctrl + +</span>
                  </div>
                  <div className="flex justify-between items-center bg-brand-secondary/30 p-3 rounded-xl border border-brand-border/40">
                    <span className="text-sm text-white/90 font-medium flex items-center gap-2">Decrease Size <span className="text-xs text-white/40 font-normal">(Hold Ctrl)</span></span>
                    <span className="bg-white/10 text-white px-3 py-1 rounded-lg text-xs font-bold border border-white/20">Ctrl + -</span>
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
      )}

      {/* Dashboard Empty State */}
      {!isRecording && !showSettings && (
        <div className="flex-1 flex flex-col gap-6 overflow-hidden mt-2 px-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-6 relative overflow-hidden shadow-lg border border-blue-500/30 flex flex-col items-center text-center">
              <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Made by Farhan Khalid</h2>
              <p className="text-blue-100/80 text-sm mb-6 leading-relaxed font-medium">Developer & Engineer<br/><br/>Development driven by real users<br/>Faster iteration on features that matter</p>
              <button onClick={() => { ipcRenderer.invoke('minimize-window'); shell.openExternal('https://farhan-khalid-portfolio.vercel.app/'); }} className="bg-[#FDE047] text-yellow-900 px-6 py-2.5 rounded-full font-bold text-sm shadow-md flex items-center gap-2 hover:bg-yellow-300 transition-colors">🚀 View Portfolio &rarr;</button>
            </div>
            
            <div className="bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl p-6 relative overflow-hidden shadow-lg border border-blue-300/30 flex flex-col justify-center items-center text-center">
              <h2 className="text-xl font-bold text-white mb-4 tracking-tight">Interview Reminders</h2>
              <button 
                onClick={() => {
                  setReminderForm({id: '', name: '', jobTitle: '', email: '', phone: '', date: '', time: ''});
                  setShowReminderPopup(true);
                }} 
                className="bg-white text-blue-600 px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-50 transition-colors flex items-center gap-2 mb-4 shadow-sm w-full justify-center"
              >
                <Plus size={16}/> Create Reminder
              </button>
              <div className="w-full space-y-2 max-h-[120px] overflow-y-auto pr-2 custom-scrollbar">
                {reminderProfiles.length === 0 ? (
                  <p className="text-blue-100/50 text-sm italic py-2">No reminder profiles set.</p>
                ) : reminderProfiles.map(prof => (
                  <div 
                    key={prof.id} 
                    className="bg-blue-900/40 hover:bg-blue-900/60 rounded-xl p-2.5 backdrop-blur-md flex justify-between items-center w-full border border-blue-400/20 group cursor-pointer transition-colors text-left"
                    onClick={() => {
                      setReminderForm(prof);
                      setShowReminderPopup(true);
                    }}
                  >
                    <div className="flex flex-col flex-1 min-w-0 pr-3">
                      <span className="font-bold text-sm text-white truncate">{prof.name}</span>
                      <span className="text-[10px] text-blue-200 truncate">{prof.jobTitle}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px] text-blue-300 font-medium bg-blue-500/20 px-1.5 py-0.5 rounded">{prof.date}</span>
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setReminderProfiles(prev => prev.filter(r => r.id !== prof.id));
                        }} 
                        className="text-blue-300 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity p-1"
                      >
                        <X size={14}/>
                      </button>
                    </div>
                  </div>
                ))}
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
        <div className="flex-1 flex flex-col gap-4 min-h-0">
          <div className={`flex-1 flex gap-4 ${layout === 'horizontal' ? 'flex-row' : 'flex-col'} min-h-0`}>
            {/* Left/Top Panel - Transcript */}
        <div 
          className={`flex flex-col rounded-3xl overflow-hidden transition-all duration-200 ${layout === 'horizontal' ? 'flex-1' : 'h-1/2'}`}
          style={{ 
            backgroundColor: `rgba(24, 24, 27, ${opacity * 0.5})`,
            backdropFilter: opacity < 0.05 ? 'none' : `blur(${opacity * 32}px)`,
            borderColor: `rgba(255, 255, 255, ${opacity * 0.1})`,
            borderWidth: '1px',
            boxShadow: opacity < 0.05 ? 'none' : `0 25px 50px -12px rgba(0, 0, 0, ${opacity * 0.5})`
          }}
        >
          <div 
            className="px-5 py-3.5 flex justify-between items-center border-b transition-all duration-200"
            style={{ 
              backgroundColor: `rgba(255, 255, 255, ${opacity * 0.05})`,
              borderColor: `rgba(255, 255, 255, ${opacity * 0.05})`
            }}
          >
            <span className="text-xs font-bold text-white flex items-center gap-2 drop-shadow-md relative">
              <Mic size={14} className={!isPaused ? "animate-pulse text-cyan-400 drop-shadow-md" : "text-white/50"} />
              Transcript
              {showNoInputError && (
                <span className="absolute left-full ml-3 whitespace-nowrap text-[9px] text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20 animate-pulse font-black uppercase tracking-wider">
                  No text is here! Press key Z or 1
                </span>
              )}
            </span>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-white/50 font-mono font-bold tracking-wider uppercase drop-shadow-sm">
                {!isRecording ? 'READY' : (isGenerating ? 'ANALYZING...' : (isPaused ? 'PAUSED' : 'LISTENING...'))}
              </span>
              <button 
                onClick={() => { 
                  navigator.clipboard.writeText(transcript); 
                  setCopiedTranscript(true);
                  setTimeout(() => setCopiedTranscript(false), 2000);
                }}
                className="text-white/40 hover:text-white transition-colors flex items-center gap-1.5"
               
              >
                {copiedTranscript && <span className="text-xs text-green-400 font-bold animate-in fade-in">Copied!</span>}
                <Copy size={14} className={copiedTranscript ? "text-green-400" : ""} />
              </button>
            </div>
          </div>
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar relative">
            <div 
              className={`w-full px-5 py-4 bg-transparent text-[15px] font-semibold whitespace-pre-wrap cursor-default select-none leading-relaxed drop-shadow-md ${currentSnapshot ? 'min-h-[120px] flex-none' : 'flex-1 h-full'} ${transcriptTextColor === 'black' ? 'text-black' : 'text-white'}`}
            >
              {transcript || <span className={transcriptTextColor === 'black' ? "text-black/50" : "text-white/30"}>Listening to interviewer...</span>}
            </div>
            {currentSnapshot && (
              <div className="px-5 pb-4 flex-1 min-h-[150px] flex flex-col items-center justify-center relative">
                <div className="relative h-full w-full max-h-[250px] rounded-xl overflow-hidden shadow-[0_0_20px_rgba(6,182,212,0.2)] border border-cyan-500/30 bg-black/50 group">
                  <img src={currentSnapshot} alt="Snapshot" className="w-full h-full object-contain" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                    <button onClick={() => setPreviewSnapshot(currentSnapshot)} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-md transition-colors shadow-lg flex items-center gap-2 font-bold text-sm">
                      <Eye size={16} /> Preview
                    </button>
                    <button onClick={() => setCurrentSnapshot(null)} className="px-4 py-2 bg-rose-500/80 hover:bg-rose-500 text-white rounded-xl backdrop-blur-md transition-colors shadow-lg flex items-center gap-2 font-bold text-sm">
                      <Trash2 size={16} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="px-5 py-2 flex gap-2 flex-wrap bg-transparent border-t border-white/5">
            {['Example', 'Types', 'Explain', 'Pros & Cons', 'Difference'].map(keyword => (
               <button 
                  key={keyword}
                  onClick={() => setTranscript(prev => prev ? `${prev} ${keyword}` : keyword)}
                  className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors border border-white/10 shadow-sm"
               >
                  + {keyword}
               </button>
            ))}
          </div>
          <div 
            className="p-3 border-t transition-all duration-200"
            style={{ 
              backgroundColor: `rgba(255, 255, 255, ${opacity * 0.03})`,
              borderColor: `rgba(255, 255, 255, ${opacity * 0.05})`
            }}
          >
             <button 
                onClick={manualTriggerAI}
                disabled={isGenerating}
                className="w-full py-1.5 bg-gradient-to-r from-cyan-500/80 to-blue-500/80 hover:from-cyan-400 hover:to-blue-400 text-white rounded-2xl shadow-[0_0_15px_rgba(6,182,212,0.3)] disabled:opacity-50 disabled:shadow-none transition-all flex flex-col items-center justify-center transform active:scale-95"
             >
                <div className="flex items-center gap-2 font-bold text-xs">
                  {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} fill="currentColor" />}
                  Generate AI Response
                </div>
                <span className="text-[9px] font-medium text-white/90 mt-0.5">Press X or 2</span>
             </button>
          </div>
        </div>

        {/* Right/Bottom Panel - Answer */}
        <div 
          className={`flex flex-col rounded-3xl overflow-hidden transition-all duration-200 ${layout === 'horizontal' ? 'flex-1' : 'h-1/2'}`}
          style={{ 
            backgroundColor: `rgba(24, 24, 27, ${opacity * 0.5})`,
            backdropFilter: opacity < 0.05 ? 'none' : `blur(${opacity * 32}px)`,
            borderColor: `rgba(255, 255, 255, ${opacity * 0.1})`,
            borderWidth: '1px',
            boxShadow: opacity < 0.05 ? 'none' : `0 25px 50px -12px rgba(0, 0, 0, ${opacity * 0.5})`
          }}
        >
          <div 
            className="px-5 py-3.5 border-b flex justify-between items-center transition-all duration-200"
            style={{ 
              backgroundColor: `rgba(255, 255, 255, ${opacity * 0.05})`,
              borderColor: `rgba(255, 255, 255, ${opacity * 0.05})`
            }}
          >
            <span className="text-xs font-bold text-white flex items-center gap-2 drop-shadow-md">
              <Cpu size={14} className="text-fuchsia-400 drop-shadow-md" /> 
              AI Output
              {activeAIInfo && (
                <span className="ml-2 px-2 py-0.5 bg-fuchsia-500/20 text-fuchsia-300 rounded-md text-[10px] uppercase tracking-wider border border-fuchsia-500/30">
                  {activeAIInfo.provider} (Key {activeAIInfo.index})
                </span>
              )}
            </span>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => { 
                  navigator.clipboard.writeText(aiAnswer); 
                  setCopiedAnswer(true);
                  setTimeout(() => setCopiedAnswer(false), 2000);
                }}
                className="text-white/40 hover:text-white transition-colors flex items-center gap-1.5"
               
              >
                {copiedAnswer && <span className="text-xs text-green-400 font-bold animate-in fade-in">Copied!</span>}
                <Copy size={14} className={copiedAnswer ? "text-green-400" : ""} />
              </button>
            </div>
          </div>
          <div className="flex-1 p-5 overflow-y-auto relative custom-scrollbar">
            {aiAnswer ? (
              <div className={`text-[18px] leading-relaxed whitespace-pre-wrap font-semibold drop-shadow-md cursor-default select-none ${transcriptTextColor === 'black' ? 'text-black' : 'text-white'}`}>
                <ReactMarkdown
                  components={{
                    code({node, inline, className, children, ...props}: any) {
                      const match = /language-(\w+)/.exec(className || '')
                      return !inline && match ? (
                        <SyntaxHighlighter
                          {...props}
                          children={String(children).replace(/\n$/, '')}
                          style={vscDarkPlus}
                          language={match[1]}
                          PreTag="div"
                          className="rounded-xl border border-white/10 !bg-[#1e1e1e]/90 backdrop-blur-md !my-4 !p-4 !shadow-xl text-[14px]"
                        />
                      ) : (
                        <code {...props} className={`${className} bg-black/20 rounded px-1.5 py-0.5 text-[15px]`}>
                          {children}
                        </code>
                      )
                    }
                  }}
                >
                  {aiAnswer}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50 text-xs font-bold tracking-wide text-center px-6 drop-shadow-sm">
                <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-fuchsia-400/80 animate-spin mb-3"></div>
                {isGenerating ? 'Drafting response...' : 'Waiting for context...'}
              </div>
            )}
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
                        setCurrentSnapshot(snap.image); 
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

      {/* Stealth Mode Warning Modal (For Starting Interview) */}
      {showStartStealthWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4">
          <div className="relative w-full max-w-md animate-in fade-in zoom-in-95 duration-300">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-rose-500 via-red-500 to-rose-500 rounded-[2rem] blur opacity-40"></div>
            
            <div className="relative bg-[#09090b]/90 border border-red-500/30 rounded-[2rem] w-full overflow-hidden shadow-[0_0_80px_rgba(225,29,72,0.3)]">
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
            <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-accent via-cyan-400 to-brand-accent rounded-[2rem] blur opacity-30"></div>
            
            <div className="relative bg-[#09090b]/90 border border-white/10 rounded-[2rem] w-full overflow-hidden shadow-[0_0_80px_rgba(0,0,0,1)]">
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
              <div>
                <label className="block text-xs font-bold text-brand-subtext uppercase mb-1">Email ID</label>
                <input type="email" placeholder="e.g. user@example.com" className={`w-full bg-black/40 border ${showReminderErrors && (!reminderForm.email || !/^\S+@\S+\.\S+$/.test(reminderForm.email)) ? 'border-rose-500/50' : 'border-brand-border'} rounded-lg p-3 text-sm text-white outline-none focus:border-blue-500 transition-colors`} value={reminderForm.email} onChange={e => setReminderForm({...reminderForm, email: e.target.value})} />
                {showReminderErrors && !reminderForm.email && <p className="text-rose-500 text-[10px] mt-1 font-bold">This field is required.</p>}
                {showReminderErrors && reminderForm.email && !/^\S+@\S+\.\S+$/.test(reminderForm.email) && <p className="text-rose-500 text-[10px] mt-1 font-bold">Please enter a valid email address.</p>}
              </div>
              <div>
                <label className="block text-xs font-bold text-brand-subtext uppercase mb-1">Date</label>
                <input type="text" placeholder="example - DD-MM-YYYY" className={`w-full bg-black/40 border ${showReminderErrors && (!reminderForm.date || !/^\d{2}-\d{2}-\d{4}$/.test(reminderForm.date)) ? 'border-rose-500/50' : 'border-brand-border'} rounded-lg p-3 text-sm text-white outline-none focus:border-blue-500 transition-colors`} value={reminderForm.date} onChange={e => setReminderForm({...reminderForm, date: e.target.value})} />
                {showReminderErrors && !reminderForm.date && <p className="text-rose-500 text-[10px] mt-1 font-bold">This field is required.</p>}
                {showReminderErrors && reminderForm.date && !/^\d{2}-\d{2}-\d{4}$/.test(reminderForm.date) && <p className="text-rose-500 text-[10px] mt-1 font-bold">Please follow the example - DD-MM-YYYY format.</p>}
              </div>
              <div>
                <label className="block text-xs font-bold text-brand-subtext uppercase mb-1">Time</label>
                <input type="text" placeholder="Hour:minute in 24 format" className={`w-full bg-black/40 border ${showReminderErrors && (!reminderForm.time || !/^([01]\d|2[0-3]):[0-5]\d$/.test(reminderForm.time)) ? 'border-rose-500/50' : 'border-brand-border'} rounded-lg p-3 text-sm text-white outline-none focus:border-blue-500 transition-colors`} value={reminderForm.time} onChange={e => setReminderForm({...reminderForm, time: e.target.value})} />
                {showReminderErrors && !reminderForm.time && <p className="text-rose-500 text-[10px] mt-1 font-bold">This field is required.</p>}
                {showReminderErrors && reminderForm.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(reminderForm.time) && <p className="text-rose-500 text-[10px] mt-1 font-bold">Please follow the Hour:minute in 24 format.</p>}
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
                  const timeValid = /^([01]\d|2[0-3]):[0-5]\d$/.test(reminderForm.time);
                  const emailValid = /^\S+@\S+\.\S+$/.test(reminderForm.email);
                  
                  if (!reminderForm.name || !reminderForm.jobTitle || !emailValid || !dateValid || !timeValid) {
                    setShowReminderErrors(true);
                    return;
                  }
                  setShowReminderErrors(false);

                  const templateParams = {
                    to_email: reminderForm.email,
                    job_title: reminderForm.jobTitle,
                    company_name: reminderForm.name,
                    to_name: username,
                    date: reminderForm.date,
                    time: reminderForm.time,
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
                  const timeValid = /^([01]\d|2[0-3]):[0-5]\d$/.test(reminderForm.time);
                  const emailValid = /^\S+@\S+\.\S+$/.test(reminderForm.email);
                  
                  if (!reminderForm.name || !reminderForm.jobTitle || !emailValid || !dateValid || !timeValid) {
                    setShowReminderErrors(true);
                    return;
                  }
                  setShowReminderErrors(false);
                  
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

      {/* Virtual Keyboard Transcript Editor */}
      {showVirtualKeyboard && (
        <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-8 animate-in fade-in duration-200">
          <div className="w-full max-w-4xl bg-brand-secondary border border-brand-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            
            <div className="flex justify-between items-center bg-black/40 px-6 py-4 border-b border-brand-border">
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <FileText size={20} className="text-brand-accent"/> Virtual Keyboard Editor
              </h2>
              <button 
                onClick={() => setShowVirtualKeyboard(false)}
                className="text-white/50 hover:text-white transition-colors bg-white/5 hover:bg-rose-500 rounded-lg px-4 py-2 flex items-center gap-2 text-sm font-bold"
              >
                <X size={16} /> Cut / Close (Esc)
              </button>
            </div>

            <textarea 
              className="w-full h-64 bg-transparent text-white p-6 outline-none resize-none text-lg font-medium leading-relaxed custom-scrollbar placeholder-white/20"
              value={transcript}
              onChange={(e) => {
                const val = e.target.value;
                setTranscript(val);
                finalizedTranscriptRef.current = val;
                interimTranscriptRef.current = '';
                audioDataRef.current = new Float32Array(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  setShowVirtualKeyboard(false);
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setShowVirtualKeyboard(false);
                }
              }}
              placeholder="Start typing..."
              autoFocus
            />

            <div className="bg-black/60 p-6 flex flex-col gap-2 items-center border-t border-brand-border/50 select-none">
              {[
                ['1','2','3','4','5','6','7','8','9','0','-','='],
                ['q','w','e','r','t','y','u','i','o','p','[',']'],
                ['a','s','d','f','g','h','j','k','l',';',"'"],
                ['z','x','c','v','b','n','m',',','.','/']
              ].map((row, i) => (
                <div key={i} className="flex gap-2 w-full justify-center">
                  {row.map(key => (
                    <button 
                      key={key} 
                      onClick={() => {
                        setTranscript(prev => {
                          const val = prev + key;
                          finalizedTranscriptRef.current = val;
                          return val;
                        });
                        interimTranscriptRef.current = '';
                      }}
                      className="w-12 h-12 bg-white/5 hover:bg-white/20 active:bg-white/30 text-white rounded-xl font-bold uppercase text-sm border border-white/5 shadow-sm transition-all flex items-center justify-center"
                    >
                      {key}
                    </button>
                  ))}
                </div>
              ))}
              <div className="flex gap-2 w-full max-w-4xl justify-center mt-2">
                 <button 
                   onClick={() => {
                     setTranscript(prev => {
                       const val = prev.slice(0, -1);
                       finalizedTranscriptRef.current = val;
                       return val;
                     });
                     interimTranscriptRef.current = '';
                   }} 
                   className="px-6 py-3 bg-white/5 hover:bg-rose-500/80 text-white rounded-xl font-bold flex-[1] border border-white/5 transition-all"
                 >
                   Backspace
                 </button>
                 <button 
                   onClick={() => {
                     setTranscript(prev => {
                       const val = prev + '\n';
                       finalizedTranscriptRef.current = val;
                       return val;
                     });
                     interimTranscriptRef.current = '';
                   }} 
                   className="px-6 py-3 bg-white/5 hover:bg-white/20 text-white rounded-xl font-bold flex-[1] border border-white/5 transition-all flex flex-col items-center justify-center gap-0.5 leading-none"
                 >
                   <span>Next Line</span>
                   <span className="text-[10px] opacity-70 font-normal">(Shift)</span>
                 </button>
                 <button 
                   onClick={() => {
                     setTranscript(prev => {
                       const val = prev + ' ';
                       finalizedTranscriptRef.current = val;
                       return val;
                     });
                     interimTranscriptRef.current = '';
                   }} 
                   className="px-6 py-3 bg-white/5 hover:bg-white/20 text-white rounded-xl font-bold flex-[2] border border-white/5 transition-all"
                 >
                   Space
                 </button>
                 <button 
                   onClick={() => setShowVirtualKeyboard(false)} 
                   className="px-6 py-3 bg-brand-accent/20 hover:bg-brand-accent/40 text-brand-accent rounded-xl font-bold flex-[1] border border-brand-accent/30 transition-all flex flex-col items-center justify-center gap-0.5 leading-none"
                 >
                   <span>Enter</span>
                   <span className="text-[10px] opacity-70 font-normal">(Press Enter)</span>
                 </button>
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
      
      {showUsernamePrompt && (
        <div className="fixed inset-0 z-[500] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-8 animate-in fade-in zoom-in duration-200">
          <div className="w-full max-w-sm bg-brand-secondary border border-brand-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
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
    </div>
  );
}

export default App;
