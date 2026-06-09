import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export type BarcodeFormat = 'EAN13' | 'CODE128' | 'CODE39' | 'QR';

export interface BarcodeItem {
  sku: string;
  name: string;
  barcode: string;
  format: BarcodeFormat;
  copies: number;
}

function skuClass(sku: string): string {
  return sku.replace(/[^a-z0-9]/gi, '_');
}

export function renderBarcodePrintHtml(items: BarcodeItem[]): string {
  const labelWidth = 80;
  const labelHeight = 40;

  const labelHtml = items
    .flatMap((item) =>
      Array.from({ length: item.copies }, () => `
      <div class="label">
        <div class="sku">${item.sku}</div>
        <svg class="bc-${skuClass(item.sku)}"></svg>
        <div class="name">${item.name.slice(0, 28)}</div>
        <div class="code">${item.barcode}</div>
      </div>
    `)
    )
    .join('');

  const jsFormat = (fmt: BarcodeFormat) => (fmt === 'QR' ? 'CODE128' : fmt);

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  @page { margin: 10mm; }
  body { font-family: Arial, sans-serif; font-size: 8px; }
  .grid { display: flex; flex-wrap: wrap; gap: 3mm; }
  .label {
    width: ${labelWidth}mm; height: ${labelHeight}mm;
    border: 0.5px solid #ccc; border-radius: 2mm;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 2mm; box-sizing: border-box; overflow: hidden;
  }
  .sku { font-size: 6px; color: #888; letter-spacing: 0.05em; margin-bottom: 1mm; }
  .name { font-size: 7px; text-align: center; margin-top: 1mm; max-width: 100%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .code { font-size: 6px; color: #555; margin-top: 0.5mm; }
  svg { max-width: 100%; height: 20mm; }
</style>
</head><body>
<div class="grid">${labelHtml}</div>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
<script>
  ${items
    .map(
      (item) => `
    document.querySelectorAll('.bc-${skuClass(item.sku)}').forEach(el => {
      try {
        JsBarcode(el, "${item.barcode.replace(/"/g, '\\"')}", {
          format: "${jsFormat(item.format)}",
          width: 1.5, height: 50,
          displayValue: false,
          margin: 0,
          background: "transparent",
          lineColor: "#000"
        });
      } catch(e) { el.outerHTML = '<span style="font-size:6px;color:red">Ошибка</span>'; }
    });
  `
    )
    .join('')}
</script>
</body></html>`;
}

export async function exportBarcodesPdf(items: BarcodeItem[]): Promise<string> {
  const html = renderBarcodePrintHtml(items);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const dir = `${FileSystem.documentDirectory ?? ''}barcodes/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const dest = `${dir}barcodes_${Date.now()}.pdf`;
  await FileSystem.moveAsync({ from: uri, to: dest });
  return dest;
}

export async function exportBarcodesCsv(items: BarcodeItem[]): Promise<string> {
  const header = 'sku,name,barcode,format\n';
  const rows = items
    .map((i) => `"${i.sku}","${i.name.replace(/"/g, '""')}","${i.barcode}","${i.format}"`)
    .join('\n');
  const csv = header + rows;

  const dir = `${FileSystem.documentDirectory ?? ''}barcodes/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const path = `${dir}barcodes_${Date.now()}.csv`;
  await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
  return path;
}

export async function shareBarcodeFile(path: string): Promise<void> {
  await Sharing.shareAsync(path, {
    UTI: path.endsWith('.pdf') ? 'com.adobe.pdf' : 'public.comma-separated-values-text',
  });
}

export function generateEan13(): string {
  const prefix = '860';
  const rand = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('');
  const base = prefix + rand;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(base[i], 10) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return base + check;
}

function skuFilename(sku: string): string {
  return sku.replace(/[^a-z0-9]/gi, '_');
}

function buildTextFallbackSvg(barcode: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80" viewBox="0 0 200 80">
  <rect width="200" height="80" fill="white"/>
  <text x="100" y="45" font-family="monospace" font-size="14" text-anchor="middle" fill="black">${barcode}</text>
  <text x="100" y="65" font-family="sans-serif" font-size="8" text-anchor="middle" fill="#666">CODE128</text>
</svg>`;
}

function buildEan13Svg(ean: string): string {
  const L_CODES: Record<string, string> = {
    '0': '0001101',
    '1': '0011001',
    '2': '0010011',
    '3': '0111101',
    '4': '0100011',
    '5': '0110001',
    '6': '0101111',
    '7': '0111011',
    '8': '0110111',
    '9': '0001011',
  };
  const G_CODES: Record<string, string> = {
    '0': '0100111',
    '1': '0110011',
    '2': '0011011',
    '3': '0100001',
    '4': '0011101',
    '5': '0111001',
    '6': '0000101',
    '7': '0010001',
    '8': '0001001',
    '9': '0010111',
  };
  const R_CODES: Record<string, string> = {
    '0': '1110010',
    '1': '1100110',
    '2': '1101100',
    '3': '1000010',
    '4': '1011100',
    '5': '1001110',
    '6': '1010000',
    '7': '1000100',
    '8': '1001000',
    '9': '1110100',
  };
  const FIRST_DIGIT_STRUCTURE: Record<string, string> = {
    '0': 'LLLLLL',
    '1': 'LLGLGG',
    '2': 'LLGGLG',
    '3': 'LLGGGL',
    '4': 'LGLLGG',
    '5': 'LGGLLG',
    '6': 'LGGGLL',
    '7': 'LGLGLG',
    '8': 'LGLGGL',
    '9': 'LGGLGL',
  };

  const firstDigit = ean[0];
  const structure = FIRST_DIGIT_STRUCTURE[firstDigit] ?? 'LLLLLL';

  let bits = '101';
  for (let i = 0; i < 6; i++) {
    const d = ean[i + 1];
    bits += structure[i] === 'G' ? G_CODES[d] : L_CODES[d];
  }
  bits += '01010';
  for (let i = 7; i <= 12; i++) {
    bits += R_CODES[ean[i]];
  }
  bits += '101';

  const W = 200;
  const H = 80;
  const barWidth = (W - 20) / bits.length;
  const barHeight = H - 20;
  const textY = H - 4;

  let rects = '';
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === '1') {
      rects += `<rect x="${(10 + i * barWidth).toFixed(2)}" y="5" width="${barWidth.toFixed(2)}" height="${barHeight}" fill="black"/>`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="white"/>
  ${rects}
  <text x="${W / 2}" y="${textY}" font-family="monospace" font-size="9" text-anchor="middle" fill="black">${ean}</text>
</svg>`;
}

function buildSvgBarcode(barcode: string, format: BarcodeFormat): string {
  if (format === 'EAN13' && /^\d{13}$/.test(barcode)) {
    return buildEan13Svg(barcode);
  }
  return buildTextFallbackSvg(barcode);
}

export async function generateBarcodePng(
  barcode: string,
  sku: string,
  format: BarcodeFormat = 'EAN13'
): Promise<string> {
  const dir = `${FileSystem.documentDirectory ?? ''}barcodes/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });

  const filename = `${skuFilename(sku)}.svg`;
  const outPath = `${dir}${filename}`;

  const cached = await FileSystem.getInfoAsync(outPath);
  if (cached.exists) {
    return outPath;
  }

  const svgContent = buildSvgBarcode(barcode, format);
  await FileSystem.writeAsStringAsync(outPath, svgContent, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return outPath;
}
