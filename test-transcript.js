const watcher = require('./src/core/watcher');

const line = `{"step_index":1811,"source":"MODEL","type":"PLANNER_RESPONSE","status":"DONE","created_at":"2026-06-05T06:23:37Z","thinking":"...","tool_calls":[{"name":"view_file","args":{"AbsolutePath":"\\"/home/nhien36hk/...\\"","toolAction":"\\"Viewing task 1790 log\\"","toolSummary":"\\"View task 1790\\""}}]}`;

const parsed = JSON.parse(line);
const firstTool = parsed.tool_calls[0];
let actionStr = firstTool.toolAction || (firstTool.args && firstTool.args.toolAction);
let summaryStr = firstTool.toolSummary || (firstTool.args && firstTool.args.toolSummary);

console.log("Extracted action:", actionStr);
console.log("Extracted summary:", summaryStr);

if (typeof actionStr === 'string') actionStr = actionStr.replace(/^"|"$/g, '');
if (typeof summaryStr === 'string') summaryStr = summaryStr.replace(/^"|"$/g, '');

console.log("Clean action:", actionStr);
console.log("Clean summary:", summaryStr);
