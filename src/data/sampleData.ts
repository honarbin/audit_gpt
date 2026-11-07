import { CertificateRecord, OfficeProfile, AuditCampaign, UploadedDocument, OfficeManager, OfficeTypeDefinition } from '../types';
import { EXPANDED_INITIAL_OFFICES, INITIAL_MANAGERS, DEFAULT_OFFICE_TYPES } from './iranGeoData';

export const INITIAL_OFFICES: OfficeProfile[] = EXPANDED_INITIAL_OFFICES;
export const INITIAL_MANAGERS_LIST: OfficeManager[] = INITIAL_MANAGERS;
export const INITIAL_OFFICE_TYPES_LIST: OfficeTypeDefinition[] = DEFAULT_OFFICE_TYPES;

export const SAMPLE_CERTIFICATES_RAW: CertificateRecord[] = [];

export const SAMPLE_MOCK_DOCS: Record<string, UploadedDocument[]> = {};

export const INITIAL_CAMPAIGNS: AuditCampaign[] = [];
