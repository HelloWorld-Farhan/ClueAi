
const fs = require("fs");
const path = "src/App.tsx";
let code = fs.readFileSync(path, "utf-8");
const lines = code.split("\n");

const startStr = "{/* 2. Main Conversation Window */}";
const endStr = "{/* Bottom Snapshot History UI */}";
const startIdx = lines.findIndex(l => l.includes(startStr));
const endIdx = lines.findIndex(l => l.includes(endStr));

if (startIdx === -1 || endIdx === -1) {
    console.error("Could not find boundaries");
    process.exit(1);
}

const newLayout = `            {/* 2. Main Conversation Window */}
            <div 
              className="flex-1 flex flex-col min-h-0 rounded-[2.5rem] overflow-hidden transition-all duration-500 ease-in-out w-full mx-auto relative z-10"
              style={{ 
                backgroundColor: "rgba(24, 24, 27, 0.6)",
                backdropFilter: opacity < 0.05 ? "none" : \`blur(\${opacity * 30}px)\`,
                borderColor: "rgba(255, 255, 255, 0.1)",
                borderWidth: "1px",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
              }}
            >
               {/* Header */}
               <div className="px-8 py-5 flex justify-between items-center border-b border-white/10 bg-black/40 backdrop-blur-md">
                  <div>
                     <h2 className="text-xl font-black text-white tracking-tight drop-shadow-sm">Current Conversation</h2>
                     <p className="text-[11px] font-bold text-white/50 drop-shadow-sm mt-0.5">{currentSessionHistory.length} messages in this conversation</p>
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
                        {isGenerating ? <Loader2 size={16} className="animate-spin" /> : "New Chat"} <ChevronUp size={16} className="opacity-80" />
                     </button>
                  </div>
               </div>

               {/* Keyword Tags (Floating just below header) */}
               <div className="px-8 py-3 flex gap-2 flex-wrap bg-white/[0.02] border-b border-white/5 shadow-inner">
                 {["Example", "Types", "Explain", "Pros & Cons", "Difference"].map(keyword => (
                    <button 
                       key={keyword}
                       onClick={() => setTranscript(prev => prev ? \`\${prev} \${keyword}\` : keyword)}
                       className="px-4 py-1.5 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-full text-[10px] font-black uppercase tracking-wider transition-colors shadow-sm border border-white/10"
                    >
                       + {keyword}
                    </button>
                 ))}
               </div>

               <div className="flex-1 flex flex-col min-h-0">
                 {/* Transcript Area (Top) */}
                 <div className="flex-1 overflow-y-auto custom-scrollbar p-8 flex flex-col gap-6 relative border-b border-white/10 bg-black/20" ref={transcriptScrollRef}>
                    <div className="absolute top-4 left-6 bg-white/10 backdrop-blur-md px-3 py-1 rounded-md border border-white/10 text-[10px] font-black uppercase tracking-[0.1em] text-cyan-400 flex items-center gap-1.5 z-10 shadow-sm">
                      <Mic size={12} /> Transcript Area
                    </div>
                    <div className="mt-8">
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

                      {/* Transcript Text */}
                      <div 
                        className="leading-relaxed whitespace-pre-wrap font-medium text-white/90 drop-shadow-sm px-2"
                        style={{ fontSize: transcriptTextSize + "px" }}
                      >
                         {transcript || <span className="text-white/30 italic">Listening to conversation...</span>}
                      </div>
                    </div>
                 </div>

                 {/* Generate Area (Bottom) */}
                 <div className="flex-[1.5] overflow-y-auto custom-scrollbar p-8 relative bg-black/10" ref={aiAnswerScrollRef}>
                    <div className="absolute top-4 left-6 flex gap-2 z-10">
                      <div className="bg-fuchsia-500/20 backdrop-blur-md px-3 py-1 rounded-md border border-fuchsia-500/30 text-[10px] font-black uppercase tracking-[0.1em] text-fuchsia-300 shadow-sm flex items-center gap-1.5">
                        <Cpu size={12} /> {activeAIInfo ? \`\${activeAIInfo.provider}\` : "Generate Area"}
                      </div>
                      {aiAnswer && <CopyButton text={aiAnswer} className="bg-white/10 hover:bg-white/20 hover:scale-105 backdrop-blur-md px-2 py-1 rounded-md border border-white/10 text-white/60 hover:text-white shadow-sm transition-all" tooltip="Copy Answer" size={12} />}
                    </div>

                    <div className="mt-8">
                      {aiAnswer ? (
                         <div 
                           className="leading-relaxed whitespace-pre-wrap font-semibold text-white drop-shadow-sm px-2"
                           style={{ fontSize: aiAnswerTextSize + "px" }}
                         >
                           <ReactMarkdown
                             components={{
                               code(props: any) {
                                 const {node, className, children, ...rest} = props;
                                 const match = /language-(\w+)/.exec(className || "");
                                 return match ? (
                                   <div className="relative group/code my-6">
                                     <CopyButton 
                                       text={String(children).replace(/\\n$/, "")}
                                       className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg opacity-0 group-hover/code:opacity-100 transition-opacity z-10"
                                       tooltip="Copy code"
                                     />
                                     <SyntaxHighlighter
                                       {...rest}
                                       children={String(children).replace(/\\n$/, "")}
                                       style={vscDarkPlus}
                                       language={match[1]}
                                       PreTag="div"
                                       className="rounded-2xl border border-white/10 !bg-[#1e1e1e]/95 backdrop-blur-md !m-0 !p-6 !shadow-xl text-[14px]"
                                     />
                                   </div>
                                 ) : (
                                   <code {...rest} className={\`\${className || '} bg-white/10 text-fuchsia-300 font-bold rounded-lg px-2 py-1 text-[15px]\`}>
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
`;

const newLines = [
    ...lines.slice(0, startIdx),
    newLayout,
    ...lines.slice(endIdx)
];

fs.writeFileSync(path, newLines.join("\n"));
console.log("Successfully replaced layout");

