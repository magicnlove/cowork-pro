/**
 * UTF-8 header patch for expand-recurring-starts.ts (ASCII-only source file).
 */
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "src", "lib", "expand-recurring-starts.ts");
let s = fs.readFileSync(file, "utf8");
const h =
  "/**\n" +
  " * \uBC18\uBCF5 \uC77C\uC815\uC758 \uAC01 \uC778\uC2A4\uD134\uC2A4 \uC2DC\uC791 \uC2DC\uAC01(Date) \uBAA9\uB85D\uC744 \uACC4\uC0B0\uD55C\uB2E4.\n" +
  " * POST\uB294 recurrenceDays\uAC00 number[], DB/\uB2E8\uAC74 \uC870\uD68C\uB294 \"1,2,3\" \uD615\uD0DC \uBB38\uC790\uC5F4\uC77C \uC218 \uC788\uB2E4.\n" +
  " */\n\n";
s = s.replace(/^\/\*\*[\s\S]*?\*\/\n\n/, h);
fs.writeFileSync(file, s, "utf8");
