/** Parse CSV records, including escaped quotes and line breaks inside quoted fields. */
export const parseCsv = (input: string): string[][] => {
  const text = input.replace(/^\uFEFF/, '');
  const records: string[][] = [];
  let record: string[] = [];
  let value = '';
  let quoted = false;
  let closedQuote = false;
  let line = 1;

  const finishValue = () => {
    record.push(value.trim());
    value = '';
    closedQuote = false;
  };
  const finishRecord = () => {
    finishValue();
    records.push(record);
    record = [];
  };

  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') { value += '"'; index++; }
        else { quoted = false; closedQuote = true; }
      } else {
        value += character;
        if (character === '\n') line++;
      }
      continue;
    }
    if (character === ',') { finishValue(); continue; }
    if (character === '\r' || character === '\n') {
      if (character === '\r' && text[index + 1] === '\n') index++;
      finishRecord();
      line++;
      continue;
    }
    if (closedQuote) {
      if (/\s/.test(character)) continue;
      throw new Error(`CSV line ${line}: unexpected text after a closing quote.`);
    }
    if (character === '"') {
      if (value.trim()) throw new Error(`CSV line ${line}: quotes must surround the entire field.`);
      value = '';
      quoted = true;
    } else {
      value += character;
    }
  }
  if (quoted) throw new Error(`CSV line ${line}: missing closing quote.`);
  if (value || record.length || closedQuote) finishRecord();
  return records;
};

/** Quote CSV text and prevent spreadsheet applications from interpreting it as a formula. */
export const csvCell = (value: string | number | null | undefined): string => {
  let text = String(value ?? '');
  if (typeof value !== 'number' && /^\s*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

export const createCsv = (rows: Array<Array<string | number | null | undefined>>): string =>
  rows.map(row => row.map(csvCell).join(',')).join('\r\n');
