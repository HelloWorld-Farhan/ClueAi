
const fs = require("fs");
const path = "src/App.tsx";
let code = fs.readFileSync(path, "utf-8");
const lines = code.split("\n");

// 1. Remove transcriptTextColor
const tIdx = lines.findIndex(l => l.includes("const [transcriptTextColor"));
if (tIdx !== -1) lines[tIdx] = "";

// 2. Add CopyButton component at the top after formatTimer
const copyButtonCode = `const CopyButton = ({ text, className, tooltip, size = 14 }: { text: string, className?: string, tooltip?: string, size?: number }) => {
  const [copied, setCopied] = useState(false);
  const [empty, setEmpty] = useState(false);
  
  const handleCopy = () => {
    if (!text || text.trim() === "") {
      setEmpty(true);
      setTimeout(() => setEmpty(false), 2000);
      return;
    }
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className="flex items-center gap-2">
      {copied && <span className="text-green-500 text-[10px] font-bold animate-pulse">Copied!</span>}
      {empty && <span className="text-rose-500 text-[10px] font-bold animate-pulse">No Text</span>}
      <button 
        onClick={handleCopy}
        className={className}
        title={tooltip}
      >
        <FileText size={size} />
      </button>
    </div>
  );
};`;

const insertIdx = lines.findIndex(l => l.includes("const formatTimer"));
if (insertIdx !== -1) {
    lines.splice(insertIdx, 0, copyButtonCode);
}

// Write it out
fs.writeFileSync(path, lines.join("\n"));
console.log("Fixed state and added CopyButton component");

