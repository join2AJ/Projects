/*
 * Grouped project tabs: a short row of parent tabs; hovering (or tapping) a parent shows its tabs in a menu,
 * and the open group's tabs also show as a second row. Each tab keeps its own ?tab= link.
 * groups: [[groupId, label, [[tabId, label], …]], …]. A group with one tab behaves like a plain tab.
 */
import { useState } from "react";
import { C } from "./ui.jsx";

export const flatTabs = (groups) => groups.flatMap(([, , tabs]) => tabs);
export const groupOf = (groups, tab) => groups.find(([, , tabs]) => tabs.some(([id]) => id === tab)) || groups[0];

export function NavTabs({ groups, value, onChange, label }) {
  const [hover, setHover] = useState(null);
  const active = groupOf(groups, value);
  return (
    <div className="mb-6" onMouseLeave={() => setHover(null)}>
      <div role="tablist" aria-label={label} className="flex flex-wrap" style={{ borderBottom: `1px solid ${C.rule}` }}>
        {groups.map(([gid, glabel, tabs]) => {
          const on = active[0] === gid;
          const many = tabs.length > 1;
          return (
            <div key={gid} className="relative" onMouseEnter={() => setHover(many ? gid : null)}>
              <button role="tab" aria-selected={on} aria-haspopup={many ? "menu" : undefined} aria-expanded={many ? hover === gid : undefined}
                onClick={() => { onChange(tabs[0][0]); setHover(many && hover !== gid ? gid : null); }}
                className="px-4 py-3 text-sm whitespace-nowrap"
                style={{ color: on ? C.deep : C.mute, fontWeight: on ? 700 : 400, borderBottom: `3px solid ${on ? C.deep : "transparent"}`, marginBottom: -1, background: "transparent" }}>
                {glabel}{many && <span aria-hidden="true" style={{ fontSize: 10, marginLeft: 4 }}>▾</span>}
              </button>
              {hover === gid && (
                <div role="menu" aria-label={glabel} className="absolute z-20 py-1" style={{ top: "100%", left: 0, minWidth: 220, background: C.card, border: `1px solid ${C.rule}`, borderRadius: 4, boxShadow: "0 6px 18px rgba(0,0,0,.08)" }}>
                  {tabs.map(([id, l]) => (
                    <button key={id} role="menuitem" onClick={() => { onChange(id); setHover(null); }}
                      className="block w-full text-left px-3 py-2 text-sm"
                      style={{ color: value === id ? C.deep : C.ink, fontWeight: value === id ? 700 : 400, background: value === id ? C.bg : "transparent" }}>
                      {l}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {active[2].length > 1 && (
        <div className="flex flex-wrap gap-2 mt-3" aria-label={`${active[1]} sections`}>
          {active[2].map(([id, l]) => (
            <button key={id} onClick={() => onChange(id)} aria-pressed={value === id}
              className="px-3 py-1 rounded-full text-xs"
              style={{ border: `1px solid ${value === id ? C.deep : C.rule}`, background: value === id ? C.deep : C.card, color: value === id ? "#fff" : C.ink }}>
              {l}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
