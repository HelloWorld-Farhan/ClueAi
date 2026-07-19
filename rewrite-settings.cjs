
const fs = require("fs");
const path = "src/App.tsx";
let code = fs.readFileSync(path, "utf-8");

// 1. Rename Settings Icon to Info Icon in top bar
// Find the exact line in top bar:
// <button onClick={() => setShowSettings(true)} className="w-11 h-11 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 transition-colors text-white shadow-sm" title="Settings">
// <Settings size={20} />
// </button>
code = code.replace(
    /title="Settings">\s*<Settings size=\{20\} \/>/g,
    `title="Info">\\n                       <Info size={20} />`
);

// 2. Restyle the Settings Modal
const startStr = "{/* Full-Screen Settings Modal */}";
const endStr = "{/* Dashboard Empty State */}";

const startIdx = code.indexOf(startStr);
const endIdx = code.indexOf(endStr);

if (startIdx === -1 || endIdx === -1) {
    console.error("Bounds not found");
    process.exit(1);
}

const prefix = code.slice(0, startIdx);
const suffix = code.slice(endIdx);

// Note: I will keep the existing form elements but just replace the wrapper classes to match the dark glassy look.
const originalSettingsBlock = code.slice(startIdx, endIdx);

let newSettingsBlock = originalSettingsBlock
    .replace(
        `className="absolute inset-2 z-40 bg-brand-bg/95 backdrop-blur-3xl rounded-2xl border border-brand-border/50 flex flex-col animate-in fade-in duration-200 overflow-hidden shadow-2xl"`,
        `className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex flex-col p-8 animate-in fade-in duration-200"\\n          ><div className="w-full max-w-5xl mx-auto bg-[#18181b]/60 backdrop-blur-xl border border-white/10 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col h-full overflow-hidden relative z-10"`
    )
    .replace(
        `className="w-full flex-shrink-0 bg-brand-bg/95 pt-8 pb-4 px-8 border-b border-brand-border"`,
        `className="px-8 py-5 flex justify-between items-center border-b border-white/10 bg-black/40 backdrop-blur-md"`
    )
    .replace(
        `<h2 className="text-3xl font-black tracking-tight text-white">Settings</h2>`,
        `<h2 className="text-xl font-black text-white tracking-tight drop-shadow-sm flex items-center gap-2"><Info size={20} className="text-white/60"/> Info & Settings</h2>`
    )
    .replace(
        `<div className="flex-1 overflow-y-auto p-8 custom-scrollbar">`,
        `<div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar bg-black/20">`
    )
    // Adjust inner card backgrounds
    .replace(/bg-brand-card/g, "bg-white/5 backdrop-blur-sm")
    .replace(/border-brand-border/g, "border-white/10")
    .replace(/text-brand-subtext/g, "text-white/60")
    .replace(/text-brand-text/g, "text-white/90")
    .replace(/bg-brand-secondary/g, "bg-white/10")
    .replace(/bg-brand-bg/g, "bg-black/40")
    .replace(/text-brand-accentSec/g, "text-white")
    .replace(/text-brand-accent/g, "text-cyan-400");

// We need to close the extra div we added for the dark glassy container
// The original ended with:
//         )}
//   
//         {/* Dashboard Empty State */}
// We replace the last </div>\\n        )} with </div></div>\\n        )}
newSettingsBlock = newSettingsBlock.replace(
    /<\/div>\s*\)\}/g,
    `</div>\\n          </div>\\n        )}`
);

fs.writeFileSync(path, prefix + newSettingsBlock + suffix);
console.log("Updated Info/Settings Modal!");

