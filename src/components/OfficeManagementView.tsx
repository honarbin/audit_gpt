import React, { useState, useMemo, useEffect } from 'react';
import { 
  Building2, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  FileSpreadsheet, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Upload, 
  Edit3, 
  Trash2, 
  Eye, 
  Globe, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  Sparkles, 
  Printer, 
  X, 
  Check, 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  ShieldCheck,
  Building,
  GraduationCap,
  Scale,
  Landmark,
  MoreHorizontal,
  FolderPlus,
  RefreshCw,
  Clock,
  AlertTriangle,
  FileText,
  Bell,
  History,
  XCircle,
  Ban,
  SlidersHorizontal,
  Database,
  UserCheck,
  ArrowLeft,
  MoreVertical,
  ArrowUpDown
} from 'lucide-react';
import { 
  OfficeProfile, 
  OfficeManager, 
  OfficeTypeDefinition, 
  OfficeBatchImportSummary,
  OfficeAuditEvent,
  OfficeStatus,
  FormFieldSetting,
  AuditCampaign,
  CertificateRecord
} from '../types';
import { IRAN_PROVINCES, DEFAULT_OFFICE_TYPES } from '../data/iranGeoData';
import { 
  downloadOfficeManagersExcelTemplate, 
  parseOfficesAndManagersFromExcel, 
  exportOfficesAndManagersToExcel 
} from '../utils/officeExcelService';
import { IranLocationPickerModal } from './IranLocationPickerModal';
import { IranOfficesDistributionMap } from './IranOfficesDistributionMap';
import { OfficeAuditTimelineModal } from './OfficeAuditTimelineModal';
import { FormFieldSettingsModal, FormFieldSettingsPanel } from './FormFieldSettingsModal';
import { UsersManagementPanel } from './UsersManagementPanel';
import { AccessLogsPanel } from './AccessLogsPanel';
import { DEFAULT_FORM_FIELD_SETTINGS } from '../utils/auditTimelineLogger';
import { AppUser, UserAccessLog } from '../types/auth';
import { 
  loadUserAccessLogs, 
  clearUserAccessLogs, 
  syncOfficeUsers, 
  saveStoredShowQuickLogin, 
  getUserPermissions, 
  isSeniorInspector, 
  saveStoredUsers, 
  normalizeUsername, 
  normalizeNationalId,
  saveUserToServer,
  syncAllUsersToServer,
  syncOfficesToServer
} from '../services/authService';
import { 
  deleteOfficeFromSupabase, 
  clearAllOfficesAndCertificatesFromSupabase,
  upsertOfficeToSupabase,
  upsertUserToSupabase
} from '../services/supabaseService';

export type OfficeViewTaskMode =
  | 'OFFICES'
  | 'MANAGERS'
  | 'MAP'
  | 'TYPES'
  | 'FIELDS'
  | 'SUSPENSIONS'
  | 'COMMITMENTS'
  | 'COMPLAINTS';

interface OfficeManagementViewProps {
  viewMode?: OfficeViewTaskMode;
  offices: OfficeProfile[];
  setOffices: React.Dispatch<React.SetStateAction<OfficeProfile[]>>;
  managers: OfficeManager[];
  setManagers: React.Dispatch<React.SetStateAction<OfficeManager[]>>;
  officeTypes: OfficeTypeDefinition[];
  setOfficeTypes: React.Dispatch<React.SetStateAction<OfficeTypeDefinition[]>>;
  fieldSettings?: FormFieldSetting[];
  setFieldSettings?: React.Dispatch<React.SetStateAction<FormFieldSetting[]>>;
  auditEvents?: OfficeAuditEvent[];
  setAuditEvents?: React.Dispatch<React.SetStateAction<OfficeAuditEvent[]>>;
  campaigns?: AuditCampaign[];
  setCampaigns?: React.Dispatch<React.SetStateAction<AuditCampaign[]>>;
  certificates?: CertificateRecord[];
  setCertificates?: React.Dispatch<React.SetStateAction<CertificateRecord[]>>;
  onAddAuditEvent?: (newEvent: Omit<OfficeAuditEvent, 'id' | 'createdAt'>) => void;
  onResolveAuditEvent?: (eventId: string) => void;
  onUpdateOfficeStatus?: (officeCode: string, newStatus: OfficeStatus) => void;
  onSelectOfficeForInspection?: (officeCode: string) => void;
  currentUser?: AppUser;
  users?: AppUser[];
  setUsers?: React.Dispatch<React.SetStateAction<AppUser[]>>;
  showQuickLoginPanel?: boolean;
  setShowQuickLoginPanel?: (show: boolean) => void;
  initialStatusPreset?: string;
}

