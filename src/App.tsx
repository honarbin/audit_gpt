import React, { useState, useEffect, useRef, useMemo } from 'react';
import { hasAuthToken, endServerSession } from './services/apiAuth';
import { 
  Building2, 
  Users, 
  BellRing, 
  History, 
  SlidersHorizontal, 
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { Navbar } from './components/Navbar';
import { InspectorUploadAndSampling } from './components/InspectorUploadAndSampling';
import { OfficeKartable } from './components/OfficeKartable';
import { InspectorReviewPanel } from './components/InspectorReviewPanel';
import { InspectionAnalytics } from './components/InspectionAnalytics';
import { OfficialMinutesModal } from './components/OfficialMinutesModal';
import { OfficeManagementView } from './components/OfficeManagementView';
import { UsersManagementPanel } from './components/UsersManagementPanel';
import { NotificationCenterView } from './components/NotificationCenterView';
import { AccessLogsPanel } from './components/AccessLogsPanel';
import { SupabaseSyncModal } from './components/SupabaseSyncModal';
import { Sidebar, MainNavTab } from './components/Sidebar';
import { LoginModal } from './components/LoginModal';
import { UserProfileModal } from './components/UserProfileModal';
import { ForcePasswordChangeModal } from './components/ForcePasswordChangeModal';
import { AdminSystemSettingsModal } from './components/AdminSystemSettingsModal';
import { LogRetentionModal } from './components/LogRetentionModal';
import { 
  OfficeProfile, 
  AuditCampaign, 
  AuditInspectionRecord, 
  CertificateRecord,
  OfficeManager,
  OfficeTypeDefinition,
  OfficeAuditEvent,
  OfficeStatus,
  FormFieldSetting,
  AppNotification,
  NotificationChannelConfig,
  UserAccessLog
} from './types';
import { AppUser } from './types/auth';
import { 
  getStoredAccessLogs,
  hydrateAccessLogs,
  refreshAccessLogsFromServer,
  saveStoredUsers, 
  saveUserToServer,
  getCurrentSessionUser, 
  setCurrentSessionUser, 
  clearCurrentSession,
  getUserPermissions,
  isPrivilegedUser,
  isStrictOfficeBoundUser,
  canUserAccessTab,
  logUserAccessAction,
  syncOfficeUsers,
  syncOfficesAndManagersFromUsers,
  getStoredShowQuickLogin,
  saveStoredShowQuickLogin,
  fetchUsersFromServer,
  fetchOfficesFromServer,
  syncAllUsersToServer,
  sanitizeAndReconcileUsers,
  normalizeUsername
} from './services/authService';
import {
  hydrateServerSettings,
  getServerSetting,
  saveServerSetting,
  SETTING_NOTIFICATION_CHANNELS,
  purgeLegacyBrowserCache,
} from './services/serverSettingsStore';
import {
  resolveManagers,
  resolveOffices,
  stripManagersPersonalFields,
  stripManagerPersonalFields,
  findManagerUser,
  applyManagerPersonalFieldsToUser,
} from './utils/managerIdentity';
import {
  fetchSystemBootstrap,
  type BootstrapResponse,
  syncCampaignsToServer,
  syncCampaignRecordToServer,
  syncOfficesToServer,
  syncManagersToServer,
  syncAuditEventsToServer,
  syncNotificationsToServer,
  syncFieldSettingsToServer,
  syncOfficeTypesToServer,
} from './services/centralSyncService';
import { 
  INITIAL_OFFICES, 
  SAMPLE_CERTIFICATES_RAW, 
  INITIAL_CAMPAIGNS,
  INITIAL_MANAGERS_LIST,
  INITIAL_OFFICE_TYPES_LIST
} from './data/sampleData';
import { INITIAL_AUDIT_EVENTS } from './data/sampleTimelineData';
import { DEFAULT_FORM_FIELD_SETTINGS, createAutoAuditEvent } from './utils/auditTimelineLogger';
import { deduplicateAuditRecords, areAuditRecordsIdentical } from './utils/samplingEngine';
import { 
  INITIAL_NOTIFICATIONS, 
  DEFAULT_NOTIFICATION_CHANNELS_CONFIG, 
  createNotification, 
  updateNotificationOnResponse 
} from './utils/notificationEngine';
import {
  fetchCampaignsFromSupabase,
  fetchAuditEventsFromSupabase,
  fetchNotificationsFromSupabase,
  fetchNotificationSettingsFromSupabase,
  fetchFormFieldSettingsFromSupabase
} from './services/supabaseService';
import { checkAndRunAutoPruning } from './services/systemSettingsService';
import {
  autoSyncOffice,
  autoDeleteOffice,
  autoSyncCampaign,
  autoSyncInspectionRecord,
  autoSyncAuditEvent,
} from './services/autoSyncService';
import {
  broadcastSyncEvent,
  subscribeToRealtimeSync,
  initSupabasePostgresSubscription,
} from './services/realtimeSyncBus';

export default function App() {
  const isRemoteUpdateRef = useRef(false);
  // Only a per-device UI preference stays in the browser; all data lives in the central database.
  const STORAGE_KEY_SELECTED_OFFICE = 'ra_audit_selected_office_code_v2';

  // Authentication and RBAC state
  const [users, setUsers] = useState<AppUser[]>([]);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => (hasAuthToken() ? getCurrentSessionUser() : null));
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(() => !(hasAuthToken() && getCurrentSessionUser()));
  const [isUserProfileModalOpen, setIsUserProfileModalOpen] = useState<boolean>(false);
  const [showQuickLoginPanel, setShowQuickLoginPanel] = useState<boolean>(() => getStoredShowQuickLogin());
  const isServerDataLoadedRef = useRef<boolean>(false);

  // User data is server-authoritative. localStorage is cache only and must never
  // push stale credentials back to the central database automatically.
  useEffect(() => {
    saveStoredUsers(users);
  }, [users]);

  // Keep currentUser in sync if updated in users list
  useEffect(() => {
    if (currentUser) {
      const refreshed = users.find(u => u.id === currentUser.id || (u.username && u.username.toLowerCase() === currentUser.username?.toLowerCase()));
      if (refreshed) {
        if (
          refreshed.role !== currentUser.role ||
          refreshed.fullName !== currentUser.fullName ||
          refreshed.isActive !== currentUser.isActive ||
          refreshed.assignedOfficeCode !== currentUser.assignedOfficeCode ||
          refreshed.isPasswordChanged !== currentUser.isPasswordChanged
        ) {
          const merged = { ...currentUser, ...refreshed };
          setCurrentUser(merged);
          setCurrentSessionUser(merged);
        }
      }
    }
  }, [users]);

  // Access logs state
  const [accessLogs, setAccessLogs] = useState<UserAccessLog[]>([]);

  // Navigation State (Each route represents a single dedicated task)
  const [activeTab, setActiveTab] = useState<
    | 'OFFICE_MANAGEMENT'
    | 'MANAGERS'
    | 'OFFICE_MAP'
    | 'OFFICE_TYPES'
    | 'SUSPENSIONS'
    | 'COMMITMENTS'
    | 'COMPLAINTS'
    | 'FORM_FIELDS'
    | 'SAMPLING'
    | 'CERTIFICATES_POOL'
    | 'OFFICE_KARTABLE'
    | 'INSPECTION_REVIEW'
    | 'INSPECTION_WARNINGS'
    | 'ANALYTICS'
    | 'NOTIFICATIONS'
    | 'ACCESS_LOGS'
    | 'USERS_MANAGEMENT'
  >('OFFICE_MANAGEMENT');
  const [selectedOfficeCode, setSelectedOfficeCode] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_SELECTED_OFFICE);
    if (saved) return saved;
    const sessionUser = getCurrentSessionUser();
    if (sessionUser?.assignedOfficeCode) return sessionUser.assignedOfficeCode;
    return '';
  });

  // Sync selectedOfficeCode to localStorage
  useEffect(() => {
    if (selectedOfficeCode) {
      localStorage.setItem(STORAGE_KEY_SELECTED_OFFICE, selectedOfficeCode);
    }
  }, [selectedOfficeCode]);

  // Notifications state (read from the central database)
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Notification Channels configuration state (stored in the central database)
  const [channelConfig, setChannelConfig] = useState<NotificationChannelConfig>(DEFAULT_NOTIFICATION_CHANNELS_CONFIG);

  // Sanitize and deduplicate managers list
  const sanitizeAndDeduplicateManagers = (mgrList: OfficeManager[]): OfficeManager[] => {
    if (!Array.isArray(mgrList)) return [];
    const result: OfficeManager[] = [];
    const seenIds = new Set<string>();
    const seenCodes = new Set<string>();

    mgrList.forEach((m) => {
      if (!m) return;
      const cleanId = String(m.id || m.managerCode || '').trim();
      const cleanCode = String(m.assignedOfficeCode || '').trim();

      if (!cleanId && !cleanCode) return;

      const finalId = cleanId || (cleanCode ? `MGR-${cleanCode}` : `MGR-${Date.now()}`);
      if (seenIds.has(finalId) || (cleanCode && seenCodes.has(cleanCode))) {
        return;
      }

      seenIds.add(finalId);
      if (cleanCode) seenCodes.add(cleanCode);

      result.push({
        ...m,
        id: finalId,
        managerCode: m.managerCode || finalId,
        assignedOfficeCode: cleanCode,
      });
    });

    return result;
  };

  // Sanitize and deduplicate offices list
  const sanitizeAndDeduplicateOffices = (officeList: OfficeProfile[]): OfficeProfile[] => {
    if (!Array.isArray(officeList)) return [];
    const result: OfficeProfile[] = [];
    const seenCodes = new Set<string>();
    const seenIds = new Set<string>();

    officeList.forEach((o) => {
      if (!o) return;
      const cleanCode = String(o.code || '').trim();
      const cleanId = String(o.id || '').trim();

      if (!cleanCode && !cleanId) return;
      if (cleanCode && seenCodes.has(cleanCode)) return;
      if (cleanId && seenIds.has(cleanId)) return;

      if (cleanCode) seenCodes.add(cleanCode);
      if (cleanId) seenIds.add(cleanId);

      result.push({
        ...o,
        code: cleanCode,
        id: cleanId || `off-${cleanCode}`,
      });
    });

    return result;
  };

  // Offices / managers state (read from the central database)
  const [offices, setOffices] = useState<OfficeProfile[]>([]);
  const [managers, setManagers] = useState<OfficeManager[]>([]);

  // Single source of truth: manager personal data (name, national id, mobile, e-mail,
  // username) is always read from the users table; the manager record only stores `userId`.
  const resolvedManagers = useMemo(() => resolveManagers(managers, users), [managers, users]);
  const resolvedOffices = useMemo(() => resolveOffices(offices, resolvedManagers), [offices, resolvedManagers]);

  // Enforce role-based tab restrictions & initial office binding
  useEffect(() => {
    if (currentUser) {
      const isStrict = isStrictOfficeBoundUser(currentUser);
      if (isStrict && currentUser.assignedOfficeCode) {
        // اختصاص پیش‌فرض اولیه در صورت خالی بودن دفتر فعال
        if (!selectedOfficeCode) {
          setSelectedOfficeCode(currentUser.assignedOfficeCode);
        }
        if (activeTab !== 'OFFICE_KARTABLE') {
          setActiveTab('OFFICE_KARTABLE');
        }
      } else {
        if (!selectedOfficeCode && offices.length > 0) {
          setSelectedOfficeCode(offices[0].code);
        }
        // If current activeTab is not permitted for the user, safely redirect to the first permitted tab
        if (!canUserAccessTab(activeTab, currentUser)) {
          const safeTab = currentUser.role === 'INSPECTOR' ? 'INSPECTION_REVIEW' : 'OFFICE_KARTABLE';
          if (activeTab !== safeTab) {
            setActiveTab(safeTab);
          }
        }
      }
    }
  }, [currentUser, activeTab, offices]);

  // Safe one-time initial reconciliation of office users on mount
  const isInitialSyncDoneRef = useRef(false);
  useEffect(() => {
    if (isInitialSyncDoneRef.current) return;
    isInitialSyncDoneRef.current = true;
    setUsers((prevUsers) => syncOfficeUsers(offices, prevUsers));
  }, []);

  // Office Types, field settings, audit events, campaigns: all read from the central database
  const [officeTypes, setOfficeTypes] = useState<OfficeTypeDefinition[]>([]);
  const [fieldSettings, setFieldSettings] = useState<FormFieldSetting[]>(DEFAULT_FORM_FIELD_SETTINGS);
  const [auditEvents, setAuditEvents] = useState<OfficeAuditEvent[]>([]);
  const [campaigns, setCampaigns] = useState<AuditCampaign[]>([]);

  // Certificate pool: a temporary working set for sampling (uploaded Excel), held in memory only.
  const [availableCertificates, setAvailableCertificates] = useState<CertificateRecord[]>([]);

  // Official Minutes Modal
  const [officialMinutesRecord, setOfficialMinutesRecord] = useState<AuditInspectionRecord | null>(null);

  // Supabase Sync Modal
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);

  // Modern Sidebar Navigation State
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [activePresetFilter, setActivePresetFilter] = useState<string | undefined>(undefined);

  // Admin System Settings Modal (Inspector visibility & Log retention)
  const [isAdminSettingsModalOpen, setIsAdminSettingsModalOpen] = useState(false);
  const [isLogRetentionModalOpen, setIsLogRetentionModalOpen] = useState(false);

  // ===========================================================================
  // The central database is the single source of truth.
  //  - Nothing is cached in the browser: every screen is filled from the server.
  //  - Every change is written to the database immediately (see `persist`).
  //  - Other devices/tabs are told "something changed" and simply re-read the database.
  // ===========================================================================
  const [serverLoadState, setServerLoadState] = useState<'loading' | 'ready' | 'error'>(() => (hasAuthToken() ? 'loading' : 'ready'));
  const [syncError, setSyncError] = useState<string | null>(null);
  // JSON of the last value known to be identical in the database (prevents echo / stale overwrites)
  const lastSyncedRef = useRef<Record<string, string>>({});
  // ids known to be in the database; an id that disappears from the list was deleted by THIS user
  const lastIdsRef = useRef<Record<string, string[]>>({});
  const idsOf = (list: any[]): string[] => (list || []).map((x) => String(x?.id ?? x?.code ?? '')).filter(Boolean);
  const lastRecordIdsRef = useRef<string[]>([]);
  const recordIdsOf = (list: AuditCampaign[]): string[] => (list || []).flatMap((c) => (c.records || []).map((r) => String(r.id)));
  const pendingWritesRef = useRef(0);
  const writeEpochRef = useRef(0);
  const refreshTimerRef = useRef<number | null>(null);

  const applyBootstrap = (bootstrap: BootstrapResponse) => {
    const synced = lastSyncedRef.current;

    // Users (authoritative; kept in memory only)
    const cleanUsers = sanitizeAndReconcileUsers(bootstrap.users || [], bootstrap.offices, bootstrap.managers);
    saveStoredUsers(cleanUsers);
    setUsers(cleanUsers);

    const currentSession = getCurrentSessionUser();
    if (currentSession) {
      const matched = cleanUsers.find(u =>
        u.id === currentSession.id ||
        (u.username && u.username.toLowerCase() === currentSession.username?.toLowerCase())
      );
      if (matched) {
        setCurrentUser(matched);
        setCurrentSessionUser(matched);
      } else {
        // The account was removed from the central database.
        setCurrentUser(null);
        setCurrentSessionUser(null);
        setIsLoginModalOpen(true);
      }
    }

    const nextOffices = sanitizeAndDeduplicateOffices(bootstrap.offices || []);
    const nextManagers = sanitizeAndDeduplicateManagers(bootstrap.managers || []);
    const nextCampaigns = bootstrap.campaigns || [];
    const nextEvents = bootstrap.auditEvents || [];
    const nextNotifications = bootstrap.notifications || [];
    const nextTypes = bootstrap.officeTypes || [];
    const nextFields: FormFieldSetting[] = Array.isArray(bootstrap.fieldSettings) ? bootstrap.fieldSettings : DEFAULT_FORM_FIELD_SETTINGS;

    hydrateServerSettings(bootstrap.settings);
    const nextChannels: NotificationChannelConfig = {
      ...DEFAULT_NOTIFICATION_CHANNELS_CONFIG,
      ...getServerSetting<Partial<NotificationChannelConfig>>(SETTING_NOTIFICATION_CHANNELS, {}),
    };

    const known = lastIdsRef.current;
    known.offices = (nextOffices || []).map((o) => String(o.code));
    known.managers = idsOf(nextManagers);
    known.campaigns = idsOf(nextCampaigns);
    lastRecordIdsRef.current = recordIdsOf(nextCampaigns);
    known.auditEvents = idsOf(nextEvents);
    known.notifications = idsOf(nextNotifications);
    known.officeTypes = (nextTypes || []).map((t: any) => String(t.code));

    synced.offices = JSON.stringify(nextOffices);
    synced.managers = JSON.stringify(stripManagersPersonalFields<OfficeManager, AppUser>(nextManagers, cleanUsers));
    synced.campaigns = JSON.stringify(nextCampaigns);
    synced.auditEvents = JSON.stringify(nextEvents);
    synced.notifications = JSON.stringify(nextNotifications);
    synced.officeTypes = JSON.stringify(nextTypes);
    synced.fieldSettings = JSON.stringify(nextFields);
    synced.channelConfig = JSON.stringify(nextChannels);

    setOffices(nextOffices);
    setManagers(nextManagers);
    setCampaigns(nextCampaigns);
    setAuditEvents(nextEvents);
    setNotifications(nextNotifications);
    setOfficeTypes(nextTypes);
    setFieldSettings(nextFields);
    setChannelConfig(nextChannels);

    hydrateAccessLogs(bootstrap.accessLogs || []);
    setAccessLogs(getStoredAccessLogs());
  };

  /** Re-reads everything from the database. Returns false if the server could not be reached. */
  const refreshFromServer = async (attempt = 0): Promise<boolean> => {
    // Never apply a snapshot that is older than a write we just made.
    if (pendingWritesRef.current > 0 && attempt < 10) {
      await new Promise((r) => setTimeout(r, 400));
      return refreshFromServer(attempt + 1);
    }
    const epoch = writeEpochRef.current;
    const bootstrap = await fetchSystemBootstrap();
    if (!bootstrap || !bootstrap.success) return false;
    if (epoch !== writeEpochRef.current && attempt < 10) {
      return refreshFromServer(attempt + 1);
    }
    applyBootstrap(bootstrap);
    return true;
  };

  const scheduleRefresh = () => {
    if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = window.setTimeout(() => { refreshFromServer().catch(() => {}); }, 300);
  };

  const loadInitialData = async () => {
    setServerLoadState('loading');
    try {
      const ok = await refreshFromServer();
      if (ok) {
        isServerDataLoadedRef.current = true;
        setServerLoadState('ready');
        return;
      }
    } catch (e) {
      console.warn('Central server load failed:', e);
    }
    setServerLoadState('error');
  };

  // First load, then a light re-read when the tab regains focus and every 30 seconds.
  useEffect(() => {
    purgeLegacyBrowserCache();
    // Nothing is read from the database before login; the data is loaded right after a successful sign-in.
    if (hasAuthToken()) loadInitialData();
    else clearCurrentSession();

    const onVisible = () => {
      if (document.visibilityState === 'visible' && isServerDataLoadedRef.current) scheduleRefresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && isServerDataLoadedRef.current) {
        refreshFromServer().catch(() => {});
      }
    }, 30000);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, []);

  // Check and run automatic log pruning based on admin retention policy (after data is loaded)
  useEffect(() => {
    if (serverLoadState !== 'ready') return;
    try {
      const pruneResult = checkAndRunAutoPruning(auditEvents, (newEvents) => {
        setAuditEvents(newEvents);
      });
      if (pruneResult.pruned && pruneResult.message) {
        console.log(pruneResult.message);
      }
    } catch (e) {
      console.warn('Auto pruning error:', e);
    }
  }, [serverLoadState === 'ready']);

  // Cross-tab / cross-device notifications carry NO data: they only say "something changed",
  // and every client re-reads the database.
  useEffect(() => {
    const unsubscribeBus = subscribeToRealtimeSync(() => {
      if (isServerDataLoadedRef.current) scheduleRefresh();
    });
    const cleanupDb = initSupabasePostgresSubscription(() => {
      if (isServerDataLoadedRef.current) scheduleRefresh();
    });
    return () => {
      unsubscribeBus();
      if (cleanupDb) cleanupDb();
    };
  }, []);

  /**
   * Writes a changed list to the database immediately. Skips values identical to what the
   * database already holds (so loading/refreshing never writes anything back). If the
   * database refuses the write, the user is told and the screen is reloaded from the database.
   */
  const persist = (key: string, value: unknown, send: (deletedIds: string[]) => Promise<boolean>, currentIds?: string[]) => {
    if (!isServerDataLoadedRef.current) return;
    const json = JSON.stringify(value);
    if (lastSyncedRef.current[key] === json) return;
    lastSyncedRef.current[key] = json;
    let deletedIds: string[] = [];
    if (currentIds) {
      const now = new Set(currentIds);
      deletedIds = (lastIdsRef.current[key] || []).filter((id) => !now.has(id));
      lastIdsRef.current[key] = currentIds;
    }
    writeEpochRef.current++;
    pendingWritesRef.current++;
    let failed = false;
    send(deletedIds)
      .then((ok) => {
        if (!ok) throw new Error('rejected');
        broadcastSyncEvent('SYSTEM_STATE_REFRESH');
      })
      .catch(() => {
        failed = true;
        delete lastSyncedRef.current[key];
        setSyncError('ذخیره تغییرات در دیتابیس انجام نشد. اطلاعات از دیتابیس بازخوانی شد؛ لطفاً دوباره تلاش کنید.');
      })
      .finally(() => {
        pendingWritesRef.current--;
        if (failed) refreshFromServer().catch(() => {});
      });
  };

  useEffect(() => {
    // Records removed by THIS user (recall, purge) are sent explicitly; everything else is merged on the server.
    const nowIds = new Set(recordIdsOf(campaigns));
    const removedRecords = lastRecordIdsRef.current.filter((id) => !nowIds.has(id));
    persist('campaigns', campaigns, (d) => syncCampaignsToServer(campaigns, d, removedRecords), idsOf(campaigns));
    if (isServerDataLoadedRef.current) lastRecordIdsRef.current = Array.from(nowIds);
  }, [campaigns]);
  useEffect(() => { persist('offices', offices, (d) => syncOfficesToServer(offices, d), offices.map((o) => String(o.code))); }, [offices]);
  useEffect(() => {
    // Only the reference to the user is stored for managers (no duplicated personal data).
    const stored = stripManagersPersonalFields<OfficeManager, AppUser>(managers, users);
    persist('managers', stored, (d) => syncManagersToServer(stored, d), idsOf(stored));
  }, [managers, users]);
  useEffect(() => { persist('officeTypes', officeTypes, (d) => syncOfficeTypesToServer(officeTypes, d), officeTypes.map((t: any) => String(t.code))); }, [officeTypes]);
  useEffect(() => { persist('auditEvents', auditEvents, (d) => syncAuditEventsToServer(auditEvents, d), idsOf(auditEvents)); }, [auditEvents]);
  useEffect(() => { persist('fieldSettings', fieldSettings, () => syncFieldSettingsToServer(fieldSettings)); }, [fieldSettings]);
  useEffect(() => { persist('notifications', notifications, (d) => syncNotificationsToServer(notifications, d), idsOf(notifications)); }, [notifications]);
  useEffect(() => {
    persist('channelConfig', channelConfig, () => saveServerSetting(SETTING_NOTIFICATION_CHANNELS, channelConfig));
  }, [channelConfig]);

  // Direct writes (users etc.) report failures through this event.
  useEffect(() => {
    const onFail = (e: Event) => setSyncError(String((e as CustomEvent).detail || 'ذخیره در دیتابیس انجام نشد.'));
    window.addEventListener('ra-sync-error', onFail);
    return () => window.removeEventListener('ra-sync-error', onFail);
  }, []);

  // Handle Campaign creation from step 1 (with automatic timeline logging & Notification generation)
  const handleCreateCampaign = (newCampaign: AuditCampaign) => {
    // 1. Strictly deduplicate within newCampaign.records
    const dedupedRecords = deduplicateAuditRecords(newCampaign.records || []);

    // 2. Strict check: prevent injecting records that already exist in any campaign of this office
    const existingOfficeRecords = campaigns
      .filter(c => String(c.officeCode || '').trim() === String(newCampaign.officeCode || '').trim())
      .flatMap(c => c.records || []);

    const nonDuplicateRecords = dedupedRecords.filter(newRec => {
      const alreadyExists = existingOfficeRecords.some(existRec => areAuditRecordsIdentical(existRec, newRec));
      return !alreadyExists;
    });

    if (nonDuplicateRecords.length === 0 && existingOfficeRecords.length > 0) {
      console.warn('تمام رکوردهای این دوره قبلاً به کارتابل دفتر ابلاغ شده‌اند. جلوگیری از ارسال تکراری.');
      return;
    }

    const finalizedCampaign: AuditCampaign = {
      ...newCampaign,
      records: nonDuplicateRecords,
      selectedSampleCount: nonDuplicateRecords.length,
    };

    setCampaigns(prev => [finalizedCampaign, ...prev]);
    setSelectedOfficeCode(finalizedCampaign.officeCode);

    // Auto log to timeline
    const autoEvt = createAutoAuditEvent(
      newCampaign.officeCode,
      'INSPECTION',
      `آغاز دوره بازرسی و ممیزی مدارک (کمپین ${newCampaign.title})`,
      `ایجاد ماموریت ممیزی شامل استخراج ${newCampaign.selectedSampleCount} نمونه گواهی بر اساس الگوریتم ۷‌گانه به روش نمونه‌گیری تصادفی و ریسک‌محور.`
    );
    setAuditEvents(prev => [autoEvt, ...prev]);

    // Create Notification for the office
    const newNotif = createNotification({
      eventCode: `EVT-CAMPAIGN-REQ-${newCampaign.officeCode}-${Date.now().toString().slice(-4)}`,
      title: `درخواست بارگذاری مدارک دوره بازرسی: ${newCampaign.title}`,
      message: `تعداد ${newCampaign.selectedSampleCount} پرونده گواهی برای دفتر ${newCampaign.officeName} جهت تطبیق مدارک انتخاب گردید. مهلت ارسال مدارک: ۵ روز کاری.`,
      category: 'INSPECTION_ACTION',
      severity: 'WARNING',
      priority: 'HIGH',
      status: 'ACTION_REQUIRED',
      officeCode: newCampaign.officeCode,
      officeName: newCampaign.officeName,
      targetEntityId: newCampaign.id,
      targetEntityType: 'CAMPAIGN',
      expiresAt: newCampaign.deadlineDate,
      metadata: {
        campaignId: newCampaign.id,
        campaignTitle: newCampaign.title,
        samplesCount: newCampaign.selectedSampleCount,
      },
      channelsConfig: channelConfig,
    });
    setNotifications(prev => [newNotif, ...prev]);

    // Asynchronous background sync to Supabase
  };

  // Handle Record updates (uploading docs, changing review verdicts, submitting notes)
  const handleUpdateRecord = (updatedRecord: AuditInspectionRecord) => {
    // The record itself is saved on its own (atomic merge on the server), so another user's edits to
    // other records of the same campaign are never overwritten.
    writeEpochRef.current++;
    pendingWritesRef.current++;
    syncCampaignRecordToServer(updatedRecord.campaignId, updatedRecord).then((ok) => {
      pendingWritesRef.current--;
      if (!ok) {
        setSyncError('ذخیره پرونده در دیتابیس انجام نشد. اطلاعات از دیتابیس بازخوانی شد؛ لطفاً دوباره تلاش کنید.');
        refreshFromServer().catch(() => {});
      }
    });
    setCampaigns(prev => prev.map(campaign => {
      if (campaign.id !== updatedRecord.campaignId) return campaign;
      return {
        ...campaign,
        records: campaign.records.map(rec => rec.id === updatedRecord.id ? updatedRecord : rec)
      };
    }));

    // Background sync record to Supabase (sanitizing uploaded documents binaries)

    // Auto update related notifications when office submits response/docs or inspector reviews
    if (updatedRecord.status === 'UPLOADED' || updatedRecord.status === 'UNDER_REVIEW') {
      const latestNote = updatedRecord.notesHistory?.[updatedRecord.notesHistory.length - 1];
      setNotifications(prev => updateNotificationOnResponse(prev, {
        targetEntityId: updatedRecord.id,
        responderRole: 'OFFICE_USER',
        responderName: latestNote?.authorName || 'مسئول دفتر صدور گواهی',
        responseText: updatedRecord.officeNotes || latestNote?.text || 'مدارک و مستندات پرونده با موفقیت توسط دفتر بارگذاری گردید.',
        actionTaken: 'بارگذاری مدارک و ارسال جهت بررسی بازرس',
        newStatus: 'RESPONDED',
        channelsConfig: channelConfig,
      }));
    } else if (updatedRecord.status === 'APPROVED') {
      const autoEvt = createAutoAuditEvent(
        updatedRecord.certificate.officeCode,
        'INSPECTION',
        `تایید انطباق پرونده گواهی: ${updatedRecord.certificate.applicantName}`,
        `مدارک بارگذاری شده توسط دفتر برای متقاضی ${updatedRecord.certificate.applicantName} (کدملی: ${updatedRecord.certificate.nationalId}) با امتیاز ${updatedRecord.complianceScore} تایید گردید.`
      );
      setAuditEvents(prev => [autoEvt, ...prev]);


      // Update notification status to RESOLVED
      setNotifications(prev => updateNotificationOnResponse(prev, {
        targetEntityId: updatedRecord.id,
        responderRole: 'INSPECTOR',
        responderName: updatedRecord.reviewerName || 'بازرس مرکز بازرسی و نظارت مرکز میانی عام',
        responseText: updatedRecord.inspectorNotes || 'مدارک و الزامات دستورالعمل صدور به طور کامل تایید گردید.',
        actionTaken: 'تایید انطباق و مختومه‌سازی پرونده',
        newStatus: 'RESOLVED',
        channelsConfig: channelConfig,
      }));
    } else if (updatedRecord.status === 'DEFECT_MAJOR' || updatedRecord.status === 'DEFECT_MINOR' || updatedRecord.status === 'REJECTED') {
      const isMajor = updatedRecord.status === 'DEFECT_MAJOR';
      const autoEvt = createAutoAuditEvent(
        updatedRecord.certificate.officeCode,
        isMajor ? 'VIOLATION' : 'WARNING',
        `ثبت ${isMajor ? 'تخلف و عدم انطباق عمده' : 'نقص مدارک'} در پرونده: ${updatedRecord.certificate.applicantName}`,
        `عدم انطباق برای پرونده رهگیری ${updatedRecord.certificate.trackingCode} ثبت شد. توضیحات: ${updatedRecord.inspectorNotes || 'مغایرت مدارک با دستورالعمل صدور'}`
      );
      setAuditEvents(prev => [autoEvt, ...prev]);

      // Create Defect Notification for the office
      const defectNotif = createNotification({
        eventCode: `EVT-DEFECT-${updatedRecord.certificate.officeCode}-${Date.now().toString().slice(-4)}`,
        title: `اعلام نقص و عدم انطباق در پرونده متقاضی ${updatedRecord.certificate.applicantName}`,
        message: `بازرس در پرونده رهگیری ${updatedRecord.certificate.trackingCode} اعلام نقص نموده است: ${updatedRecord.inspectorNotes || 'کسری یا مغایرت مدارک'}. مهلت اصلاح: ۳ روز کاری.`,
        category: 'DEFECT_ALERT',
        severity: isMajor ? 'CRITICAL' : 'WARNING',
        priority: 'URGENT',
        status: 'ACTION_REQUIRED',
        officeCode: updatedRecord.certificate.officeCode,
        officeName: updatedRecord.certificate.officeName,
        targetEntityId: updatedRecord.id,
        targetEntityType: 'INSPECTION_RECORD',
        metadata: {
          trackingCode: updatedRecord.certificate.trackingCode,
          applicantName: updatedRecord.certificate.applicantName,
          nationalId: updatedRecord.certificate.nationalId,
          campaignId: updatedRecord.campaignId,
        },
        channelsConfig: channelConfig,
      });
      setNotifications(prev => [defectNotif, ...prev]);

    }
  };

  // Handle office status update (e.g. suspension, revocation, reactivation)
  const handleUpdateOfficeStatus = (officeCode: string, newStatus: OfficeStatus) => {
    setOffices(prev => prev.map(off => {
      if (off.code === officeCode) {
        return { ...off, status: newStatus };
      }
      return off;
    }));

    const targetOffice = offices.find(o => o.code === officeCode);
    const officeName = targetOffice?.name || `دفتر ${officeCode}`;

    // Auto-create corresponding audit timeline event & notification
    if (newStatus === 'SUSPENDED') {
      const autoEvt = createAutoAuditEvent(
        officeCode,
        'SUSPENSION',
        'تعلیق موقت فعالیت دفتر ثبت‌نام',
        'فعالیت دفتر به دستور هیئت نظارت و بازرسی به دلیل بررسی تخلفات به مدت ۳ ماه تعلیق گردید.',
        {
          suspensionDays: 90,
          endDate: '1405/08/20',
          isAlarmActive: true,
        }
      );
      setAuditEvents(prev => [autoEvt, ...prev]);

      const suspNotif = createNotification({
        eventCode: `EVT-SUSPEND-${officeCode}-${Date.now().toString().slice(-4)}`,
        title: `حکم تعلیق موقت فعالیت دفتر ${officeName}`,
        message: `فعالیت دفتر شماره ${officeCode} به دلیل بررسی تخلفات و عدم انطباق‌های صادره به مدت ۳ ماه به حالت تعلیق درآمد.`,
        category: 'LIFECYCLE_EVENT',
        severity: 'CRITICAL',
        priority: 'URGENT',
        status: 'ACTION_REQUIRED',
        officeCode: officeCode,
        officeName: officeName,
        targetEntityId: officeCode,
        targetEntityType: 'OFFICE',
        channelsConfig: channelConfig,
      });
      setNotifications(prev => [suspNotif, ...prev]);

      autoSyncAuditEvent(autoEvt);
      if (targetOffice) {
        autoSyncOffice({ ...targetOffice, status: newStatus });
      }
    } else if (newStatus === 'REVOKED') {
      const autoEvt = createAutoAuditEvent(
        officeCode,
        'REVOCATION',
        'ابطال دائم مجوز دفتر ثبت‌نام',
        'مجوز صدور گواهی الکترونیکی دفتر به طور قطعی ابطال و کلیه دسترسی‌های سیستمی مسدود گردید.'
      );
      setAuditEvents(prev => [autoEvt, ...prev]);

      const revNotif = createNotification({
        eventCode: `EVT-REVOKE-${officeCode}-${Date.now().toString().slice(-4)}`,
        title: `حکم ابطال قطعی مجوز فعالیت دفتر ${officeName}`,
        message: `مجوز صدور گواهی الکترونیکی دفتر شماره ${officeCode} ابطال گردید و به سامانه مرکز بازرسی و نظارت دفاتر ثبت نام مرکز میانی عام گزارش شد.`,
        category: 'LIFECYCLE_EVENT',
        severity: 'CRITICAL',
        priority: 'URGENT',
        status: 'RESOLVED',
        officeCode: officeCode,
        officeName: officeName,
        channelsConfig: channelConfig,
      });
      setNotifications(prev => [revNotif, ...prev]);

      autoSyncAuditEvent(autoEvt);
      if (targetOffice) {
        autoSyncOffice({ ...targetOffice, status: newStatus });
      }
    } else if (newStatus === 'ACTIVE') {
      const autoEvt = createAutoAuditEvent(
        officeCode,
        'REINSTATEMENT',
        'رفع تعلیق و فعال‌سازی مجدد دفتر',
        'پس از بررسی مدارک و انقضای دوره تعلیق، فعالیت دفتر مجدداً در شبکه ممیزی فعال گردید.'
      );
      setAuditEvents(prev => [autoEvt, ...prev]);

      const reinNotif = createNotification({
        eventCode: `EVT-REINSTATE-${officeCode}-${Date.now().toString().slice(-4)}`,
        title: `رفع تعلیق و فعال‌سازی مجدد دفتر ${officeName}`,
        message: `دفتر شماره ${officeCode} مجدداً مجاز به صدور گواهی الکترونیکی در سامانه گردید.`,
        category: 'LIFECYCLE_EVENT',
        severity: 'SUCCESS',
        priority: 'NORMAL',
        status: 'RESOLVED',
        officeCode: officeCode,
        officeName: officeName,
        channelsConfig: channelConfig,
      });
      setNotifications(prev => [reinNotif, ...prev]);

      autoSyncAuditEvent(autoEvt);
      if (targetOffice) {
        autoSyncOffice({ ...targetOffice, status: newStatus });
      }
    }
  };

  // Handle single office profile update
  const handleUpdateOffice = (updatedOffice: OfficeProfile) => {
    setOffices(prev => prev.map(o => o.code === updatedOffice.code ? updatedOffice : o));
    // Auto log update
    const autoEvt = createAutoAuditEvent(
      updatedOffice.code,
      'INSPECTION',
      'بروزرسانی مشخصات و پرونده دفتر ثبت‌نام',
      `اطلاعات ثبتی دفتر شامل مشخصات ارتباطی، تلفن و آدرس توسط کاربر در کارتابل بروزرسانی گردید.`
    );
    setAuditEvents(prev => [autoEvt, ...prev]);

    // Instant auto-sync to cloud database
    autoSyncOffice(updatedOffice);
    autoSyncAuditEvent(autoEvt);
  };

  // Handle single manager update
  const handleUpdateManager = (updatedManager: OfficeManager) => {
    // Personal fields edited here belong to the linked user account: write them there.
    const linkedUser = findManagerUser<AppUser>(updatedManager, users);
    if (linkedUser) {
      const updatedUser = applyManagerPersonalFieldsToUser<AppUser>(updatedManager, linkedUser);
      setUsers(prev => {
        const next = prev.map(u => (u.id === updatedUser.id ? updatedUser : u));
        saveStoredUsers(next);
        return next;
      });
      saveUserToServer(updatedUser).catch((err) => console.warn('User sync warning:', err));
    }

    const storedManager = stripManagerPersonalFields<OfficeManager, AppUser>(
      linkedUser ? { ...updatedManager, userId: linkedUser.id } : updatedManager,
      users
    );

    setManagers(prev => {
      const cleanId = String(updatedManager.id || updatedManager.managerCode || '').trim();
      const cleanCode = String(updatedManager.assignedOfficeCode || '').trim();
      const filtered = prev.filter(m => {
        const id = String(m.id || m.managerCode || '').trim();
        const code = String(m.assignedOfficeCode || '').trim();
        return (cleanId ? id !== cleanId : true) && (cleanCode ? code !== cleanCode : true);
      });
      // The effect above persists/syncs the list, so no direct sync call is needed here.
      return [...filtered, storedManager];
    });
  };

  // Handle adding new audit timeline event
  const handleAddAuditEvent = (newEventData: Omit<OfficeAuditEvent, 'id' | 'createdAt'>) => {
    const newEvent: OfficeAuditEvent = {
      ...newEventData,
      id: `evt-${Date.now()}`,
      createdAt: '1405/05/20',
    };
    setAuditEvents(prev => [newEvent, ...prev]);

  };

  // Handle resolving an alarm/event
  const handleResolveAuditEvent = (eventId: string) => {
    setAuditEvents(prev => prev.map(evt => {
      if (evt.id === eventId) {
        return { ...evt, isResolved: true, isAlarmActive: false };
      }
      return evt;
    }));

    // Also mark matching notifications as resolved
    setNotifications(prev => updateNotificationOnResponse(prev, {
      targetEntityId: eventId,
      responderRole: 'SUPERVISOR',
      responderName: 'کارشناس نظارت و ممیزی',
      responseText: 'مهلت اقدام و تعهدنامه مربوطه مختومه و تایید گردید.',
      actionTaken: 'رفع آلارم و مختومه‌سازی',
      newStatus: 'RESOLVED',
      channelsConfig: channelConfig,
    }));
  };

  // Handle recalling/returning a record back from the campaign/kartable before or during audit
  const handleRecallRecord = (
    recordId: string, 
    campaignId?: string, 
    reason?: string,
    recordObj?: AuditInspectionRecord
  ) => {
    let targetOfficeCode = '';
    let targetApplicantName = '';
    let targetTrackingCode = '';

    setCampaigns(prev => prev.map(camp => {
      // Find matching record across campaigns
      const found = camp.records?.find(r => 
        r.id === recordId || 
        r.certificateId === recordId || 
        (recordObj && (
          r.id === recordObj.id || 
          r.certificateId === recordObj.certificateId || 
          (r.certificate?.serialNumber && r.certificate?.serialNumber === recordObj.certificate?.serialNumber)
        ))
      );

      if (found) {
        targetOfficeCode = targetOfficeCode || found.certificate?.officeCode || found.officeCode || camp.officeCode;
        targetApplicantName = targetApplicantName || found.certificate?.applicantName || '';
        targetTrackingCode = targetTrackingCode || found.certificate?.trackingCode || '';
        
        const remainingRecords = camp.records.filter(r => 
          r.id !== recordId && 
          r.certificateId !== recordId && 
          (!recordObj || (
            r.id !== recordObj.id && 
            r.certificateId !== recordObj.certificateId && 
            (!r.certificate?.serialNumber || r.certificate?.serialNumber !== recordObj.certificate?.serialNumber)
          ))
        );

        return {
          ...camp,
          records: remainingRecords,
          sampleSize: remainingRecords.length,
        };
      }
      return camp;
    }));

    // Add audit event log
    const autoEvt = createAutoAuditEvent(
      targetOfficeCode || selectedOfficeCode || '1607',
      'INSPECTION',
      `استرداد و عودت پرونده بازرسی: ${targetApplicantName || recordId}`,
      `پرونده با شماره رهگیری ${targetTrackingCode} به درخواست کاربر از کارتابل بازرسی دفتر خارج و عودت گردید. دلیل: ${reason || 'استرداد قبل از بارگذاری مدارک'}`
    );
    setAuditEvents(prev => [autoEvt, ...prev]);

    if (currentUser) {
      logUserAccessAction(
        currentUser,
        'UPDATE_RECORD',
        `استرداد پرونده ${targetTrackingCode} (${targetApplicantName}): ${reason || 'عودت از کارتابل'}`
      );
    }
  };

  // Apply state pulled from Supabase database
  const handleApplyRemoteState = (remoteData: {
    offices?: OfficeProfile[];
    officeTypes?: OfficeTypeDefinition[];
    certificates?: CertificateRecord[];
    campaigns?: AuditCampaign[];
    auditEvents?: OfficeAuditEvent[];
    notifications?: AppNotification[];
    channelConfig?: NotificationChannelConfig;
    fieldSettings?: FormFieldSetting[];
  }) => {
    if (remoteData.offices && remoteData.offices.length > 0) setOffices(remoteData.offices);
    if (remoteData.officeTypes && remoteData.officeTypes.length > 0) setOfficeTypes(remoteData.officeTypes);
    if (remoteData.campaigns && remoteData.campaigns.length > 0) setCampaigns(remoteData.campaigns);
    if (remoteData.auditEvents && remoteData.auditEvents.length > 0) setAuditEvents(remoteData.auditEvents);
    if (remoteData.notifications && remoteData.notifications.length > 0) setNotifications(remoteData.notifications);
    if (remoteData.channelConfig) setChannelConfig(remoteData.channelConfig);
    if (remoteData.fieldSettings && remoteData.fieldSettings.length > 0) setFieldSettings(remoteData.fieldSettings);
  };

  // "Reset": discard anything not yet saved and re-read everything from the database.
  // Sample data is never written back to the database.
  const handleResetData = () => {
    refreshFromServer().catch(() => {});
    setActiveTab('OFFICE_MANAGEMENT');
  };

  // Count pending uploads for the active office (strictly deduplicated to prevent inflated badge count)
  const effectiveOfficeCode = (isStrictOfficeBoundUser(currentUser) && currentUser?.assignedOfficeCode)
    ? String(currentUser.assignedOfficeCode).trim()
    : String(selectedOfficeCode).trim();

  const currentOfficeCampaigns = campaigns.filter(c => {
    const campOfficeCode = String(c.officeCode || c.officeId || '').trim();
    return campOfficeCode === effectiveOfficeCode || (!campOfficeCode && campaigns.length === 1);
  });
  const rawOfficeRecords = currentOfficeCampaigns.flatMap(c => c.records || []);
  const deduplicatedOfficeRecords = deduplicateAuditRecords(rawOfficeRecords);

  const pendingOfficeUploadsCount = deduplicatedOfficeRecords.filter(
    r => r.status === 'PENDING_UPLOAD' || !r.status
  ).length;

  const allDeduplicatedCampaignRecords = deduplicateAuditRecords(campaigns.flatMap(c => c.records || []));
  const pendingInspectorReviewCount = allDeduplicatedCampaignRecords.filter(
    r => r.status === 'UPLOADED'
  ).length;

  if (serverLoadState !== 'ready') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6 font-sans" dir="rtl">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-lg p-8 text-center">
          {serverLoadState === 'loading' ? (
            <p className="text-sm font-bold text-slate-700">در حال دریافت اطلاعات از دیتابیس مرکزی…</p>
          ) : (
            <>
              <p className="text-sm font-black text-rose-700 mb-2">ارتباط با دیتابیس مرکزی برقرار نشد</p>
              <p className="text-xs text-slate-600 leading-6 mb-5">
                برای جلوگیری از نمایش اطلاعات قدیمی، سامانه فقط با اتصال به دیتابیس کار می‌کند. اتصال اینترنت و تنظیمات سرور را بررسی کنید و دوباره تلاش نمایید.
              </p>
              <button
                onClick={() => loadInitialData()}
                className="px-5 py-2 rounded-lg bg-teal-700 text-white text-xs font-bold hover:bg-teal-800"
              >
                تلاش مجدد
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/80 text-slate-900 flex flex-col font-sans selection:bg-teal-600 selection:text-white" dir="rtl">
      {syncError && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] max-w-xl w-[92%] bg-rose-600 text-white text-xs font-bold rounded-xl shadow-xl px-4 py-3 flex items-start gap-3">
          <span className="flex-1 leading-6">{syncError}</span>
          <button onClick={() => setSyncError(null)} className="shrink-0 font-black" aria-label="بستن">✕</button>
        </div>
      )}
      {/* Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        offices={resolvedOffices}
        selectedOfficeCode={selectedOfficeCode}
        setSelectedOfficeCode={setSelectedOfficeCode}
        pendingOfficeUploadsCount={pendingOfficeUploadsCount}
        pendingInspectorReviewCount={pendingInspectorReviewCount}
        notifications={notifications}
        onMarkAllNotificationsAsRead={() => {
          setNotifications(prev => prev.map(n => n.status === 'UNREAD' ? { ...n, status: 'READ' } : n));
        }}
        onResetData={handleResetData}
        onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
        currentUser={currentUser}
        onOpenUserProfile={() => setIsUserProfileModalOpen(true)}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        onOpenAdminSettings={() => setIsAdminSettingsModalOpen(true)}
        onLogout={() => {
          if (currentUser) {
            logUserAccessAction(currentUser, 'LOGOUT', 'خروج موفق از حساب کاربری');
          }
          clearCurrentSession();
          // End the server session, then reload so no data stays in this tab's memory.
          endServerSession().finally(() => window.location.reload());
        }}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(prev => !prev)}
        onNavigateToNotifications={() => setActiveTab('NOTIFICATIONS')}
      />

      {/* Main Layout Container: Dark Petrol Sidebar + Fluid Content */}
      <div className="flex-1 flex">
        {/* Modern Sidebar (Petrol dark theme matching user requested design) */}
        <Sidebar
          currentTab={activeTab}
          onNavigate={(tabKey, filterPreset) => {
            setActivePresetFilter(filterPreset);
            setIsMobileSidebarOpen(false);
            if (tabKey === 'DASHBOARD') {
              setActiveTab('ANALYTICS');
            } else if (tabKey === 'INSPECTION_REVIEW') {
              setActiveTab('INSPECTION_REVIEW');
            } else if (tabKey === 'OFFICE_KARTABLE') {
              setActiveTab('OFFICE_KARTABLE');
            } else if (tabKey === 'SAMPLING') {
              setActiveTab('SAMPLING');
            } else if (tabKey === 'CERTIFICATES_POOL') {
              setActiveTab('CERTIFICATES_POOL');
            } else if (tabKey === 'INSPECTION_WARNINGS') {
              setActiveTab('INSPECTION_WARNINGS');
            } else if (tabKey === 'OFFICE_MANAGEMENT') {
              setActiveTab('OFFICE_MANAGEMENT');
            } else if (tabKey === 'MANAGERS') {
              setActiveTab('MANAGERS');
            } else if (tabKey === 'OFFICE_MAP') {
              setActiveTab('OFFICE_MAP');
            } else if (tabKey === 'OFFICE_TYPES') {
              setActiveTab('OFFICE_TYPES');
            } else if (tabKey === 'SUSPENSIONS') {
              setActiveTab('SUSPENSIONS');
            } else if (tabKey === 'COMMITMENTS') {
              setActiveTab('COMMITMENTS');
            } else if (tabKey === 'COMPLAINTS') {
              setActiveTab('COMPLAINTS');
            } else if (tabKey === 'FORM_FIELDS') {
              setActiveTab('FORM_FIELDS');
            } else if (tabKey === 'SAMPLING') {
              setActiveTab('SAMPLING');
            } else if (tabKey === 'USERS_MANAGEMENT') {
              setActiveTab('USERS_MANAGEMENT');
            } else if (tabKey === 'NOTIFICATIONS') {
              setActiveTab('NOTIFICATIONS');
            } else if (tabKey === 'ACCESS_LOGS') {
              setActiveTab('ACCESS_LOGS');
            }
          }}
          currentUser={currentUser}
          onOpenAdminSettings={() => setIsAdminSettingsModalOpen(true)}
          onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
          isOpenMobile={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          activePresetFilter={activePresetFilter}
        />

        {/* Dynamic View Area */}
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-5 space-y-4">
        {/* Minimalist Breadcrumb Navigation */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          <span className="hover:text-slate-700 cursor-default">سامانه نظارت و بازرسی</span>
          <span className="text-slate-300">/</span>
          {activeTab === 'OFFICE_MANAGEMENT' && (
            <>
              <span className="text-slate-500">مدیریت دفاتر</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-800 font-semibold">دفاتر RA</span>
            </>
          )}
          {activeTab === 'MANAGERS' && (
            <>
              <span className="text-slate-500">مدیریت دفاتر</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-800 font-semibold">مسئولین دفاتر RA</span>
            </>
          )}
          {activeTab === 'OFFICE_MAP' && (
            <>
              <span className="text-slate-500">مدیریت دفاتر</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-800 font-semibold">نقشه پراکندگی جغرافیایی</span>
            </>
          )}
          {activeTab === 'OFFICE_TYPES' && (
            <>
              <span className="text-slate-500">مدیریت دفاتر</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-800 font-semibold">تعاریف و انواع دفاتر RA</span>
            </>
          )}
          {activeTab === 'SUSPENSIONS' && (
            <>
              <span className="text-slate-500">نظارت و پیگیری</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-800 font-semibold">دفاتر معلق و احکام نظارتی</span>
            </>
          )}
          {activeTab === 'COMMITMENTS' && (
            <>
              <span className="text-slate-500">نظارت و پیگیری</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-800 font-semibold">تعهدنامه‌های نظارتی</span>
            </>
          )}
          {activeTab === 'COMPLAINTS' && (
            <>
              <span className="text-slate-500">نظارت و پیگیری</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-800 font-semibold">شکایات و پرونده‌های بازرسی</span>
            </>
          )}
          {activeTab === 'FORM_FIELDS' && (
            <>
              <span className="text-slate-500">مدیریت سیستم</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-800 font-semibold">تنظیمات فیلدهای فرم دفاتر</span>
            </>
          )}
          {activeTab === 'USERS_MANAGEMENT' && (
            <>
              <span className="text-slate-500">مدیریت سیستم</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-800 font-semibold">کاربران و دسترسی‌ها (RBAC)</span>
            </>
          )}
          {activeTab === 'NOTIFICATIONS' && (
            <>
              <span className="text-slate-500">مرکز پیام‌ها</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-800 font-semibold">اعلان‌ها و رویدادها</span>
            </>
          )}
          {activeTab === 'ACCESS_LOGS' && (
            <>
              <span className="text-slate-500">امنیت و پایش</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-800 font-semibold">لاگ تردد و رویت</span>
            </>
          )}
          {activeTab === 'OFFICE_KARTABLE' && (
            <>
              <span className="text-slate-500">میز کار و کارتابل‌ها</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-800 font-semibold">کارتابل دفتر ثبت نام</span>
            </>
          )}
          {activeTab === 'INSPECTION_REVIEW' && (
            <>
              <span className="text-slate-500">میز کار و کارتابل‌ها</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-800 font-semibold">کارتابل بازرسی و ممیزی مدارک</span>
            </>
          )}
          {activeTab === 'SAMPLING' && (
            <>
              <span className="text-slate-500">فرآیند بازرسی</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-800 font-semibold">نمونه‌گیری آماری و ابلاغ بازرسی</span>
            </>
          )}
          {activeTab === 'CERTIFICATES_POOL' && (
            <>
              <span className="text-slate-500">فرآیند بازرسی</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-800 font-semibold">بانک جامع گواهی‌ها و بارگذاری اکسل</span>
            </>
          )}
          {activeTab === 'INSPECTION_WARNINGS' && (
            <>
              <span className="text-slate-500">فرآیند بازرسی</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-800 font-semibold">رصد و نظارت بر اخطارهای بازرسی</span>
            </>
          )}
          {activeTab === 'ANALYTICS' && (
            <>
              <span className="text-slate-500">میز کار</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-800 font-semibold">داشبورد شاخص‌ها و آمار</span>
            </>
          )}
        </div>

        {(activeTab === 'OFFICE_MANAGEMENT' ||
          activeTab === 'MANAGERS' ||
          activeTab === 'OFFICE_MAP' ||
          activeTab === 'OFFICE_TYPES' ||
          activeTab === 'SUSPENSIONS' ||
          activeTab === 'COMMITMENTS' ||
          activeTab === 'COMPLAINTS' ||
          activeTab === 'FORM_FIELDS') && (
          <OfficeManagementView
            viewMode={
              activeTab === 'MANAGERS'
                ? 'MANAGERS'
                : activeTab === 'OFFICE_MAP'
                ? 'MAP'
                : activeTab === 'OFFICE_TYPES'
                ? 'TYPES'
                : activeTab === 'FORM_FIELDS'
                ? 'FIELDS'
                : activeTab === 'SUSPENSIONS'
                ? 'SUSPENSIONS'
                : activeTab === 'COMMITMENTS'
                ? 'COMMITMENTS'
                : activeTab === 'COMPLAINTS'
                ? 'COMPLAINTS'
                : 'OFFICES'
            }
            offices={resolvedOffices}
            setOffices={setOffices}
            managers={resolvedManagers}
            setManagers={setManagers}
            officeTypes={officeTypes}
            setOfficeTypes={setOfficeTypes}
            fieldSettings={fieldSettings}
            setFieldSettings={setFieldSettings}
            auditEvents={auditEvents}
            setAuditEvents={setAuditEvents}
            campaigns={campaigns}
            setCampaigns={setCampaigns}
            certificates={availableCertificates}
            setCertificates={setAvailableCertificates}
            onAddAuditEvent={handleAddAuditEvent}
            onResolveAuditEvent={handleResolveAuditEvent}
            onUpdateOfficeStatus={handleUpdateOfficeStatus}
            onSelectOfficeForInspection={(code) => {
              setSelectedOfficeCode(code);
              setActiveTab('SAMPLING');
            }}
            currentUser={currentUser || undefined}
            users={users}
            setUsers={setUsers}
            showQuickLoginPanel={showQuickLoginPanel}
            setShowQuickLoginPanel={setShowQuickLoginPanel}
            initialStatusPreset={activePresetFilter}
          />
        )}

        {activeTab === 'USERS_MANAGEMENT' && currentUser && (
          <UsersManagementPanel
            currentUser={currentUser}
            users={users}
            setUsers={setUsers}
            offices={resolvedOffices}
            setOffices={setOffices}
            certificates={availableCertificates}
            setCertificates={setAvailableCertificates}
            campaigns={campaigns}
            setCampaigns={setCampaigns}
            auditEvents={auditEvents}
            setAuditEvents={setAuditEvents}
            managers={resolvedManagers}
            setManagers={setManagers}
            showQuickLoginPanel={showQuickLoginPanel}
            setShowQuickLoginPanel={setShowQuickLoginPanel}
          />
        )}

        {(activeTab === 'SAMPLING' || activeTab === 'CERTIFICATES_POOL') && (
          <InspectorUploadAndSampling
            offices={resolvedOffices}
            onUpdateOffices={setOffices}
            selectedOfficeCode={selectedOfficeCode}
            setSelectedOfficeCode={setSelectedOfficeCode}
            availableCertificates={availableCertificates}
            setAvailableCertificates={setAvailableCertificates}
            campaigns={campaigns}
            currentUser={currentUser}
            onCreateCampaign={handleCreateCampaign}
            onNavigateToOfficeKartable={() => setActiveTab('OFFICE_KARTABLE')}
            viewMode={activeTab === 'CERTIFICATES_POOL' ? 'POOL' : 'SAMPLING'}
          />
        )}

        {activeTab === 'OFFICE_KARTABLE' && (
          <OfficeKartable
            campaigns={campaigns}
            selectedOfficeCode={selectedOfficeCode}
            onSelectOfficeCode={(code) => setSelectedOfficeCode(code)}
            offices={resolvedOffices}
            managers={resolvedManagers}
            officeTypes={officeTypes}
            fieldSettings={fieldSettings}
            currentUser={currentUser}
            onUpdateRecord={handleUpdateRecord}
            onUpdateOffice={handleUpdateOffice}
            onUpdateManager={handleUpdateManager}
            onNavigateToInspectorReview={() => setActiveTab('INSPECTION_REVIEW')}
          />
        )}

        {(activeTab === 'INSPECTION_REVIEW' || activeTab === 'INSPECTION_WARNINGS') && (
          <InspectorReviewPanel
            campaigns={campaigns}
            currentUser={currentUser}
            onUpdateRecord={handleUpdateRecord}
            onOpenOfficialMinutes={(record) => setOfficialMinutesRecord(record)}
            viewMode={activeTab === 'INSPECTION_WARNINGS' ? 'WARNINGS' : 'INSPECTION'}
          />
        )}

        {activeTab === 'ANALYTICS' && (
          <InspectionAnalytics
            campaigns={campaigns}
            offices={resolvedOffices}
            onOpenOfficialMinutes={(record) => setOfficialMinutesRecord(record)}
          />
        )}

        {activeTab === 'NOTIFICATIONS' && (
          <NotificationCenterView
            notifications={notifications}
            setNotifications={setNotifications}
            channelConfig={channelConfig}
            setChannelConfig={setChannelConfig}
            offices={resolvedOffices}
            onNavigateToEntity={(entityType, entityId, officeCode) => {
              if (officeCode) setSelectedOfficeCode(officeCode);
              if (entityType === 'OFFICE') {
                setActiveTab('OFFICE_MANAGEMENT');
              } else if (entityType === 'CAMPAIGN' || entityType === 'INSPECTION_RECORD') {
                setActiveTab('OFFICE_KARTABLE');
              }
            }}
          />
        )}

        {activeTab === 'ACCESS_LOGS' && (
          <AccessLogsPanel
            logs={accessLogs}
            offices={resolvedOffices}
            onRefresh={() => { refreshAccessLogsFromServer().then((logs) => setAccessLogs([...logs])); }}
            onClearLogs={() => setAccessLogs([])}
            onLogsUpdated={(remaining) => setAccessLogs(remaining)}
          />
        )}
        </main>
      </div>

      {/* Login / Authentication Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => {
          if (currentUser) setIsLoginModalOpen(false);
        }}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setCurrentSessionUser(user);
          setIsLoginModalOpen(false);
          loadInitialData();
          if (user.role === 'OFFICE_USER') {
            if (user.assignedOfficeCode) {
              setSelectedOfficeCode(user.assignedOfficeCode);
            }
            setActiveTab('OFFICE_KARTABLE');
          }
        }}
        users={users}
        offices={resolvedOffices}
        showQuickLoginPanel={showQuickLoginPanel}
      />

      {/* Force Password Change Modal upon first login */}
      {currentUser && !currentUser.isPasswordChanged && (
        <ForcePasswordChangeModal
          isOpen={!currentUser.isPasswordChanged}
          user={currentUser}
          onPasswordChanged={(updatedUser) => {
            setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
            setCurrentUser(updatedUser);
            setCurrentSessionUser(updatedUser);
            logUserAccessAction(updatedUser, 'PASSWORD_CHANGE', 'تغییر اجباری کلمه عبور در اولین ورود با موفقیت انجام شد.');
          }}
        />
      )}

      {/* User Profile & Password Change Modal */}
      <UserProfileModal
        isOpen={isUserProfileModalOpen}
        onClose={() => setIsUserProfileModalOpen(false)}
        currentUser={currentUser}
        onUpdateUser={(updatedUser) => {
          setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
          setCurrentUser(updatedUser);
          setCurrentSessionUser(updatedUser);
        }}
      />

      {/* Official Audit Minutes Printable Modal */}
      <OfficialMinutesModal
        record={officialMinutesRecord}
        onClose={() => setOfficialMinutesRecord(null)}
      />

      {/* Supabase Cloud Database Integration & Sync Modal */}
      <SupabaseSyncModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        appState={{
          offices: resolvedOffices,
          managers: stripManagersPersonalFields(managers, users),
          officeTypes,
          // The Excel certificate pool is working data only; just the selected sample records are saved (inside campaigns).
          certificates: [],
          campaigns,
          auditEvents,
          notifications,
          channelConfig,
          fieldSettings,
        }}
        onApplyRemoteState={handleApplyRemoteState}
      />

      {/* Admin System Settings Modal (Inspector visibility & Log Retention) */}
      {isAdminSettingsModalOpen && (
        <AdminSystemSettingsModal
          isOpen={isAdminSettingsModalOpen}
          onClose={() => setIsAdminSettingsModalOpen(false)}
          onOpenLogRetention={() => {
            setIsLogRetentionModalOpen(true);
          }}
          onSettingsSaved={() => {
            // Trigger refresh so components update inspector name and log settings
            setAuditEvents(prev => [...prev]);
          }}
        />
      )}

      {/* Log Retention & Database Pruning Modal */}
      {isLogRetentionModalOpen && (
        <LogRetentionModal
          isOpen={isLogRetentionModalOpen}
          onClose={() => setIsLogRetentionModalOpen(false)}
          auditEvents={auditEvents}
          accessLogs={accessLogs}
          onAuditEventsUpdated={(updatedEvents) => {
            setAuditEvents(updatedEvents);
          }}
          onLogsPruned={() => {
            setAuditEvents(prev => [...prev]);
            refreshAccessLogsFromServer().then((logs) => setAccessLogs([...logs]));
          }}
          onLogsUpdated={(remaining) => {
            setAccessLogs(remaining);
          }}
        />
      )}
    </div>
  );
}
