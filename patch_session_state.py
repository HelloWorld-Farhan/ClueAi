import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update currentSessionHistory state
content = content.replace(
    "const [currentSessionHistory, setCurrentSessionHistory] = useState<{question: string, answer: string, images?: string[]}[]>([]);",
    "const [currentSessionHistory, setCurrentSessionHistory] = useState<{question: string, answer: string, images?: string[], modelInfo?: string}[]>([]);"
)

# 2. Update sessions state
content = content.replace(
    "const [sessions, setSessions] = useState<{id: string, name: string, time: string, transcript: string, aiAnswer: string, date?: string, snapshotHistory?: {id: string, image: string, transcriptContext: string}[]}[]>(() => {",
    "const [sessions, setSessions] = useState<{id: string, name: string, time: string, transcript: string, aiAnswer: string, date?: string, snapshotHistory?: {id: string, image: string, transcriptContext: string}[], history?: {question: string, answer: string, images?: string[], modelInfo?: string}[]}[]>(() => {"
)

# 3. Update currentSessionHistory appending logic
old_append = """        setCurrentSessionHistory(prev => {
          const newHistory = [...prev];
          if (newHistory.length > 0) {
            newHistory[newHistory.length - 1].answer = finalAnswer;
          }
          return newHistory;
        });"""

new_append = """        setCurrentSessionHistory(prev => {
          const newHistory = [...prev];
          if (newHistory.length > 0) {
            newHistory[newHistory.length - 1].answer = finalAnswer;
            newHistory[newHistory.length - 1].modelInfo = currentProviderInfo;
          }
          return newHistory;
        });"""

content = content.replace(old_append, new_append)

# 4. Update saving logic when interview ends
old_save = """        const newSession = {
          id: currentSessionId || Date.now().toString(),
          name: sessionNameInput || 'Untitled Session',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          date: new Date().toLocaleDateString(),
          transcript: finalLog.trim(),
          aiAnswer: '' 
        };
        setSessions(prev => [newSession, ...prev.filter(s => s.id !== newSession.id)]);"""

new_save = """        const newSession = {
          id: currentSessionId || Date.now().toString(),
          name: sessionNameInput || 'Untitled Session',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          date: new Date().toLocaleDateString(),
          transcript: finalLog.trim(),
          aiAnswer: '',
          history: [...currentSessionHistory]
        };
        setSessions(prev => [newSession, ...prev.filter(s => s.id !== newSession.id)]);"""

content = content.replace(old_save, new_save)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated session state logic.")
