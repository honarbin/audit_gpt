import React, { useState, useEffect, useRef } from 'react';
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
  loadStoredUsers, 
  saveStoredUsers, 
  getCurrentSessionUser, 
  setCurrentSessionUser, 
  clearCurrentSession,
  getUserPermissions,
  isPrivilegedUser,
  isStrictOfficeBoundUser,
  canUserAccessTab,
  logUserAccessAction,
  loadUserAccessLogs,
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
  fetchSystemBootstrap,
  syncCampaignsToServer,
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
  isSupabaseReady 
} from './lib/supabase';
import {
  upsertOfficeToSupabase,
  upsertCampaignToSupabase,
  upsertInspectionRecordToSupabase,
  upsertAuditEventToSupabase,
  upsertNotificationToSupabase,
  upsertNotificationSettingsToSupabase,
  upsertFormFieldSettingsToSupabase,
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

// Defensive local cache reader: a malformed or outdated browser cache must not
// prevent the app from mounting after authentication. Supabase/server data remains authoritative.
function readStoredArray<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as T[] : fallback;
  } catch (error) {
    console.warn(`[RA Audit] Ignoring invalid local cache: ${key}`, error);
    return fallback;
  }
}

function readStoredObject<T extends object>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as T : fallback;
  } catch (error) {
    console.warn(`[RA Audit] Ignoring invalid local cache: ${key}`, error);
    return fallback;
  }
}

