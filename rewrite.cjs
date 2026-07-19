
const fs = require("fs");
const path = "src/App.tsx";
let code = fs.readFileSync(path, "utf-8");
const lines = code.split("\n");

const startIdx = lines.findIndex(l => l.includes("{/* Main UI */}"));
const endIdx = lines.findIndex(l => l.includes("{/* Bottom Snapshot History UI */}"));

if (startIdx === -1 || endIdx === -1) {
    console.error("Could not find boundaries");
    process.exit(1);
}

const newLayout = `      {/* Main UI */}
        {isRecording && (
          <div className="flex-1 flex flex-col gap-6 min-h-0 relative">
            {/* 1. Top Toolbar (The "Floating Pill") */}
            <div className="flex items-center justify-between bg-[#09090b]/90 backdrop-blur-md rounded-[2rem] px-4 py-2.5 border border-white/10 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] shrink-0 w-full mx-auto relative z-20">
               {/* Left: Mic / Pause */}
               <button onClick={togglePause} className="flex items-center justify-center w-11 h-11 rounded-full bg-white/5 hover:bg-white/10 transition-colors shadow-inner">
                  <Mic size={20} className={!isPaused ? "animate-pulse text-cyan-400 drop-shadow-md" : "text-white/50"} />
               </button>

               {/* Center: Fake Search Bar / Status */}
               <div className="flex-1 mx-6 relative group max-w-2xl">
                  <div className="w-full bg-[#18181b] border border-white/10 rounded-full py-3 px-6 text-[13px] text-white/50 font-semibold flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors shadow-inner">
                     <span className="tracking-wide">{!isRecording ? "Ask me anything..." : (isGenerating ? "Drafting response..." : (isPaused ? "Paused..." : "Listening to conversation..."))}</span>
                     <div className="flex items-center gap-3">
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
                  <button onClick={() => setShowPreviousQuestions(true)} className="w-11 h-11 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 transition-colors text-white shadow-sm" title="History">
                     <Clock size={20} />
                  </button>
                  <button onClick={() => setShowSettings(true)} className="w-11 h-11 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 transition-colors text-white shadow-sm" title="Settings">
                     <Settings size={20} />
                  </button>
               </div>
            </div>

            {/* 2. Main Conversation Window */}
            <div 
              className="flex-1 flex flex-col min-h-0 rounded-[2.5rem] overflow-hidden transition-all duration-500 ease-in-out w-full mx-auto relative z-10"
              style={{ 
                backgroundColor: "rgba(255, 255, 255, 0.4)",
                backdropFilter: opacity < 0.05 ? "none" : \`blur(\${opacity * 40}px)\`,
                borderColor: "rgba(255, 255, 255, 0.5)",
                borderWidth: "1px",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)"
              }}
            >
               {/* Header */}
               <div className="px-8 py-5 flex justify-between items-center border-b border-black/5 bg-white/30 backdrop-blur-md">
                  <div>
                     <h2 className="text-xl font-black text-black tracking-tight drop-shadow-sm">Current Conversation</h2>
                     <p className="text-[11px] font-bold text-black/60 drop-shadow-sm mt-0.5">{currentSessionHistory.length} messages in this conversation</p>
                  </div>
                  <div className="flex items-center gap-4">
                     <div className="flex items-center gap-1 bg-black/5 rounded-xl p-1 border border-black/5 shrink-0 shadow-inner">
                        <button onClick={() => {
                          const next = Math.max(10, transcriptTextSize - 1);
                          setTranscriptTextSize(next);
                          setAiAnswerTextSize(next);
                        }} className="px-2 py-1.5 hover:bg-black/10 rounded-lg text-black/60 hover:text-black transition-colors font-black text-xs" title="Decrease Text Size">A-</button>
                        <span className="text-[11px] text-black/60 font-mono w-4 text-center select-none font-black">{transcriptTextSize}</span>
                        <button onClick={() => {
                          const next = Math.min(40, transcriptTextSize + 1);
                          setTranscriptTextSize(next);
                          setAiAnswerTextSize(next);
                        }} className="px-2 py-1.5 hover:bg-black/10 rounded-lg text-black/60 hover:text-black transition-colors font-black text-xs" title="Increase Text Size">A+</button>
                     </div>
                     <button onClick={() => { if (!isGenerating) manualTriggerAI(); }} className="px-5 py-2.5 bg-[#09090b] hover:bg-black text-white text-[13px] font-bold rounded-[1rem] flex items-center gap-2 transition-all active:scale-95 shadow-xl hover:shadow-2xl tracking-wide">
                        {isGenerating ? <Loader2 size={16} className="animate-spin" /> : "New Chat"} <ChevronUp size={16} className="opacity-80" />
                     </button>
                  </div>
               </div>

               {/* Keyword Tags (Floating just below header) */}
               <div className="px-8 py-4 flex gap-2 flex-wrap bg-black/[0.02] border-b border-black/5 shadow-inner">
                 {["Example", "Types", "Explain", "Pros & Cons", "Difference"].map(keyword => (
                    <button 
                       key={keyword}
                       onClick={() => setTranscript(prev => prev ? \`\${prev} \${keyword}\` : keyword)}
                       className="px-4 py-2 bg-black/10 hover:bg-black/20 text-black/80 hover:text-black rounded-full text-[10px] font-black uppercase tracking-wider transition-colors shadow-sm"
                    >
                       + {keyword}
                    </button>
                 ))}
               </div>

               {/* Scrolling Body containing Transcript and Answer */}
               <div className="flex-1 overflow-y-auto custom-scrollbar p-10 flex flex-col gap-12 scroll-smooth relative" ref={transcriptScrollRef}>
                  
                  {/* Snapshots inserted inline if any */}
                  {currentSnapshots.length > 0 && (
                    <div className="flex-none min-h-[140px] max-h-[200px] flex gap-4 overflow-x-auto custom-scrollbar relative items-center pb-2">
                      {currentSnapshots.map((snap, idx) => (
                        <div key={idx} className="relative h-[140px] aspect-video rounded-[1.5rem] overflow-hidden shadow-lg border border-black/10 bg-black/50 group shrink-0">
                          <img src={snap} alt="Snapshot" className="w-full h-full object-contain" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                            <button onClick={() => setPreviewSnapshot(snap)} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-md transition-colors shadow-lg flex items-center gap-2 font-bold text-xs">
                              <Eye size={14} /> Preview
                            </button>
                            <button onClick={() => setCurrentSnapshots(prev => prev.filter((_, i) => i !== idx))} className="px-4 py-2 bg-rose-500/80 hover:bg-rose-500 text-white rounded-xl backdrop-blur-md transition-colors shadow-lg flex items-center gap-2 font-bold text-xs">
                              <Trash2 size={14} /> Remove
                            </button>
                          </div>
                        </div>
                      ))}
                      {currentSnapshots.length > 1 && (
                        <button onClick={() => setCurrentSnapshots([])} className="h-[140px] aspect-square rounded-[1.5rem] bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-500 transition-colors flex flex-col items-center justify-center gap-2 shrink-0">
                          <Trash2 size={24} />
                          <span className="text-xs font-bold uppercase tracking-wider">Clear</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Transcript Section */}
                  <div 
                    className="leading-relaxed whitespace-pre-wrap font-medium text-black/90 drop-shadow-sm px-2"
                    style={{ fontSize: transcriptTextSize + "px" }}
                  >
                     {transcript || <span className="text-black/40 italic">Listening to conversation...</span>}
                  </div>
                  
                  {/* AI Answer Section */}
                  {aiAnswer ? (
                     <div 
                       className="leading-relaxed whitespace-pre-wrap font-bold text-black border-t-2 border-black/10 pt-12 mt-auto drop-shadow-sm relative px-2"
                       style={{ fontSize: aiAnswerTextSize + "px" }}
                       ref={aiAnswerScrollRef}
                     >
                       {/* Context indicator */}
                       <div className="absolute -top-[15px] left-4 bg-white/90 backdrop-blur-md px-4 py-1.5 rounded-full border border-black/10 text-[10px] font-black uppercase tracking-[0.2em] text-fuchsia-600 shadow-sm flex items-center gap-1.5">
                         <Cpu size={12} /> {activeAIInfo ? \`\${activeAIInfo.provider}\` : "AI Output"}
                       </div>
                       
                       <ReactMarkdown
                         components={{
                           code({node, inline, className, children, ...props}) {
                             const match = /language-(\w+)/.exec(className || "");
                             return !inline && match ? (
                               <div className="relative group/code my-6">
                                 <SyntaxHighlighter
                                   {...props}
                                   children={String(children).replace(/\\n$/, "")}
                                   style={vscDarkPlus}
                                   language={match[1]}
                                   PreTag="div"
                                   className="rounded-2xl border border-black/10 !bg-[#1e1e1e]/95 backdrop-blur-md !m-0 !p-6 !shadow-xl text-[14px]"
                                 />
                               </div>
                             ) : (
                               <code {...props} className={\`\${className} bg-black/10 text-black font-bold rounded-lg px-2 py-1 text-[15px]\`}>
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
                    isGenerating && (
                      <div className="flex flex-col items-center justify-center text-black/50 text-xs font-bold tracking-wide mt-10 p-12 border-t-2 border-black/10 border-dashed rounded-[2rem] bg-black/[0.02]">
                        <div className="w-10 h-10 rounded-full border-2 border-black/10 border-t-black animate-spin mb-4"></div>
                        Drafting response...
                      </div>
                    )
                  )}
               </div>
            </div>`;

const newLines = [
    ...lines.slice(0, startIdx),
    newLayout,
    ...lines.slice(endIdx)
];

fs.writeFileSync(path, newLines.join("\n"));
console.log("Successfully replaced layout");

