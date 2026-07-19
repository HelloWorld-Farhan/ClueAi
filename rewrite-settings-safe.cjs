
const fs = require("fs");
const path = "src/App.tsx";
let code = fs.readFileSync(path, "utf-8");

// 1. Rename Settings Icon to Info Icon in top bar
code = code.replace(
    /title="Settings">\s*<Settings size=\{20\} \/>/g,
    `title="Info & Settings">\\n                       <Info size={20} />`
);

// 2. Restyle the Settings Modal
const startStr = "{/* Full-Screen Settings Modal */}";
const startIdx = code.indexOf(startStr);
if (startIdx === -1) {
    console.error("Bounds not found");
    process.exit(1);
}

// Just replace the wrapper tags using exact string replacements rather than indices
code = code.replace(
    `className="absolute inset-2 z-40 bg-brand-bg/95 backdrop-blur-3xl rounded-2xl border border-brand-border/50 flex flex-col animate-in fade-in duration-200 overflow-hidden shadow-2xl"`,
    `className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-md flex flex-col p-8 animate-in fade-in duration-200"`
);

code = code.replace(
    `className="w-full flex-shrink-0 bg-brand-bg/95 pt-8 pb-4 px-8 border-b border-brand-border"`,
    `className="w-full max-w-5xl mx-auto bg-[#09090b]/80 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col h-full overflow-hidden relative z-10"\\n          ><div className="px-8 py-5 flex justify-between items-center border-b border-white/10 bg-black/40 backdrop-blur-md"`
);

code = code.replace(
    `<h2 className="text-3xl font-black tracking-tight text-white">Settings</h2>`,
    `<h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2 drop-shadow-sm"><Info size={20} className="text-white/60"/> Info & Settings</h2>`
);

code = code.replace(
    `<p className="text-brand-subtext text-sm">Configure your AI model, screen capture, and interview context.</p>`,
    `<p className="text-white/50 text-xs font-medium mt-1">Configure your AI model, screen capture, and Stealth Mode.</p>`
);

code = code.replace(
    `<button onClick={() => setShowSettings(false)} className="bg-brand-secondary hover:bg-brand-border hover:scale-105 active:scale-95 text-brand-text px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2">\\n                    Done <X size={16}/>`,
    `<button onClick={() => setShowSettings(false)} className="text-white/50 hover:text-white p-2 bg-white/5 hover:bg-rose-500 rounded-xl transition-colors shadow-sm border border-transparent hover:border-rose-500/50">\\n                    <X size={20}/>`
);

code = code.replace(
    `<div className="flex-1 overflow-y-auto p-8 custom-scrollbar">`,
    `<div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar bg-black/20">`
);

// Close the extra div for the wrapper
const dashStart = code.indexOf("{/* Dashboard Empty State */}");
if (dashStart === -1) {
    console.error("End Bounds not found");
    process.exit(1);
}

// Find the last </div>\\n        )} before Dashboard Empty State
const settingsBlock = code.slice(startIdx, dashStart);
const lastDivIdx = settingsBlock.lastIndexOf(`</div>\\n        )}`);
if (lastDivIdx !== -1) {
    const before = code.slice(0, startIdx + lastDivIdx);
    const after = code.slice(startIdx + lastDivIdx + 16);
    code = before + `</div></div>\\n        )}` + after;
}

// Also remove keyword tags from main view since they are in history now!
const keywordTagsStr = `{/* Keyword Tags (Floating just below header) */}
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
                 </div>`;
code = code.replace(keywordTagsStr, "");

fs.writeFileSync(path, code);
console.log("Updated Info/Settings Modal Safely!");