export default function App() {
  const isRemoteUpdateRef = useRef(false);
  // Local storage keys
  const STORAGE_KEY_CAMPAIGNS = 'ra_audit_campaigns_v2';
  const STORAGE_KEY_CERTS = 'ra_audit_certificates_v2';
  const STORAGE_KEY_OFFICES = 'ra_audit_offices_v2';
  const STORAGE_KEY_MANAGERS = 'ra_audit_managers_v2';
  const STORAGE_KEY_OFFICE_TYPES = 'ra_audit_office_types_v2';
  const STORAGE_KEY_AUDIT_EVENTS = 'ra_audit_events_v2';
  const STORAGE_KEY_FIELD_SETTINGS = 'ra_audit_field_settings_v2';
  const STORAGE_KEY_NOTIFICATIONS = 'ra_audit_notifications_v2';
  const STORAGE_KEY_NOTIFICATION_CONFIG = 'ra_audit_notif_channels_v2';
  const STORAGE_KEY_SELECTED_OFFICE = 'ra_audit_selected_office_code_v2';

  // Authentication and RBAC state
  const [users, setUsers] = useState<AppUser[]>(() => loadStoredUsers());
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => getCurrentSessionUser());
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(() => !getCurrentSessionUser());
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
  const [accessLogs, setAccessLogs] = useState<UserAccessLog[]>(() => loadUserAccessLogs());

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
    return '1607';
  });

  // Sync selectedOfficeCode to localStorage
  useEffect(() => {
    if (selectedOfficeCode) {
      localStorage.setItem(STORAGE_KEY_SELECTED_OFFICE, selectedOfficeCode);
    }
  }, [selectedOfficeCode]);

  // Notifications state
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    return readStoredArray<AppNotification>(STORAGE_KEY_NOTIFICATIONS, INITIAL_NOTIFICATIONS);
  });

  // Notification Channels configuration state
  const [channelConfig, setChannelConfig] = useState<NotificationChannelConfig>(() => {
    return readStoredObject<NotificationChannelConfig>(STORAGE_KEY_NOTIFICATION_CONFIG, DEFAULT_NOTIFICATION_CHANNELS_CONFIG);
  });

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

  // Offices state
  const [offices, setOffices] = useState<OfficeProfile[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_OFFICES);
    if (saved) {
      try {
        const parsed: OfficeProfile[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return sanitizeAndDeduplicateOffices([...parsed, ...INITIAL_OFFICES]);
        }
      } catch (e) {
        console.error('Error loading offices from storage:', e);
      }
    }
    return sanitizeAndDeduplicateOffices(INITIAL_OFFICES);
  });

  // Managers state
  const [managers, setManagers] = useState<OfficeManager[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_MANAGERS);
    if (saved) {
      try {
        const parsed: OfficeManager[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return sanitizeAndDeduplicateManagers([...parsed, ...INITIAL_MANAGERS_LIST]);
        }
      } catch (e) {
        console.error('Error loading managers from storage:', e);
      }
    }
    return sanitizeAndDeduplicateManagers(INITIAL_MANAGERS_LIST);
  });

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

  // Office Types Base state
  const [officeTypes, setOfficeTypes] = useState<OfficeTypeDefinition[]>(() => {
    return readStoredArray<OfficeTypeDefinition>(STORAGE_KEY_OFFICE_TYPES, INITIAL_OFFICE_TYPES_LIST);
  });

  // Form Field Customization Settings
  const [fieldSettings, setFieldSettings] = useState<FormFieldSetting[]>(() => {
    return readStoredArray<FormFieldSetting>(STORAGE_KEY_FIELD_SETTINGS, DEFAULT_FORM_FIELD_SETTINGS);
  });

  // Audit Timeline Events & Alarms state
  const [auditEvents, setAuditEvents] = useState<OfficeAuditEvent[]>(() => {
    return readStoredArray<OfficeAuditEvent>(STORAGE_KEY_AUDIT_EVENTS, INITIAL_AUDIT_EVENTS);
  });

  // Campaigns state
  const [campaigns, setCampaigns] = useState<AuditCampaign[]>(() => {
    const parsed = readStoredArray<AuditCampaign>(STORAGE_KEY_CAMPAIGNS, INITIAL_CAMPAIGNS);
    // Strict deduplication of records inside stored campaigns
    return (parsed || []).map(c => ({
      ...c,
      records: deduplicateAuditRecords(c.records || [])
    }));
  });

  // Available Certificates state
  const [availableCertificates, setAvailableCertificates] = useState<CertificateRecord[]>(() => {
    return readStoredArray<CertificateRecord>(STORAGE_KEY_CERTS, SAMPLE_CERTIFICATES_RAW);
  });

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

  // Initial fetch from Central Server & Supabase on startup (Cross-device persistence)
  useEffect(() => {
    let isMounted = true;

    const loadInitialCentralData = async () => {
      try {
        const bootstrap = await fetchSystemBootstrap();
        if (!isMounted || !bootstrap || !bootstrap.success) return;

        // 1. Authoritative Users: the central server is the single source of truth.
        // Never merge credentials/profile data from localStorage into server users.
        if (Array.isArray(bootstrap.users)) {
          const cleanUsers = sanitizeAndReconcileUsers(
            bootstrap.users,
            bootstrap.offices,
            bootstrap.managers
          );
          setUsers(cleanUsers);
          saveStoredUsers(cleanUsers);

          // Update current user from the authoritative server record.
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
        }

        // 2. Authoritative Offices
        if (bootstrap.offices && bootstrap.offices.length > 0) {
          setOffices(bootstrap.offices);
          localStorage.setItem(STORAGE_KEY_OFFICES, JSON.stringify(bootstrap.offices));
        }

        // 3. Authoritative Managers
        if (bootstrap.managers && bootstrap.managers.length > 0) {
          setManagers(bootstrap.managers);
          localStorage.setItem(STORAGE_KEY_MANAGERS, JSON.stringify(bootstrap.managers));
        }

        // 4. Authoritative Campaigns
        if (bootstrap.campaigns && bootstrap.campaigns.length > 0) {
          setCampaigns(bootstrap.campaigns);
          localStorage.setItem(STORAGE_KEY_CAMPAIGNS, JSON.stringify(bootstrap.campaigns));
        } else {
          // If server campaigns is empty, seed from local storage if available
          const stored = localStorage.getItem(STORAGE_KEY_CAMPAIGNS);
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              if (Array.isArray(parsed) && parsed.length > 0) {
                syncCampaignsToServer(parsed);
              }
            } catch (e) {}
          }
        }

        // 5. Authoritative Audit Events
        if (bootstrap.auditEvents && bootstrap.auditEvents.length > 0) {
          setAuditEvents(bootstrap.auditEvents);
          localStorage.setItem(STORAGE_KEY_AUDIT_EVENTS, JSON.stringify(bootstrap.auditEvents));
        } else {
          const stored = localStorage.getItem(STORAGE_KEY_AUDIT_EVENTS);
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              if (Array.isArray(parsed) && parsed.length > 0) {
                syncAuditEventsToServer(parsed);
              }
            } catch (e) {}
          }
        }

        // 6. Authoritative Notifications
        if (bootstrap.notifications && bootstrap.notifications.length > 0) {
          setNotifications(bootstrap.notifications);
          localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(bootstrap.notifications));
        }

        // 7. Authoritative Field Settings
        if (bootstrap.fieldSettings) {
          setFieldSettings(bootstrap.fieldSettings);
          localStorage.setItem(STORAGE_KEY_FIELD_SETTINGS, JSON.stringify(bootstrap.fieldSettings));
        }

        // 8. Authoritative Office Types
        if (bootstrap.officeTypes && bootstrap.officeTypes.length > 0) {
          setOfficeTypes(bootstrap.officeTypes);
          localStorage.setItem(STORAGE_KEY_OFFICE_TYPES, JSON.stringify(bootstrap.officeTypes));
        }

        // 9. Authoritative Access Logs
        if (bootstrap.accessLogs && bootstrap.accessLogs.length > 0) {
          setAccessLogs(prev => {
            const combined = [...bootstrap.accessLogs, ...prev];
            const deduped: UserAccessLog[] = [];
            const seen = new Set<string>();
            for (const l of combined) {
              const key = l.id || `${l.timestamp}-${l.username}`;
              if (!seen.has(key)) {
                seen.add(key);
                deduped.push(l);
              }
            }
            return deduped.slice(0, 500);
          });
        }
      } catch (e) {
        console.warn('Central server sync on startup failed:', e);
      } finally {
        isServerDataLoadedRef.current = true;
      }
    };

    loadInitialCentralData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isSupabaseReady()) {
      const loadInitialSupabaseData = async () => {
        try {
          const [remoteCampaigns, remoteEvents, remoteNotifs] = await Promise.all([
            fetchCampaignsFromSupabase().catch(() => null),
            fetchAuditEventsFromSupabase().catch(() => null),
            fetchNotificationsFromSupabase().catch(() => null),
          ]);

          if (remoteCampaigns && remoteCampaigns.length > 0) {
            setCampaigns(prevLocal => {
              const merged = [...remoteCampaigns];
              prevLocal.forEach(localCamp => {
                const existingIdx = merged.findIndex(m => m.id === localCamp.id);
                if (existingIdx === -1) {
                  merged.push(localCamp);
                } else {
                  // Ensure local records are retained if remote records are empty
                  if ((!merged[existingIdx].records || merged[existingIdx].records.length === 0) && localCamp.records && localCamp.records.length > 0) {
                    merged[existingIdx] = {
                      ...merged[existingIdx],
                      records: localCamp.records
                    };
                  }
                }
              });
              return merged;
            });
          }
          if (remoteEvents && remoteEvents.length > 0) setAuditEvents(remoteEvents);
          if (remoteNotifs && remoteNotifs.length > 0) setNotifications(remoteNotifs);
        } catch (e) {
          console.warn('Initial Supabase fetch skipped or failed:', e);
        }
      };
      loadInitialSupabaseData();
    }
  }, []);

  // Check and run automatic log pruning based on admin retention policy
  useEffect(() => {
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
  }, []);

  // Realtime Inter-Tab & Multi-Client Synchronization
  useEffect(() => {
    const unsubscribeBus = subscribeToRealtimeSync((msg) => {
      isRemoteUpdateRef.current = true;
      if (msg.type === 'OFFICES_CHANGED') {
        // Never trust an event payload as the authoritative office list.
        // Re-read the central database so every browser converges on the same state.
        fetchSystemBootstrap().then((bootstrap) => {
          if (bootstrap?.success && Array.isArray(bootstrap.offices)) {
            setOffices(bootstrap.offices);
            localStorage.setItem(STORAGE_KEY_OFFICES, JSON.stringify(bootstrap.offices));
          }
        }).catch(() => {});
      } else if (msg.type === 'USERS_CHANGED' || msg.type === 'USER_UPDATED' || msg.type === 'USER_PASSWORD_CHANGED') {
        fetchSystemBootstrap().then((bootstrap) => {
          if (bootstrap?.success && Array.isArray(bootstrap.users)) {
            const cleanUsers = sanitizeAndReconcileUsers(bootstrap.users, bootstrap.offices, bootstrap.managers);
            setUsers(cleanUsers);
            saveStoredUsers(cleanUsers);
            const session = getCurrentSessionUser();
            if (session) {
              const matched = cleanUsers.find(u => u.id === session.id || normalizeUsername(u.username) === normalizeUsername(session.username));
              if (matched) {
                setCurrentUser(matched);
                setCurrentSessionUser(matched);
              }
            }
          }
        }).catch(() => {});
      } else if (msg.type === 'CAMPAIGNS_CHANGED' && Array.isArray(msg.payload)) {
        setCampaigns(msg.payload);
      } else if (msg.type === 'AUDIT_EVENT_ADDED' && Array.isArray(msg.payload)) {
        setAuditEvents(msg.payload);
      } else if (msg.type === 'NOTIFICATION_DISPATCHED' && Array.isArray(msg.payload)) {
        setNotifications(msg.payload);
      } else if (msg.type === 'SYSTEM_STATE_REFRESH') {
        const storedOffices = localStorage.getItem(STORAGE_KEY_OFFICES);
        if (storedOffices) {
          try { setOffices(JSON.parse(storedOffices)); } catch (e) {}
        }
        const storedCampaigns = localStorage.getItem(STORAGE_KEY_CAMPAIGNS);
        if (storedCampaigns) {
          try { setCampaigns(JSON.parse(storedCampaigns)); } catch (e) {}
        }
      }
      setTimeout(() => {
        isRemoteUpdateRef.current = false;
      }, 60);
    });

    // Supabase Realtime WebSocket subscription for cross-device networks
    const cleanupDb = initSupabasePostgresSubscription((table) => {
      if (table === 'offices') {
        // Offices are authoritative in the central server, not Supabase.
        fetchSystemBootstrap().then(bootstrap => {
          if (bootstrap?.success && Array.isArray(bootstrap.offices)) {
            setOffices(bootstrap.offices);
            localStorage.setItem(STORAGE_KEY_OFFICES, JSON.stringify(bootstrap.offices));
          }
        }).catch(() => {});
      } else if (table === 'audit_campaigns' || table === 'inspection_records') {
        fetchCampaignsFromSupabase().then(res => {
          if (res && res.length > 0) setCampaigns(res);
        });
      } else if (table === 'notifications') {
        fetchNotificationsFromSupabase().then(res => {
          if (res) setNotifications(res);
        });
      }
    });

    return () => {
      unsubscribeBus();
      if (cleanupDb) cleanupDb();
    };
  }, []);

  // Sync to local storage & broadcast to other tabs & persist immediately to server database
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CAMPAIGNS, JSON.stringify(campaigns));
    if (!isRemoteUpdateRef.current) {
      broadcastSyncEvent('CAMPAIGNS_CHANGED', campaigns);
    }
    if (isServerDataLoadedRef.current) {
      syncCampaignsToServer(campaigns);
    }
  }, [campaigns]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CERTS, JSON.stringify(availableCertificates));
  }, [availableCertificates]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_OFFICES, JSON.stringify(offices));
    if (!isRemoteUpdateRef.current) {
      broadcastSyncEvent('OFFICES_CHANGED', offices);
    }
    if (isServerDataLoadedRef.current) {
      syncOfficesToServer(offices);
    }
  }, [offices]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_MANAGERS, JSON.stringify(managers));
    if (isServerDataLoadedRef.current) {
      syncManagersToServer(managers);
    }
  }, [managers]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_OFFICE_TYPES, JSON.stringify(officeTypes));
    if (isServerDataLoadedRef.current) {
      syncOfficeTypesToServer(officeTypes);
    }
  }, [officeTypes]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_AUDIT_EVENTS, JSON.stringify(auditEvents));
    if (!isRemoteUpdateRef.current) {
      broadcastSyncEvent('AUDIT_EVENT_ADDED', auditEvents);
    }
    if (isServerDataLoadedRef.current) {
      syncAuditEventsToServer(auditEvents);
    }
  }, [auditEvents]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_FIELD_SETTINGS, JSON.stringify(fieldSettings));
    if (isServerDataLoadedRef.current) {
      syncFieldSettingsToServer(fieldSettings);
    }
  }, [fieldSettings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(notifications));
    if (!isRemoteUpdateRef.current) {
      broadcastSyncEvent('NOTIFICATION_DISPATCHED', notifications);
    }
    if (isServerDataLoadedRef.current) {
      syncNotificationsToServer(notifications);
    }
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_NOTIFICATION_CONFIG, JSON.stringify(channelConfig));
  }, [channelConfig]);

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
    if (isSupabaseReady()) {
      upsertCampaignToSupabase(newCampaign).catch(err => console.warn('Supabase campaign sync error:', err));
      upsertAuditEventToSupabase(autoEvt).catch(err => console.warn('Supabase event sync error:', err));
      upsertNotificationToSupabase(newNotif).catch(err => console.warn('Supabase notif sync error:', err));
    }
  };

  // Handle Record updates (uploading docs, changing review verdicts, submitting notes)
  const handleUpdateRecord = (updatedRecord: AuditInspectionRecord) => {
    setCampaigns(prev => prev.map(campaign => {
      if (campaign.id !== updatedRecord.campaignId) return campaign;
      return {
        ...campaign,
        records: campaign.records.map(rec => rec.id === updatedRecord.id ? updatedRecord : rec)
      };
    }));

    // Background sync record to Supabase (sanitizing uploaded documents binaries)
    if (isSupabaseReady()) {
      upsertInspectionRecordToSupabase(updatedRecord).catch(err => console.warn('Supabase record sync error:', err));
    }

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

      if (isSupabaseReady()) {
        upsertAuditEventToSupabase(autoEvt).catch(err => console.warn('Supabase event sync error:', err));
      }

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

      if (isSupabaseReady()) {
        upsertAuditEventToSupabase(autoEvt).catch(err => console.warn('Supabase event sync error:', err));
        upsertNotificationToSupabase(defectNotif).catch(err => console.warn('Supabase notif sync error:', err));
      }
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
    setManagers(prev => {
      const cleanId = String(updatedManager.id || updatedManager.managerCode || '').trim();
      const cleanCode = String(updatedManager.assignedOfficeCode || '').trim();
      const filtered = prev.filter(m => {
        const id = String(m.id || m.managerCode || '').trim();
        const code = String(m.assignedOfficeCode || '').trim();
        return (cleanId ? id !== cleanId : true) && (cleanCode ? code !== cleanCode : true);
      });
      const updatedList = [...filtered, updatedManager];
      syncManagersToServer(updatedList).catch((err) => console.warn('Manager sync warning:', err));
      return updatedList;
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

    if (isSupabaseReady()) {
      upsertAuditEventToSupabase(newEvent).catch(err => console.warn('Supabase event sync error:', err));
    }
  };

  // Handle resolving an alarm/event
  const handleResolveAuditEvent = (eventId: string) => {
    setAuditEvents(prev => prev.map(evt => {
      if (evt.id === eventId) {
        return { ...evt, isResolved: true, isAlarmActive: false };
      }
      return evt;
    }));

    if (isSupabaseReady()) {
      const targetEvt = auditEvents.find(e => e.id === eventId);
      if (targetEvt) {
        upsertAuditEventToSupabase({ ...targetEvt, isResolved: true, isAlarmActive: false }).catch(err => console.warn('Supabase event resolve sync error:', err));
      }
    }

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
    if (remoteData.certificates && remoteData.certificates.length > 0) setAvailableCertificates(remoteData.certificates);
    if (remoteData.campaigns && remoteData.campaigns.length > 0) setCampaigns(remoteData.campaigns);
    if (remoteData.auditEvents && remoteData.auditEvents.length > 0) setAuditEvents(remoteData.auditEvents);
    if (remoteData.notifications && remoteData.notifications.length > 0) setNotifications(remoteData.notifications);
    if (remoteData.channelConfig) setChannelConfig(remoteData.channelConfig);
    if (remoteData.fieldSettings && remoteData.fieldSettings.length > 0) setFieldSettings(remoteData.fieldSettings);
  };

  // Reset to initial sample data
  const handleResetData = () => {
    localStorage.removeItem(STORAGE_KEY_CAMPAIGNS);
    localStorage.removeItem(STORAGE_KEY_CERTS);
    localStorage.removeItem(STORAGE_KEY_OFFICES);
    localStorage.removeItem(STORAGE_KEY_MANAGERS);
    localStorage.removeItem(STORAGE_KEY_OFFICE_TYPES);
    localStorage.removeItem(STORAGE_KEY_AUDIT_EVENTS);
    localStorage.removeItem(STORAGE_KEY_FIELD_SETTINGS);
    localStorage.removeItem(STORAGE_KEY_NOTIFICATIONS);
    localStorage.removeItem(STORAGE_KEY_NOTIFICATION_CONFIG);
    setCampaigns(INITIAL_CAMPAIGNS);
    setAvailableCertificates(SAMPLE_CERTIFICATES_RAW);
    setOffices(INITIAL_OFFICES);
    setManagers(INITIAL_MANAGERS_LIST);
    setOfficeTypes(INITIAL_OFFICE_TYPES_LIST);
    setFieldSettings(DEFAULT_FORM_FIELD_SETTINGS);
    setAuditEvents(INITIAL_AUDIT_EVENTS);
    setNotifications(INITIAL_NOTIFICATIONS);
    setChannelConfig(DEFAULT_NOTIFICATION_CHANNELS_CONFIG);
    setSelectedOfficeCode('1607');
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

  return (
    <div className="min-h-screen bg-slate-100/80 text-slate-900 flex flex-col font-sans selection:bg-teal-600 selection:text-white" dir="rtl">
      {/* Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        offices={offices}
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
          setCurrentUser(null);
          setIsLoginModalOpen(true);
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
            offices={offices}
            setOffices={setOffices}
            managers={managers}
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
            offices={offices}
            setOffices={setOffices}
            certificates={availableCertificates}
            setCertificates={setAvailableCertificates}
            campaigns={campaigns}
            setCampaigns={setCampaigns}
            auditEvents={auditEvents}
            setAuditEvents={setAuditEvents}
            managers={managers}
            setManagers={setManagers}
            showQuickLoginPanel={showQuickLoginPanel}
            setShowQuickLoginPanel={setShowQuickLoginPanel}
          />
        )}

        {(activeTab === 'SAMPLING' || activeTab === 'CERTIFICATES_POOL') && (
          <InspectorUploadAndSampling
            offices={offices}
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
            offices={offices}
            managers={managers}
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
            offices={offices}
            onOpenOfficialMinutes={(record) => setOfficialMinutesRecord(record)}
          />
        )}

        {activeTab === 'NOTIFICATIONS' && (
          <NotificationCenterView
            notifications={notifications}
            setNotifications={setNotifications}
            channelConfig={channelConfig}
            setChannelConfig={setChannelConfig}
            offices={offices}
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
            offices={offices}
            onRefresh={() => setAccessLogs(loadUserAccessLogs())}
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
          if (user.role === 'OFFICE_USER') {
            if (user.assignedOfficeCode) {
              setSelectedOfficeCode(user.assignedOfficeCode);
            }
            setActiveTab('OFFICE_KARTABLE');
          }
        }}
        users={users}
        offices={offices}
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
          offices,
          managers,
          officeTypes,
          certificates: availableCertificates,
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
            setAccessLogs(loadUserAccessLogs());
          }}
          onLogsUpdated={(remaining) => {
            setAccessLogs(remaining);
          }}
        />
      )}
    </div>
  );
}
