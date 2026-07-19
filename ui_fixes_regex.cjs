
const fs = require("fs");
const path = "src/App.tsx";
let code = fs.readFileSync(path, "utf-8");

// 1. Rename Current Answer to AI Answer
code = code.replace(
    /<h2 className="text-xl font-black text-white tracking-tight drop-shadow-sm">Current Answer<\/h2>/g,
    `<h2 className="text-xl font-black text-white tracking-tight drop-shadow-sm">AI Answer</h2>`
);

// 2. Add Generate Answer button and change New Chat behavior
// We will replace the entire button that contains "New Chat"
code = code.replace(
    /<button[^>]*onClick=\{\(\) => \{ if \(\!isGenerating\) manualTriggerAI\(\); \}\}[^>]*>\s*\{isGenerating \? <Loader2 size=\{16\} className="animate-spin" \/> : "New Chat"\} <ChevronUp size=\{16\} className="opacity-80" \/>\s*<\/button>/g,
    `<button 
        onClick={() => {
          setTranscript("");
          setAiAnswer("");
          setCurrentSessionHistory([]);
        }} 
        className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-[13px] font-bold rounded-[1rem] transition-colors border border-white/10 shadow-sm"
        title="Start New Chat"
     >
       New Chat
     </button>
     <button 
        onClick={() => { if (!isGenerating) manualTriggerAI(); }} 
        className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white text-[13px] font-bold rounded-[1rem] flex items-center gap-2 transition-all active:scale-95 shadow-[0_0_15px_rgba(6,182,212,0.3)] tracking-wide border border-cyan-400/50"
        title="Generate Answer (Shortcut: 2)"
     >
       {isGenerating ? <Loader2 size={16} className="animate-spin" /> : "Generate Answer"} <ChevronUp size={16} className="opacity-80" />
     </button>`
);

// 3. Remove keyword tags entirely (just comment it out via regex or replace)
const tagsRegex = /\{\/\* Keyword Tags \(Floating just below header\) \*\/\}\s*<div className="px-8 py-3 flex gap-2 flex-wrap bg-white\/\[0\.02\] border-b border-white\/5 shadow-inner">[\s\S]*?<\/div>/;
code = code.replace(tagsRegex, "");

fs.writeFileSync(path, code);
console.log("Updated UI changes successfully using regex!");

