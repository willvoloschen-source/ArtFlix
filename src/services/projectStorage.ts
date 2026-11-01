import type { ProductBranch } from '../types/mapTypes';
import { supabase } from './supabaseClient';

const bucket = 'artflix-assets';
const prefix = 'artflix-storage:';
const uploaded = new Set<string>();
const downloaded = new Map<string, Promise<string>>();

function extension(mime: string): string {
  return ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'application/pdf': 'pdf' } as Record<string, string>)[mime] || 'bin';
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function uploadDataUrl(dataUrl: string, userId: string, projectId: string): Promise<string> {
  if (!supabase) throw new Error('Supabase não configurado.');
  const mime = dataUrl.match(/^data:([^;]+);base64,/)?.[1];
  if (!mime) return dataUrl;
  const path = `${userId}/${projectId}/${await sha256(dataUrl)}.${extension(mime)}`;
  if (!uploaded.has(path)) {
    const blob = await fetch(dataUrl).then(response => response.blob());
    if (blob.size > 10_485_760) throw new Error('Um arquivo do projeto excede o limite de 10 MB do armazenamento.');
    const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: mime, upsert: true });
    if (error) throw error;
    uploaded.add(path);
  }
  return `${prefix}${path}`;
}

async function downloadDataUrl(path: string): Promise<string> {
  if (!supabase) throw new Error('Supabase não configurado.');
  if (!downloaded.has(path)) downloaded.set(path, (async () => {
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error || !data) throw error || new Error('Arquivo não encontrado.');
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(data);
    });
    uploaded.add(path);
    return dataUrl;
  })());
  return downloaded.get(path)!;
}

async function mapValues(value: unknown, mapString: (value: string) => Promise<string>): Promise<unknown> {
  if (typeof value === 'string') return mapString(value);
  if (Array.isArray(value)) return Promise.all(value.map(item => mapValues(item, mapString)));
  if (value && typeof value === 'object') {
    const pairs = await Promise.all(Object.entries(value).map(async ([key, entry]) => [key, await mapValues(entry, mapString)] as const));
    return Object.fromEntries(pairs);
  }
  return value;
}

export async function prepareProjectForSave(project: ProductBranch, userId: string): Promise<ProductBranch> {
  return mapValues(project, value => /^data:(image\/|application\/pdf)/.test(value)
    ? uploadDataUrl(value, userId, project.id)
    : Promise.resolve(value)) as Promise<ProductBranch>;
}

export async function restoreProjectFromStorage(project: ProductBranch): Promise<ProductBranch> {
  return mapValues(project, value => value.startsWith(prefix)
    ? downloadDataUrl(value.slice(prefix.length))
    : Promise.resolve(value)) as Promise<ProductBranch>;
}
