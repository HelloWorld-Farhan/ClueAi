
const fs = require("fs");
const path = "src/App.tsx";
let code = fs.readFileSync(path, "utf-8");

const startStr = "{/* Previous Questions Modal */}";
const startIdx = code.indexOf(startStr);

if (startIdx === -1) {
    console.error("Bounds not found");
    process.exit(1);
}

// Find the last </div> before </>
const endIdx = code.lastIndexOf("</>");

if (endIdx === -1) {
    console.error("End Bounds not found");
    process.exit(1);
}

const prefix = code.slice(0, startIdx);
const suffix = code.slice(endIdx);

const newHistoryModal = `{/* Previous Questions Modal */}
      {showPreviousQuestions && (
        <div className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-sm flex flex-col p-8 animate-in fade-in duration-200">
          <div className="w-full max-w-4xl mx-auto bg-[#18181b]/60 backdrop-blur-xl border border-white/10 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col h-full overflow-hidden relative z-10">
            <div className="px-8 py-5 flex justify-between items-center border-b border-white/10 bg-black/40 backdrop-blur-md">
              <h2 className="font-black text-xl text-white tracking-tight flex items-center gap-2 drop-shadow-sm">
                <FileText size={20} className="text-white/60" />
                Previous Questions (Active Session)
              </h2>
              <button onClick={() => setShowPreviousQuestions(false)} className="text-white/50 hover:text-white p-2 bg-white/5 hover:bg-rose-500 rounded-xl transition-colors shadow-sm border border-transparent hover:border-rose-500/50">
                <X size={20} />
              </button>
            </div>

            {/* Keyword Tags inside History */}
            <div className="px-8 py-3 flex gap-2 flex-wrap bg-white/[0.02] border-b border-white/5 shadow-inner">
              <span className="text-xs font-bold text-white/40 flex items-center mr-2 uppercase tracking-wider">Quick Add:</span>
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

            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar bg-black/20">
              {currentSessionHistory.length === 0 ? (
                <div className="text-center text-white/30 font-medium italic mt-10">No questions asked in this session yet.</div>
              ) : currentSessionHistory.map((item, idx) => (
                <div key={idx} className="bg-white/5 border border-white/10 rounded-[1.5rem] p-6 space-y-6 shadow-sm backdrop-blur-sm">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-[11px] font-black text-cyan-400 uppercase tracking-wider flex items-center gap-1.5"><Mic size={14} /> Transcript {idx + 1} (Editable)</h3>
                      <CopyButton text={item.question} className="text-white/40 hover:text-white transition-colors" tooltip="Copy Transcript" />
                    </div>
                    <textarea 
                      className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white/90 text-sm font-medium outline-none focus:border-cyan-500 transition-colors resize-y min-h-[80px]"
                      value={item.question}
                      onChange={(e) => {
                        const newHistory = [...currentSessionHistory];
                        newHistory[idx].question = e.target.value;
                        setCurrentSessionHistory(newHistory);
                      }}
                    />
                    <div className="mt-3 flex justify-end">
                      <button 
                        onClick={() => {
                          setTranscript(item.question);
                          setShowPreviousQuestions(false);
                          setTimeout(() => {
                            if (!isGenerating) manualTriggerAI();
                          }, 100);
                        }}
                        className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-500/30 text-cyan-300 hover:text-cyan-100 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-2"
                      >
                        <Cpu size={14} /> Ask AI Again
                      </button>
                    </div>
                  </div>
                  <div className="pt-6 border-t border-white/10">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-[11px] font-black text-fuchsia-400 uppercase tracking-wider flex items-center gap-1.5"><Cpu size={14} /> AI Answer</h3>
                      <CopyButton text={item.answer} className="text-white/40 hover:text-white transition-colors" tooltip="Copy Answer" />
                    </div>
                    <div className="text-white font-bold text-sm whitespace-pre-wrap leading-relaxed">
                      <ReactMarkdown
                        components={{
                          code(props: any) {
                            const {node, className, children, ...rest} = props;
                            const match = /language-(\\w+)/.exec(className || "");
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
                              <code {...rest} className={\`\${className || ""} bg-white/10 text-fuchsia-300 font-bold rounded-lg px-2 py-1 text-[15px]\`}>
                                {children}
                              </code>
                            );
                          }
                        }}
                      >
                        {item.answer}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      </div>
      `;

fs.writeFileSync(path, prefix + newHistoryModal + suffix);
console.log("Updated History Modal properly!");

