import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

state_inject = """  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [expandedHistoryItems, setExpandedHistoryItems] = useState<Record<string, {transcript: boolean, answer: boolean}>>({});
  
  const toggleHistoryItem = (sessionId: string, idx: number, type: 'transcript' | 'answer') => {
    const key = `${sessionId}-${idx}`;
    setExpandedHistoryItems(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || {transcript: false, answer: false}),
        [type]: !(prev[key]?.[type])
      }
    }));
  };
"""

content = content.replace("const [sessions, setSessions] = useState", state_inject + "  const [sessions, setSessions] = useState")

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Successfully injected state variables.")
