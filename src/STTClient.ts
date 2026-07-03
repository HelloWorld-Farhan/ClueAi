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

export async function transcribeAudioChunk(audioData: Float32Array, resumeText: string = '', personalContext: string = '', interviewTitle: string = ''): Promise<string> {
  if (groqApiKeys.length === 0) return 'ERR: No API Key';
  if (audioData.length === 0) return '';

  try {
    const wavBlob = encodeWAV(audioData, 16000);
    const formData = new FormData();
    formData.append('file', wavBlob, 'audio.wav');
    formData.append('model', 'whisper-large-v3');
    formData.append('temperature', '0'); // Force deterministic output to reduce hallucinations
    // formData.append('language', 'en'); // Remove hardcoded English so it auto-detects Hindi/etc.
    
    // Inject heavy tech jargon and resume context into the STT prompt so it auto-corrects names and technologies!
    const techJargon = "SAP, Fiori, ABAP, OData, AWS, Azure, GCP, React, Node.js, Python, Java, SQL, API, CI/CD, Agile, Developer, Consultant.";
    let promptContext = `${interviewTitle ? interviewTitle + ', ' : ''}${techJargon} Technical job interview transcript. High accuracy.`;
    if (resumeText) promptContext += ` Context: ${resumeText.slice(0, 500)}`;
    if (personalContext) promptContext += ` Personal Info: ${personalContext.slice(0, 300)}`;
    
    formData.append('prompt', promptContext);

    const apiKey = groqApiKeys[currentGroqIndex];
    currentGroqIndex = (currentGroqIndex + 1) % groqApiKeys.length;

    const res = await fetch('https://api.groq.com/openai/v1/audio/translations', {
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
    let text = data.text || '';
    
    // Whisper Hallucination Filter: Whisper often hallucinates these exact phrases on silent audio
    const lowerText = text.toLowerCase().trim();
    if (
      lowerText === 'thank you.' || 
      lowerText === 'thank you' ||
      lowerText === 'subtitle' ||
      lowerText.includes('sampath chitluri') ||
      lowerText.includes('amara.org') ||
      lowerText.includes('subtitles by') ||
      lowerText.includes('edited by') ||
      lowerText === 'you'
    ) {
      return '';
    }

    return text;
  } catch (error: any) {
    console.error('Transcription error:', error);
    return `ERR: ${error.message || error}`;
  }
}
