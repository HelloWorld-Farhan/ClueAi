
const fs = require("fs");
const path = "src/App.tsx";
let code = fs.readFileSync(path, "utf-8");
code = code.replace("z-10\"\\n          ><div", "z-10\">\\n          <div");
fs.writeFileSync(path, code);

