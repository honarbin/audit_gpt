import { 
  AppNotification, 
  NotificationCategory, 
  NotificationSeverity, 
  NotificationPriority, 
  NotificationStatus, 
  NotificationChannelConfig, 
  ChannelDeliveryStatus, 
  NotificationResponseRecord,
  NotificationExportablePayload
} from '../types/notifications';

export const DEFAULT_NOTIFICATION_CHANNELS_CONFIG: NotificationChannelConfig = {
  inAppEnabled: true,
  smsEnabled: true,
  smsProvider: 'KAVENEGAR',
  smsSenderNumber: '30005006',
  smsDefaultRecipient: '09121234567',
  emailEnabled: true,
  emailSmtpHost: 'smtp.root-ca.gov.ir',
  emailSmtpPort: 587,
  emailSenderAddress: 'audit-notifications@root-ca.gov.ir',
  emailDefaultRecipient: 'notary.inspection@gov.ir',
  webPushEnabled: true,
  webhookEnabled: true,
  webhookUrl: 'https://audit.root-ca.gov.ir/api/v1/webhook/events',
  webhookAuthBearer: 'Bearer ra_audit_sec_9938210492_prod',
  webhookSecretHMAC: 'sha256=a7b3c990234deff812903ab',
  webhookAutoDispatchOnCreate: true,
  webhookAutoDispatchOnResponse: true,
};

export const INITIAL_NOTIFICATIONS: AppNotification[] = [];

/**
 * Builds a standardized, machine-readable exportable JSON payload
 */
export function buildExportableNotificationPayload(params: {
  eventId: string;
  eventCode: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  priority: NotificationPriority;
  recipientRole?: string;
  officeCode?: string;
  officeName?: string;
  contactMobile?: string;
  contactEmail?: string;
  title: string;
  summary: string;
  trackingCode?: string;
  certificateSerial?: string;
  applicantName?: string;
  nationalId?: string;
  campaignId?: string;
  campaignTitle?: string;
  defects?: string[];
  deadlineDate?: string;
  complianceScore?: number;
  status: NotificationStatus;
  respondedAt?: string;
  respondedBy?: string;
  responseNotes?: string;
  channels?: string[];
  webhookUrl?: string;
}): NotificationExportablePayload {
  return {
    version: '2.4.0',
    eventId: params.eventId,
    eventCode: params.eventCode,
    timestamp: new Date().toISOString(),
    environment: 'PRODUCTION',
    sourceSystem: 'RA_AUDIT_CORE_ENGINE',
    targetSystem: 'ROOT_CA_CENTRAL_SUPERVISION',
    eventCategory: params.category,
    severity: params.severity,
    priority: params.priority,
    recipient: {
      role: params.recipientRole || 'OFFICE_MANAGER',
      officeCode: params.officeCode,
      officeName: params.officeName,
      contactMobile: params.contactMobile,
      contactEmail: params.contactEmail,
    },
    details: {
      title: params.title,
      summary: params.summary,
      trackingCode: params.trackingCode,
      certificateSerial: params.certificateSerial,
      applicantName: params.applicantName,
      nationalId: params.nationalId,
      campaignId: params.campaignId,
      campaignTitle: params.campaignTitle,
      defects: params.defects,
      deadlineDate: params.deadlineDate,
      complianceScore: params.complianceScore,
    },
    latestAction: {
      status: params.status,
      respondedAt: params.respondedAt,
      respondedBy: params.respondedBy,
      responseNotes: params.responseNotes,
    },
    dispatchInfo: {
      channels: params.channels || ['IN_APP', 'SMS', 'EMAIL', 'WEBHOOK'],
      webhookCallbackUrl: params.webhookUrl || 'https://audit.root-ca.gov.ir/api/v1/webhook/events',
      signatureHMAC: `sha256=${Math.random().toString(36).substring(2, 15)}`,
    },
  };
}

/**
 * Creates a new notification with automated multi-channel delivery configuration
 */
