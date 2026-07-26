import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add states at the top
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

new_map = """              <div className="space-y-3">
                {sessions.length === 0 ? (
                  <div className="text-brand-subtext text-sm italic px-2 py-4">No sessions saved yet. Start capturing to see history here!</div>
                ) : sessions.map((session) => (
                  <div key={session.id} className="flex flex-col bg-brand-secondary/30 rounded-xl transition-colors border border-brand-border group relative overflow-hidden">
                    <div 
                      className="flex justify-between items-center py-3 px-4 hover:bg-brand-secondary/80 cursor-pointer"
                      onClick={() => setExpandedSessionId(expandedSessionId === session.id ? null : session.id)}
                    >
                      {editingSessionId === session.id ? (
                        <input 
                          type="text" 
                          value={editingSessionName}
                          onChange={(e) => setEditingSessionName(e.target.value)}
                          onBlur={() => handleRenameSession(session.id)}
                          onKeyDown={(e) => e.key === 'Enter' && handleRenameSession(session.id)}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                          className="bg-[#090909] text-white px-2 py-1 rounded-md text-sm border border-brand-accent outline-none flex-1 mr-4"
                        />
                      ) : (
                        <div className="flex items-center gap-3">
                          {expandedSessionId === session.id ? <ChevronDown size={16} className="text-brand-subtext"/> : <ChevronRight size={16} className="text-brand-subtext"/>}
                          <span className="text-brand-text font-bold text-sm truncate">{session.name}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-6 text-brand-subtext text-xs font-mono shrink-0">
                        <span>{session.time}</span>
                        <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === session.id ? null : session.id); }} className="p-1 hover:bg-white/10 rounded-md transition-colors">
                          <MoreVertical size={16} />
                        </button>
                      </div>
                      
                      {openMenuId === session.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); }}></div>
                          <div className="absolute right-4 top-10 bg-brand-secondary border border-brand-border rounded-lg shadow-xl z-50 overflow-hidden min-w-[120px]">
                            <button onClick={(e) => { e.stopPropagation(); setEditingSessionId(session.id); setEditingSessionName(session.name); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 text-sm text-brand-text hover:bg-brand-accentSec flex items-center gap-2 transition-colors">
                              <FileText size={14} /> Rename
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); exportSession(session); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 text-sm text-brand-text hover:bg-brand-accentSec flex items-center gap-2 transition-colors border-t border-brand-border">
                              <Download size={14} /> Export
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); deleteSession(session.id); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 text-sm text-rose-400 hover:bg-rose-500 hover:text-white flex items-center gap-2 transition-colors border-t border-brand-border">
                              <Trash2 size={14} /> Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                    
                    {/* Expanded Session History Accordion */}
                    {expandedSessionId === session.id && (
                      <div className="border-t border-brand-border bg-black/40 p-4 space-y-4">
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
                                  {isTranscriptExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
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
                                  {isAnswerExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                                  Answer of {idx + 1} - Generate Ai
                                </h4>
                              </div>
                              
                              {/* Answer Body */}
                              {isAnswerExpanded && (
                                <div className="p-4 text-xs text-white/90 border-t border-white/5 bg-black/50 overflow-x-auto">
                                  <ReactMarkdown 
                                    components={{
                                      code({node, inline, className, children, ...props}: any) {
                                        const match = /language-(\w+)/.exec(className || '');
                                        return !inline && match ? (
                                          <SyntaxHighlighter
                                            style={vscDarkPlus as any}
                                            language={match[1]}
                                            PreTag="div"
                                            {...props}
                                          >
                                            {String(children).replace(/\\n$/, '')}
                                          </SyntaxHighlighter>
                                        ) : (
                                          <code className="bg-brand-secondary/80 text-brand-accent px-1.5 py-0.5 rounded text-[11px]" {...props}>
                                            {children}
                                          </code>
                                        )
                                      }
                                    }}
                                  >
                                    {item.answer || "No answer generated"}
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
              </div>"""

start_str = '<div className="space-y-1">\n                {sessions.length === 0 ? ('
end_str = '                  </div>\n                ))}\n              </div>'

start_idx = content.find(start_str)
end_idx = content.find(end_str, start_idx) + len(end_str)

if start_idx != -1 and end_idx != -1:
    new_content = content[:start_idx] + new_map + content[end_idx:]
    with open('src/App.tsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Successfully replaced block.")
else:
    print("Failed to find block.")
