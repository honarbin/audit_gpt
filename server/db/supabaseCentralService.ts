import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import type { ServerOffice, ServerUser, ServerManager } from './serverDbService';

function env(name: string): string {
  return String(process.env[name] || '').trim().replace(/^['"]|['"]$/g, '');
}

function getConfig(): { url: string; key: string } | null {
  const url = env('SUPABASE_URL') || env('VITE_SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY') || env('SUPABASE_ANON_KEY') || env('VITE_SUPABASE_ANON_KEY');
  if (!url || !key || url.includes('your-project') || key.includes('your-anon-key')) return null;
  return { url, key };
}

let client: SupabaseClient | null = null;
let clientKey = '';

function getClient(): SupabaseClient | null {
  const config = getConfig();
  if (!config) return null;
  const key = `${config.url}:::${config.key}`;
  if (client && clientKey === key) return client;
  client = createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  clientKey = key;
  return client;
}

export function isCentralSupabaseConfigured(): boolean {
  return Boolean(getClient());
}

function normalizeDigits(value?: string | null): string {
  if (!value) return '';
  return String(value).trim()
    .replace(/[۰-۹]/g, d => String.fromCharCode(d.charCodeAt(0) - 1728))
    .replace(/[٠-٩]/g, d => String.fromCharCode(d.charCodeAt(0) - 1584));
}

function toUser(row: any): ServerUser {
  return {
    id: String(row.id),
    username: row.username || '',
    nationalId: row.national_id || '',
    passwordHash: row.password_hash || '',
    fullName: row.full_name || '',
    role: row.role,
    mobilePhone: row.mobile_phone || undefined,
    email: row.email || undefined,
    assignedOfficeCode: row.assigned_office_code || undefined,
    assignedOfficeName: row.assigned_office_name || undefined,
    isActive: row.is_active ?? true,
    isPasswordChanged: row.is_password_changed ?? false,
    lastLoginAt: row.last_login_at || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    notes: row.notes || undefined,
    customPermissions: row.custom_permissions || undefined,
  };
}

function userRow(user: ServerUser): any {
  return {
    id: user.id,
    username: user.username,
    national_id: user.nationalId || null,
    password_hash: user.passwordHash,
    full_name: user.fullName,
    role: user.role,
    mobile_phone: user.mobilePhone || null,
    email: user.email || null,
    assigned_office_code: user.assignedOfficeCode || null,
    assigned_office_name: user.assignedOfficeName || null,
    is_active: user.isActive ?? true,
    is_password_changed: user.isPasswordChanged ?? false,
    custom_permissions: user.customPermissions || {},
    last_login_at: user.lastLoginAt || null,
    notes: user.notes || null,
    updated_at: new Date().toISOString(),
  };
}

function toOffice(row: any): ServerOffice {
  return {
    id: row.code,
    code: String(row.code),
    name: row.name || '',
    type: row.type || 'PRESHKHAN',
    customTypeName: row.custom_type_name || undefined,
    province: row.province || '',
    city: row.city || '',
    address: row.address || '',
    phone: row.phone || '',
    email: row.email || undefined,
    latitude: row.latitude == null ? undefined : Number(row.latitude),
    longitude: row.longitude == null ? undefined : Number(row.longitude),
    managerId: row.manager_id || undefined,
    managerName: row.manager_name || '',
    activeCampaignsCount: row.active_campaigns_count || 0,
    status: row.status || 'ACTIVE',
    createdAt: row.created_at || undefined,
    notes: row.notes || undefined,
  };
}

function officeRow(office: ServerOffice): any {
  return {
    code: String(office.code).trim(),
    name: office.name,
    type: office.type || 'PRESHKHAN',
    custom_type_name: office.customTypeName || null,
    province: office.province || '',
    city: office.city || '',
    address: office.address || null,
    phone: office.phone || null,
    email: office.email || null,
    latitude: office.latitude ?? null,
    longitude: office.longitude ?? null,
    manager_id: office.managerId || null,
    manager_name: office.managerName || 'مسئول دفتر',
    active_campaigns_count: office.activeCampaignsCount || 0,
    status: office.status || 'ACTIVE',
    notes: office.notes || null,
    updated_at: new Date().toISOString(),
  };
}

function toManager(row: any): ServerManager {
  return {
    id: String(row.id),
    managerCode: row.manager_code || '',
    username: row.username || undefined,
    nationalId: row.national_id || '',
    fullName: row.full_name || '',
    mobilePhone: row.mobile_phone || '',
    landlinePhone: row.landline_phone || '',
    email: row.email || undefined,
    assignedOfficeCode: row.assigned_office_code || '',
    assignedOfficeName: row.assigned_office_name || undefined,
    appointmentDate: row.appointment_date || undefined,
    status: row.status || 'ACTIVE',
    notes: row.notes || undefined,
  };
}

export async function fetchUsers(): Promise<ServerUser[] | null> {
  const db = getClient(); if (!db) return null;
  const { data, error } = await db.from('app_users').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(toUser);
}

export async function fetchOffices(): Promise<ServerOffice[] | null> {
  const db = getClient(); if (!db) return null;
  const { data, error } = await db.from('offices').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(toOffice);
}

export async function fetchManagers(): Promise<ServerManager[] | null> {
  const db = getClient(); if (!db) return null;
  const { data, error } = await db.from('office_managers').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(toManager);
}

export async function saveUser(user: ServerUser): Promise<ServerUser> {
  const db = getClient(); if (!db) throw new Error('Supabase مرکزی تنظیم نشده است.');
  const { data, error } = await db.from('app_users').upsert(userRow(user), { onConflict: 'id' }).select('*').single();
  if (error) throw error;
  return toUser(data);
}

export async function deleteUser(id: string): Promise<boolean> {
  const db = getClient(); if (!db) throw new Error('Supabase مرکزی تنظیم نشده است.');
  const { error } = await db.from('app_users').delete().eq('id', id);
  if (error) throw error;
  return true;
}

export async function saveOffice(office: ServerOffice): Promise<ServerOffice> {
  const db = getClient(); if (!db) throw new Error('Supabase مرکزی تنظیم نشده است.');
  const { data, error } = await db.from('offices').upsert(officeRow(office), { onConflict: 'code' }).select('*').single();
  if (error) throw error;
  return toOffice(data);
}

export async function saveOffices(offices: ServerOffice[]): Promise<void> {
  const db = getClient(); if (!db) throw new Error('Supabase مرکزی تنظیم نشده است.');
  if (!offices.length) return;
  const { error } = await db.from('offices').upsert(offices.map(officeRow), { onConflict: 'code' });
  if (error) throw error;
}

export async function deleteOffice(code: string): Promise<boolean> {
  const db = getClient(); if (!db) throw new Error('Supabase مرکزی تنظیم نشده است.');
  const { error } = await db.from('offices').delete().eq('code', code);
  if (error) throw error;
  return true;
}

export async function saveManager(manager: ServerManager): Promise<ServerManager> {
  const db = getClient(); if (!db) throw new Error('Supabase مرکزی تنظیم نشده است.');
  const row = {
    id: manager.id,
    manager_code: manager.managerCode,
    username: manager.username || null,
    national_id: manager.nationalId,
    full_name: manager.fullName,
    mobile_phone: manager.mobilePhone,
    landline_phone: manager.landlinePhone || null,
    email: manager.email || null,
    assigned_office_code: manager.assignedOfficeCode,
    assigned_office_name: manager.assignedOfficeName || null,
    appointment_date: manager.appointmentDate || null,
    status: manager.status || 'ACTIVE',
    notes: manager.notes || null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await db.from('office_managers').upsert(row, { onConflict: 'id' }).select('*').single();
  if (error) throw error;
  return toManager(data);
}

export async function authenticate(usernameOrId: string, password: string): Promise<{ success: boolean; user?: ServerUser; error?: string }> {
  const db = getClient(); if (!db) return { success: false, error: 'مرکز داده متمرکز تنظیم نشده است.' };
  const input = normalizeDigits(usernameOrId).toLowerCase();
  const pass = normalizeDigits(password);
  if (!input || !pass) return { success: false, error: 'نام کاربری و رمز عبور الزامی است.' };

  const { data, error } = await db.from('app_users').select('*');
  if (error) throw error;
  let row = (data || []).find((u: any) => {
    const username = normalizeDigits(u.username).toLowerCase();
    const nid = normalizeDigits(u.national_id);
    const office = normalizeDigits(u.assigned_office_code);
    return username === input || nid === input || office === input || `office${office}` === input;
  });

  if (!row) return { success: false, error: 'کاربری با این شناسه در پایگاه داده مرکزی یافت نشد.' };
  if (row.is_active === false) return { success: false, error: 'حساب کاربری شما غیرفعال یا تعلیق شده است.' };

  const stored = String(row.password_hash || '');
  let valid = stored === pass || normalizeDigits(stored) === pass;
  if (stored.startsWith('scrypt$')) {
    const [, salt, hash] = stored.split('$');
    const derived = crypto.scryptSync(pass, salt, 64).toString('hex');
    valid = crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(hash, 'hex'));
  }
  if (!valid) return { success: false, error: 'رمز عبور وارد شده نادرست می‌باشد.' };

  const updated = { ...row, last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  const result = await db.from('app_users').update({ last_login_at: updated.last_login_at, updated_at: updated.updated_at }).eq('id', row.id).select('*').single();
  if (result.error) throw result.error;
  return { success: true, user: toUser(result.data) };
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export async function changePassword(params: { userId?: string; username?: string; currentPassword?: string; newPassword: string }): Promise<{ success: boolean; user?: ServerUser; error?: string }> {
  const db = getClient(); if (!db) return { success: false, error: 'مرکز داده متمرکز تنظیم نشده است.' };
  const input = normalizeDigits(params.username || '').toLowerCase();
  let query = db.from('app_users').select('*').limit(1);
  if (params.userId) query = query.eq('id', params.userId) as any;
  else if (input) query = query.or(`username.eq.${input},national_id.eq.${input},assigned_office_code.eq.${input}`) as any;
  else return { success: false, error: 'شناسه کاربر الزامی است.' };
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return { success: false, error: 'کاربر در پایگاه داده مرکزی یافت نشد.' };

  if (params.currentPassword) {
    const check = await authenticate(data.username, params.currentPassword);
    if (!check.success) return { success: false, error: 'رمز عبور فعلی وارد شده نادرست است.' };
  }
  const newPassword = normalizeDigits(params.newPassword);
  if (!newPassword) return { success: false, error: 'رمز عبور جدید نمی‌تواند خالی باشد.' };

  const { data: updated, error: updateError } = await db.from('app_users').update({
    password_hash: hashPassword(newPassword),
    is_password_changed: true,
    updated_at: new Date().toISOString(),
  }).eq('id', data.id).select('*').single();
  if (updateError) throw updateError;
  return { success: true, user: toUser(updated) };
}

export async function syncUsers(users: ServerUser[]): Promise<ServerUser[]> {
  const db = getClient(); if (!db) throw new Error('Supabase مرکزی تنظیم نشده است.');
  const existing = await fetchUsers() || [];
  const map = new Map(existing.map(u => [u.id, u]));
  const rows = users.map(incoming => {
    const current = map.get(incoming.id);
    return current ? { ...current, ...incoming, passwordHash: current.passwordHash, isPasswordChanged: current.isPasswordChanged } : incoming;
  });
  const { error } = await db.from('app_users').upsert(rows.map(userRow), { onConflict: 'id' });
  if (error) throw error;
  return (await fetchUsers()) || rows;
}
