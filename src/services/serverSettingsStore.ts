/**
 * Settings (admin system settings, notification templates, channel configuration) are stored in the
 * central database. This module only keeps the last value read from the server in memory so that
 * synchronous getters keep working; every save is written to the database immediately.
 */

let memory: Record<string, any> = {};

export const SETTING_ADMIN_SYSTEM = 'admin_system_settings';
export const SETTING_NOTIFICATION_TEMPLATES = 'notification_templates';
export const SETTING_NOTIFICATION_CHANNELS = 'notification_channel_config';

export function hydrateServerSettings(settings: Record<string, any> | null | undefined): void {
  memory = settings && typeof settings === 'object' ? { ...settings } : {};
}

export function getServerSetting<T>(key: string, fallback: T): T {
  const value = memory[key];
  return value === undefined || value === null ? fallback : (value as T);
}

export async function saveServerSetting(key: string, value: unknown): Promise<boolean> {
  memory[key] = value;
  try {
    const res = await fetch(`/api/v1/settings/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    });
    const data = await res.json().catch(() => null);
    const ok = res.ok && Boolean(data?.success);
    if (!ok) console.warn(`[settings] Saving "${key}" to the database failed`, data?.error);
    return ok;
  } catch (e) {
    console.warn(`[settings] Saving "${key}" to the database failed`, e);
    return false;
  }
}

/**
 * Removes all cached browser data left behind by older versions (including stored credentials).
 * Data keys are first copied ONCE into a single backup entry that the app never reads, so nothing
 * that existed only in this browser is lost (credentials and logs are never backed up).
 */
export function purgeLegacyBrowserCache(): void {
  const dataKeys = [
    'ra_audit_campaigns_v2', 'ra_audit_offices_v2', 'ra_audit_managers_v2', 'ra_audit_office_types_v2',
    'ra_audit_events_v2', 'ra_audit_field_settings_v2', 'ra_audit_notifications_v2',
    'ra_audit_notif_channels_v2', 'ra_audit_notification_templates_v2', 'ra_admin_system_settings_v2',
  ];
  const dropKeys = [
    ...dataKeys, 'ra_audit_users_v2', 'ra_audit_access_logs_v2', 'ra_audit_certificates_v2', 'ra_audit_cross_tab_event',
  ];
  try {
    const BACKUP_KEY = 'ra_audit_legacy_backup_v1';
    if (!localStorage.getItem(BACKUP_KEY)) {
      const backup: Record<string, string> = {};
      dataKeys.forEach((k) => {
        const v = localStorage.getItem(k);
        if (v) backup[k] = v;
      });
      if (Object.keys(backup).length > 0) {
        try { localStorage.setItem(BACKUP_KEY, JSON.stringify(backup)); } catch { /* quota: skip backup */ }
      }
    }
    dropKeys.forEach((k) => localStorage.removeItem(k));
  } catch { /* storage unavailable */ }
}
