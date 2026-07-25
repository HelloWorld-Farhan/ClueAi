import os
import re

filepath = 'src/App.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add click-through-bg to the h-screen container
content = content.replace(
    '''className="flex flex-col h-screen text-brand-text p-4 font-sans overflow-y-auto overflow-x-hidden rounded-3xl select-none animate-in fade-in duration-1000 delay-[1500ms] fill-mode-both"''',
    '''className="flex flex-col h-screen text-brand-text p-4 font-sans overflow-y-auto overflow-x-hidden rounded-3xl select-none animate-in fade-in duration-1000 delay-[1500ms] fill-mode-both click-through-bg"'''
)

# 2. Add click-through-bg to the w-full h-full isAiFullscreen container
content = content.replace(
    '''className="flex flex-col w-full h-full overflow-hidden rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 duration-200 pointer-events-auto"''',
    '''className="flex flex-col w-full h-full overflow-hidden rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 duration-200 pointer-events-auto click-through-bg"'''
)

# 3. Add click-through-bg to the text panels (there are 2)
content = content.replace(
    '''className="flex-1 flex flex-col min-h-0 bg-black/20 rounded-3xl overflow-hidden border border-white/5 relative"''',
    '''className="flex-1 flex flex-col min-h-0 bg-black/20 rounded-3xl overflow-hidden border border-white/5 relative click-through-bg"'''
)

# 4. Add pointer-events-none to the inner text elements
content = content.replace(
    '''className="whitespace-pre-wrap text-white/90 text-sm font-medium leading-relaxed"''',
    '''className="whitespace-pre-wrap text-white/90 text-sm font-medium leading-relaxed pointer-events-none"'''
)
content = content.replace(
    '''className="text-white/40 italic"''',
    '''className="text-white/40 italic pointer-events-none"'''
)
content = content.replace(
    '''className="text-emerald-400 italic font-bold"''',
    '''className="text-emerald-400 italic font-bold pointer-events-none"'''
)
content = content.replace(
    '''className="prose prose-invert max-w-none text-white/90 text-sm font-medium prose-headings:text-white prose-p:leading-relaxed prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/10 prose-code:text-cyan-300"''',
    '''className="prose prose-invert max-w-none text-white/90 text-sm font-medium prose-headings:text-white prose-p:leading-relaxed prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/10 prose-code:text-cyan-300 pointer-events-none"'''
)


# 5. Global pointermove handler
pointermove_code = '''
  // Stealth Mode click-through handler
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      // Only active during interview
      if (!isAiFullscreen && !isRecording) {
        ipcRenderer.send('set-ignore-mouse-events', false);
        return;
      }
      
      const target = e.target as HTMLElement;
      const shouldPassThrough = target.classList.contains('click-through-bg') || target === document.body || target === document.documentElement || target.id === 'root';
      
      if (shouldPassThrough) {
        ipcRenderer.send('set-ignore-mouse-events', true);
      } else {
        ipcRenderer.send('set-ignore-mouse-events', false);
      }
    };
    window.addEventListener('pointermove', handlePointerMove);
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, [isAiFullscreen, isRecording]);
'''
if "handlePointerMove" not in content:
    # Insert it right before the window resize effect
    content = content.replace("useEffect(() => {", pointermove_code + "\n  useEffect(() => {", 1)


# 6. manualTriggerAI fixes
old_set_log = '''setSessionLog(prev => prev + \\n\\n--- QUESTION ---\\n\\n\\n--- AI ANSWER ---\\n[MODEL:]\\n\\n\\n);'''
new_set_log = '''const imagesLog = snaps.map(img => [IMAGE_BASE64:]).join('\\n');
        setSessionLog(prev => prev + \\n\\n--- QUESTION ---\\n\\n\\n--- AI ANSWER ---\\n[MODEL:]\\n\\n\\n);'''
content = content.replace(old_set_log, new_set_log)

# 7. Add history: [...currentSessionHistory] to stopRecording
old_new_session = '''const newSession = {
            id: currentSessionId || Date.now().toString(),
            name: sessionNameInput || 'Untitled Session',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            date: new Date().toLocaleDateString(),
            transcript: finalLog.trim(),
            aiAnswer: '' 
          };'''
new_new_session = '''const newSession = {
            id: currentSessionId || Date.now().toString(),
            name: sessionNameInput || 'Untitled Session',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            date: new Date().toLocaleDateString(),
            transcript: finalLog.trim(),
            aiAnswer: '',
            history: [...currentSessionHistory]
          };'''
content = content.replace(old_new_session, new_new_session)


# 8. Fix exportSession
old_export_vars = '''let currentBlockType = ''; // 'question', 'answer'
      let currentBlockContent = '';
      let currentImage = '';
      let currentModelInfo = '';'''

new_export_vars = '''let currentBlockType = ''; // 'question', 'answer'
      let currentBlockContent = '';
      let currentImages: string[] = [];
      let currentModelInfo = '';'''
content = content.replace(old_export_vars, new_export_vars)

old_close_block = '''if (currentBlockType === 'question') {
          htmlContent += <div class="block"><div class="question"><div class="question-label">Question context</div>;
          if (currentImage) htmlContent += <img src="" class="snapshot" />;
          htmlContent += <div class="text-content"></div></div>;'''

new_close_block = '''if (currentBlockType === 'question') {
          htmlContent += <div class="block"><div class="question"><div class="question-label">Question context</div>;
          currentImages.forEach(img => {
            if (img) htmlContent += <img src="" class="snapshot" />;
          });
          htmlContent += <div class="text-content"></div></div>;'''
content = content.replace(old_close_block, new_close_block)

old_clear_vars = '''currentBlockContent = '';
        currentImage = '';
        currentModelInfo = '';
        currentBlockType = '';'''
new_clear_vars = '''currentBlockContent = '';
        currentImages = [];
        currentModelInfo = '';
        currentBlockType = '';'''
content = content.replace(old_clear_vars, new_clear_vars)

old_parse_img = '''if (line.includes('[IMAGE_BASE64:')) {
          currentImage = line.match(/\\[IMAGE_BASE64:(.*?)\\]/)?.[1] || '';
        } else if (line.includes('[MODEL:')) {'''
new_parse_img = '''if (line.includes('[IMAGE_BASE64:')) {
          const matched = line.match(/\\[IMAGE_BASE64:(.*?)\\]/)?.[1];
          if (matched) currentImages.push(matched);
        } else if (line.includes('[MODEL:')) {'''
content = content.replace(old_parse_img, new_parse_img)


with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated App.tsx successfully")