export const OfficeManagementView: React.FC<OfficeManagementViewProps> = ({
  viewMode = 'OFFICES',
  offices,
  setOffices,
  managers,
  setManagers,
  officeTypes,
  setOfficeTypes,
  fieldSettings = DEFAULT_FORM_FIELD_SETTINGS,
  setFieldSettings,
  auditEvents = [],
  setAuditEvents,
  campaigns = [],
  setCampaigns,
  certificates = [],
  setCertificates,
  onAddAuditEvent,
  onResolveAuditEvent,
  onUpdateOfficeStatus,
  onSelectOfficeForInspection,
  currentUser,
  users = [],
  setUsers,
  showQuickLoginPanel,
  setShowQuickLoginPanel,
  initialStatusPreset,
}) => {
  // Permission & Role Check (Senior Inspector and Higher Authority have full access; Lower inspector is restricted)
  const userPerms = getUserPermissions(currentUser);
  const isSenior = isSeniorInspector(currentUser);
  const isAdmin = currentUser?.role === 'SYSTEM_ADMIN';
  const canManage = userPerms.canManageOffices || isSenior || isAdmin;
  const canManageUsersPerm = userPerms.canManageUsers || isSenior || isAdmin;

  // Active Sub-Tab
  const [subTab, setSubTab] = useState<'OFFICES' | 'MANAGERS' | 'MAP' | 'TYPES' | 'FIELDS' | 'USERS' | 'LOGS'>('OFFICES');
  const [accessLogs, setAccessLogs] = useState<UserAccessLog[]>(() => loadUserAccessLogs());

  // Search and Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [provinceFilter, setProvinceFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'NEWEST' | 'OLDEST' | 'CODE' | 'NAME'>('NEWEST');
  const [openActionMenuCode, setOpenActionMenuCode] = useState<string | null>(null);
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState<boolean>(false);
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState<boolean>(false);

  const activeFilterCount = (provinceFilter !== 'ALL' ? 1 : 0) + (statusFilter !== 'ALL' ? 1 : 0) + (typeFilter !== 'ALL' ? 1 : 0);

  // Synchronize view mode and preset filters from navigation
  useEffect(() => {
    if (viewMode === 'MANAGERS') {
      setSubTab('MANAGERS');
    } else if (viewMode === 'MAP') {
      setSubTab('MAP');
    } else if (viewMode === 'TYPES') {
      setSubTab('TYPES');
    } else if (viewMode === 'FIELDS') {
      setSubTab('FIELDS');
    } else if (viewMode === 'SUSPENSIONS' || initialStatusPreset === 'SUSPENDED') {
      setStatusFilter('SUSPENDED');
      setSubTab('OFFICES');
    } else if (viewMode === 'COMPLAINTS' || initialStatusPreset === 'COMPLAINT') {
      setStatusFilter('ALL');
      setSubTab('OFFICES');
    } else if (viewMode === 'COMMITMENTS' || initialStatusPreset === 'COMMITMENT') {
      setStatusFilter('ALL');
      setSubTab('OFFICES');
    } else {
      setStatusFilter('ALL');
      setSubTab('OFFICES');
    }
    setCurrentPage(1);
    setSearchQuery('');
  }, [viewMode, initialStatusPreset]);

  // Pagination for large dataset (e.g. 1000 offices)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Modals state
  const [showAddEditModal, setShowAddEditModal] = useState<boolean>(false);
  const [editingOffice, setEditingOffice] = useState<OfficeProfile | null>(null);
  const [showExcelImportModal, setShowExcelImportModal] = useState<boolean>(false);
  const [showLocationPickerModal, setShowLocationPickerModal] = useState<boolean>(false);
  const [showOfficeCardModal, setShowOfficeCardModal] = useState<OfficeProfile | null>(null);
  const [showAddTypeModal, setShowAddTypeModal] = useState<boolean>(false);
  const [editingType, setEditingType] = useState<OfficeTypeDefinition | null>(null);
  const [showTimelineOffice, setShowTimelineOffice] = useState<OfficeProfile | null>(null);
  const [showFieldSettingsModal, setShowFieldSettingsModal] = useState<boolean>(false);
  const [confirmActionOffice, setConfirmActionOffice] = useState<OfficeProfile | null>(null);
  const [actionToast, setActionToast] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null);
  const [showClearDbModal, setShowClearDbModal] = useState<boolean>(false);
  const [isClearingDb, setIsClearingDb] = useState<boolean>(false);

  // Single Form Draft State
  const [formActiveTab, setFormActiveTab] = useState<'OFFICE_INFO' | 'MANAGER_INFO' | 'GEO_LOCATION'>('OFFICE_INFO');
  const [formOfficeCode, setFormOfficeCode] = useState<string>('');
  const [formOfficeName, setFormOfficeName] = useState<string>('');
  const [formUsername, setFormUsername] = useState<string>('');
  const [formOfficeType, setFormOfficeType] = useState<string>('PRESHKHAN');
  const [formCustomTypeName, setFormCustomTypeName] = useState<string>('');
  const [formProvince, setFormProvince] = useState<string>('تهران');
  const [formCity, setFormCity] = useState<string>('تهران');
  const [formAddress, setFormAddress] = useState<string>('');
  const [formOfficePhone, setFormOfficePhone] = useState<string>('');
  const [formOfficeEmail, setFormOfficeEmail] = useState<string>('');
  const [formLat, setFormLat] = useState<number | undefined>(35.6892);
  const [formLng, setFormLng] = useState<number | undefined>(51.3890);
  const [formStatus, setFormStatus] = useState<OfficeStatus>('ACTIVE');
  const [formNotes, setFormNotes] = useState<string>('');

  // Form Manager State
  const [managerSelectionMode, setManagerSelectionMode] = useState<'EXISTING' | 'NEW'>('NEW');
  const [selectedExistingUserId, setSelectedExistingUserId] = useState<string>('');
  const [formManagerCode, setFormManagerCode] = useState<string>('');
  const [formManagerNationalId, setFormManagerNationalId] = useState<string>('');
  const [formManagerName, setFormManagerName] = useState<string>('');
  const [formManagerMobile, setFormManagerMobile] = useState<string>('');
  const [formManagerPhone, setFormManagerPhone] = useState<string>('');
  const [formManagerEmail, setFormManagerEmail] = useState<string>('');

  // Custom Office Type Form State
  const [newTypeCode, setNewTypeCode] = useState<string>('');
  const [newTypeTitle, setNewTypeTitle] = useState<string>('');
  const [newTypeDescription, setNewTypeDescription] = useState<string>('');
  const [newTypeColor, setNewTypeColor] = useState<string>('emerald');

  // Excel Batch Upload Draft State
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [isProcessingExcel, setIsProcessingExcel] = useState<boolean>(false);
  const [importSummary, setImportSummary] = useState<OfficeBatchImportSummary | null>(null);
  const [importErrorMessage, setImportErrorMessage] = useState<string | null>(null);

  // Available counties for selected province in form
  const currentProvinceData = IRAN_PROVINCES.find(p => p.name === formProvince);
  const availableCounties = currentProvinceData?.counties || [formProvince];

  // Helper to open Add modal
  const handleOpenAddModal = () => {
    setEditingOffice(null);
    const randomCode = String(Math.floor(1000 + Math.random() * 9000));
    setFormOfficeCode(randomCode);
    setFormOfficeName('');
    setFormUsername(`office${randomCode}`);
    setFormOfficeType('PRESHKHAN');
    setFormCustomTypeName('');
    setFormProvince('تهران');
    setFormCity('تهران');
    setFormAddress('');
    setFormOfficePhone('');
    setFormOfficeEmail('');
    setFormLat(35.6892);
    setFormLng(51.3890);
    setFormStatus('ACTIVE');
    setFormNotes('');

    setFormManagerCode(`MGR-${randomCode}`);
    setFormManagerNationalId('');
    setFormManagerName('');
    setFormManagerMobile('');
    setFormManagerPhone('');
    setFormManagerEmail('');

    setFormActiveTab('OFFICE_INFO');
    setShowAddEditModal(true);
  };

  // Helper to open Edit modal
  const handleOpenEditModal = (office: OfficeProfile) => {
    setEditingOffice(office);
    setFormOfficeCode(office.code);
    setFormOfficeName(office.name);
    setFormOfficeType(office.type);
    setFormCustomTypeName(office.customTypeName || '');
    setFormProvince(office.province);
    setFormCity(office.city);
    setFormAddress(office.address);
    setFormOfficePhone(office.phone);
    setFormOfficeEmail(office.email || '');
    setFormLat(office.latitude || 35.6892);
    setFormLng(office.longitude || 51.3890);
    setFormStatus(office.status || 'ACTIVE');
    setFormNotes(office.notes || '');

    // Look for matching manager or user
    const matchedMgr = managers.find(m => m.assignedOfficeCode === office.code || m.id === office.managerId);
    const matchedUser = (users || []).find(u => u.assignedOfficeCode === office.code);
    setFormUsername(matchedUser?.username || matchedMgr?.username || `office${office.code}`);
    setFormManagerCode(matchedMgr?.managerCode || office.managerId || `MGR-${office.code}`);
    setFormManagerNationalId(matchedMgr?.nationalId || matchedUser?.nationalId || '');
    setFormManagerName(matchedMgr?.fullName || matchedUser?.fullName || office.managerName || '');
    setFormManagerMobile(matchedMgr?.mobilePhone || matchedUser?.mobilePhone || '');
    setFormManagerPhone(matchedMgr?.landlinePhone || office.phone || '');
    setFormManagerEmail(matchedMgr?.email || matchedUser?.email || office.email || '');

    setFormActiveTab('OFFICE_INFO');
    setShowAddEditModal(true);
  };

  // Helper to select an existing user or manager
  const handleSelectExistingManagerUser = (id: string) => {
    setSelectedExistingUserId(id);
    if (!id) return;

    // Check in users first
    const foundUser = (users || []).find(u => u.id === id);
    if (foundUser) {
      setFormManagerName(foundUser.fullName);
      setFormManagerNationalId(foundUser.nationalId || '');
      setFormManagerMobile(foundUser.mobilePhone || '');
      setFormManagerEmail(foundUser.email || '');
      setFormUsername(foundUser.username);
      setFormManagerCode(`MGR-${foundUser.id}`);
      return;
    }

    // Then check in managers
    const foundMgr = managers.find(m => m.id === id || m.managerCode === id);
    if (foundMgr) {
      setFormManagerName(foundMgr.fullName);
      setFormManagerNationalId(foundMgr.nationalId);
      setFormManagerMobile(foundMgr.mobilePhone);
      setFormManagerEmail(foundMgr.email || '');
      setFormManagerPhone(foundMgr.landlinePhone || '');
      if (foundMgr.username) setFormUsername(foundMgr.username);
      setFormManagerCode(foundMgr.managerCode || foundMgr.id);
    }
  };

  // Handle Save Office and Manager
  const handleSaveOffice = (e: React.FormEvent) => {
    e.preventDefault();

    const cleanCode = formOfficeCode.trim();
    const cleanOfficeName = formOfficeName.trim();
    const cleanManagerName = formManagerName.trim();
    const cleanManagerMobile = formManagerMobile.trim();
    const cleanNationalId = normalizeNationalId(formManagerNationalId);
    const cleanUsername = normalizeUsername(formUsername) || `office${cleanCode}`;

    if (!cleanCode || !cleanOfficeName) {
      alert('لطفاً کد یکتای دفتر و نام دفتر را وارد نمایید.');
      return;
    }
    if (!cleanManagerName || !cleanManagerMobile) {
      alert('لطفاً نام و نام خانوادگی و شماره همراه مسئول دفتر را وارد نمایید.');
      return;
    }
    if (!cleanNationalId || cleanNationalId.length !== 10) {
      alert('کد ملی مسئول دفتر باید دقیقاً ۱۰ رقم عددی معتبر باشد.');
      return;
    }

    // 1. Check duplicate office code if creating new office
    if (!editingOffice && offices.some(o => String(o.code).trim() === cleanCode)) {
      alert(`کد دفتر «${cleanCode}» تکراری است و قبلاً در سامانه ثبت شده است. لطفاً کد دیگری وارد فرمایید.`);
      return;
    }

    // 2. Identify the user ID if currently editing
    const currentEditingUserId = editingOffice
      ? users.find(u => u.assignedOfficeCode === editingOffice.code || (selectedExistingUserId && u.id === selectedExistingUserId))?.id
      : (selectedExistingUserId || null);

    // 3. Uniqueness Check: Username must be unique across all existing users
    const duplicateUsernameUser = users.find(
      u => u.id !== currentEditingUserId && normalizeUsername(u.username) === cleanUsername
    );
    if (duplicateUsernameUser) {
      alert(`نام کاربری «${cleanUsername}» تکراری است و قبلاً به «${duplicateUsernameUser.fullName}» اختصاص داده شده است. نام کاربری و کد ملی باید کاملاً یکتا باشند.`);
      return;
    }

    // 4. Uniqueness Check: National ID must be unique across all existing users
    const duplicateNidUser = users.find(
      u => u.id !== currentEditingUserId && normalizeNationalId(u.nationalId) === cleanNationalId
    );
    if (duplicateNidUser) {
      alert(`کد ملی «${cleanNationalId}» تکراری است و قبلاً برای کاربر «${duplicateNidUser.fullName}» (نام کاربری: ${duplicateNidUser.username}) ثبت شده است. نام کاربری و کد ملی باید یکتا باشند.`);
      return;
    }

    const managerId = formManagerCode.trim() || `MGR-${cleanCode}`;
    const officeId = editingOffice?.id || `off-${cleanCode}`;

    // Create Manager Record
    const newManager: OfficeManager = {
      id: managerId,
      managerCode: managerId,
      username: cleanUsername,
      nationalId: cleanNationalId,
      fullName: cleanManagerName,
      mobilePhone: cleanManagerMobile,
      landlinePhone: formManagerPhone.trim() || formOfficePhone.trim(),
      email: formManagerEmail.trim() || undefined,
      assignedOfficeCode: cleanCode,
      assignedOfficeName: cleanOfficeName,
      appointmentDate: '1403/01/01',
      status: (formStatus === 'INACTIVE' || formStatus === 'REVOKED') ? 'INACTIVE' : 'ACTIVE',
      notes: formNotes || undefined,
    };

    // Create Office Record
    const newOffice: OfficeProfile = {
      id: officeId,
      code: cleanCode,
      name: cleanOfficeName,
      type: formOfficeType,
      customTypeName: formOfficeType === 'OTHER' ? formCustomTypeName.trim() : undefined,
      province: formProvince,
      city: formCity,
      address: formAddress.trim() || `${formProvince}، ${formCity}، نشانی در پرونده`,
      phone: formOfficePhone.trim() || '۰۲۱-۰۰۰۰۰۰۰۰',
      email: formOfficeEmail.trim() || undefined,
      latitude: formLat,
      longitude: formLng,
      managerId: managerId,
      managerName: newManager.fullName,
      activeCampaignsCount: editingOffice?.activeCampaignsCount || 0,
      status: formStatus,
      createdAt: editingOffice?.createdAt || '1403/01/01',
      notes: formNotes || undefined,
    };

    // Update Offices State
    setOffices(prev => {
      const exists = prev.some(o => o.code === newOffice.code);
      const nextOffices = exists 
        ? prev.map(o => o.code === newOffice.code ? newOffice : o)
        : [newOffice, ...prev];
      
      // Persist to server database
      syncOfficesToServer(nextOffices).catch(() => {});
      upsertOfficeToSupabase(newOffice).catch(() => {});
      return nextOffices;
    });

    // Update Managers State (strictly deduplicate by id and office code)
    setManagers(prev => {
      const cleanId = String(newManager.id || newManager.managerCode || '').trim();
      const code = String(newManager.assignedOfficeCode || '').trim();
      const filtered = prev.filter(m => {
        const id = String(m.id || m.managerCode || '').trim();
        const c = String(m.assignedOfficeCode || '').trim();
        return (cleanId ? id !== cleanId : true) && (code ? c !== code : true);
      });
      return [newManager, ...filtered];
    });

    // Update or Create Auth User so credentials and user list immediately have the new user
    if (setUsers) {
      setUsers(prev => {
        const existingIndex = prev.findIndex(u => 
          (currentEditingUserId && u.id === currentEditingUserId) ||
          (u.assignedOfficeCode && String(u.assignedOfficeCode).trim() === cleanCode)
        );

        let updated: AppUser[];
        let targetUser: AppUser;
        if (existingIndex >= 0) {
          const existingUser = prev[existingIndex];
          targetUser = {
            ...existingUser,
            username: cleanUsername,
            nationalId: cleanNationalId,
            fullName: `${cleanManagerName} (${cleanOfficeName})`,
            assignedOfficeCode: cleanCode,
            assignedOfficeName: cleanOfficeName,
            mobilePhone: cleanManagerMobile,
            email: newManager.email || newOffice.email,
            isActive: formStatus !== 'REVOKED' && formStatus !== 'INACTIVE',
            passwordHash: (!existingUser.isPasswordChanged || !existingUser.passwordHash) ? cleanUsername : existingUser.passwordHash
          };
          updated = [...prev];
          updated[existingIndex] = targetUser;
        } else {
          targetUser = {
            id: `user-off-${cleanCode}-${Date.now()}`,
            username: cleanUsername,
            nationalId: cleanNationalId,
            passwordHash: cleanUsername,
            fullName: `${cleanManagerName} (${cleanOfficeName})`,
            role: 'OFFICE_USER',
            assignedOfficeCode: cleanCode,
            assignedOfficeName: cleanOfficeName,
            mobilePhone: cleanManagerMobile,
            email: newManager.email || newOffice.email,
            isActive: formStatus !== 'REVOKED' && formStatus !== 'INACTIVE',
            isPasswordChanged: false,
            createdAt: newOffice.createdAt || '1403/01/01',
            notes: `حساب کاربری دفتر ${cleanOfficeName} (کد ${cleanCode})`,
          };
          updated = [targetUser, ...prev];
        }
        saveStoredUsers(updated);

        // Persist to server database
        saveUserToServer(targetUser).catch(() => {});
        upsertUserToSupabase(targetUser).catch(() => {});

        return updated;
      });
    }

    setShowAddEditModal(false);
  };

  // Helper: Count inspection records for office
  const getOfficeRecordsCount = (officeCode: string) => {
    if (!campaigns || campaigns.length === 0) return 0;
    return campaigns
      .filter(c => c.officeCode === officeCode)
      .reduce((sum, c) => sum + (c.records ? c.records.length : 0), 0);
  };

  // Open Smart Status / Delete Modal
  const handleOpenActionModal = (office: OfficeProfile) => {
    setConfirmActionOffice(office);
  };

  // Change Office Status (Active, Inactive, Suspended, Revoked)
  const handleChangeOfficeStatus = (officeCode: string, newStatus: OfficeStatus) => {
    setOffices(prev => prev.map(o => o.code === officeCode ? { ...o, status: newStatus } : o));
    setManagers(prev => prev.map(m => {
      if (m.assignedOfficeCode === officeCode) {
        return { ...m, status: (newStatus === 'INACTIVE' || newStatus === 'REVOKED') ? 'INACTIVE' : 'ACTIVE' };
      }
      return m;
    }));
    if (onUpdateOfficeStatus) {
      onUpdateOfficeStatus(officeCode, newStatus);
    }
    const statusLabels: Record<OfficeStatus, string> = {
      ACTIVE: 'فعال',
      INACTIVE: 'غیرفعال',
      SUSPENDED: 'تعلیق موقت',
      REVOKED: 'ابطال شده',
    };
    setActionToast({
      message: `وضعیت دفتر کد ${officeCode} به «${statusLabels[newStatus] || newStatus}» تغییر یافت.`,
      type: 'success',
    });
    setConfirmActionOffice(null);
  };

  // Delete Office Permanently
  const handlePermanentDeleteOffice = (officeCode: string, forceCascade = false) => {
    const recordsCount = getOfficeRecordsCount(officeCode);
    if (recordsCount > 0 && !forceCascade) {
      if (window.confirm(`این دفتر دارای ${recordsCount} پرونده و گواهی است. آیا مایلید دفتر به همراه تمام داده‌ها و پرونده‌های وابسته آن به صورت کامل پاکسازی شود؟`)) {
        handlePermanentDeleteOffice(officeCode, true);
        return;
      }
      return;
    }
    setOffices(prev => prev.filter(o => o.code !== officeCode));
    setManagers(prev => prev.filter(m => m.assignedOfficeCode !== officeCode));
    if (setCertificates) {
      setCertificates(prev => prev.filter(c => c.officeCode !== officeCode));
    }
    if (setCampaigns) {
      setCampaigns(prev => prev.filter(camp => camp.officeCode !== officeCode));
    }
    if (setAuditEvents) {
      setAuditEvents(prev => prev.filter(evt => evt.officeCode !== officeCode));
    }
    if (setUsers) {
      setUsers(prev => prev.map(u => u.assignedOfficeCode === officeCode ? { ...u, assignedOfficeCode: undefined, assignedOfficeName: undefined } : u));
    }
    deleteOfficeFromSupabase(officeCode).catch(err => console.error('Supabase delete error:', err));
    setActionToast({
      message: `دفتر کد ${officeCode} و کلیه داده‌های وابسته آن با موفقیت حذف و پاکسازی گردید.`,
      type: 'success',
    });
    setConfirmActionOffice(null);
  };

  // Clear All Offices and Certificates from Database & Local Storage
  const handleClearAllDatabaseAndStorage = async () => {
    setIsClearingDb(true);
    try {
      const officesCount = offices.length;
      const certsCount = certificates.length;

      // 1. Delete from Supabase Database
      await clearAllOfficesAndCertificatesFromSupabase();

      // 2. Clear Local Storage
      localStorage.removeItem('ra_audit_offices_v2');
      localStorage.removeItem('ra_audit_managers_v2');
      localStorage.removeItem('ra_audit_certificates_v2');
      localStorage.removeItem('ra_audit_campaigns_v2');
      localStorage.removeItem('ra_audit_events_v2');

      // 3. Clear React in-memory states
      setOffices([]);
      setManagers([]);
      if (setCertificates) setCertificates([]);
      if (setCampaigns) setCampaigns([]);
      if (setAuditEvents) setAuditEvents([]);
      if (setUsers) {
        setUsers(prev => prev.map(u => u.role === 'OFFICE_USER' ? { ...u, assignedOfficeCode: undefined, assignedOfficeName: undefined } : u));
      }

      setShowClearDbModal(false);
      setActionToast({
        type: 'success',
        message: `پاکسازی کامل انجام شد: کلیه دفاتر (${officesCount.toLocaleString('fa-IR')} مورد) و گواهی‌ها (${certsCount.toLocaleString('fa-IR')} مورد) از دیتابیس و سامانه حذف شدند. اکنون می‌توانید اطلاعات جدید را ارسال یا بارگذاری نمایید.`
      });
    } catch (err: any) {
      console.error('Error clearing database and storage:', err);
      setActionToast({
        type: 'error',
        message: `خطا در فرآیند پاکسازی اطلاعات: ${err?.message || 'مشکلی رخ داد.'}`
      });
    } finally {
      setIsClearingDb(false);
    }
  };

  // Process Excel Upload
  const handleProcessExcelFile = async () => {
    if (!excelFile) return;
    setIsProcessingExcel(true);
    setImportErrorMessage(null);
    setImportSummary(null);

    try {
      const summary = await parseOfficesAndManagersFromExcel(excelFile, offices);
      setImportSummary(summary);
    } catch (err: any) {
      setImportErrorMessage(err.message || 'خطا در پردازش فایل اکسل');
    } finally {
      setIsProcessingExcel(false);
    }
  };

  // Apply Batch Imported Offices & Managers
  const handleApplyBatchImport = () => {
    if (!importSummary) return;

    // Merge offices and managers
    const newOfficesMap = new Map<string, OfficeProfile>();
    offices.forEach(o => newOfficesMap.set(o.code, o));
    importSummary.importedOffices.forEach(o => newOfficesMap.set(o.code, o));

    const newManagersMap = new Map<string, OfficeManager>();
    managers.forEach(m => newManagersMap.set(m.assignedOfficeCode, m));
    importSummary.importedManagers.forEach(m => newManagersMap.set(m.assignedOfficeCode, m));

    const allMergedOffices = Array.from(newOfficesMap.values());
    const allMergedManagers = Array.from(newManagersMap.values());

    setOffices(allMergedOffices);
    setManagers(allMergedManagers);

    if (setUsers) {
      setUsers(prev => syncOfficeUsers(allMergedOffices, prev));
    }

    alert(`عملیات با موفقیت انجام شد: تعداد ${importSummary.successCount + importSummary.updatedCount} دفتر و مسئول ثبت/به‌روزرسانی گردید و حساب‌های کاربری آن‌ها فعال شد.`);
    setShowExcelImportModal(false);
    setExcelFile(null);
    setImportSummary(null);
  };

  // Office Type Management: Open Add Modal
  const handleOpenAddTypeModal = () => {
    setEditingType(null);
    setNewTypeCode('');
    setNewTypeTitle('');
    setNewTypeDescription('');
    setNewTypeColor('emerald');
    setShowAddTypeModal(true);
  };

  // Office Type Management: Open Edit Modal
  const handleOpenEditTypeModal = (typeToEdit: OfficeTypeDefinition) => {
    setEditingType(typeToEdit);
    setNewTypeCode(typeToEdit.code);
    setNewTypeTitle(typeToEdit.title);
    setNewTypeDescription(typeToEdit.description || '');
    setNewTypeColor(typeToEdit.color || 'emerald');
    setShowAddTypeModal(true);
  };

  // Office Type Management: Delete with safety check
  const handleDeleteOfficeType = (typeToDelete: OfficeTypeDefinition) => {
    const linkedOffices = offices.filter(o => o.type === typeToDelete.code);
    if (linkedOffices.length > 0) {
      // Reassign affected offices to OTHER
      setOffices(prev => prev.map(o => 
        o.type === typeToDelete.code 
          ? { ...o, type: 'OTHER', customTypeName: typeToDelete.title } 
          : o
      ));
    }

    setOfficeTypes(prev => prev.filter(t => t.code !== typeToDelete.code));
    setActionToast({
      message: `نوع دفتر «${typeToDelete.title}» حذف گردید${linkedOffices.length > 0 ? ` (نوع ${linkedOffices.length} دفتر به «سایر» تغییر یافت)` : ''}.`,
      type: 'success',
    });
  };

  // Add / Edit Office Type Save Handler
  const handleSaveCustomType = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTypeTitle.trim()) return;

    if (editingType) {
      const updatedCode = newTypeCode.trim() || editingType.code;
      const oldCode = editingType.code;

      setOfficeTypes(prev => prev.map(t => {
        if (t.code === oldCode) {
          return {
            ...t,
            code: updatedCode,
            title: newTypeTitle.trim(),
            description: newTypeDescription.trim() || undefined,
            color: newTypeColor,
          };
        }
        return t;
      }));

      // If code changed, update any office referencing the old code
      if (oldCode !== updatedCode) {
        setOffices(prev => prev.map(o => o.type === oldCode ? { ...o, type: updatedCode } : o));
      }

      setEditingType(null);
      setShowAddTypeModal(false);
    } else {
      const code = newTypeCode.trim() || `TYPE_${Date.now()}`;
      const newType: OfficeTypeDefinition = {
        code,
        title: newTypeTitle.trim(),
        description: newTypeDescription.trim() || undefined,
        color: newTypeColor,
        isCustom: true,
      };

      setOfficeTypes(prev => [...prev, newType]);
      setNewTypeCode('');
      setNewTypeTitle('');
      setNewTypeDescription('');
      setShowAddTypeModal(false);
    }
  };

  // Filtered and Sorted Offices List
  const filteredOffices = useMemo(() => {
    const list = offices.filter(office => {
      if (provinceFilter !== 'ALL' && office.province !== provinceFilter) return false;
      if (typeFilter !== 'ALL' && office.type !== typeFilter) return false;
      if (statusFilter !== 'ALL' && (office.status || 'ACTIVE') !== statusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchCode = String(office.code).toLowerCase().includes(q);
        const matchName = office.name.toLowerCase().includes(q);
        const matchManager = (office.managerName || '').toLowerCase().includes(q);
        const matchMobile = (office.managerMobile || '').toLowerCase().includes(q);
        const matchNationalId = (office.managerNationalId || '').toLowerCase().includes(q);
        const matchCity = (office.city || '').toLowerCase().includes(q);
        const matchAddress = (office.address || '').toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchManager && !matchMobile && !matchNationalId && !matchCity && !matchAddress) {
          return false;
        }
      }
      return true;
    });

    if (sortBy === 'CODE') {
      return [...list].sort((a, b) => String(a.code).localeCompare(String(b.code), 'fa-IR', { numeric: true }));
    } else if (sortBy === 'NAME') {
      return [...list].sort((a, b) => a.name.localeCompare(b.name, 'fa-IR'));
    } else if (sortBy === 'OLDEST') {
      return [...list].sort((a, b) => (new Date(a.createdAt || 0).getTime()) - (new Date(b.createdAt || 0).getTime()));
    } else {
      // NEWEST by default
      return [...list].sort((a, b) => (new Date(b.createdAt || 0).getTime()) - (new Date(a.createdAt || 0).getTime()));
    }
  }, [offices, provinceFilter, typeFilter, statusFilter, searchQuery, sortBy]);

  // Paginated Offices
  const totalPages = Math.ceil(filteredOffices.length / pageSize) || 1;
  const paginatedOffices = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOffices.slice(start, start + pageSize);
  }, [filteredOffices, currentPage, pageSize]);

  // Filtered Managers List (with strict deduplication to guarantee unique items and keys)
  const filteredManagers = useMemo(() => {
    const seenIds = new Set<string>();
    const seenOfficeCodes = new Set<string>();
    const uniqueManagers = managers.filter(manager => {
      if (!manager) return false;
      const cleanId = String(manager.id || manager.managerCode || '').trim();
      const cleanCode = String(manager.assignedOfficeCode || '').trim();
      if (cleanId && seenIds.has(cleanId)) return false;
      if (cleanCode && seenOfficeCodes.has(cleanCode)) return false;
      if (cleanId) seenIds.add(cleanId);
      if (cleanCode) seenOfficeCodes.add(cleanCode);
      return true;
    });

    return uniqueManagers.filter(manager => {
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchCode = String(manager.managerCode).toLowerCase().includes(q);
        const matchName = manager.fullName.toLowerCase().includes(q);
        const matchNationalId = manager.nationalId.toLowerCase().includes(q);
        const matchMobile = manager.mobilePhone.toLowerCase().includes(q);
        const matchOffice = (manager.assignedOfficeName || '').toLowerCase().includes(q) || manager.assignedOfficeCode.toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchNationalId && !matchMobile && !matchOffice) return false;
      }
      return true;
    });
  }, [managers, searchQuery]);

  // Active Alarms for suspensions/commitments nearing deadline
  const activeAlarmsList = useMemo(() => {
    return auditEvents.filter(e => e.isAlarmActive && !e.isResolved);
  }, [auditEvents]);

  // Helper for Type badge
  const renderOfficeTypeBadge = (typeCode: string, customName?: string) => {
    const t = officeTypes.find(ot => ot.code === typeCode);
    const title = customName || t?.title || typeCode;

    let colorClass = 'bg-slate-100 text-slate-800 border-slate-200';
    if (typeCode === 'PRESHKHAN') colorClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
    if (typeCode === 'NOTARY') colorClass = 'bg-amber-50 text-amber-800 border-amber-200';
    if (typeCode === 'EDUCATION') colorClass = 'bg-blue-50 text-blue-800 border-blue-200';
    if (typeCode === 'ORGANIZATION') colorClass = 'bg-indigo-50 text-indigo-800 border-indigo-200';
    if (typeCode === 'OTHER') colorClass = 'bg-purple-50 text-purple-800 border-purple-200';
    if (typeCode === 'JUDICIAL') colorClass = 'bg-indigo-50 text-indigo-800 border-indigo-200';
    if (typeCode === 'BANK') colorClass = 'bg-teal-50 text-teal-800 border-teal-200';
    if (typeCode === 'POLICE10') colorClass = 'bg-violet-50 text-violet-800 border-violet-200';

    return (
      <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold border ${colorClass} whitespace-nowrap`}>
        {title}
      </span>
    );
  };

  // Helper for Status badge
  const renderOfficeStatusBadge = (status?: OfficeStatus) => {
    switch (status) {
      case 'SUSPENDED':
        return (
          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 whitespace-nowrap">
            <Clock className="w-2.5 h-2.5 text-amber-700" />
            <span>تعلیق موقت</span>
          </span>
        );
      case 'REVOKED':
        return (
          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-300 flex items-center gap-1 whitespace-nowrap">
            <Ban className="w-2.5 h-2.5 text-rose-700" />
            <span>ابطال شده</span>
          </span>
        );
      case 'INACTIVE':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300 whitespace-nowrap">
            غیرفعال
          </span>
        );
      case 'ACTIVE':
      default:
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 whitespace-nowrap">
            فعال
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Toast Banner */}
      {actionToast && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs shadow-xs animate-in fade-in duration-200 ${
          actionToast.type === 'success'
            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
            : actionToast.type === 'warning'
            ? 'bg-amber-50 border-amber-300 text-amber-900'
            : 'bg-rose-50 border-rose-300 text-rose-900'
        }`}>
          <div className="flex items-center gap-2">
            {actionToast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            )}
            <span className="font-bold">{actionToast.message}</span>
          </div>
          <button
            onClick={() => setActionToast(null)}
            className="p-1 hover:bg-black/5 rounded-lg transition cursor-pointer text-slate-500 hover:text-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header: Dynamic Single-Task Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {viewMode === 'MANAGERS'
              ? 'مسئولین دفاتر RA'
              : viewMode === 'MAP'
              ? 'نقشه پراکندگی دفاتر RA'
              : viewMode === 'TYPES'
              ? 'تعاریف و انواع دفاتر RA'
              : viewMode === 'FIELDS'
              ? 'تنظیمات فیلدهای فرم دفاتر'
              : viewMode === 'SUSPENSIONS'
              ? 'دفاتر معلق و احکام نظارتی'
              : viewMode === 'COMMITMENTS'
              ? 'تعهدنامه‌های نظارتی دفاتر RA'
              : viewMode === 'COMPLAINTS'
              ? 'شکایات و پرونده‌های بازرسی'
              : 'دفاتر RA'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            {viewMode === 'MANAGERS'
              ? 'مشخصات، اطلاعات هویتی و شماره‌های تماس مسئولین منتسب به دفاتر صدور گواهی'
              : viewMode === 'MAP'
              ? 'موقعیت جغرافیایی و پراکندگی استانی دفاتر صدور گواهی در سراسر کشور'
              : viewMode === 'TYPES'
              ? 'مدیریت تعاریف پایه، کدهای شناسایی و دسته‌بندی دفاتر ثبت‌نام'
              : viewMode === 'FIELDS'
              ? 'پیکربندی فیلدهای اجباری، اختیاری یا پنهان در فرم‌های ثبت اطلاعات دفاتر'
              : viewMode === 'SUSPENSIONS'
              ? 'پایش و نظارت بر دفاتر در وضعیت تعلیق فعالیت و هشدارهای سررسید احکام'
              : viewMode === 'COMMITMENTS'
              ? 'پایش تعهدنامه‌های کتبی اخذشده از دفاتر و بررسی اجرای تعهدات'
              : viewMode === 'COMPLAINTS'
              ? 'رسیدگی به شکایات واصله، تخلفات ثبت‌شده و بازرسی‌های موردی دفاتر'
              : 'مدیریت جامع دفاتر ثبت‌شده، اطلاعات هویتی و مشخصات ثبتی'}
          </p>
        </div>

        {/* Action Controls specific to the current page task */}
        <div className="flex items-center gap-2">
          {viewMode === 'TYPES' && canManage && (
            <button
              onClick={handleOpenAddTypeModal}
              className="flex items-center gap-2 bg-[#0d9488] hover:bg-[#0f766e] text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>تعریف نوع جدید دفتر</span>
            </button>
          )}

          {(viewMode === 'OFFICES' || viewMode === 'SUSPENSIONS' || viewMode === 'COMMITMENTS' || viewMode === 'COMPLAINTS' || viewMode === 'MAP') && canManage && (
            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-2 bg-[#0d9488] hover:bg-[#0f766e] text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>ثبت دفتر جدید</span>
            </button>
          )}

          {viewMode === 'MANAGERS' && canManage && (
            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-2 bg-[#0d9488] hover:bg-[#0f766e] text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>معرفی مسئول جدید</span>
            </button>
          )}

          {/* Consolidated Secondary Actions Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsToolsMenuOpen(prev => !prev)}
              className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 transition shadow-2xs cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-slate-500" />
              <span>گزارش و ابزارها</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {isToolsMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setIsToolsMenuOpen(false)}
                />
                <div className="absolute left-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-30 divide-y divide-slate-100 text-xs text-right">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setIsToolsMenuOpen(false);
                        exportOfficesAndManagersToExcel(offices, managers);
                      }}
                      className="w-full text-right px-3.5 py-2 hover:bg-slate-50 text-slate-700 flex items-center gap-2 font-medium cursor-pointer"
                    >
                      <Download className="w-4 h-4 text-slate-500" />
                      <span>خروجی اکسل دفاتر و مسئولین</span>
                    </button>
                    {canManage && (
                      <button
                        onClick={() => {
                          setIsToolsMenuOpen(false);
                          setExcelFile(null);
                          setImportSummary(null);
                          setImportErrorMessage(null);
                          setShowExcelImportModal(true);
                        }}
                        className="w-full text-right px-3.5 py-2 hover:bg-slate-50 text-slate-700 flex items-center gap-2 font-medium cursor-pointer"
                      >
                        <Upload className="w-4 h-4 text-teal-600" />
                        <span>بارگذاری اکسل</span>
                      </button>
                    )}
                  </div>

                  {canManage && (
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setIsToolsMenuOpen(false);
                          setShowFieldSettingsModal(true);
                        }}
                        className="w-full text-right px-3.5 py-2 hover:bg-slate-50 text-slate-700 flex items-center gap-2 font-medium cursor-pointer"
                      >
                        <SlidersHorizontal className="w-4 h-4 text-amber-600" />
                        <span>تنظیمات فیلدهای فرم</span>
                      </button>
                      <button
                        onClick={() => {
                          setIsToolsMenuOpen(false);
                          setShowClearDbModal(true);
                        }}
                        className="w-full text-right px-3.5 py-2 hover:bg-rose-50 text-rose-700 flex items-center gap-2 font-medium cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4 text-rose-500" />
                        <span>پاکسازی کامل داده‌ها</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Active Alarms Warning Card if any suspension/commitment needs review (Only in relevant views) */}
      {activeAlarmsList.length > 0 && (viewMode === 'OFFICES' || viewMode === 'SUSPENSIONS' || viewMode === 'COMMITMENTS') && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Bell className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-amber-950">
                  مرکز هشدارهای نظارتی و سررسید تعلیق / تعهدات دفاتر
                </h3>
                <span className="bg-amber-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold">
                  {activeAlarmsList.length}
                </span>
              </div>
              <p className="text-[11px] text-amber-800">
                موعد پایان دوره تعلیق یا سررسید تعهدنامه این دفاتر نزدیک است یا فرارسیده است.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {activeAlarmsList.slice(0, 3).map(alarm => {
              const matchedOffice = offices.find(o => String(o.code) === String(alarm.officeCode));
              return (
                <button
                  key={alarm.id}
                  onClick={() => {
                    if (matchedOffice) setShowTimelineOffice(matchedOffice);
                  }}
                  className="bg-white hover:bg-amber-100/50 border border-amber-300 text-amber-900 text-xs font-bold px-2.5 py-1 rounded-lg transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>دفتر {alarm.officeCode}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 4 Minimalist Stat Blocks Tailored to Current Task (Single Line / Enterprise Style) */}
      {viewMode !== 'FIELDS' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {viewMode === 'MANAGERS' ? (
            <>
              <div className="bg-white border border-slate-200/80 rounded-xl px-4 py-2.5 shadow-2xs flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">کل مسئولین</span>
                <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                  {managers.length.toLocaleString('fa-IR')}
                </span>
              </div>
              <div className="bg-white border border-slate-200/80 rounded-xl px-4 py-2.5 shadow-2xs flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">دفاتر دارای مسئول</span>
                <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                  {offices.filter(o => o.managerName).length.toLocaleString('fa-IR')}
                </span>
              </div>
              <div className="bg-white border border-slate-200/80 rounded-xl px-4 py-2.5 shadow-2xs flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">تلفن همراه فعال</span>
                <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                  {managers.filter(m => m.mobilePhone).length.toLocaleString('fa-IR')}
                </span>
              </div>
              <div className="bg-white border border-slate-200/80 rounded-xl px-4 py-2.5 shadow-2xs flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">کد ملی ثبت‌شده</span>
                <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                  {managers.filter(m => m.nationalId).length.toLocaleString('fa-IR')}
                </span>
              </div>
            </>
          ) : viewMode === 'TYPES' ? (
            <>
              <div className="bg-white border border-slate-200/80 rounded-xl px-4 py-2.5 shadow-2xs flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">انواع دفتر</span>
                <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                  {officeTypes.length.toLocaleString('fa-IR')}
                </span>
              </div>
              <div className="bg-white border border-slate-200/80 rounded-xl px-4 py-2.5 shadow-2xs flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">انواع پایه</span>
                <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                  {officeTypes.filter(t => !t.isCustom).length.toLocaleString('fa-IR')}
                </span>
              </div>
              <div className="bg-white border border-slate-200/80 rounded-xl px-4 py-2.5 shadow-2xs flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">انواع سفارشی</span>
                <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                  {officeTypes.filter(t => t.isCustom).length.toLocaleString('fa-IR')}
                </span>
              </div>
              <div className="bg-white border border-slate-200/80 rounded-xl px-4 py-2.5 shadow-2xs flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">کل دفاتر منتسب</span>
                <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                  {offices.length.toLocaleString('fa-IR')}
                </span>
              </div>
            </>
          ) : viewMode === 'SUSPENSIONS' ? (
            <>
              <div className="bg-white border border-slate-200/80 rounded-xl px-4 py-2.5 shadow-2xs flex items-center justify-between">
                <span className="text-xs text-rose-600 font-medium">دفاتر معلق</span>
                <span className="text-xl sm:text-2xl font-black text-rose-700 font-mono">
                  {offices.filter(o => o.status === 'SUSPENDED').length.toLocaleString('fa-IR')}
                </span>
              </div>
              <div className="bg-white border border-slate-200/80 rounded-xl px-4 py-2.5 shadow-2xs flex items-center justify-between">
                <span className="text-xs text-amber-600 font-medium">هشدارهای فعال</span>
                <span className="text-xl sm:text-2xl font-black text-amber-700 font-mono">
                  {activeAlarmsList.length.toLocaleString('fa-IR')}
                </span>
              </div>
              <div className="bg-white border border-slate-200/80 rounded-xl px-4 py-2.5 shadow-2xs flex items-center justify-between">
                <span className="text-xs text-emerald-600 font-medium">دفاتر فعال</span>
                <span className="text-xl sm:text-2xl font-black text-emerald-700 font-mono">
                  {offices.filter(o => (o.status || 'ACTIVE') === 'ACTIVE').length.toLocaleString('fa-IR')}
                </span>
              </div>
              <div className="bg-white border border-slate-200/80 rounded-xl px-4 py-2.5 shadow-2xs flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">کل دفاتر</span>
                <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                  {offices.length.toLocaleString('fa-IR')}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="bg-white border border-slate-200/80 rounded-xl px-4 py-2.5 shadow-2xs flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">دفاتر فعال</span>
                <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                  {offices.filter(o => (o.status || 'ACTIVE') === 'ACTIVE').length.toLocaleString('fa-IR')}
                </span>
              </div>
              <div className="bg-white border border-slate-200/80 rounded-xl px-4 py-2.5 shadow-2xs flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">مسئولین</span>
                <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                  {managers.length.toLocaleString('fa-IR')}
                </span>
              </div>
              <div className="bg-white border border-slate-200/80 rounded-xl px-4 py-2.5 shadow-2xs flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">استان‌ها</span>
                <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                  {new Set(offices.map(o => o.province)).size.toLocaleString('fa-IR')}
                </span>
              </div>
              <div className="bg-white border border-slate-200/80 rounded-xl px-4 py-2.5 shadow-2xs flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">کل دفاتر</span>
                <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                  {offices.length.toLocaleString('fa-IR')}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 1: OFFICES LIST & MANAGEMENT */}
      {subTab === 'OFFICES' && (
        <div className="space-y-3">
          {/* Unified Search & Filters Single Row */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-2.5 sm:p-3 shadow-2xs space-y-2">
            <div className="flex items-center gap-2">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="text"
                  placeholder="جستجو در نام دفتر، کد، استان یا مسئول..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pr-9 pl-6 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setCurrentPage(1);
                    }}
                    className="absolute left-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Filter Popover Toggle Button */}
              <div className="relative">
                <button
                  onClick={() => setIsFilterPopoverOpen(prev => !prev)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition border cursor-pointer ${
                    activeFilterCount > 0 || isFilterPopoverOpen
                      ? 'bg-teal-50 text-teal-900 border-teal-300'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                  <span>فیلترها</span>
                  {activeFilterCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-teal-600 text-white text-[10px] flex items-center justify-center font-mono">
                      {activeFilterCount}
                    </span>
                  )}
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isFilterPopoverOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Collapsible Filters Popover Panel */}
                {isFilterPopoverOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setIsFilterPopoverOpen(false)}
                    />
                    <div className="absolute left-0 mt-2 w-72 sm:w-80 bg-white rounded-xl shadow-xl border border-slate-200 p-4 z-30 space-y-3.5 text-xs text-right">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <span className="font-bold text-slate-900">فیلترهای پیشرفته</span>
                        {activeFilterCount > 0 && (
                          <button
                            onClick={() => {
                              setProvinceFilter('ALL');
                              setStatusFilter('ALL');
                              setTypeFilter('ALL');
                              setCurrentPage(1);
                            }}
                            className="text-[11px] text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
                          >
                            پاک کردن همه
                          </button>
                        )}
                      </div>

                      {/* Province Select */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600 block">استان</label>
                        <select
                          value={provinceFilter}
                          onChange={(e) => {
                            setProvinceFilter(e.target.value);
                            setCurrentPage(1);
                          }}
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer text-xs"
                        >
                          <option value="ALL">همه استان‌ها</option>
                          {IRAN_PROVINCES.map(p => (
                            <option key={p.name} value={p.name}>{p.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Status Select */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600 block">وضعیت فعالیت</label>
                        <select
                          value={statusFilter}
                          onChange={(e) => {
                            setStatusFilter(e.target.value);
                            setCurrentPage(1);
                          }}
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer text-xs"
                        >
                          <option value="ALL">همه وضعیت‌ها</option>
                          <option value="ACTIVE">فعال</option>
                          <option value="SUSPENDED">تعلیق موقت</option>
                          <option value="REVOKED">ابطال شده</option>
                          <option value="INACTIVE">غیرفعال</option>
                        </select>
                      </div>

                      {/* Office Type Select */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600 block">نوع دفتر</label>
                        <select
                          value={typeFilter}
                          onChange={(e) => {
                            setTypeFilter(e.target.value);
                            setCurrentPage(1);
                          }}
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer text-xs"
                        >
                          <option value="ALL">همه انواع</option>
                          {officeTypes.map(t => (
                            <option key={t.code} value={t.code}>{t.title}</option>
                          ))}
                        </select>
                      </div>

                      {/* Page Size */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600 block">تعداد نمایش در صفحه</label>
                        <select
                          value={pageSize}
                          onChange={(e) => {
                            setPageSize(Number(e.target.value));
                            setCurrentPage(1);
                          }}
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer text-xs"
                        >
                          <option value={10}>۱۰ مورد</option>
                          <option value={25}>۲۵ مورد</option>
                          <option value={50}>۵۰ مورد</option>
                        </select>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                        <button
                          onClick={() => setIsFilterPopoverOpen(false)}
                          className="bg-teal-700 hover:bg-teal-800 text-white font-bold px-3.5 py-1.5 rounded-lg text-xs cursor-pointer"
                        >
                          بستن
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Sorting */}
              <div className="hidden sm:flex items-center gap-1 text-xs text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-transparent font-medium text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="NEWEST">جدیدترین</option>
                  <option value="OLDEST">قدیمی‌ترین</option>
                  <option value="CODE">کد دفتر</option>
                  <option value="NAME">نام دفتر</option>
                </select>
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              </div>
            </div>

            {/* Active Filters summary pills (if any active) */}
            {activeFilterCount > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px]">
                <span className="text-slate-400 font-medium">فیلترهای اعمال‌شده:</span>
                {provinceFilter !== 'ALL' && (
                  <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium">
                    استان: {provinceFilter}
                    <button onClick={() => setProvinceFilter('ALL')} className="hover:text-rose-600 font-bold cursor-pointer">✕</button>
                  </span>
                )}
                {statusFilter !== 'ALL' && (
                  <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium">
                    وضعیت: {statusFilter === 'ACTIVE' ? 'فعال' : statusFilter === 'SUSPENDED' ? 'تعلیق' : statusFilter === 'REVOKED' ? 'ابطال' : 'غیرفعال'}
                    <button onClick={() => setStatusFilter('ALL')} className="hover:text-rose-600 font-bold cursor-pointer">✕</button>
                  </span>
                )}
                {typeFilter !== 'ALL' && (
                  <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium">
                    نوع: {officeTypes.find(t => t.code === typeFilter)?.title || typeFilter}
                    <button onClick={() => setTypeFilter('ALL')} className="hover:text-rose-600 font-bold cursor-pointer">✕</button>
                  </span>
                )}
                <button
                  onClick={() => {
                    setProvinceFilter('ALL');
                    setStatusFilter('ALL');
                    setTypeFilter('ALL');
                    setCurrentPage(1);
                  }}
                  className="text-rose-600 hover:text-rose-700 font-bold mr-1 cursor-pointer"
                >
                  پاک کردن همه
                </button>
              </div>
            )}
          </div>

          {/* Offices Table Card */}
          <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs">
            {/* Table Card Header */}
            <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <span className="font-bold text-slate-800">
                {filteredOffices.length.toLocaleString('fa-IR')} مورد ثبت‌شده
              </span>
              <div className="sm:hidden flex items-center gap-1">
                <span>مرتب‌سازی:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-transparent font-medium text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="NEWEST">جدیدترین</option>
                  <option value="OLDEST">قدیمی‌ترین</option>
                  <option value="CODE">کد دفتر</option>
                  <option value="NAME">نام دفتر</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-bold">
                  <tr>
                    <th className="p-3.5 w-12 text-center">ردیف</th>
                    <th className="p-3.5">نام دفتر</th>
                    <th className="p-3.5">کد دفتر</th>
                    <th className="p-3.5">استان</th>
                    <th className="p-3.5">نوع دفتر</th>
                    <th className="p-3.5">وضعیت</th>
                    <th className="p-3.5">مسئول</th>
                    <th className="p-3.5 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedOffices.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-500">
                        <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm font-bold text-slate-700">هیچ دفتری مطابق با فیلترهای انتخابی یافت نشد.</p>
                        <p className="text-xs text-slate-400 mt-1">می‌توانید دفتر جدیدی ثبت کنید یا فایل اکسل را بارگذاری نمایید.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedOffices.map((office, idx) => {
                      const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                      const typeObj = officeTypes.find(t => t.code === office.type);
                      const typeTitle = office.customTypeName || typeObj?.title || office.type;

                      return (
                        <tr key={office.code} className="hover:bg-slate-50/70 transition">
                          {/* Row Number */}
                          <td className="p-3.5 text-center font-mono text-slate-400">
                            {rowNumber.toLocaleString('fa-IR')}
                          </td>

                          {/* Office Name */}
                          <td className="p-3.5">
                            <div className="flex items-center gap-2 font-bold text-slate-900">
                              <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[200px]" title={office.name}>{office.name}</span>
                            </div>
                          </td>

                          {/* Office Code */}
                          <td className="p-3.5">
                            <span className="font-mono text-xs font-semibold text-slate-700">
                              {office.code}
                            </span>
                          </td>

                          {/* Province */}
                          <td className="p-3.5">
                            <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{office.province}</span>
                            </div>
                          </td>

                          {/* Office Type */}
                          <td className="p-3.5">
                            <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                              <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{typeTitle}</span>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="p-3.5">
                            {office.status === 'ACTIVE' || !office.status ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span>فعال</span>
                              </span>
                            ) : office.status === 'SUSPENDED' ? (
                              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                <span>تعلیق موقت</span>
                              </span>
                            ) : office.status === 'REVOKED' ? (
                              <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                <span>ابطال شده</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                <span>غیرفعال</span>
                              </span>
                            )}
                          </td>

                          {/* Manager */}
                          <td className="p-3.5">
                            <div className="flex items-center gap-1.5 font-medium text-slate-800">
                              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[150px]">{office.managerName || '-'}</span>
                            </div>
                          </td>

                          {/* Operations */}
                          <td className="p-3.5 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {/* View Details Button */}
                              <button
                                onClick={() => setShowOfficeCardModal(office)}
                                className="inline-flex items-center gap-1 text-slate-700 hover:text-teal-700 hover:bg-teal-50 px-2.5 py-1 rounded-xl text-xs font-semibold transition cursor-pointer border border-transparent hover:border-teal-200"
                                title="مشاهده شناسنامه کامل دفتر"
                              >
                                <span>مشاهده</span>
                                <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
                              </button>

                              {/* More Dropdown */}
                              <div className="relative">
                                <button
                                  onClick={() => setOpenActionMenuCode(prev => prev === office.code ? null : office.code)}
                                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                                  title="سایر عملیات"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </button>

                                {openActionMenuCode === office.code && (
                                  <div className="absolute left-0 mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-30 animate-in fade-in zoom-in-95 text-right">
                                    <button
                                      onClick={() => {
                                        setOpenActionMenuCode(null);
                                        setShowTimelineOffice(office);
                                      }}
                                      className="w-full text-right px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                                    >
                                      <span>تایم‌لاین و تخلفات</span>
                                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                                    </button>

                                    {onSelectOfficeForInspection && (
                                      <button
                                        onClick={() => {
                                          setOpenActionMenuCode(null);
                                          onSelectOfficeForInspection(office.code);
                                        }}
                                        className="w-full text-right px-3 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-50 flex items-center justify-between"
                                      >
                                        <span>ثبت بازرسی و نمونه</span>
                                        <Search className="w-3.5 h-3.5 text-teal-600" />
                                      </button>
                                    )}

                                    {canManage && (
                                      <>
                                        <button
                                          onClick={() => {
                                            setOpenActionMenuCode(null);
                                            handleOpenEditModal(office);
                                          }}
                                          className="w-full text-right px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                                        >
                                          <span>ویرایش دفتر</span>
                                          <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                                        </button>

                                        <button
                                          onClick={() => {
                                            setOpenActionMenuCode(null);
                                            handleOpenActionModal(office);
                                          }}
                                          className="w-full text-right px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center justify-between"
                                        >
                                          <span>تغییر وضعیت یا حذف</span>
                                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <div>
                نمایش {((currentPage - 1) * pageSize + 1).toLocaleString('fa-IR')} تا {Math.min(currentPage * pageSize, filteredOffices.length).toLocaleString('fa-IR')} از {filteredOffices.length.toLocaleString('fa-IR')} مورد
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-7 h-7 rounded-lg font-mono font-bold text-xs transition cursor-pointer ${
                      currentPage === page
                        ? 'bg-[#0d9488] text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {page.toLocaleString('fa-IR')}
                  </button>
                ))}

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MANAGERS DIRECTORY */}
      {subTab === 'MANAGERS' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
              <input
                type="text"
                placeholder="جستجو در نام مسئول، کدملی، شماره همراه یا کد دفتر..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pr-10 pl-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-sans"
              />
            </div>
            <div className="text-xs text-slate-500">
              تعداد مسئولین منتسب: <strong className="text-slate-900 font-mono">{filteredManagers.length}</strong> نفر
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredManagers.map((manager, idx) => {
              const matchedOffice = offices.find(o => o.code === manager.assignedOfficeCode);
              const cardKey = manager.id ? `mgr-card-${manager.id}` : `mgr-card-${manager.assignedOfficeCode || idx}`;

              return (
                <div key={cardKey} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3.5 hover:border-blue-300 transition">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900">{manager.fullName}</h4>
                        <span className="text-[11px] font-mono text-slate-500">شناسه مسئول: {manager.managerCode}</span>
                      </div>
                    </div>

                    <span className="text-[10px] bg-slate-100 text-slate-700 font-mono px-2 py-0.5 rounded-lg border border-slate-200">
                      کد {manager.assignedOfficeCode}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 space-y-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">کد ملی:</span>
                      <strong className="font-mono text-slate-900">{manager.nationalId}</strong>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">شماره همراه (موبایل):</span>
                      <strong className="font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {manager.mobilePhone}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">تلفن ثابت مستقیم:</span>
                      <strong className="font-mono text-slate-800">{manager.landlinePhone || '-'}</strong>
                    </div>

                    {manager.email && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">ایمیل:</span>
                        <span className="font-mono text-[11px] text-blue-700 truncate max-w-[180px]">{manager.email}</span>
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-2xl">
                      <span className="block text-slate-500 font-semibold mb-0.5">دفتر ثبت نام منتسب:</span>
                      <span className="font-bold text-slate-900">{manager.assignedOfficeName || matchedOffice?.name}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: NATIONAL DISTRIBUTION MAP */}
      {subTab === 'MAP' && (
        <IranOfficesDistributionMap
          offices={offices}
          managers={managers}
          officeTypes={officeTypes}
          onSelectOffice={(office) => setShowOfficeCardModal(office)}
          onOpenTimeline={(office) => setShowTimelineOffice(office)}
          onOpenCard={(office) => setShowOfficeCardModal(office)}
        />
      )}

      {/* TAB 4: BASE TABLES & OFFICE TYPES */}
      {subTab === 'TYPES' && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-slate-900">تعاریف پایه و مدیریت انواع دفاتر صدور گواهی</h3>
              <p className="text-xs text-slate-500 mt-0.5">امکان تعریف، ویرایش مشخصات، تغییر رنگ برچسب و حذف انواع دفاتر ثبت‌نام</p>
            </div>
            <button
              onClick={handleOpenAddTypeModal}
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 rounded-2xl transition shadow-2xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>تعریف نوع جدید دفتر</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {officeTypes.map(t => {
              const count = offices.filter(o => o.type === t.code).length;

              return (
                <div key={t.code} className="bg-white border border-slate-200 hover:border-slate-300 rounded-3xl p-5 shadow-xs space-y-3.5 transition flex flex-col justify-between">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-lg font-bold">
                        {t.code}
                      </span>
                      {t.isCustom ? (
                        <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full font-bold">
                          سفارشی
                        </span>
                      ) : (
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                          پایه سیستم
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-black text-slate-900">{t.title}</h4>
                    <p className="text-xs text-slate-500 leading-relaxed min-h-[36px]">
                      {t.description || 'نوع استاندارد صدور گواهی الکترونیکی در سامانه RA'}
                    </p>
                  </div>

                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs text-slate-600 font-semibold">
                      <span>تعداد دفاتر فعال:</span>
                      <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-lg">
                        {count} دفتر
                      </span>
                    </div>

                    {/* Action buttons: Edit and Delete */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => handleOpenEditTypeModal(t)}
                        className="flex-1 flex items-center justify-center gap-1.5 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 py-1.5 px-2.5 rounded-xl font-bold transition cursor-pointer"
                        title="ویرایش عنوان، کد، توضیحات و رنگ برچسب"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>ویرایش</span>
                      </button>

                      <button
                        onClick={() => handleDeleteOfficeType(t)}
                        className="flex-1 flex items-center justify-center gap-1.5 text-xs text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 py-1.5 px-2.5 rounded-xl font-bold transition cursor-pointer"
                        title="حذف این نوع دفتر از تعاریف سیستم"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 5: FORM FIELD SETTINGS (INLINE PANEL) */}
      {subTab === 'FIELDS' && (
        <FormFieldSettingsPanel
          fieldSettings={fieldSettings}
          onSave={(updated) => {
            if (setFieldSettings) {
              setFieldSettings(updated);
            }
          }}
        />
      )}

      {/* TAB 6: USERS & RBAC MANAGEMENT PANEL */}
      {subTab === 'USERS' && currentUser && setUsers && (
        <UsersManagementPanel
          currentUser={currentUser}
          users={users}
          setUsers={setUsers}
          offices={offices}
          setOffices={setOffices}
          certificates={certificates}
          setCertificates={setCertificates}
          campaigns={campaigns}
          setCampaigns={setCampaigns}
          auditEvents={auditEvents}
          setAuditEvents={setAuditEvents}
          managers={managers}
          setManagers={setManagers}
        />
      )}

      {/* TAB 7: ACCESS & NOTIFICATION LOGS PANEL */}
      {subTab === 'LOGS' && (
        <AccessLogsPanel
          logs={accessLogs}
          offices={offices}
          onClearLogs={() => {
            clearUserAccessLogs();
            setAccessLogs([]);
          }}
        />
      )}

      {/* MODAL 1: SINGLE OFFICE & MANAGER REGISTRATION / EDIT */}
      {showAddEditModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 my-4">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-2xs font-bold">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {editingOffice ? `ویرایش اطلاعات دفتر کد ${editingOffice.code}` : 'ثبت دفتر صدور گواهی و معرفی مسئول'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    اطلاعات ثبتی، شماره‌های تماس، مسئول منتسب و موقعیت مکانی را تکمیل نمایید.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddEditModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs Header */}
            <div className="flex items-center gap-2 px-6 pt-4 border-b border-slate-100 bg-white">
              <button
                type="button"
                onClick={() => setFormActiveTab('OFFICE_INFO')}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-2xl text-xs font-bold transition border-b-2 ${
                  formActiveTab === 'OFFICE_INFO'
                    ? 'border-emerald-600 text-emerald-700 bg-emerald-50/60'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building className="w-4 h-4" />
                <span>۱. مشخصات دفتر ثبت نام</span>
              </button>

              <button
                type="button"
                onClick={() => setFormActiveTab('MANAGER_INFO')}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-2xl text-xs font-bold transition border-b-2 ${
                  formActiveTab === 'MANAGER_INFO'
                    ? 'border-emerald-600 text-emerald-700 bg-emerald-50/60'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <User className="w-4 h-4" />
                <span>۲. مشخصات مسئول دفتر</span>
              </button>

              <button
                type="button"
                onClick={() => setFormActiveTab('GEO_LOCATION')}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-2xl text-xs font-bold transition border-b-2 ${
                  formActiveTab === 'GEO_LOCATION'
                    ? 'border-emerald-600 text-emerald-700 bg-emerald-50/60'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <MapPin className="w-4 h-4" />
                <span>۳. موقعیت جغرافیایی روی نقشه</span>
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveOffice} className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* TAB 1: OFFICE BASIC INFO */}
              {formActiveTab === 'OFFICE_INFO' && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Office Code (Unique) */}
                    <div>
                      <label className="text-xs font-extrabold text-slate-800 block mb-1.5">
                        کد یکتای دفتر ثبت نام <span className="text-rose-500">*</span>:
                      </label>
                      <input
                        type="text"
                        required
                        value={formOfficeCode}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormOfficeCode(val);
                          if (!editingOffice && (!formUsername || formUsername.startsWith('office'))) {
                            setFormUsername(`office${val}`);
                          }
                        }}
                        placeholder="مثال: 1042"
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>

                    {/* Office Name */}
                    <div>
                      <label className="text-xs font-extrabold text-slate-800 block mb-1.5">
                        نام کامل دفتر ثبت نام <span className="text-rose-500">*</span>:
                      </label>
                      <input
                        type="text"
                        required
                        value={formOfficeName}
                        onChange={(e) => setFormOfficeName(e.target.value)}
                        placeholder="مثال: دفتر پیشخوان خدمات دولت کد ۱۰۴۲"
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>

                    {/* Username */}
                    <div>
                      <label className="text-xs font-extrabold text-slate-800 block mb-1.5 flex items-center justify-between">
                        <span>نام کاربری ورود (Username) <span className="text-rose-500">*</span>:</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formUsername}
                        onChange={(e) => setFormUsername(e.target.value)}
                        placeholder={`office${formOfficeCode || '1042'}`}
                        className="w-full bg-teal-50/60 border border-teal-200 rounded-2xl px-3.5 py-2.5 text-xs text-teal-900 font-mono font-bold focus:ring-2 focus:ring-teal-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Office Type */}
                    <div>
                      <label className="text-xs font-extrabold text-slate-800 block mb-1.5">
                        نوع دفتر ثبت نام <span className="text-rose-500">*</span>:
                      </label>
                      <select
                        value={formOfficeType}
                        onChange={(e) => setFormOfficeType(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                      >
                        {officeTypes.map(t => (
                          <option key={t.code} value={t.code}>{t.title}</option>
                        ))}
                      </select>
                    </div>

                    {/* Custom Type Title if 'OTHER' */}
                    {formOfficeType === 'OTHER' && (
                      <div>
                        <label className="text-xs font-extrabold text-slate-800 block mb-1.5">
                          عنوان نوع سفارشی:
                        </label>
                        <input
                          type="text"
                          value={formCustomTypeName}
                          onChange={(e) => setFormCustomTypeName(e.target.value)}
                          placeholder="مثال: باجه صدور گواهی منطقه آزاد"
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        />
                      </div>
                    )}

                    {/* Status */}
                    <div>
                      <label className="text-xs font-extrabold text-slate-800 block mb-1.5">
                        وضعیت فعالیت دفتر:
                      </label>
                      <select
                        value={formStatus}
                        onChange={(e) => setFormStatus(e.target.value as OfficeStatus)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                      >
                        <option value="ACTIVE">فعال (آماده پذیرش و صدور)</option>
                        <option value="SUSPENDED">تعلیق موقت</option>
                        <option value="REVOKED">ابطال شده و لغو امتیاز</option>
                        <option value="INACTIVE">غیرفعال</option>
                      </select>
                    </div>
                  </div>

                  {/* Province & City */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-extrabold text-slate-800 block mb-1.5">
                        استان <span className="text-rose-500">*</span>:
                      </label>
                      <select
                        value={formProvince}
                        onChange={(e) => {
                          const newProv = e.target.value;
                          setFormProvince(newProv);
                          const pData = IRAN_PROVINCES.find(p => p.name === newProv);
                          if (pData && pData.counties.length > 0) {
                            setFormCity(pData.counties[0]);
                          }
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                      >
                        {IRAN_PROVINCES.map(p => (
                          <option key={p.name} value={p.name}>استان {p.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-extrabold text-slate-800 block mb-1.5">
                        شهرستان / شهر <span className="text-rose-500">*</span>:
                      </label>
                      <select
                        value={formCity}
                        onChange={(e) => setFormCity(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                      >
                        {availableCounties.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Address */}
                  <div>
                    <label className="text-xs font-extrabold text-slate-800 block mb-1.5">
                      آدرس دفتر:
                    </label>
                    <textarea
                      rows={2}
                      value={formAddress}
                      onChange={(e) => setFormAddress(e.target.value)}
                      placeholder="خیابان، پلاک، طبقه و واحد..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  {/* Phone & Email */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-extrabold text-slate-800 block mb-1.5">
                        شماره تلفن ثابت دفتر:
                      </label>
                      <input
                        type="text"
                        value={formOfficePhone}
                        onChange={(e) => setFormOfficePhone(e.target.value)}
                        placeholder="021-88765432"
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-extrabold text-slate-800 block mb-1.5">
                        آدرس ایمیل:
                      </label>
                      <input
                        type="email"
                        value={formOfficeEmail}
                        onChange={(e) => setFormOfficeEmail(e.target.value)}
                        placeholder="info@office.ir"
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: MANAGER INFO */}
              {formActiveTab === 'MANAGER_INFO' && (
                <div className="space-y-4 animate-in fade-in">
                  {/* Mode Selector: Existing User vs New User */}
                  <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setManagerSelectionMode('EXISTING')}
                      className={`flex-1 py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        managerSelectionMode === 'EXISTING'
                          ? 'bg-white text-emerald-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <UserCheck className="w-4 h-4 text-emerald-600" />
                      <span>انتخاب از کاربران از پیش تعریف‌شده</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setManagerSelectionMode('NEW');
                        setSelectedExistingUserId('');
                      }}
                      className={`flex-1 py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        managerSelectionMode === 'NEW'
                          ? 'bg-white text-emerald-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Plus className="w-4 h-4 text-slate-600" />
                      <span>تعریف مسئول جدید</span>
                    </button>
                  </div>

                  {/* Dropdown for Existing User */}
                  {managerSelectionMode === 'EXISTING' && (
                    <div className="bg-emerald-50/70 border border-emerald-300 rounded-2xl p-4 space-y-3 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                          <UserCheck className="w-4 h-4 text-emerald-700" />
                          <span>انتخاب کاربر یا مسئول قبلی جهت انتساب به این دفتر:</span>
                        </label>
                        <span className="text-[10px] bg-emerald-200 text-emerald-900 font-bold px-2 py-0.5 rounded-full">
                          {(users?.length || 0) + (managers?.length || 0)} مورد قابل انتخاب
                        </span>
                      </div>

                      <select
                        value={selectedExistingUserId}
                        onChange={(e) => handleSelectExistingManagerUser(e.target.value)}
                        className="w-full bg-white border border-emerald-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                      >
                        <option value="">-- لطفاً یک کاربر یا مسئول از پیش ثبت‌شده را انتخاب فرمایید --</option>
                        {users && users.length > 0 && (
                          <optgroup label="کاربران ثبت‌شده سامانه">
                            {users.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.fullName} (نام کاربری: {u.username}) {u.assignedOfficeCode ? `[دفتر فعلی: ${u.assignedOfficeCode}]` : '[بدون انتساب به دفتر]'}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {managers && managers.length > 0 && (
                          <optgroup label="مسئولان دفاتر فعال">
                            {(() => {
                              const seenOptIds = new Set<string>();
                              return managers
                                .filter(m => {
                                  if (!m || !m.id) return false;
                                  const id = String(m.id).trim();
                                  if (seenOptIds.has(id)) return false;
                                  seenOptIds.add(id);
                                  return true;
                                })
                                .map((m) => (
                                  <option key={`mgr-opt-${m.id}`} value={m.id}>
                                    {m.fullName} (کد ملی: {m.nationalId}) [دفتر: {m.assignedOfficeCode}]
                                  </option>
                                ));
                            })()}
                          </optgroup>
                        )}
                      </select>

                      {selectedExistingUserId ? (
                        <div className="bg-white p-3 rounded-xl border border-emerald-200 text-xs space-y-1 text-emerald-950">
                          <div className="flex items-center justify-between font-extrabold text-slate-900">
                            <span>مسئول انتخابی:</span>
                            <span className="text-emerald-800">{formManagerName}</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1 border-t border-slate-100">
                            <span>نام کاربری: <strong className="font-mono text-slate-800">{formUsername}</strong></span>
                            <span>شماره همراه: <strong className="font-mono text-slate-800">{formManagerMobile || 'ثبت نشده'}</strong></span>
                          </div>
                          <p className="text-[10px] text-emerald-700 pt-1">
                            ✓ این حساب کاربری بدون نیاز به ایجاد اکانت جدید، مستقیماً به دفتر اختصاص خواهد یافت.
                          </p>
                        </div>
                      ) : (
                        <p className="text-[11px] text-emerald-800">
                          با انتخاب هر یک از کاربران، مشخصات فردی و نام کاربری وی به صورت خودکار در فیلدهای زیر درج می‌گردد.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 text-xs text-blue-900 space-y-1">
                    <div className="font-extrabold flex items-center gap-1.5">
                      <User className="w-4 h-4 text-blue-700" />
                      <span>اتصال مسئول به دفتر ثبت نام</span>
                    </div>
                    <p className="text-[11px] text-blue-800 leading-relaxed">
                      هر مسئول با کد یکتای اختصاصی به دفتر کد <strong>{formOfficeCode || '...'}</strong> منتسب می‌گردد. ثبت هر دو شماره تماس (موبایل و ثابت) الزامی است.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Manager Unique Code */}
                    <div>
                      <label className="text-xs font-extrabold text-slate-800 block mb-1.5">
                        کد یکتای اختصاصی مسئول <span className="text-rose-500">*</span>:
                      </label>
                      <input
                        type="text"
                        required
                        value={formManagerCode}
                        onChange={(e) => setFormManagerCode(e.target.value)}
                        placeholder={`MGR-${formOfficeCode || '1042'}`}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>

                    {/* Manager National ID */}
                    <div>
                      <label className="text-xs font-extrabold text-slate-800 block mb-1.5">
                        کد ملی مسئول (۱۰ رقمی) <span className="text-rose-500">*</span>:
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={10}
                        value={formManagerNationalId}
                        onChange={(e) => setFormManagerNationalId(e.target.value)}
                        placeholder="0078451234"
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Manager Full Name */}
                  <div>
                    <label className="text-xs font-extrabold text-slate-800 block mb-1.5">
                      نام و نام خانوادگی مسئول دفتر <span className="text-rose-500">*</span>:
                    </label>
                    <input
                      type="text"
                      required
                      value={formManagerName}
                      onChange={(e) => setFormManagerName(e.target.value)}
                      placeholder="مثال: مهندس محمدرضا ابراهیمی"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  {/* Dual Phone Numbers: Mobile & Landline */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-extrabold text-slate-800 block mb-1.5">
                        شماره تلفن همراه (موبایل) <span className="text-rose-500">*</span>:
                      </label>
                      <input
                        type="tel"
                        required
                        value={formManagerMobile}
                        onChange={(e) => setFormManagerMobile(e.target.value)}
                        placeholder="09121112233"
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-extrabold text-slate-800 block mb-1.5">
                        شماره تلفن ثابت مسئول:
                      </label>
                      <input
                        type="tel"
                        value={formManagerPhone}
                        onChange={(e) => setFormManagerPhone(e.target.value)}
                        placeholder="021-88765432"
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Manager Email */}
                  <div>
                    <label className="text-xs font-extrabold text-slate-800 block mb-1.5">
                      آدرس ایمیل مسئول:
                    </label>
                    <input
                      type="email"
                      value={formManagerEmail}
                      onChange={(e) => setFormManagerEmail(e.target.value)}
                      placeholder="m.ebrahimi@pishkhan.ir"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* TAB 3: GEO LOCATION */}
              {formActiveTab === 'GEO_LOCATION' && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="space-y-1 text-xs text-emerald-950">
                      <strong className="block font-bold">تعیین موقعیت جغرافیایی روی نقشه تعاملی ایران:</strong>
                      <p className="text-[11px] text-emerald-800">
                        مختصات ثبت شده برای نمایش روی نقشه کشوری و نظارت میدانی بازرسان استفاده خواهد شد.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowLocationPickerModal(true)}
                      className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition shrink-0 shadow-2xs cursor-pointer"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>باز کردن نقشه انتخاب موقعیت</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-extrabold text-slate-800 block mb-1.5">
                        عرض جغرافیایی (Latitude):
                      </label>
                      <input
                        type="number"
                        step="0.000001"
                        value={formLat || ''}
                        onChange={(e) => setFormLat(e.target.value ? parseFloat(e.target.value) : undefined)}
                        placeholder="35.6892"
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-extrabold text-slate-800 block mb-1.5">
                        طول جغرافیایی (Longitude):
                      </label>
                      <input
                        type="number"
                        step="0.000001"
                        value={formLng || ''}
                        onChange={(e) => setFormLng(e.target.value ? parseFloat(e.target.value) : undefined)}
                        placeholder="51.3890"
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="text-xs font-extrabold text-slate-800 block mb-1.5">
                      توضیحات و سوابق تکمیلی دفتر:
                    </label>
                    <textarea
                      rows={2}
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      placeholder="سوابق ممیزی، تجهیزات سخت‌افزاری و توکن‌های موجود در دفتر..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Modal Footer Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  {formActiveTab === 'OFFICE_INFO' && (
                    <button
                      type="button"
                      onClick={() => setFormActiveTab('MANAGER_INFO')}
                      className="text-emerald-700 font-bold hover:underline"
                    >
                      مرحله بعد: مشخصات مسئول دفتر ←
                    </button>
                  )}
                  {formActiveTab === 'MANAGER_INFO' && (
                    <button
                      type="button"
                      onClick={() => setFormActiveTab('GEO_LOCATION')}
                      className="text-emerald-700 font-bold hover:underline"
                    >
                      مرحله بعد: موقعیت روی نقشه ←
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddEditModal(false)}
                    className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2.5 rounded-2xl shadow-xs transition cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>{editingOffice ? 'ذخیره تغییرات دفتر' : 'ثبت نهایی دفتر و مسئول'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: BATCH EXCEL UPLOAD (1000+ RECORDS) */}
      {showExcelImportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 my-4">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-2xs">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    بارگذاری دسته‌جمعی دفاتر و مسئولین از طریق فایل اکسل
                  </h3>
                  <p className="text-xs text-slate-500">
                    پشتیبانی از ۱۰۰۰+ دفتر ثبت نام با تولید خودکار کدهای یکتا و اعتبارسنجی تلفن‌ها و موقعیت
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowExcelImportModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {/* Step 1: Download Standard Template */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="space-y-1 text-xs">
                  <strong className="text-slate-900 font-bold block">مرحله ۱: دریافت قالب استاندارد اکسل</strong>
                  <span className="text-slate-600">
                    شامل ستون‌های کد دفتر، نام، نوع، استان، شهرستان، آدرس، تلفن ثابت، ایمیل، کدملی مسئول، نام مسئول و موبایل
                  </span>
                </div>
                <button
                  type="button"
                  onClick={downloadOfficeManagersExcelTemplate}
                  className="flex items-center gap-1.5 bg-white hover:bg-slate-100 text-emerald-700 border border-emerald-300 font-bold text-xs px-3.5 py-2 rounded-xl transition shrink-0 shadow-2xs cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>دانلود قالب اکسل</span>
                </button>
              </div>

              {/* Step 2: File Dropzone */}
              <div className="space-y-2">
                <label className="text-xs font-extrabold text-slate-900 block">
                  مرحله ۲: انتخاب یا رهاسازی فایل اکسل تکمیل شده:
                </label>

                <label className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-3xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer bg-slate-50/50 hover:bg-emerald-50/30 transition text-center">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setExcelFile(e.target.files[0]);
                        setImportSummary(null);
                        setImportErrorMessage(null);
                      }
                    }}
                    className="hidden"
                  />
                  <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center shadow-xs">
                    <Upload className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 block">
                      {excelFile ? excelFile.name : 'فایل اکسل دفاتر را اینجا بکشید یا برای انتخاب کلیک کنید'}
                    </span>
                    <span className="text-[11px] text-slate-500 mt-0.5 block">
                      پشتیبانی از فرمت‌های XLSX و XLS (حجم تا ۵۰ مگابایت و ۱۰۰۰+ سطر)
                    </span>
                  </div>
                </label>
              </div>

              {/* Process Button */}
              {excelFile && !importSummary && (
                <button
                  type="button"
                  disabled={isProcessingExcel}
                  onClick={handleProcessExcelFile}
                  className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-emerald-700 text-white font-bold text-xs py-3 rounded-2xl transition shadow-xs cursor-pointer"
                >
                  {isProcessingExcel ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>در حال پردازش و اعتبارسنجی ردیف‌های اکسل...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>پردازش و اعتبارسنجی فایل اکسل</span>
                    </>
                  )}
                </button>
              )}

              {/* Error Alert */}
              {importErrorMessage && (
                <div className="bg-rose-50 border border-rose-200 text-rose-900 text-xs p-4 rounded-2xl flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold block">خطا در اعتبارسنجی فایل:</strong>
                    <span>{importErrorMessage}</span>
                  </div>
                </div>
              )}

              {/* Summary of Parsed Rows */}
              {importSummary && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl">
                      <span className="text-[11px] text-emerald-800 block font-semibold">دفاتر جدید</span>
                      <strong className="text-lg font-black text-emerald-900 font-mono">
                        {importSummary.successCount}
                      </strong>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 p-3 rounded-2xl">
                      <span className="text-[11px] text-blue-800 block font-semibold">دفاتر به‌روزرسانی شده</span>
                      <strong className="text-lg font-black text-blue-900 font-mono">
                        {importSummary.updatedCount}
                      </strong>
                    </div>

                    <div className="bg-rose-50 border border-rose-200 p-3 rounded-2xl">
                      <span className="text-[11px] text-rose-800 block font-semibold">خطاهای سطری</span>
                      <strong className="text-lg font-black text-rose-900 font-mono">
                        {importSummary.errorCount}
                      </strong>
                    </div>
                  </div>

                  {/* Errors preview if any */}
                  {importSummary.errors.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl space-y-1 text-xs">
                      <strong className="text-amber-950 font-bold block">هشدارهای ردیف‌های نامعتبر:</strong>
                      <ul className="list-disc list-inside text-amber-900 space-y-0.5 max-h-28 overflow-y-auto text-[11px]">
                        {importSummary.errors.map((err, i) => (
                          <li key={i}>ردیف {err.row}: {err.message}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Preview Table of first 5 imported items */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-slate-800 block">پیش‌نمایش ردیف‌های خوانده‌شده:</span>
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 max-h-44 overflow-y-auto text-xs divide-y divide-slate-200">
                      {importSummary.importedOffices.slice(0, 8).map((o, idx) => (
                        <div key={idx} className="py-2 flex items-center justify-between">
                          <div>
                            <strong className="text-slate-900 block">{o.name}</strong>
                            <span className="text-[11px] text-slate-500 font-mono">کد دفتر: {o.code} • مسئول: {o.managerName}</span>
                          </div>
                          <span className="text-[11px] font-mono text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                            {o.province} - {o.city}
                          </span>
                        </div>
                      ))}
                      {importSummary.importedOffices.length > 8 && (
                        <div className="py-2 text-center text-slate-500 text-[11px]">
                          و {importSummary.importedOffices.length - 8} دفتر دیگر...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowExcelImportModal(false)}
                className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition"
              >
                انصراف
              </button>

              {importSummary && (
                <button
                  type="button"
                  onClick={handleApplyBatchImport}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-2xl shadow-xs transition cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>تایید و افزودن {importSummary.importedOffices.length} دفتر به سامانه</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: LOCATION PICKER */}
      {showLocationPickerModal && (
        <IranLocationPickerModal
          initialLat={formLat}
          initialLng={formLng}
          province={formProvince}
          city={formCity}
          officeName={formOfficeName}
          onSelectLocation={(selectedLat, selectedLng) => {
            setFormLat(selectedLat);
            setFormLng(selectedLng);
          }}
          onClose={() => setShowLocationPickerModal(false)}
        />
      )}

      {/* MODAL 4: OFFICE IDENTIFICATION & PRINT CARD */}
      {showOfficeCardModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 my-4">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-black text-slate-900">
                  شناسنامه رسمی دفتر صدور گواهی الکترونیکی (RA)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const targetOffice = showOfficeCardModal;
                    setShowOfficeCardModal(null);
                    setShowTimelineOffice(targetOffice);
                  }}
                  className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold px-3 py-1.5 rounded-xl border border-amber-200 transition cursor-pointer"
                  title="مشاهده تایم‌لاین نظارتی و پرونده‌های تعلیق/تخلف"
                >
                  <Clock className="w-3.5 h-3.5 text-amber-700" />
                  <span>تایم‌لاین نظارتی</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>چاپ</span>
                </button>
                <button
                  onClick={() => setShowOfficeCardModal(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5 text-xs">
              {/* Office Header Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-lg text-xs font-black border border-emerald-200">
                      کد شناسه دفتر: {showOfficeCardModal.code}
                    </span>
                    {renderOfficeStatusBadge(showOfficeCardModal.status)}
                  </div>
                  <h4 className="text-base font-black text-slate-900 mt-2">{showOfficeCardModal.name}</h4>
                  <div className="mt-1">
                    {renderOfficeTypeBadge(showOfficeCardModal.type, showOfficeCardModal.customTypeName)}
                  </div>
                </div>

                <div className="text-left font-mono text-[11px] text-slate-500">
                  <div>استان {showOfficeCardModal.province}</div>
                  <div>شهرستان {showOfficeCardModal.city}</div>
                </div>
              </div>

              {/* Manager & Contact Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-2xl p-4 space-y-2">
                  <strong className="text-slate-900 font-extrabold flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                    <User className="w-4 h-4 text-blue-600" />
                    <span>مشخصات مسئول دفتر:</span>
                  </strong>
                  <div className="text-slate-700 space-y-1">
                    <div>نام و نام خانوادگی: <strong className="text-slate-900">{showOfficeCardModal.managerName}</strong></div>
                    <div>کد یکتای مسئول: <span className="font-mono text-slate-900">{showOfficeCardModal.managerId || '-'}</span></div>
                    <div>کد ملی: <span className="font-mono text-slate-900">{showOfficeCardModal.managerNationalId || '-'}</span></div>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-2xl p-4 space-y-2">
                  <strong className="text-slate-900 font-extrabold flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                    <Phone className="w-4 h-4 text-emerald-600" />
                    <span>اطلاعات تماس و ارتباطات:</span>
                  </strong>
                  <div className="text-slate-700 space-y-1 font-mono">
                    <div>همراه مسئول: <strong className="text-emerald-800">{showOfficeCardModal.managerMobile || '-'}</strong></div>
                    <div>تلفن ثابت دفتر: <strong className="text-slate-900">{showOfficeCardModal.phone}</strong></div>
                    <div>ایمیل: <span className="text-slate-600 text-[11px]">{showOfficeCardModal.email || '-'}</span></div>
                  </div>
                </div>
              </div>

              {/* Login Credentials Box */}
              <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <strong className="text-emerald-950 font-black flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>مشخصات ورود به کارتابل (نام کاربری و کلمه عبور دفتر):</span>
                  </strong>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">
                    حساب کاربری فعال
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                  <div className="bg-white p-2.5 rounded-xl border border-emerald-200/70 flex items-center justify-between">
                    <span className="text-slate-600">نام کاربری:</span>
                    <span className="font-mono font-bold text-emerald-900 bg-slate-100 px-2 py-0.5 rounded">
                      {showOfficeCardModal.username || `office${showOfficeCardModal.code}`}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-emerald-200/70 flex items-center justify-between">
                    <span className="text-slate-600">کلمه عبور اولیه:</span>
                    <span className="font-mono font-bold text-emerald-900 bg-slate-100 px-2 py-0.5 rounded">
                      {showOfficeCardModal.username || `office${showOfficeCardModal.code}`}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-emerald-800/90 pt-0.5">
                  مسئول دفتر می‌تواند با نام کاربری و رمز فوق وارد کارتابل انحصاری دفتر خود شود. (در اولین ورود ملزم به تعیین رمز جدید خواهد بود).
                </p>
              </div>

              {/* Postal & Location Info */}
              <div className="border border-slate-200 rounded-2xl p-4 space-y-2 bg-slate-50/50">
                <strong className="text-slate-900 font-extrabold flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  <span>آدرس و موقعیت مکانی:</span>
                </strong>
                <p className="text-slate-700 leading-relaxed">{showOfficeCardModal.address}</p>
                {showOfficeCardModal.latitude && showOfficeCardModal.longitude && (
                  <div className="text-emerald-800 font-mono text-[11px] bg-emerald-50 p-2 rounded-xl border border-emerald-200">
                    مختصات جغرافیایی: Lat: {showOfficeCardModal.latitude}, Lng: {showOfficeCardModal.longitude}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: ADD / EDIT OFFICE TYPE */}
      {showAddTypeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 my-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600" />
                <span>{editingType ? `ویرایش نوع دفتر: ${editingType.title}` : 'تعریف نوع جدید دفتر ثبت‌نام'}</span>
              </h3>
              <button
                onClick={() => {
                  setEditingType(null);
                  setShowAddTypeModal(false);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomType} className="space-y-3.5 text-xs">
              <div>
                <label className="font-extrabold text-slate-800 block mb-1">کد سیستمی / انگلیسی نوع:</label>
                <input
                  type="text"
                  value={newTypeCode}
                  onChange={(e) => setNewTypeCode(e.target.value.toUpperCase())}
                  placeholder="مثال: NOTARY_MARRIAGE"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-left uppercase"
                  dir="ltr"
                />
                <p className="text-[10px] text-slate-400 mt-1">شناسه یکتای نوع دفتر در پایگاه داده</p>
              </div>

              <div>
                <label className="font-extrabold text-slate-800 block mb-1">عنوان فارسی نوع دفتر <span className="text-rose-500">*</span>:</label>
                <input
                  type="text"
                  required
                  value={newTypeTitle}
                  onChange={(e) => setNewTypeTitle(e.target.value)}
                  placeholder="مثال: دفاتر ازدواج و طلاق"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-800 block mb-1">رنگ برچسب و شناسه:</label>
                <div className="grid grid-cols-4 gap-2 pt-1">
                  {[
                    { id: 'emerald', name: 'زمردی', bg: 'bg-emerald-500' },
                    { id: 'blue', name: 'آبی', bg: 'bg-blue-500' },
                    { id: 'amber', name: 'کهربایی', bg: 'bg-amber-500' },
                    { id: 'purple', name: 'بنفش', bg: 'bg-purple-500' },
                    { id: 'rose', name: 'رز', bg: 'bg-rose-500' },
                    { id: 'indigo', name: 'نیلی', bg: 'bg-indigo-500' },
                    { id: 'teal', name: 'فیروزه‌ای', bg: 'bg-teal-500' },
                    { id: 'slate', name: 'خاکستری', bg: 'bg-slate-500' },
                  ].map((colorOpt) => (
                    <button
                      key={colorOpt.id}
                      type="button"
                      onClick={() => setNewTypeColor(colorOpt.id)}
                      className={`flex items-center gap-1.5 p-1.5 rounded-xl border text-[11px] font-bold transition cursor-pointer ${
                        newTypeColor === colorOpt.id
                          ? 'border-slate-900 bg-slate-50 shadow-2xs text-slate-900'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full ${colorOpt.bg}`} />
                      <span>{colorOpt.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-extrabold text-slate-800 block mb-1">توضیحات و دامنه فعالیت:</label>
                <textarea
                  rows={2}
                  value={newTypeDescription}
                  onChange={(e) => setNewTypeDescription(e.target.value)}
                  placeholder="توضیحات تکمیلی پیرامون وظایف و اختیارات این نوع دفتر..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingType(null);
                    setShowAddTypeModal(false);
                  }}
                  className="px-3.5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer font-bold"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl shadow-xs transition cursor-pointer"
                >
                  {editingType ? 'ذخیره تغییرات' : 'افزودن نوع جدید'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: AUDIT TIMELINE & VIOLATION / SUSPENSION DOSSIER */}
      {showTimelineOffice && (
        <OfficeAuditTimelineModal
          office={showTimelineOffice}
          allEvents={auditEvents}
          onClose={() => setShowTimelineOffice(null)}
          onAddEvent={(newEvent) => {
            if (onAddAuditEvent) onAddAuditEvent(newEvent);
          }}
          onResolveEvent={(eventId) => {
            if (onResolveAuditEvent) onResolveAuditEvent(eventId);
          }}
          onUpdateOfficeStatus={(officeCode, newStatus) => {
            if (onUpdateOfficeStatus) {
              onUpdateOfficeStatus(officeCode, newStatus);
            }
            setOffices(prev => prev.map(o => o.code === officeCode ? { ...o, status: newStatus } : o));
            if (showTimelineOffice && showTimelineOffice.code === officeCode) {
              setShowTimelineOffice(prev => prev ? { ...prev, status: newStatus } : null);
            }
          }}
        />
      )}

      {/* MODAL 7: FORM FIELD SETTINGS (REQUIRED/OPTIONAL, ACTIVE/EDITABLE) */}
      <FormFieldSettingsModal
        isOpen={showFieldSettingsModal}
        onClose={() => setShowFieldSettingsModal(false)}
        fieldSettings={fieldSettings}
        onSave={(updated) => {
          if (setFieldSettings) {
            setFieldSettings(updated);
          }
        }}
      />

      {/* MODAL 8: SMART DEACTIVATE / DELETE OFFICE CONFIRMATION */}
      {confirmActionOffice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-2xl ${getOfficeRecordsCount(confirmActionOffice.code) > 0 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>
                  {getOfficeRecordsCount(confirmActionOffice.code) > 0 ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : (
                    <Trash2 className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    مدیریت وضعیت و حذف دفتر
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    کد دفتر: {confirmActionOffice.code} | {confirmActionOffice.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setConfirmActionOffice(null)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200/50 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs">
              {/* Office Snapshot Card */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900 text-sm">{confirmActionOffice.name}</span>
                  {renderOfficeStatusBadge(confirmActionOffice.status)}
                </div>
                <div className="text-slate-600 flex items-center justify-between">
                  <span>مسئول: <strong className="text-slate-800">{confirmActionOffice.managerName}</strong></span>
                  <span>استان: <strong className="text-slate-800">{confirmActionOffice.province} - {confirmActionOffice.city}</strong></span>
                </div>
              </div>

              {/* Condition Check */}
              {getOfficeRecordsCount(confirmActionOffice.code) > 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2 text-amber-900">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold text-xs">
                        امکان حذف فیزیکی این دفتر به دلیل وجود سوابق ممیزی وجود ندارد:
                      </p>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        این دفتر دارای <strong className="font-bold text-amber-950 underline font-mono">{getOfficeRecordsCount(confirmActionOffice.code)}</strong> پرونده / مدرک بازرسی ثبت‌شده در سامانه است. جهت حفظ زنجیره ممیزی و سوابق حقوقی، امکان حذف فیزیکی وجود ندارد؛ اما می‌توانید وضعیت دفتر را غیرفعال یا تعلیق نمایید.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-xs">
                        این دفتر هیچ پرونده بازرسی یا مدرک ممیزی ثبت‌شده‌ای ندارد.
                      </p>
                      <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                        می‌توانید دفتر را به صورت کامل و دائمی از سامانه حذف نمایید و یا وضعیت آن را به غیرفعال / تعلیق تغییر دهید.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Choice Buttons */}
              <div className="space-y-2 pt-1">
                <p className="font-bold text-slate-700 text-xs">عملیات مدنظر را انتخاب فرمایید:</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Status: Inactive */}
                  <button
                    type="button"
                    onClick={() => handleChangeOfficeStatus(confirmActionOffice.code, 'INACTIVE')}
                    className={`p-3 rounded-2xl border text-right transition cursor-pointer flex flex-col justify-between ${
                      confirmActionOffice.status === 'INACTIVE'
                        ? 'bg-slate-200/80 border-slate-400 font-bold text-slate-900'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-extrabold text-xs">غیرفعال‌سازی دفتر</span>
                      <XCircle className="w-4 h-4 text-slate-500" />
                    </div>
                    <span className="text-[10px] text-slate-500">توقف موقت کلیه دسترسی‌ها بدون حذف داده</span>
                  </button>

                  {/* Status: Suspended */}
                  <button
                    type="button"
                    onClick={() => handleChangeOfficeStatus(confirmActionOffice.code, 'SUSPENDED')}
                    className={`p-3 rounded-2xl border text-right transition cursor-pointer flex flex-col justify-between ${
                      confirmActionOffice.status === 'SUSPENDED'
                        ? 'bg-amber-100 border-amber-400 font-bold text-amber-900'
                        : 'bg-white hover:bg-amber-50/50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-extrabold text-xs text-amber-800">تعلیق موقت دفتر</span>
                      <Clock className="w-4 h-4 text-amber-600" />
                    </div>
                    <span className="text-[10px] text-slate-500">ثبت تعلیق انضباطی با امکان رفع تعلیق</span>
                  </button>

                  {/* Status: Active (Activate again) */}
                  <button
                    type="button"
                    onClick={() => handleChangeOfficeStatus(confirmActionOffice.code, 'ACTIVE')}
                    className={`p-3 rounded-2xl border text-right transition cursor-pointer flex flex-col justify-between ${
                      confirmActionOffice.status === 'ACTIVE'
                        ? 'bg-emerald-100 border-emerald-400 font-bold text-emerald-900'
                        : 'bg-white hover:bg-emerald-50/50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-extrabold text-xs text-emerald-800">فعال‌سازی مجدد</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <span className="text-[10px] text-slate-500">بازگرداندن وضعیت دفتر به فعال عادی</span>
                  </button>

                  {/* Status: Revoked */}
                  <button
                    type="button"
                    onClick={() => handleChangeOfficeStatus(confirmActionOffice.code, 'REVOKED')}
                    className={`p-3 rounded-2xl border text-right transition cursor-pointer flex flex-col justify-between ${
                      confirmActionOffice.status === 'REVOKED'
                        ? 'bg-rose-100 border-rose-400 font-bold text-rose-900'
                        : 'bg-white hover:bg-rose-50/50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-extrabold text-xs text-rose-800">ابطال دائمی مجوز</span>
                      <Ban className="w-4 h-4 text-rose-600" />
                    </div>
                    <span className="text-[10px] text-slate-500">ابطال کامل پروانه و مجوز دفتر</span>
                  </button>
                </div>

                {/* Permanent Delete Option if records === 0 */}
                {getOfficeRecordsCount(confirmActionOffice.code) === 0 && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => handlePermanentDeleteOffice(confirmActionOffice.code)}
                      className="w-full p-3 rounded-2xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-800 text-right transition cursor-pointer flex items-center justify-between"
                    >
                      <div>
                        <p className="font-black text-xs text-rose-900">حذف کامل و دائمی دفتر از سامانه</p>
                        <p className="text-[10px] text-rose-700 mt-0.5">
                          حذف فیزیکی رکورد دفتر و اطلاعات مسئول اختصاص‌یافته به آن
                        </p>
                      </div>
                      <Trash2 className="w-5 h-5 text-rose-600 shrink-0" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setConfirmActionOffice(null)}
                className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 font-bold transition cursor-pointer text-xs"
              >
                انصراف و بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CLEAR ALL OFFICES & CERTIFICATES FROM DATABASE */}
      {showClearDbModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden animate-in zoom-in-95 my-4">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-rose-900 via-slate-900 to-rose-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-400/30 flex items-center justify-center text-rose-400 shrink-0">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    پاکسازی اطلاعات دیتابیس (دفاتر و گواهی‌ها)
                  </h3>
                  <p className="text-xs text-rose-200 mt-0.5">
                    آماده‌سازی سامانه جهت ارسال و بارگذاری مجدد اطلاعات
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isClearingDb && setShowClearDbModal(false)}
                disabled={isClearingDb}
                className="p-1.5 hover:bg-white/10 rounded-xl text-white/70 hover:text-white transition cursor-pointer disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-5">
              {/* Warning Alert */}
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs text-rose-900 leading-relaxed space-y-1.5">
                  <p className="font-bold text-rose-950">هشدار پاکسازی کامل اطلاعات:</p>
                  <p>
                    این عملیات تمامی دفاتر ثبت‌نام، مسئولین، گواهی‌های صدور و رکوردهای بازرسی وابسته به آن‌ها را از دیتابیس ابری (Supabase) و حافظه سامانه حذف می‌نماید.
                  </p>
                  <p className="text-rose-700">
                    پس از اجرای این عملیات، می‌توانید با خیال آسوده فایل اکسل جدید دفاتر یا گواهی‌ها را بدون تداخل یا ثبت رکوردهای تکراری مجدداً بارگذاری و ارسال فرمایید.
                  </p>
                </div>
              </div>

              {/* Data counts to be deleted */}
              <div className="space-y-2">
                <h4 className="text-xs font-black text-slate-700">داده‌هایی که حذف خواهند شد:</h4>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                    <span className="text-[11px] text-slate-500 block">دفاتر ثبت نام</span>
                    <span className="text-lg font-black text-slate-900 font-mono">
                      {offices.length.toLocaleString('fa-IR')}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">دفتر فعال</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                    <span className="text-[11px] text-slate-500 block">مسئولین دفاتر</span>
                    <span className="text-lg font-black text-slate-900 font-mono">
                      {managers.length.toLocaleString('fa-IR')}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">مسئول ثبت شده</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                    <span className="text-[11px] text-slate-500 block">گواهی‌های صدور</span>
                    <span className="text-lg font-black text-slate-900 font-mono">
                      {certificates.length.toLocaleString('fa-IR')}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">گواهی الکترونیکی</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                    <span className="text-[11px] text-slate-500 block">پرونده‌ها و وقایع</span>
                    <span className="text-lg font-black text-slate-900 font-mono">
                      {(campaigns.length + auditEvents.length).toLocaleString('fa-IR')}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">رکورد و رویداد</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowClearDbModal(false)}
                  disabled={isClearingDb}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleClearAllDatabaseAndStorage}
                  disabled={isClearingDb}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {isClearingDb ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>در حال پاکسازی دیتابیس...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>تایید و پاکسازی کامل اطلاعات</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
