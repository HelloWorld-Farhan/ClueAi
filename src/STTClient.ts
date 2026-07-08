let groqApiKeys: string[] = [];
let currentGroqIndex = 0;

export async function initSTT(onProgress: (info: any) => void) {
  // We no longer need to download a heavy local model!
  // We will use Groq's lightning-fast Whisper API for free.
  onProgress({ status: 'done' });
  return true;
}

export function setSTTApiKey(keys: string[]) {
  groqApiKeys = keys;
  currentGroqIndex = 0;
}

function encodeWAV(samples: Float32Array, sampleRate: number = 16000) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  
  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);
  
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  
  return new Blob([buffer], { type: 'audio/wav' });
}

export async function transcribeAudioChunk(audioData: Float32Array, contextText: string = ''): Promise<string> {
  if (groqApiKeys.length === 0) return 'ERR: No API Key';
  if (audioData.length === 0) return '';

  try {
    const wavBlob = encodeWAV(audioData, 16000);
    const formData = new FormData();
    formData.append('file', wavBlob, 'audio.wav');
    formData.append('model', 'whisper-large-v3');
    formData.append('language', 'en'); 
    formData.append('temperature', '0.0');
    
    // Build a targeted prompt using standard jargon ONLY, no sentences or periods to prevent Whisper prompt-leaking!
    let promptString = "SAP, ABAP, OData, ALV, RAP, CDS, REST API, Fiori, BAPI, SQL, Java, Python, Developer, Consultant, Data Dictionary, Transparent Table, Pool Table";
    if (contextText) {
      // Add context as comma-separated words to prevent sentence hallucination
      const cleanContext = contextText.replace(/[^a-zA-Z0-9 ]/g, ' ').slice(0, 100).trim().split(/\s+/).join(', ');
      promptString += ", " + cleanContext;
    }
    
    formData.append('prompt', promptString);


    const apiKey = groqApiKeys[currentGroqIndex];
    currentGroqIndex = (currentGroqIndex + 1) % groqApiKeys.length;

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`
      },
      body: formData
    });

    if (!res.ok) {
       const errText = await res.text();
       return `ERR: ${res.status} ${errText}`;
    }

    const data = await res.json();
    let text = (data.text || '').trim();
    
    // Hallucination Filter
    const lowerText = text.toLowerCase();
    const hallucinations = [
      "thanks for watching", 
      "thank you for watching", 
      "please subscribe",
      "amira", 
      "mbc",
      "bbc",
      "you can support the channel",
      "transcribed by",
      "subtitles by",
      "captions by"
    ];
    
    // Check if the entire string matches a known hallucination
    if (hallucinations.some(h => lowerText.includes(h)) && text.length < 50) {
      console.log(`[STT Filter] Blocked hallucination: "${text}"`);
      return '';
    }

    // Check for purely non-alphanumeric or bracketed/asterisk hallucinations (e.g. *sigh*, [music])
    if (/^[\*\(\[].*[\*\)\]]$/.test(text) || !/[a-zA-Z0-9]/.test(text)) {
      console.log(`[STT Filter] Blocked noise/bracket: "${text}"`);
      return '';
    }
    
    // If it's a single word and very short, it's often a hallucination when surrounded by silence
    if (text.split(/\s+/).length === 1 && text.length < 4 && !/^[A-Z]+$/.test(text)) {
      console.log(`[STT Filter] Blocked short fragment: "${text}"`);
      return '';
    }

    return text;
  } catch (error: any) {
    console.error('Transcription error:', error);
    return `ERR: ${error.message || error}`;
  }
}
