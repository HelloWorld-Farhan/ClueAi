
const fs = require("fs");
const path = "src/App.tsx";
let code = fs.readFileSync(path, "utf-8");

// 1. Change top bar text to include transcript and truncate
code = code.replace(
    `<span className="tracking-wide">{!isRecording ? "Ask me anything..." : (isGenerating ? "Drafting response..." : (isPaused ? "Paused..." : "Listening to conversation..."))}</span>`,
    `<span className="tracking-wide truncate block max-w-xl">{!isRecording ? "Ask me anything..." : (isGenerating ? "Drafting response..." : (isPaused ? "Paused..." : (transcript ? transcript : "Listening to conversation...")))}</span>`
);

// 2. Change "Current Conversation" to "Current Answer"
code = code.replace(
    `<h2 className="text-xl font-black text-white tracking-tight drop-shadow-sm">Current Conversation</h2>`,
    `<h2 className="text-xl font-black text-white tracking-tight drop-shadow-sm">Current Answer</h2>`
);

// 3. Remove Transcript Area block completely and move Snapshots down
const lines = code.split("\\n");
const tStart = lines.findIndex(l => l.includes("{/* Transcript Area (Top) */}"));
const tEnd = lines.findIndex(l => l.includes("{/* Generate Area (Bottom) */}"));

if (tStart !== -1 && tEnd !== -1) {
    // Extract snapshots code
    const snapStart = lines.findIndex(l => l.includes("{/* Snapshots inserted inline if any */}"));
    const snapEnd = lines.findIndex(l => l.includes("{/* Transcript Text */}"));
    
    let snapshotsCode = [];
    if (snapStart !== -1 && snapEnd !== -1) {
        snapshotsCode = lines.slice(snapStart, snapEnd);
    }

    // Now replace everything from tStart to the end of flex container with just the Generate Area
    lines.splice(tStart, tEnd - tStart);
    
    // Find where Generate Area starts now
    const gStart = lines.findIndex(l => l.includes("{/* Generate Area (Bottom) */}"));
    if (gStart !== -1) {
        lines[gStart + 1] = lines[gStart + 1].replace("flex-[1.5]", "flex-1");
        
        // Insert snapshots code inside Generate Area, right after the Generate Area label
        const aiAnswerStart = lines.findIndex(l => l.includes("<div className=\\"mt-8\\">"));
        if (aiAnswerStart !== -1 && snapshotsCode.length > 0) {
            lines.splice(aiAnswerStart + 1, 0, ...snapshotsCode);
        }
    }
}
code = lines.join("\\n");
fs.writeFileSync(path, code);
console.log("UI updated completely!");

