import type { SupabaseClient } from '@supabase/supabase-js';
import { getClient } from './supabaseCentralService.js';

/**
 * Generic JSON document store on Supabase (table: app_documents).
 * Used for campaigns (+ inspection records), audit events, notifications, office types,
 * access logs and settings, so none of them lives in the (ephemeral) serverless filesystem.
 */

export type DocCollection =
  | 'campaigns'
  | 'audit_events'
  | 'notifications'
  | 'office_types'
  | 'access_logs'
  | 'settings';

const TABLE = 'app_documents';

function db(): SupabaseClient {
  const client = getClient();
  if (!client) throw new Error('Supabase مرکزی تنظیم نشده است.');
  return client;
}

export function docId(doc: any): string {
  const id = doc?.id ?? doc?.code;
  if (id === undefined || id === null || String(id).trim() === '') {
    throw new Error('سند فاقد شناسه (id) است.');
  }
  return String(id);
}

export async function listDocuments<T = any>(collection: DocCollection, limit?: number): Promise<T[]> {
  let query = db().from(TABLE).select('data').eq('collection', collection).order('updated_at', { ascending: false });
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row: any) => row.data as T);
}

export async function getDocument<T = any>(collection: DocCollection, id: string): Promise<T | null> {
  const { data, error } = await db().from(TABLE).select('data').eq('collection', collection).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? (data.data as T) : null;
}

export async function upsertDocument(collection: DocCollection, doc: any, id: string = docId(doc)): Promise<any> {
  const { error } = await db().from(TABLE).upsert(
    { collection, id, data: doc, updated_at: new Date().toISOString() },
    { onConflict: 'collection,id' }
  );
  if (error) throw error;
  return doc;
}

/** Upserts only documents that are new or changed (keeps writes small and avoids needless overwrites). */
export async function upsertChangedDocuments(collection: DocCollection, docs: any[]): Promise<number> {
  if (!docs.length) return 0;
  const client = db();
  const { data: existing, error } = await client.from(TABLE).select('id,data').eq('collection', collection);
  if (error) throw error;
  const current = new Map<string, string>((existing || []).map((r: any) => [String(r.id), JSON.stringify(r.data)]));
  const now = new Date().toISOString();
  const rows = docs
    .map((doc) => ({ collection, id: docId(doc), data: doc, updated_at: now }))
    .filter((row) => current.get(row.id) !== JSON.stringify(row.data));
  if (!rows.length) return 0;
  const { error: upsertError } = await client.from(TABLE).upsert(rows, { onConflict: 'collection,id' });
  if (upsertError) throw upsertError;
  return rows.length;
}

export async function deleteDocument(collection: DocCollection, id: string): Promise<boolean> {
  const { data, error } = await db().from(TABLE).delete().eq('collection', collection).eq('id', id).select('id');
  if (error) throw error;
  return Boolean(data && data.length);
}

/** Deletes documents of a collection whose ids are not in `keepIds` (used by "replace" style lists). */
export async function pruneDocuments(collection: DocCollection, keepIds: string[]): Promise<void> {
  const client = db();
  const { data, error } = await client.from(TABLE).select('id').eq('collection', collection);
  if (error) throw error;
  const keep = new Set(keepIds.map(String));
  const stale = (data || []).map((r: any) => String(r.id)).filter((id: string) => !keep.has(id));
  if (!stale.length) return;
  const { error: delError } = await client.from(TABLE).delete().eq('collection', collection).in('id', stale);
  if (delError) throw delError;
}

/** Keeps only the newest `max` documents of a collection (access logs). */
export async function trimCollection(collection: DocCollection, max: number): Promise<void> {
  const client = db();
  const { data, error } = await client
    .from(TABLE).select('id').eq('collection', collection)
    .order('updated_at', { ascending: false }).range(max, max + 1000);
  if (error) throw error;
  const ids = (data || []).map((r: any) => String(r.id));
  if (!ids.length) return;
  await client.from(TABLE).delete().eq('collection', collection).in('id', ids);
}

// ---- settings (single documents keyed by name) ----
export async function getSetting<T = any>(key: string): Promise<T | null> {
  return getDocument<T>('settings', key);
}

export async function saveSetting(key: string, value: any): Promise<void> {
  await upsertDocument('settings', value, key);
}

export async function listSettings(): Promise<Record<string, any>> {
  const { data, error } = await db().from(TABLE).select('id,data').eq('collection', 'settings');
  if (error) throw error;
  const out: Record<string, any> = {};
  (data || []).forEach((r: any) => { out[String(r.id)] = r.data; });
  return out;
}

/**
 * Read-modify-write of one document with optimistic concurrency: the write only succeeds if nobody
 * changed the row in between (compared by updated_at); otherwise it re-reads and retries.
 * Returns the saved document, or null when the document does not exist.
 */
export async function updateDocumentAtomic<T = any>(
  collection: DocCollection,
  id: string,
  mutate: (current: T) => T,
): Promise<T | null> {
  const client = db();
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data, error } = await client.from(TABLE).select('data,updated_at').eq('collection', collection).eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const next = mutate(data.data as T);
    const stamp = new Date().toISOString();
    const { data: written, error: writeError } = await client
      .from(TABLE)
      .update({ data: next, updated_at: stamp })
      .eq('collection', collection).eq('id', id).eq('updated_at', data.updated_at)
      .select('id');
    if (writeError) throw writeError;
    if (written && written.length) return next;
    await new Promise((r) => setTimeout(r, 40 + Math.random() * 80));
  }
  throw new Error('ذخیره پرونده به دلیل ویرایش هم‌زمان کاربر دیگر انجام نشد؛ دوباره تلاش کنید.');
}
