import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const LABELS = { error: 'エラー', warn: '注意', info: '完了' };
export default function IssueList({ issues }) {
    if (issues.length === 0)
        return null;
    return (_jsx("ul", { className: "issues no-print", children: issues.map((issue, i) => (_jsxs("li", { className: issue.level, children: [_jsx("span", { className: "badge", children: LABELS[issue.level] }), issue.message] }, i))) }));
}
