const ExcelJS = require('exceljs');

const GREEN = 'FF1E4A3B';
const HEAD = { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } } };
const SHADE = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6ECE8' } };
const RED = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6D7D4' } };
const gradeName = (g) => (g === 'PREKG' ? 'Pre-KG' : /^\d+$/.test(g) ? `Class ${g}` : g);

/** Monthly register in the layout of the paper register: P / A / L / Lv per day, totals at the right and bottom. */
async function registerWorkbook(reg) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Haajari';
  const ws = wb.addWorksheet(`${reg.class.grade}-${reg.class.section} ${reg.month}`, {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
    views: [{ state: 'frozen', xSplit: 2, ySplit: 4 }],
  });
  const n = reg.days.length;
  ws.mergeCells(1, 1, 1, n + 8);
  ws.getCell(1, 1).value = `${reg.school.name} · ${gradeName(reg.class.grade)} ${reg.class.section} · Attendance register · ${reg.month}`;
  ws.getCell(1, 1).font = { bold: true, size: 14 };
  ws.mergeCells(2, 1, 2, n + 8);
  ws.getCell(2, 1).value = `UDISE ${reg.school.udiseCode || '-'} · Academic year ${reg.school.academicYear} · Working days ${reg.totals.workingDays} · P present, A absent, L late, Lv leave, H holiday/Sunday`;
  ws.getCell(2, 1).font = { color: { argb: 'FF5A6D64' } };

  const header = ['Roll', 'Name', ...reg.days.map((d) => d.day), 'Present', 'Absent', 'Leave', 'Days', '%', 'SATS ID'];
  const hr = ws.getRow(4);
  hr.values = header;
  hr.eachCell((c) => { Object.assign(c, HEAD); c.alignment = { horizontal: 'center' }; });
  ws.getColumn(1).width = 6;
  ws.getColumn(2).width = 22;
  reg.days.forEach((_, i) => { ws.getColumn(3 + i).width = 3.6; });
  [8, 8, 7, 6, 7, 12].forEach((w, i) => { ws.getColumn(3 + n + i).width = w; });

  reg.rows.forEach((r, idx) => {
    const row = ws.getRow(5 + idx);
    row.values = [r.rollNo, r.name, ...reg.days.map((d) => (d.closed ? 'H' : ({ P: 'P', A: 'A', L: 'L', LV: 'Lv' }[r.marks[d.date]] || ''))), r.present, r.A, r.LV, r.workingDays, r.pct, r.satsId || ''];
    reg.days.forEach((d, i) => {
      const c = row.getCell(3 + i);
      c.alignment = { horizontal: 'center' };
      if (d.closed) c.fill = SHADE;
      else if (r.marks[d.date] === 'A') { c.fill = RED; c.font = { bold: true, color: { argb: 'FFC2362B' } }; }
    });
    if (r.pct !== null && r.pct < 75) row.getCell(3 + n + 4).font = { bold: true, color: { argb: 'FFC2362B' } };
  });
  const tr = ws.getRow(5 + reg.rows.length);
  tr.values = ['', 'Present each day', ...reg.daily.map((d, i) => (reg.days[i].closed ? '' : d.marked ? d.present : '')), reg.totals.presentDays, reg.totals.absentDays, reg.totals.leaveDays, reg.totals.workingDays, reg.totals.pct, ''];
  tr.font = { bold: true };
  tr.eachCell((c) => { c.border = { top: { style: 'medium' } }; });
  return wb;
}

async function tableWorkbook(title, columns, rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(title.slice(0, 31));
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width || 14 }));
  ws.getRow(1).eachCell((c) => Object.assign(c, HEAD));
  rows.forEach((r) => ws.addRow(r));
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  return wb;
}

async function send(res, wb, filename) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
}

// CSV with quoting, for the same columns as a workbook.
function sendCsv(res, columns, rows, filename) {
  const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v);
  res.type('text/csv').attachment(filename);
  return res.send([columns.map((c) => c.header).join(','), ...rows.map((r) => columns.map((c) => esc(r[c.key] ?? '')).join(','))].join('\n'));
}

module.exports = { registerWorkbook, tableWorkbook, send, gradeName, sendCsv };
