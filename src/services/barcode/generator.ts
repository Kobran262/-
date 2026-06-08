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
