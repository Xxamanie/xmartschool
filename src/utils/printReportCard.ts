import { api } from '../../services/api';

const esc = (v: any): string => String(v ?? '').replace(/[&<>"]/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string
));

const gradeClass = (g: string) => {
  const u = (g || '').toUpperCase();
  if (u.startsWith('A')) return 'g-a';
  if (u.startsWith('B')) return 'g-b';
  if (u.startsWith('C')) return 'g-c';
  return 'g-d';
};

const ordinal = (n: number) => {
  if (!n) return '—';
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const ratingDots = (r: number) => {
  let out = '';
  for (let i = 1; i <= 5; i++) out += `<span class="dot ${i <= r ? 'on' : ''}"></span>`;
  return out;
};

/** Fetch report-card data and open a branded, printable report card window. */
export async function printReportCard(studentId: string, term?: string): Promise<{ ok: boolean; message?: string }> {
  const res = await api.getReportCard(studentId, term);
  if (!res.ok || !res.data) return { ok: false, message: res.message || 'Could not load report card' };
  const d: any = res.data;
  const primary = d.school?.themeColor || '#059669';

  // Prefer an AI-generated principal's comment; fall back to the rule-based one.
  let comment = d.comment || '';
  try {
    const c = await api.generateReportComment({
      studentName: d.student?.name, average: d.summary?.average, grade: d.summary?.grade,
      position: d.summary?.position, classSize: d.summary?.classSize, attendance: d.student?.attendance, term: d.term,
    });
    if (c.ok && c.data) comment = c.data;
  } catch { /* fall back to rule-based */ }

  const resultRows = (d.results || []).map((r: any) => {
    const dt = r.details || {};
    return `<tr>
      <td class="subj">${esc(r.subjectName)}</td>
      <td>${dt.ca1 ?? '—'}</td><td>${dt.ca2 ?? '—'}</td><td>${dt.ca3 ?? '—'}</td>
      <td>${dt.exam ?? '—'}</td>
      <td class="total">${r.average ?? '—'}</td>
      <td><span class="pill ${gradeClass(r.grade)}">${esc(r.grade)}</span></td>
      <td class="remark">${esc(r.remarks || '')}</td>
    </tr>`;
  }).join('');

  const domainRows = (items: any[]) => items.map((a) =>
    `<tr><td>${esc(a.trait)}</td><td class="dots">${ratingDots(a.rating)}</td></tr>`).join('');

  const logo = d.school?.logoUrl
    ? `<img src="${esc(d.school.logoUrl)}" class="crest-img" alt="" />`
    : `<div class="crest">${esc((d.school?.name || 'SCH').split(' ').map((w: string) => w[0]).slice(0, 3).join('').toUpperCase())}</div>`;

  const sign = d.school?.principalSignatureUrl
    ? `<img src="${esc(d.school.principalSignatureUrl)}" class="sig-img" alt="" />`
    : `<div class="sig-line"></div>`;

  const stamp = d.school?.schoolStampUrl
    ? `<img src="${esc(d.school.schoolStampUrl)}" class="stamp-img" alt="" />`
    : `<div class="stamp">${esc(d.school?.name || '')}<br/>OFFICIAL</div>`;

  const html = `<!doctype html><html><head><meta charset="utf-8"/>
<title>Report Card — ${esc(d.student?.name)}</title>
<style>
  :root{ --p:${primary}; --ink:#0f172a; --muted:#64748b; --line:#e2e8f0; }
  *{box-sizing:border-box} body{margin:0;font-family:'Segoe UI',system-ui,Arial,sans-serif;color:var(--ink);background:#f1f5f9}
  .sheet{max-width:820px;margin:14px auto;background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden}
  .mast{display:flex;align-items:center;gap:16px;padding:20px 26px;background:linear-gradient(135deg,var(--p),#0e7490);color:#fff}
  .crest,.crest-img{width:60px;height:60px;border-radius:10px;object-fit:cover}
  .crest{background:rgba(255,255,255,.15);border:2px solid rgba(255,255,255,.35);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:20px}
  .mast h1{margin:0;font-size:21px;font-weight:800}
  .mast p{margin:2px 0 0;font-size:12px;color:rgba(255,255,255,.9)}
  .doc{margin-left:auto;text-align:right;font-size:11.5px}
  .doc b{display:block;font-size:13px;text-transform:uppercase;letter-spacing:1px}
  .bio{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--line);border-bottom:1px solid var(--line)}
  .bio .c{background:#fff;padding:10px 14px}.bio .k{font-size:9.5px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);font-weight:700}
  .bio .v{font-size:13.5px;font-weight:700;margin-top:2px}.bio .wide{grid-column:span 2}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:16px 26px}
  .kpi{border:1px solid var(--line);border-radius:9px;padding:10px;text-align:center}.kpi .n{font-size:20px;font-weight:800}.kpi .l{font-size:9.5px;text-transform:uppercase;color:var(--muted);font-weight:700}
  .wrap{padding:2px 26px 14px}
  table{width:100%;border-collapse:collapse;font-size:12.5px}
  thead th{background:#f8fafc;color:var(--muted);text-transform:uppercase;font-size:10px;letter-spacing:.4px;padding:8px 6px;border-bottom:2px solid var(--line);text-align:center}
  thead th.l,td.subj,td.remark{text-align:left}
  tbody td{padding:8px 6px;text-align:center;border-bottom:1px solid #f1f5f9}
  td.subj{font-weight:700}td.total{font-weight:800}td.remark{color:var(--muted);font-style:italic;font-size:11px}
  tfoot td{padding:9px 6px;font-weight:800;background:#f8fafc;border-top:2px solid var(--line)}
  .pill{display:inline-block;padding:1px 8px;border-radius:999px;font-size:10.5px;font-weight:800}
  .g-a{background:#d1fae5;color:#047857}.g-b{background:#dbeafe;color:#1d4ed8}.g-c{background:#fef3c7;color:#b45309}.g-d{background:#fee2e2;color:#b91c1c}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:2px 26px}
  .panel{border:1px solid var(--line);border-radius:9px;overflow:hidden}
  .panel h3{margin:0;padding:8px 12px;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#fff;background:var(--p)}
  .panel table td{padding:6px 12px;text-align:left;font-size:12px;border-bottom:1px solid #f1f5f9}
  .dots{text-align:right}.dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:#e2e8f0;margin-left:3px}.dot.on{background:var(--p)}
  .key{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;font-size:10.5px;padding:10px 26px;color:var(--muted)}
  .signs{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;padding:14px 26px 22px;align-items:end}
  .sign{text-align:center}.sig-line{height:34px;border-bottom:1.5px dashed #94a3b8;margin-bottom:6px}
  .sig-img{height:40px;object-fit:contain;margin-bottom:2px}.stamp-img{width:80px;height:80px;object-fit:contain;margin:0 auto;display:block}
  .stamp{width:80px;height:80px;border:2.5px solid var(--p);border-radius:50%;color:var(--p);display:flex;align-items:center;justify-content:center;text-align:center;font-size:8px;font-weight:800;text-transform:uppercase;transform:rotate(-10deg);margin:0 auto;opacity:.85;line-height:1.2}
  .cap{font-size:10px;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);font-weight:700}
  .toolbar{text-align:center;padding:10px}.toolbar button{background:var(--p);color:#fff;border:0;border-radius:8px;padding:9px 18px;font-weight:700;cursor:pointer}
  @media print{.toolbar{display:none}body{background:#fff}.sheet{border:0;margin:0;border-radius:0}}
</style></head><body>
<div class="toolbar"><button onclick="window.print()">Print / Save as PDF</button></div>
<div class="sheet">
  <div class="mast">
    ${logo}
    <div><h1>${esc(d.school?.name)}</h1><p>${esc(d.school?.motto)}${d.school?.address ? ' · ' + esc(d.school.address) : ''}</p></div>
    <div class="doc"><b>Report Card</b><span>${esc(d.term)}</span></div>
  </div>
  <div class="bio">
    <div class="c wide"><div class="k">Student</div><div class="v">${esc(d.student?.name)}</div></div>
    <div class="c"><div class="k">Class</div><div class="v">${esc(d.student?.className)}</div></div>
    <div class="c"><div class="k">Gender</div><div class="v">${esc(d.student?.gender)}</div></div>
    <div class="c"><div class="k">Position</div><div class="v">${ordinal(d.summary?.position)} of ${esc(d.summary?.classSize)}</div></div>
    <div class="c"><div class="k">Attendance</div><div class="v">${esc(d.student?.attendance)}%</div></div>
    <div class="c"><div class="k">Access Code</div><div class="v">${esc(d.student?.accessCode)}</div></div>
    <div class="c"><div class="k">Subjects</div><div class="v">${esc(d.summary?.subjects)}</div></div>
  </div>
  <div class="kpis">
    <div class="kpi"><div class="n">${esc(d.summary?.average)}%</div><div class="l">Term Average</div></div>
    <div class="kpi"><div class="n">${esc(d.summary?.grade)}</div><div class="l">Overall Grade</div></div>
    <div class="kpi"><div class="n">${ordinal(d.summary?.position)}</div><div class="l">Class Position</div></div>
    <div class="kpi"><div class="n">${esc(d.student?.attendance)}%</div><div class="l">Attendance</div></div>
  </div>
  <div class="wrap">
    <table>
      <thead><tr><th class="l">Subject</th><th>CA1</th><th>CA2</th><th>CA3</th><th>Exam</th><th>Total</th><th>Grade</th><th class="l">Remark</th></tr></thead>
      <tbody>${resultRows || '<tr><td colspan="8" style="padding:18px;color:#94a3b8">No published results for this term.</td></tr>'}</tbody>
      <tfoot><tr><td class="subj" style="text-align:left">Total / Average</td><td colspan="4">Obtained: ${esc(d.summary?.totalObtained)}</td><td class="total">${esc(d.summary?.average)}%</td><td><span class="pill ${gradeClass(d.summary?.grade)}">${esc(d.summary?.grade)}</span></td><td></td></tr></tfoot>
    </table>
  </div>
  <div class="grid2">
    <div class="panel"><h3>Affective Domain (Attitude)</h3><table><tbody>${domainRows(d.affective || [])}</tbody></table></div>
    <div class="panel"><h3>Psychomotor Domain (Skills)</h3><table><tbody>${domainRows(d.psychomotor || [])}</tbody></table></div>
  </div>
  <div class="key">
    <span><b>A1</b> 75–100 Outstanding</span><span><b>B2/B3</b> 65–74 Very Good</span><span><b>C4–C6</b> 50–64 Good</span>
    <span><b>D7</b> 45–49 Pass</span><span><b>E8</b> 40–44 Below Avg</span><span><b>F9</b> 0–39 Fail</span>
  </div>
  <div style="padding:2px 26px 0">
    <div class="panel"><h3>Principal's Comment</h3><div style="padding:10px 12px;font-size:12.5px;color:#334155;line-height:1.5">${esc(comment)}</div></div>
  </div>
  <div class="signs">
    <div class="sign"><div class="sig-line"></div><div class="cap">Class Teacher</div></div>
    <div class="sign">${stamp}</div>
    <div class="sign">${sign}<div class="cap">${esc(d.school?.principalName || 'Principal')}</div></div>
  </div>
</div></body></html>`;

  const w = window.open('', '_blank', 'width=900,height=760');
  if (!w) return { ok: false, message: 'Pop-up blocked — allow pop-ups to view the report card.' };
  w.document.write(html);
  w.document.close();
  return { ok: true };
}