export function createNotification(params: {
  eventCode: string;
  title: string;
  message: string;
  category: NotificationCategory;
  severity?: NotificationSeverity;
  priority?: NotificationPriority;
  status?: NotificationStatus;
  officeCode?: string;
  officeName?: string;
  targetEntityId?: string;
  targetEntityType?: 'INSPECTION_RECORD' | 'CAMPAIGN' | 'OFFICE' | 'AUDIT_EVENT';
  expiresAt?: string;
  metadata?: Record<string, any>;
  channelsConfig?: NotificationChannelConfig;
}): AppNotification {
  const cfg = params.channelsConfig || DEFAULT_NOTIFICATION_CHANNELS_CONFIG;
  const notifId = `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat('fa-IR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(now);

  const channels: ChannelDeliveryStatus[] = [];

  // In-App Channel
  if (cfg.inAppEnabled) {
    channels.push({
      channel: 'IN_APP',
      status: 'DISPATCHED',
      dispatchedAt: dateStr,
    });
  }

  // SMS Channel
  if (cfg.smsEnabled) {
    channels.push({
      channel: 'SMS',
      status: 'DISPATCHED',
      targetAddress: params.metadata?.mobileNumber || cfg.smsDefaultRecipient || '09121112233',
      dispatchedAt: dateStr,
      externalMessageId: `SMS-${Math.floor(100000 + Math.random() * 900000)}`,
    });
  }

  // Email Channel
  if (cfg.emailEnabled) {
    channels.push({
      channel: 'EMAIL',
      status: 'DISPATCHED',
      targetAddress: params.metadata?.email || cfg.emailDefaultRecipient || 'office@notary.ir',
      dispatchedAt: dateStr,
      externalMessageId: `EML-${Math.floor(10000 + Math.random() * 90000)}`,
    });
  }

  // Web Push
  if (cfg.webPushEnabled) {
    channels.push({
      channel: 'WEB_PUSH',
      status: 'DISPATCHED',
      dispatchedAt: dateStr,
    });
  }

  // Webhook External API
  if (cfg.webhookEnabled) {
    channels.push({
      channel: 'WEBHOOK',
      status: 'DISPATCHED',
      targetAddress: cfg.webhookUrl,
      dispatchedAt: dateStr,
      responseCode: 200,
    });
  }

  const exportable = buildExportableNotificationPayload({
    eventId: notifId,
    eventCode: params.eventCode,
    category: params.category,
    severity: params.severity || 'INFO',
    priority: params.priority || 'NORMAL',
    officeCode: params.officeCode,
    officeName: params.officeName,
    title: params.title,
    summary: params.message,
    trackingCode: params.metadata?.trackingCode,
    applicantName: params.metadata?.applicantName,
    nationalId: params.metadata?.nationalId,
    campaignId: params.metadata?.campaignId,
    campaignTitle: params.metadata?.campaignTitle,
    defects: params.metadata?.defectsList,
    deadlineDate: params.expiresAt,
    status: params.status || 'ACTION_REQUIRED',
    channels: channels.map(c => c.channel),
    webhookUrl: cfg.webhookUrl,
  });

  return {
    id: notifId,
    eventCode: params.eventCode,
    title: params.title,
    message: params.message,
    category: params.category,
    severity: params.severity || 'INFO',
    priority: params.priority || 'NORMAL',
    status: params.status || 'ACTION_REQUIRED',
    officeCode: params.officeCode,
    officeName: params.officeName,
    targetEntityId: params.targetEntityId,
    targetEntityType: params.targetEntityType,
    createdAt: dateStr,
    updatedAt: dateStr,
    expiresAt: params.expiresAt,
    channels,
    metadata: params.metadata,
    exportablePayload: exportable,
  };
}

/**
 * Updates a notification when a response/action occurs on a case or office
 */
export function updateNotificationOnResponse(
  notifications: AppNotification[],
  responseParams: {
    targetEntityId: string;
    responderRole: 'OFFICE_USER' | 'INSPECTOR' | 'SUPERVISOR' | 'SYSTEM';
    responderName: string;
    responseText: string;
    actionTaken: string;
    attachedDocNames?: string[];
    newStatus?: NotificationStatus;
    channelsConfig?: NotificationChannelConfig;
  }
): AppNotification[] {
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat('fa-IR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(now);

  const updatedStatus = responseParams.newStatus || 'RESPONDED';

  const newResponseEntry: NotificationResponseRecord = {
    id: `resp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    responderRole: responseParams.responderRole,
    responderName: responseParams.responderName,
    responseText: responseParams.responseText,
    responseDate: dateStr,
    actionTaken: responseParams.actionTaken,
    attachedDocNames: responseParams.attachedDocNames,
    newStatus: updatedStatus,
  };

  let foundMatch = false;

  const updatedList = notifications.map(notif => {
    if (notif.targetEntityId === responseParams.targetEntityId || notif.id === responseParams.targetEntityId) {
      foundMatch = true;
      const history = [...(notif.responseHistory || []), newResponseEntry];

      // Update exportable payload
      const updatedPayload: NotificationExportablePayload = {
        ...notif.exportablePayload,
        latestAction: {
          status: updatedStatus,
          respondedAt: dateStr,
          respondedBy: `${responseParams.responderName} (${responseParams.responderRole})`,
          responseNotes: responseParams.responseText,
        },
      };

      return {
        ...notif,
        status: updatedStatus,
        updatedAt: dateStr,
        responseHistory: history,
        latestResponse: newResponseEntry,
        exportablePayload: updatedPayload,
      };
    }
    return notif;
  });

  return updatedList;
}

/**
 * Simulates real-time dispatch of notification payload to an external Webhook API
 */
export async function simulateWebhookDispatch(
  payload: NotificationExportablePayload,
  webhookUrl: string,
  bearerToken?: string
): Promise<{ success: boolean; statusCode: number; responseBody: string; latencyMs: number }> {
  // Simulate network latency (250ms - 600ms)
  const latency = Math.floor(250 + Math.random() * 350);
  await new Promise(resolve => setTimeout(resolve, latency));

  const isValidUrl = webhookUrl.startsWith('http://') || webhookUrl.startsWith('https://');

  if (!isValidUrl) {
    return {
      success: false,
      statusCode: 400,
      responseBody: JSON.stringify({ error: 'Invalid webhook endpoint URL' }, null, 2),
      latencyMs: latency,
    };
  }

  return {
    success: true,
    statusCode: 200,
    responseBody: JSON.stringify({
      status: 'ACK_RECEIVED',
      receiptId: `ACK-WH-${Date.now()}`,
      processedAt: new Date().toISOString(),
      acceptedEventId: payload.eventId,
      signatureVerified: true,
      message: 'پیام با موفقیت توسط وب‌هوک سامانه مقصد دریافت و در صف ممیزی ثبت گردید.',
    }, null, 2),
    latencyMs: latency,
  };
}
