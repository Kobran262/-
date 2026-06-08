import * as FileSystem from 'expo-file-system/legacy';
import { format } from 'date-fns';
import { ACT_TYPE_LABELS } from '@/src/types';
import type { ActType } from '@/src/types';

const ROOT_FOLDER = 'Srecha WMS';

export async function getOrCreateFolder(
  accessToken: string,
  folderName: string,
  parentId?: string
): Promise<string> {
  const q = [
    `mimeType='application/vnd.google-apps.folder'`,
    `name='${folderName.replace(/'/g, "\\'")}'`,
    `trashed=false`,
    parentId ? `'${parentId}' in parents` : `'root' in parents`,
  ].join(' and ');

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (searchRes.ok) {
    const searchData = (await searchRes.json()) as { files?: { id: string }[] };
    if (searchData.files?.[0]?.id) {
      return searchData.files[0].id;
    }
  }

  const body: Record<string, unknown> = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) body.parents = [parentId];

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!createRes.ok) {
    throw new Error('Не удалось создать папку в Google Drive');
  }

  const created = (await createRes.json()) as { id: string };
  return created.id;
}

function actTypeFolder(type: string): string {
  const label = ACT_TYPE_LABELS[type as ActType];
  if (label) return label.split('(')[0].trim();
  return type;
}

export async function uploadPdfToDrive(
  localPath: string,
  act: { number: string; type: string; date: number }
): Promise<string> {
  const { getValidAccessToken } = await import('./auth');
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    throw new Error('Google Drive не подключён');
  }

  const rootId = await getOrCreateFolder(accessToken, ROOT_FOLDER);
  const monthFolder = format(new Date(act.date), 'yyyy-MM');
  const monthId = await getOrCreateFolder(accessToken, monthFolder, rootId);
  const typeId = await getOrCreateFolder(accessToken, actTypeFolder(act.type), monthId);

  const filename = `${act.number}_${format(new Date(act.date), 'yyyy-MM-dd')}.pdf`.replace(/\//g, '-');
  const fileContent = await FileSystem.readAsStringAsync(localPath, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const boundary = 'srecha_wms_boundary';
  const metadata = JSON.stringify({
    name: filename,
    mimeType: 'application/pdf',
    parents: [typeId],
  });

  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${metadata}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/pdf\r\n` +
    `Content-Transfer-Encoding: base64\r\n\r\n` +
    `${fileContent}\r\n` +
    `--${boundary}--`;

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!uploadRes.ok) {
    throw new Error('Не удалось загрузить PDF в Google Drive');
  }

  const uploaded = (await uploadRes.json()) as { id: string };
  return uploaded.id;
}

export async function uploadInventoryPdfToDrive(
  localPath: string,
  inv: { number: string; period_year: number; period_month: number }
): Promise<string> {
  const { getValidAccessToken } = await import('./auth');
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    throw new Error('Google Drive не подключён');
  }

  const rootId = await getOrCreateFolder(accessToken, ROOT_FOLDER);
  const invRootId = await getOrCreateFolder(accessToken, 'Инвентаризация', rootId);
  const monthLabel = `${inv.period_year}-${String(inv.period_month).padStart(2, '0')}`;
  const monthId = await getOrCreateFolder(accessToken, monthLabel, invRootId);

  const filename = `${inv.number}_${monthLabel}.pdf`.replace(/\//g, '-');
  const fileContent = await FileSystem.readAsStringAsync(localPath, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const boundary = 'srecha_wms_boundary';
  const metadata = JSON.stringify({
    name: filename,
    mimeType: 'application/pdf',
    parents: [monthId],
  });

  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${metadata}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/pdf\r\n` +
    `Content-Transfer-Encoding: base64\r\n\r\n` +
    `${fileContent}\r\n` +
    `--${boundary}--`;

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!uploadRes.ok) {
    throw new Error('Не удалось загрузить PDF в Google Drive');
  }

  const uploaded = (await uploadRes.json()) as { id: string };
  return uploaded.id;
}
