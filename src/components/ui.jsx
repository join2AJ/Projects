/* Shared design tokens and building blocks (taken from the Tailbone audit so every page matches). */

export const C = {
  bg: "#F2F5F4", card: "#FFFFFF", ink: "#15222C", mute: "#566670", rule: "#D3DBDE",
  deep: "#12405C",
  good: "#1D7A58", goodBg: "#E3F3EC",
  warn: "#9A5F08", warnBg: "#FBF0DA",
  bad: "#B3261E", badBg: "#FBE6E4",
  info: "#2D5D9F", infoBg: "#E4ECF8",
};
export const FH = "'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif";
export const FB = "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif";
export const inr = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
export const inr2 = (n) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const Chip = ({ tone, children }) => (
  <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap"
    style={{ background: C[tone + "Bg"], color: C[tone] }}>{children}</span>
);
export const H1 = ({ children }) => (
  <h1 className="text-3xl mb-3" style={{ fontFamily: FH, color: C.deep, fontWeight: 600, lineHeight: 1.2, maxWidth: "28ch" }}>{children}</h1>
);
export const H2 = ({ children }) => (
  <h2 className="text-xl mb-2 mt-6" style={{ fontFamily: FH, color: C.deep, fontWeight: 600 }}>{children}</h2>
);
export const P = ({ children, style }) => (
  <p className="text-sm mb-3" style={{ color: C.ink, lineHeight: 1.6, maxWidth: "72ch", ...style }}>{children}</p>
);
export const Box = ({ tone, title, children }) => (
  <div className="p-4 mb-4" style={{ background: tone ? C[tone + "Bg"] : C.card, borderLeft: `4px solid ${tone ? C[tone] : C.deep}`, borderRadius: 2 }}>
    {title && <div className="font-semibold text-sm mb-1" style={{ color: tone ? C[tone] : C.deep }}>{title}</div>}
    <div className="text-sm" style={{ color: C.ink, lineHeight: 1.6 }}>{children}</div>
  </div>
);
export const Card = ({ children, className = "", style }) => (
  <div className={`p-4 ${className}`} style={{ background: C.card, border: `1px solid ${C.rule}`, borderRadius: 4, ...style }}>{children}</div>
);
export const T = ({ head, rows, right = [] }) => (
  <div className="overflow-x-auto mb-4">
    <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
      <thead>
        <tr>{head.map((h, i) => (
          <th key={i} className="py-2 pr-4 font-semibold" style={{ borderBottom: `2px solid ${C.deep}`, color: C.deep, whiteSpace: "nowrap", textAlign: right.includes(i) ? "right" : "left" }}>{h}</th>
        ))}</tr>
      </thead>
      <tbody>{rows.map((r, ri) => (
        <tr key={ri}>{r.map((c, ci) => (
          <td key={ci} className="py-2 pr-4 align-top" style={{ borderBottom: `1px solid ${C.rule}`, textAlign: right.includes(ci) ? "right" : "left", color: C.ink }}>{c}</td>
        ))}</tr>
      ))}</tbody>
    </table>
  </div>
);
export const Num = ({ label, value, onChange, step = 1, width = 90 }) => (
  <label className="text-xs inline-flex flex-col mr-4 mb-2" style={{ color: C.mute }}>
    {label}
    <input type="number" min="0" step={step} value={value}
      onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
      className="mt-1 px-2 py-1 rounded text-sm"
      style={{ width, border: `1px solid ${C.rule}`, color: C.ink, background: "#fff" }} />
  </label>
);
export const OL = ({ items }) => (
  <ol className="text-sm mb-4 pl-5" style={{ listStyle: "decimal", lineHeight: 1.7, color: C.ink, maxWidth: "72ch" }}>
    {items.map((x, i) => <li key={i} className="mb-1">{x}</li>)}
  </ol>
);
export const Pills = ({ options, value, onChange, label }) => (
  <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label={label}>
    {options.map(([k, l]) => (
      <button key={k} onClick={() => onChange(k)} className="px-3 py-1 text-sm rounded"
        style={{ border: `1px solid ${value === k ? C.deep : C.rule}`, background: value === k ? C.deep : "#fff", color: value === k ? "#fff" : C.ink }}>{l}</button>
    ))}
  </div>
);
export const Tabs = ({ tabs, value, onChange, label }) => (
  <div role="tablist" aria-label={label} className="flex overflow-x-auto mb-6" style={{ borderBottom: `1px solid ${C.rule}` }}>
    {tabs.map(([id, l]) => (
      <button key={id} role="tab" aria-selected={value === id} onClick={() => onChange(id)}
        className="px-4 py-3 text-sm whitespace-nowrap"
        style={{ color: value === id ? C.deep : C.mute, fontWeight: value === id ? 700 : 400, borderBottom: `3px solid ${value === id ? C.deep : "transparent"}`, marginBottom: -1, background: "transparent" }}>
        {l}
      </button>
    ))}
  </div>
);

/* Status vocabulary used across projects, findings, checklists and requests. */
export const STATUS_TONE = {
  Done: "good", Fixed: "good", Live: "good", Approved: "good",
  "In progress": "info", Contained: "info", Scheduled: "info", Superseded: "info",
  Open: "warn", Waiting: "warn", "Needs client": "warn", Draft: "warn", Proposed: "warn",
  Blocked: "bad", "Before launch": "bad",
};
export const Status = ({ s }) => <Chip tone={STATUS_TONE[s] || "info"}>{s}</Chip>;
