import { INK, SUB } from "@/lib/design/tokens";
import { bytesWords, type StorageReport } from "@/repositories/storage";
import { BizPage } from "./settings-kit";

/** STORAGE (30 Oct 2026) — one profile's share of DanceOS, as a total, one bar
 *  split by what it is made of, and a row per kind with its size, its share and
 *  how many. Files are measured; records are an estimate, and say so. */

const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);
const pctWords = (p: number) => (p === 0 ? "0%" : p < 1 ? "<1%" : `${Math.round(p)}%`);

export function StorageScreen({ report, whose }: { report: StorageReport; whose: string }) {
  const { lines, total } = report;
  const shown = lines.filter((l) => l.bytes > 0);
  const fileBytes = lines.filter((l) => l.kind === "file").reduce((s, l) => s + l.bytes, 0);
  const recordBytes = total - fileBytes;

  const middle = (
    <div data-testid="storage-total">
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 30, fontWeight: 900, letterSpacing: -0.8, color: INK }}>{bytesWords(total)}</span>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: SUB }}>in all</span>
      </div>
      {/* one bar, split by what the data is made of */}
      <div role="img" aria-label="How the space is split" style={{ display: "flex", height: 12, borderRadius: 999, overflow: "hidden", background: "var(--el)", margin: "12px 0 10px" }}>
        {shown.map((l) => (
          <span key={l.key} title={`${l.label} · ${bytesWords(l.bytes)}`} style={{ width: `${pct(l.bytes, total)}%`, minWidth: 3, background: l.color }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        {[
          { label: "Files", value: fileBytes },
          { label: "Records · about", value: recordBytes },
        ].map((x) => (
          <div key={x.label} style={{ flex: 1, background: "var(--card)", border: "1.5px solid var(--el)", borderRadius: 14, padding: "9px 11px" }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: INK }}>{bytesWords(x.value)}</div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", color: SUB, marginTop: 2 }}>
              {x.label} · {pctWords(pct(x.value, total))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <BizPage title="Storage" grad="linear-gradient(135deg,#0EA5E9,#6366F1)" sub={whose} middle={middle}>
      <div data-testid="storage-lines" style={{ display: "grid", gap: 8 }}>
        {lines.map((l) => {
          const p = pct(l.bytes, total);
          return (
            <div key={`${l.kind}-${l.key}`} data-testid="storage-line" style={{ background: "var(--card)", border: "1.5px solid var(--el)", borderRadius: 16, padding: "11px 13px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 999, background: l.color, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 800, color: INK }}>{l.label}</span>
                <span style={{ fontSize: 13, fontWeight: 900, color: INK }}>{bytesWords(l.bytes)}</span>
                <span style={{ width: 40, textAlign: "right", fontSize: 11.5, fontWeight: 800, color: SUB }}>{pctWords(p)}</span>
              </div>
              <div style={{ height: 5, borderRadius: 999, background: "var(--el)", margin: "8px 0 6px", overflow: "hidden" }}>
                <div style={{ width: `${p}%`, height: "100%", background: l.color }} />
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: SUB }}>
                {l.count} {l.kind === "file" ? (l.count === 1 ? "file" : "files") : l.count === 1 ? "record" : "records"}
                {l.kind === "record" ? " · size estimated" : ""}
              </div>
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: 11, color: SUB, lineHeight: 1.5, margin: "14px 2px 0" }}>
        Files are measured exactly. Records are estimated from their size as data{report.estimated ? ", and the largest lists are scaled from a sample" : ""}.
      </p>
    </BizPage>
  );
}
