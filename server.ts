import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import {
  resolveManager,
  resolveManagers,
  resolveOffices,
  stripManagerPersonalFields,
  stripManagersPersonalFields,
} from "./src/utils/managerIdentity.js";

import { signToken, verifyToken, TOKEN_TTL_SECONDS, type TokenPayload } from "./server/auth/token.js";
import { DEFAULT_ROLE_PERMISSIONS, type UserPermissionConfig } from "./src/types/auth.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function createApp() {
  const app = express();
  const PORT = 3000;

  // CORS: the API is same-origin only. A foreign origin gets no CORS headers, so other sites cannot read it.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && origin !== "null") {
      let sameHost = false;
      try { sameHost = new URL(origin).host === String(req.headers["x-forwarded-host"] || req.headers.host || ""); } catch { /* ignore */ }
      if (sameHost) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader("Vary", "Origin");
      }
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin");
    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // API endpoint for health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // ===========================================================================
  // Authentication: every /api request except health + login needs a signed token.
  // The token is read from "Authorization: Bearer" (fetch) or, for GET requests only, from the HttpOnly
  // session cookie (EventSource / <img> / <iframe> / downloads, which cannot send headers).
  // ===========================================================================
  const PUBLIC_API = new Set(["/api/health", "/api/v1/auth/login", "/api/v1/auth/logout"]);
  const COOKIE_NAME = "ra_session";
  const readCookie = (req: any, name: string): string => {
    const raw = String(req.headers.cookie || "");
    for (const part of raw.split(";")) {
      const i = part.indexOf("=");
      if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
    }
    return "";
  };
  const cookieFlags = (req: any) => {
    const secure = String(req.headers["x-forwarded-proto"] || req.protocol) === "https" ? "; Secure" : "";
    return `Path=/; HttpOnly; SameSite=Strict${secure}`;
  };
  const publicUser = <T extends { passwordHash?: string }>(user: T): T => ({ ...user, passwordHash: "" });
  const publicUsers = <T extends { passwordHash?: string }>(users: T[] | null | undefined): T[] => (users || []).map(publicUser);

  app.use("/api", (req: any, res, next) => {
    const full = `/api${req.path}`.replace(/\/+$/, "");
    if (PUBLIC_API.has(full)) return next();
    const header = String(req.headers.authorization || "");
    const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
    const cookieToken = (req.method === "GET" || req.method === "HEAD") ? readCookie(req, COOKIE_NAME) : "";
    let payload: TokenPayload | null = null;
    try {
      payload = verifyToken(bearer || cookieToken);
    } catch (err: any) {
      return res.status(500).json({ success: false, error: { code: "AUTH_NOT_CONFIGURED", message: err.message } });
    }
    if (!payload) {
      return res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "نشست شما معتبر نیست یا منقضی شده است. لطفاً دوباره وارد شوید." } });
    }
    req.auth = payload;
    next();
  });


  // AI Document Audit & Compliance Review Endpoint (Optional Gemini Assistance)
  app.post("/api/ai-audit-check", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const { certificateData, uploadedDocs, inspectionRules } = req.body;

      if (!apiKey) {
        return res.json({
          success: false,
          message: "کلید API جمینای تنظیم نشده است (ارزیابی به صورت دستی انجام می‌شود).",
          fallbackAnalysis: {
            complianceScore: 85,
            findings: [
              "مدارک اولیه بررسی و تطبیق ساختاری انجام شد.",
              "اعتبارسنجی احراز هویت متقاضی نیاز به تایید نهایی بازرس دارد."
            ],
            riskLevel: "پایین",
            recommendation: "تایید مشروط به بررسی خوانایی مدارک بارگذاری شده"
          }
        });
      }

      const ai = new GoogleGenAI({ apiKey });
      const prompt = `شما یک دستیار هوشمند ارزیابی و بازرسی دفاتر صدور گواهی امضای الکترونیکی (RA Audit Inspector) در ایران هستید.
بر اساس مشخصات گواهی صادر شده و مدارک بارگذاری شده زیر، وضعیت انطباق با قوانین مرکز ریشه و میانی را تحلیل کن:
مشخصات گواهی:
${JSON.stringify(certificateData, null, 2)}

مدارک بارگذاری شده توسط دفتر:
${JSON.stringify(uploadedDocs, null, 2)}

قوانین مدارک الزامی:
- شخص حقیقی-مستقل: فقط فرم پذیرش
- شخص حقیقی-وابسته به غیردولت و شخص حقوقی-وابسته به غیردولت: فرم پذیرش + معرفینامه + آگهی تاسیس + آخرین روزنامه رسمی
- شخص حقیقی-وابسته به دولت و شخص حقوقی-وابسته به دولت: فقط معرفینامه
- در صورت وضعیت ابطال: فرم یا درخواست کتبی ابطال

پاسخ را دقیق، حرفه‌ای و در قالب JSON زیر به زبان فارسی برگردان:
{
  "complianceScore": (عدد از 0 تا 100),
  "status": "APPROVED" | "WARNING" | "REJECTED",
  "riskLevel": "پایین" | "متوسط" | "بالا" | "بحرانی",
  "findings": ["یافته ۱", "یافته ۲"],
  "missingItems": ["مدرک کسر یا ناقص ۱"],
  "recommendation": "توصیه به بازرس",
  "auditNote": "متن یادداشت بازرسی پیشنهادی"
}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const responseText = response.text || "{}";
      const parsed = JSON.parse(responseText);

      return res.json({
        success: true,
        analysis: parsed,
      });
    } catch (err: any) {
      console.error("AI Audit Error:", err);
      return res.status(500).json({
        success: false,
        error: err.message || "خطا در پردازش هوشمند بازرسی",
      });
    }
  });

  // =========================================================================
  // Standard Storage Service & Upload API (v1 Enterprise Architecture)
  // =========================================================================
  const { StorageService } = await import("./server/storage/StorageService.js");
  const { calculateChecksum } = await import("./server/storage/storageUtils.js");
  const storageService = StorageService.getInstance();

  // Late-bound permission guard (the database services are loaded further down).
  const guard = (...keys: any[]) => (req: any, res: any, next: any) => (requirePerm as any)(...keys)(req, res, next);

  // 1. وضعیت پرووایدر فعال و تنظیمات استوریج
  app.get("/api/v1/storage/status", (req, res) => {
    const activeProvider = storageService.getActiveProviderType();
    const provider = storageService.getProvider(activeProvider);
    res.json({
      success: true,
      activeProvider,
      isConfigured: provider.isConfigured(),
      availableProviders: ["google_drive", "server", "s3", "supabase"],
      serverUploadUrl: process.env.SERVER_STORAGE_API_URL || "internal_vault",
      message: `سرویس استوریج با پرووایدر [${activeProvider}] فعال است.`,
    });
  });

  // 2. تغییر داینامیک پرووایدر استوریج (SuperAdmin / Dev)
  app.post("/api/v1/storage/provider", (req, res, next) => guard("canManageDatabaseSync", "canManageSystemConfig")(req, res, next), (req, res) => {
    const { provider } = req.body;
    try {
      storageService.setActiveProviderType(provider);
      return res.json({
        success: true,
        activeProvider: storageService.getActiveProviderType(),
        message: `پرووایدر فعال با موفقیت به ${provider} تغییر یافت.`,
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  });

  // 3. اندپوینت استاندارد آپلود فایل (POST /api/v1/files/upload)
  app.post("/api/v1/files/upload", async (req, res) => {
    try {
      const {
        file,
        fileDataUrl,
        officeId,
        applicantId,
        inspectionId,
        documentType,
        originalFileName,
        fileName,
        mimeType,
        fileType,
        size,
        fileSize,
        checksum,
        documentId,
      } = req.body;

      const rawFileSource = fileDataUrl || file;
      const targetFileName = originalFileName || fileName;
      const targetMime = mimeType || fileType || "application/octet-stream";

      if (!rawFileSource || !targetFileName) {
        return res.status(400).json({
          success: false,
          error: "VALIDATION_FAILED: فیلدهای فایل و نام اصلی الزامی هستند.",
        });
      }

      // استخراج بافر
      const base64Content = rawFileSource.includes(",")
        ? rawFileSource.split(",")[1]
        : rawFileSource;
      const fileBuffer = Buffer.from(base64Content, "base64");

      // اعتبارسنجی حجم فایل (حداکثر ۲۰ مگابایت)
      const MAX_SIZE = 20 * 1024 * 1024;
      if (fileBuffer.length > MAX_SIZE) {
        return res.status(413).json({
          success: false,
          error: "PAYLOAD_TOO_LARGE: حجم فایل بیش از حد مجاز (حداکثر ۲۰ مگابایت) است.",
        });
      }

      // محاسبه چکسام در صورت عدم ارسال از کلاینت
      const computedChecksum = checksum || calculateChecksum(fileBuffer);

      // آپلود از طریق Storage Provider فعال
      const uploadResult = await storageService.upload({
        fileBuffer,
        originalFileName: targetFileName,
        mimeType: targetMime,
        fileSize: Number(size || fileSize) || fileBuffer.length,
        checksum: computedChecksum,
        officeId,
        inspectionId,
        applicantId,
        documentType: documentType || "DOCUMENTS",
        documentId,
      });

      return res.json({
        success: true,
        fileId: uploadResult.fileId,
        storageProvider: uploadResult.storageProvider,
        storageKey: uploadResult.storageKey,
        storageFileName: uploadResult.storageFileName,
        originalFileName: uploadResult.originalFileName,
        mimeType: uploadResult.mimeType,
        fileSize: uploadResult.fileSize,
        checksum: uploadResult.checksum,
        driveFileId: uploadResult.driveFileId,
        viewUrl: uploadResult.viewUrl,
        downloadUrl: uploadResult.downloadUrl,
        isDuplicate: uploadResult.isDuplicate || false,
        syncStatus: uploadResult.syncStatus,
        errorMessage: uploadResult.errorMessage,
      });
    } catch (err: any) {
      console.error("[Storage Upload API Error]:", err);
      return res.status(500).json({
        success: false,
        syncStatus: "failed",
        error: err.message || "خطا در پردازش و ذخیره‌سازی مدرک در لایه استوریج",
      });
    }
  });

  // 4. اندپوینت دریافت اطلاعات متادیتا (GET /api/v1/files/:fileId)
  app.get("/api/v1/files/:fileId", async (req, res) => {
    try {
      const { fileId } = req.params;
      const storageKey = req.query.storageKey as string | undefined;
      const provider = req.query.provider as any;
      const metadata = await storageService.getMetadata(fileId, storageKey, provider);
      if (!metadata) {
        return res.status(404).json({ success: false, error: "فایل یافت نشد." });
      }
      return res.json({ success: true, metadata });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 5. اندپوینت نمایش امن درون‌برنامه‌ای (GET /api/v1/files/:fileId/view)
  app.get("/api/v1/files/:fileId/view", async (req, res) => {
    try {
      const { fileId } = req.params;
      const storageKey = req.query.storageKey as string | undefined;
      const provider = req.query.provider as any;
      const fileData = await storageService.download(fileId, storageKey, provider);

      res.setHeader("Content-Type", fileData.mimeType);
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${encodeURIComponent(fileData.fileName)}"`
      );
      res.setHeader("Cache-Control", "private, max-age=3600");
      return res.send(fileData.buffer);
    } catch (err: any) {
      console.error("[Storage View Error]:", err);
      return res.status(404).json({
        success: false,
        error: err.message || "فایل جهت نمایش یافت نشد.",
      });
    }
  });

  // 6. اندپوینت دانلود با سربرگ Attachment (GET /api/v1/files/:fileId/download)
  app.get("/api/v1/files/:fileId/download", async (req, res) => {
    try {
      const { fileId } = req.params;
      const storageKey = req.query.storageKey as string | undefined;
      const provider = req.query.provider as any;
      const fileData = await storageService.download(fileId, storageKey, provider);

      res.setHeader("Content-Type", fileData.mimeType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(fileData.fileName)}"`
      );
      return res.send(fileData.buffer);
    } catch (err: any) {
      return res.status(404).json({
        success: false,
        error: err.message || "فایل جهت دانلود یافت نشد.",
      });
    }
  });

  // 7. حذف فایل (DELETE /api/v1/files/:fileId)
  app.delete("/api/v1/files/:fileId", async (req, res) => {
    try {
      const { fileId } = req.params;
      const storageKey = req.query.storageKey as string | undefined;
      const provider = req.query.provider as any;
      const success = await storageService.delete(fileId, storageKey, provider);
      return res.json({ success });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 8. اندپوینت مهاجرت مدارک بین پرووایدرها (POST /api/v1/storage/migrate)
  app.post("/api/v1/storage/migrate", (req, res, next) => guard("canManageDatabaseSync", "canManageSystemConfig")(req, res, next), async (req, res) => {
    try {
      const { fileId, sourceProvider, targetProvider, storageKey, officeId, inspectionId, applicantId, documentType } = req.body;
      if (!fileId || !sourceProvider || !targetProvider) {
        return res.status(400).json({ success: false, error: "fileId, sourceProvider and targetProvider are required." });
      }
      const migrated = await storageService.migrateFile({
        fileId,
        sourceProvider,
        targetProvider,
        storageKey,
        officeId,
        inspectionId,
        applicantId,
        documentType,
      });
      return res.json({ success: true, migrated });
    } catch (err: any) {
      console.error("[Storage Migration Error]:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // =========================================================================
  // Persistent Database APIs (v1 Full Central Persistence & Authentication)
  // =========================================================================
  const { ServerDbService } = await import("./server/db/serverDbService.js");
  const serverDb = ServerDbService.getInstance();
  serverDb.ensureInitialized();
  const centralDb = await import("./server/db/supabaseCentralService.js");

  /** Loads the calling user from the database and returns the effective permissions. */
  async function loadActor(req: any): Promise<{ user: any; perms: UserPermissionConfig } | null> {
    const auth: TokenPayload | undefined = req.auth;
    if (!auth) return null;
    const list: any[] = (centralDb.isCentralSupabaseConfigured() ? await centralDb.fetchUsers() : serverDb.getUsers()) || [];
    const user = list.find((u) => String(u.id) === auth.sub);
    if (!user || user.isActive === false) return null;
    const base = (DEFAULT_ROLE_PERMISSIONS as any)[user.role] || DEFAULT_ROLE_PERMISSIONS.OFFICE_USER;
    return { user, perms: { ...base, ...(user.customPermissions || {}) } };
  }

  /** Only a SYSTEM_ADMIN may create a SYSTEM_ADMIN or change the role of one. Returns an error message when refused. */
  async function roleEscalation(actor: { user: any } | null | undefined, incoming: any[]): Promise<string | null> {
    if (!actor) return "حساب کاربری یافت نشد.";
    if (actor.user.role === "SYSTEM_ADMIN") return null;
    const existing: any[] = (centralDb.isCentralSupabaseConfigured() ? await centralDb.fetchUsers() : serverDb.getUsers()) || [];
    const byId = new Map(existing.map((u) => [String(u.id), u]));
    for (const u of incoming) {
      const current = byId.get(String(u?.id));
      const touchesAdmin = u?.role === "SYSTEM_ADMIN" || current?.role === "SYSTEM_ADMIN";
      if (touchesAdmin && (!current || current.role !== u.role)) {
        return "فقط مدیر سامانه می‌تواند حساب مدیر ایجاد یا نقش آن را تغییر دهد.";
      }
    }
    return null;
  }

  /** Express guard: the caller must hold at least one of the listed permissions (SYSTEM_ADMIN always passes). */
  const requirePerm = (...keys: (keyof UserPermissionConfig)[]) => async (req: any, res: express.Response, next: express.NextFunction) => {
    try {
      const actor = await loadActor(req);
      if (!actor) return res.status(401).json({ success: false, error: "حساب کاربری یافت نشد یا غیرفعال است." });
      if (actor.user.role !== "SYSTEM_ADMIN" && !keys.some((k) => actor.perms[k])) {
        return res.status(403).json({ success: false, error: "شما مجوز انجام این عملیات را ندارید." });
      }
      req.actor = actor;
      next();
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  };

  // ---------------------------------------------------------------------------
  // Data scope: only users who may view all offices (admins, inspectors) see everything.
  // An office user is limited to the data of their own assigned office (and to their own access logs).
  // ---------------------------------------------------------------------------
  type Actor = { user: any; perms: UserPermissionConfig };
  const seesAll = (a: Actor) => a.user.role === "SYSTEM_ADMIN" || !!a.perms.canViewAllOffices;
  const officeOf = (a: Actor) => String(a.user.assignedOfficeCode || "").trim();
  const byOffice = <T,>(a: Actor, list: T[] | null | undefined, key: string, allowEmpty = false): T[] =>
    (list || []).filter((x: any) => {
      if (seesAll(a)) return true;
      const code = String(x?.[key] ?? "").trim();
      return code ? code === officeOf(a) && !!officeOf(a) : allowEmpty;
    });
  const scopeUsers = (a: Actor, users: any[] | null | undefined): any[] =>
    seesAll(a) ? (users || []) : (users || []).filter((u) => String(u.id) === String(a.user.id) || (!!officeOf(a) && String(u.assignedOfficeCode || "").trim() === officeOf(a)));
  const scopeLogs = (a: Actor, logs: any[] | null | undefined): any[] =>
    seesAll(a) ? (logs || []) : (logs || []).filter((l) => String(l.userId) === String(a.user.id));
  const scopeSettings = (a: Actor, settings: Record<string, any> | null | undefined): Record<string, any> => {
    const out = { ...(settings || {}) };
    // Webhook tokens and similar secrets are only for users who manage notification channels.
    if (a.user.role !== "SYSTEM_ADMIN" && !a.perms.canManageNotifications && !a.perms.canManageSystemConfig) {
      delete out.notification_channel_config;
      delete out.admin_system_settings;
    }
    return out;
  };
  const actorOr401 = async (req: any, res: any): Promise<Actor | null> => {
    const actor = await loadActor(req);
    if (!actor) res.status(401).json({ success: false, error: "حساب کاربری یافت نشد یا غیرفعال است." });
    return actor;
  };

  // Permission groups for write endpoints (SYSTEM_ADMIN always passes).
  const canWriteOffices = requirePerm("canManageOffices", "canManageUsers");
  const canWriteCampaigns = requirePerm("canRunSampling", "canManageOffices", "canReviewAndVerdict", "canUploadOfficeDocuments");
  const canDeleteCampaigns = requirePerm("canRunSampling", "canManageOffices");
  const canWriteEvents = requirePerm("canRunSampling", "canManageOffices", "canReviewAndVerdict", "canIssueFinalVerdict", "canSuperviseWarnings", "canUploadOfficeDocuments");

  // Real-time Server-Sent Events (SSE) Hub for Instant Multi-Device Sync
  const sseClients = new Set<express.Response>();
  function broadcastRealtimeEvent(type: string, payload?: any) {
    const data = JSON.stringify({ type, payload, timestamp: new Date().toISOString() });
    for (const client of sseClients) {
      try {
        client.write(`event: db_update\ndata: ${data}\n\n`);
      } catch {
        sseClients.delete(client);
      }
    }
  }

  // Real-time Event Stream (GET /api/v1/realtime/stream)
  app.get("/api/v1/realtime/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    res.write(`event: connected\ndata: ${JSON.stringify({ status: "connected", timestamp: new Date().toISOString() })}\n\n`);
    sseClients.add(res);

    const pingInterval = setInterval(() => {
      try {
        res.write(`event: ping\ndata: ${Date.now()}\n\n`);
      } catch {
        clearInterval(pingInterval);
        sseClients.delete(res);
      }
    }, 25000);

    req.on("close", () => {
      clearInterval(pingInterval);
      sseClients.delete(res);
    });
  });

  // Client-triggered Realtime Broadcast
  app.post("/api/v1/realtime/broadcast", (req, res) => {
    const { type, payload } = req.body;
    if (type) {
      broadcastRealtimeEvent(type, payload);
    }
    return res.json({ success: true, clientCount: sseClients.size });
  });

  // 0. دریافت تمامی اطلاعات سیستم در بدو ورود (Bootstrap)
  app.get("/api/v1/system/bootstrap", async (req, res) => {
    try {
      const data = serverDb.getBootstrapData();
      if (centralDb.isCentralSupabaseConfigured()) {
        const [users, offices, managers] = await Promise.all([
          centralDb.fetchUsers(),
          centralDb.fetchOffices(),
          centralDb.fetchManagers(),
        ]);
        if (users) data.users = users;
        if (offices) data.offices = offices;
        if (managers) data.managers = managers;
      }
      if (centralDb.isCentralSupabaseConfigured()) {
        const docsStore = await import("./server/db/documentStore.js");
        const [campaigns, auditEvents, notifications, officeTypes, accessLogs, settings] = await Promise.all([
          docsStore.listDocuments("campaigns"),
          docsStore.listDocuments("audit_events"),
          docsStore.listDocuments("notifications"),
          docsStore.listDocuments("office_types"),
          docsStore.listDocuments("access_logs", 100),
          docsStore.listSettings(),
        ]);
        data.campaigns = campaigns;
        data.auditEvents = auditEvents;
        data.notifications = notifications;
        data.officeTypes = officeTypes;
        data.accessLogs = accessLogs;
        data.settings = settings;
        data.fieldSettings = settings.field_settings ?? null;
      }
      // Manager personal data always comes from the users table.
      data.managers = resolveManagers(data.managers, data.users);
      data.offices = resolveOffices(data.offices, data.managers);
      const actor = await actorOr401(req, res);
      if (!actor) return;
      data.users = publicUsers(scopeUsers(actor, data.users as any[])) as any;
      data.offices = byOffice(actor, data.offices as any[], "code") as any;
      data.managers = byOffice(actor, data.managers as any[], "assignedOfficeCode") as any;
      data.campaigns = byOffice(actor, data.campaigns as any[], "officeCode") as any;
      data.auditEvents = byOffice(actor, data.auditEvents as any[], "officeCode") as any;
      data.notifications = byOffice(actor, data.notifications as any[], "officeCode", true) as any;
      data.accessLogs = scopeLogs(actor, data.accessLogs as any[]) as any;
      data.settings = scopeSettings(actor, (data as any).settings) as any;
      return res.json({ success: true, ...data });
    } catch (err: any) {
      console.error('[bootstrap]', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 1. احراز هویت ورود به سامانه در دیتابیس متمرکز سرور
  const loginFailures = new Map<string, { count: number; first: number }>();
  app.post("/api/v1/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body || {};
      // Brute-force throttle: 8 failed attempts per client+username in 10 minutes (best effort per instance).
      const throttleKey = `${String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim()}|${String(username || "").toLowerCase()}`;
      const hit = loginFailures.get(throttleKey);
      if (hit && Date.now() - hit.first > 10 * 60 * 1000) loginFailures.delete(throttleKey);
      const current = loginFailures.get(throttleKey);
      if (current && current.count >= 8) {
        return res.status(429).json({ success: false, error: "تعداد تلاش‌های ناموفق زیاد است. چند دقیقه بعد دوباره تلاش کنید." });
      }
      const result = centralDb.isCentralSupabaseConfigured()
        ? await centralDb.authenticate(username, password)
        : serverDb.authenticateUser(username, password);
      if (result.success && result.user) {
        broadcastRealtimeEvent("USER_LOGGED_IN", { userId: result.user.id, username: result.user.username });
        loginFailures.delete(throttleKey);
        const token = signToken(result.user);
        res.setHeader("Set-Cookie", `${COOKIE_NAME}=${encodeURIComponent(token)}; ${cookieFlags(req)}; Max-Age=${TOKEN_TTL_SECONDS}`);
        return res.json({ ...result, user: publicUser(result.user), token });
      }
      const prev = loginFailures.get(throttleKey);
      loginFailures.set(throttleKey, { count: (prev?.count || 0) + 1, first: prev?.first || Date.now() });
      return res.status(401).json(result);
    } catch (err: any) {
      console.error('[login]', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/v1/auth/logout", (req, res) => {
    res.setHeader("Set-Cookie", `${COOKIE_NAME}=; ${cookieFlags(req)}; Max-Age=0`);
    return res.json({ success: true });
  });

  // 2. لیست کاربران سامانه از دیتابیس سرور
  app.get("/api/v1/users", async (req, res) => {
    try {
      const users = centralDb.isCentralSupabaseConfigured() ? await centralDb.fetchUsers() : serverDb.getUsers();
      const actor = await actorOr401(req, res); if (!actor) return;
      return res.json({ success: true, users: publicUsers(scopeUsers(actor, users)) });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 3. همگام‌سازی یا ثبت گروهی کاربران در سرور (با محافظت کامل از کلمات عبور ثبت‌شده)
  app.post("/api/v1/users/sync", requirePerm("canManageUsers", "canManageOffices"), async (req: any, res) => {
    try {
      const { users } = req.body || {};
      if (!Array.isArray(users)) return res.status(400).json({ success: false, error: "users array required" });
      const denied = await roleEscalation(req.actor, users);
      if (denied) return res.status(403).json({ success: false, error: denied });
      const synced = centralDb.isCentralSupabaseConfigured()
        ? await centralDb.syncUsers(users)
        : serverDb.syncUsers(users);
      broadcastRealtimeEvent("USERS_CHANGED", { count: synced.length });
      return res.json({ success: true, count: synced.length, users: publicUsers(synced) });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. تغییر رمز عبور کاربر در دیتابیس مرکزی
  app.post("/api/v1/users/change-password", async (req: any, res) => {
    try {
      const { userId, username, currentPassword, newPassword } = req.body || {};
      const actor = await loadActor(req);
      if (!actor) return res.status(401).json({ success: false, error: "حساب کاربری یافت نشد یا غیرفعال است." });
      const targetsSelf = (userId && String(userId) === String(actor.user.id))
        || (!userId && username && String(username).toLowerCase() === String(actor.user.username || "").toLowerCase());
      const mayManage = actor.user.role === "SYSTEM_ADMIN" || actor.perms.canManageUsers;
      if (!targetsSelf && !mayManage) {
        return res.status(403).json({ success: false, error: "شما فقط می‌توانید رمز عبور حساب خودتان را تغییر دهید." });
      }
      // Changing your own password needs the current one (except the forced first-login change and admin resets).
      if (targetsSelf && !mayManage && actor.user.isPasswordChanged !== false && !currentPassword) {
        return res.status(400).json({ success: false, error: "رمز عبور فعلی را وارد کنید." });
      }
      const result = centralDb.isCentralSupabaseConfigured()
        ? await centralDb.changePassword({ userId, username, currentPassword, newPassword })
        : serverDb.updateUserPassword({ userId, username, currentPassword, newPassword });
      if (result.success && result.user) {
        broadcastRealtimeEvent("USER_PASSWORD_CHANGED", { userId: result.user.id, username: result.user.username });
      }
      return res.json(result.user ? { ...result, user: publicUser(result.user) } : result);
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 5. ایجاد یا ویرایش یک کاربر در سرور
  app.post("/api/v1/users", async (req: any, res) => {
    try {
      const user = req.body;
      if (!user || !user.id || !user.username) return res.status(400).json({ success: false, error: "id and username are required" });
      const actor = await loadActor(req);
      if (!actor) return res.status(401).json({ success: false, error: "حساب کاربری یافت نشد یا غیرفعال است." });
      const isSelf = String(user.id) === String(actor.user.id);
      if (!isSelf && actor.user.role !== "SYSTEM_ADMIN" && !actor.perms.canManageUsers && !actor.perms.canManageOffices) {
        return res.status(403).json({ success: false, error: "شما مجوز ویرایش کاربران را ندارید." });
      }
      if (isSelf && !actor.perms.canManageUsers && actor.user.role !== "SYSTEM_ADMIN") {
        // Self-service profile edit: identity, role and status can never be changed by the user.
        Object.assign(user, { role: actor.user.role, isActive: actor.user.isActive, assignedOfficeCode: actor.user.assignedOfficeCode, assignedOfficeName: actor.user.assignedOfficeName, customPermissions: actor.user.customPermissions, username: actor.user.username, nationalId: actor.user.nationalId });
      }
      const denied = await roleEscalation(actor, [user]);
      if (denied) return res.status(403).json({ success: false, error: denied });
      const saved = centralDb.isCentralSupabaseConfigured() ? await centralDb.saveUser(user) : serverDb.saveUser(user);
      broadcastRealtimeEvent("USER_UPDATED", { userId: saved.id, username: saved.username });
      return res.json({ success: true, user: publicUser(saved) });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 6. حذف کاربر از سرور
  app.delete("/api/v1/users/:id", requirePerm("canManageUsers"), async (req: any, res) => {
    if (String(req.params.id) === String(req.actor.user.id)) return res.status(400).json({ success: false, error: "حذف حساب کاربری خودتان مجاز نیست." });
    try {
      const deleted = centralDb.isCentralSupabaseConfigured() ? await centralDb.deleteUser(req.params.id) : serverDb.deleteUser(req.params.id);
      broadcastRealtimeEvent("USERS_CHANGED", { deletedUserId: req.params.id });
      return res.json({ success: deleted });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 7. لیست دفاتر از دیتابیس سرور
  app.get("/api/v1/offices", async (req, res) => {
    try {
      const offices = centralDb.isCentralSupabaseConfigured() ? await centralDb.fetchOffices() : serverDb.getOffices();
      const actor = await actorOr401(req, res); if (!actor) return;
      return res.json({ success: true, offices: byOffice(actor, offices, "code") });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 8. ذخیره یک دفتر در سرور
  app.post("/api/v1/offices", canWriteOffices, async (req, res) => {
    try {
      const office = req.body;
      if (!office || !office.code) return res.status(400).json({ success: false, error: "code is required" });
      const saved = centralDb.isCentralSupabaseConfigured() ? await centralDb.saveOffice(office) : serverDb.saveOffice(office);
      broadcastRealtimeEvent("OFFICES_CHANGED", { office: saved });
      return res.json({ success: true, office: saved });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 9. ذخیره گروهی دفاتر در سرور
  app.post("/api/v1/offices/sync", canWriteOffices, async (req, res) => {
    try {
      const { offices } = req.body || {};
      if (!Array.isArray(offices)) return res.status(400).json({ success: false, error: "offices array required" });
      const deletedIds: string[] = Array.isArray(req.body?.deletedIds) ? req.body.deletedIds.map(String) : [];
      if (centralDb.isCentralSupabaseConfigured()) {
        await centralDb.saveOffices(offices);
        for (const code of deletedIds) await centralDb.deleteOffice(code);
      } else {
        serverDb.saveOffices(offices);
        deletedIds.forEach((code) => serverDb.deleteOffice(code));
      }
      broadcastRealtimeEvent("OFFICES_CHANGED", { count: offices.length });
      return res.json({ success: true, count: offices.length });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 10. حذف دفتر از سرور
  app.delete("/api/v1/offices/:code", canWriteOffices, async (req, res) => {
    try {
      const deleted = centralDb.isCentralSupabaseConfigured() ? await centralDb.deleteOffice(req.params.code) : serverDb.deleteOffice(req.params.code);
      broadcastRealtimeEvent("OFFICES_CHANGED", { deletedCode: req.params.code });
      return res.json({ success: deleted });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 11. مسئولین دفاتر (Managers)
  const loadUsersForManagers = async () =>
    centralDb.isCentralSupabaseConfigured() ? ((await centralDb.fetchUsers()) || []) : serverDb.getUsers();

  app.get("/api/v1/managers", async (req, res) => {
    try {
      const users = await loadUsersForManagers();
      const raw = centralDb.isCentralSupabaseConfigured() ? ((await centralDb.fetchManagers()) || []) : serverDb.getManagers();
      const actor = await actorOr401(req, res); if (!actor) return;
      return res.json({ success: true, managers: byOffice(actor, resolveManagers(raw, users), "assignedOfficeCode") });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/v1/managers", canWriteOffices, async (req, res) => {
    try {
      const users = await loadUsersForManagers();
      const incoming = stripManagerPersonalFields(req.body, users);
      const saved = centralDb.isCentralSupabaseConfigured()
        ? await centralDb.saveManager(incoming)
        : serverDb.saveManager(incoming);
      broadcastRealtimeEvent("OFFICES_CHANGED", { manager: saved });
      return res.json({ success: true, manager: resolveManager(saved, users) });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/v1/managers/sync", canWriteOffices, async (req, res) => {
    try {
      const { managers } = req.body;
      if (Array.isArray(managers)) {
        const users = await loadUsersForManagers();
        const stripped = stripManagersPersonalFields(managers, users);
        const deletedIds: string[] = Array.isArray(req.body?.deletedIds) ? req.body.deletedIds.map(String) : [];
        if (centralDb.isCentralSupabaseConfigured()) {
          await centralDb.saveManagers(stripped);
          await centralDb.deleteManagers(deletedIds);
        } else {
          serverDb.saveManagers(stripped);
          serverDb.deleteManagers(deletedIds);
        }
        broadcastRealtimeEvent("OFFICES_CHANGED", { managersCount: managers.length });
        return res.json({ success: true, count: managers.length });
      }
      return res.status(400).json({ success: false, error: "managers array required" });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // Data routes. When the central Supabase is configured EVERYTHING is stored there
  // (app_documents); the local JSON vault is only used for local development.
  // ---------------------------------------------------------------------------
  const docs = await import("./server/db/documentStore.js");
  const central = () => centralDb.isCentralSupabaseConfigured();
  const fail = (res: any, err: any) => res.status(Number(err?.status) || 500).json({ success: false, error: err?.message || String(err) });

  // 12. کمپین‌ها و پرونده‌های بازرسی (Campaigns & Records)
  app.get("/api/v1/campaigns", async (req, res) => {
    try {
      const campaigns = central() ? await docs.listDocuments("campaigns") : serverDb.getCampaigns();
      const actor = await actorOr401(req, res); if (!actor) return;
      return res.json({ success: true, campaigns: byOffice(actor, campaigns, "officeCode") });
    } catch (err) { return fail(res, err); }
  });

  app.post("/api/v1/campaigns", canWriteCampaigns, async (req: any, res) => {
    try {
      if (!seesAll(req.actor) && String(req.body?.officeCode || "").trim() !== officeOf(req.actor)) {
        return res.status(403).json({ success: false, error: "این پرونده متعلق به دفتر شما نیست." });
      }
      const saved = central() ? await docs.upsertDocument("campaigns", req.body) : serverDb.saveCampaign(req.body);
      broadcastRealtimeEvent("CAMPAIGNS_CHANGED", { campaign: saved });
      return res.json({ success: true, campaign: saved });
    } catch (err) { return fail(res, err); }
  });

  app.post("/api/v1/campaigns/sync", canWriteCampaigns, async (req, res) => {
    try {
      const actor = (req as any).actor as Actor;
      const all = seesAll(actor);
      if (!Array.isArray(req.body?.campaigns)) return res.status(400).json({ success: false, error: "campaigns array required" });
      // An office user can only write campaigns of their own office and can never delete anything through sync.
      const campaigns: any[] = byOffice(actor, req.body.campaigns, "officeCode");
      // Upsert + explicit deletions only (ids this browser removed): a stale browser can never erase other users' data.
      const deletedIds: string[] = all && Array.isArray(req.body?.deletedIds) ? req.body.deletedIds.map(String) : [];
      const deletedRecordIds: string[] = all && Array.isArray(req.body?.deletedRecordIds) ? req.body.deletedRecordIds.map(String) : [];
      // Records of an existing campaign are merged by id with what the database already holds:
      // a stale browser can neither drop records added by others nor overwrite their contents
      // (record edits travel through /campaigns/record). Records leave a campaign only via deletedRecordIds.
      const mergeCampaigns = (existing: any[]) => {
        const byId = new Map(existing.map((c) => [String(c.id), c]));
        const gone = new Set(deletedRecordIds);
        return campaigns.map((c: any) => {
          const incoming = (c.records || []).filter((r: any) => !gone.has(String(r.id)));
          const current = byId.get(String(c.id));
          if (!current) return { ...c, records: incoming };
          const kept = (current.records || []).filter((r: any) => !gone.has(String(r.id)));
          const have = new Set(kept.map((r: any) => String(r.id)));
          return { ...c, records: [...kept, ...incoming.filter((r: any) => !have.has(String(r.id)))] };
        });
      };
      if (central()) {
        await docs.upsertChangedDocuments("campaigns", mergeCampaigns(await docs.listDocuments("campaigns")));
        for (const id of deletedIds) await docs.deleteDocument("campaigns", id);
      } else {
        const merged = mergeCampaigns(serverDb.getCampaigns());
        const untouched = serverDb.getCampaigns().filter((c: any) => !merged.some((m: any) => String(m.id) === String(c.id)) && !deletedIds.includes(String(c.id)));
        serverDb.saveAllCampaigns([...merged, ...untouched]);
        deletedIds.forEach((id) => serverDb.deleteCampaign(id));
      }
      broadcastRealtimeEvent("CAMPAIGNS_CHANGED", { count: campaigns.length });
      return res.json({ success: true, count: campaigns.length });
    } catch (err) { return fail(res, err); }
  });

  app.post("/api/v1/campaigns/record", canWriteCampaigns, async (req, res) => {
    try {
      const { campaignId, record } = req.body;
      if (!campaignId || !record) {
        return res.status(400).json({ success: false, error: "campaignId and record are required" });
      }
      let ok: boolean;
      if (central()) {
        // Atomic per-record merge: concurrent updates to other records of the same campaign are never lost.
        const saved = await docs.updateDocumentAtomic<any>("campaigns", String(campaignId), (campaign) => {
          if (!seesAll((req as any).actor) && String(campaign.officeCode || "").trim() !== officeOf((req as any).actor)) {
            throw Object.assign(new Error("این پرونده متعلق به دفتر شما نیست."), { status: 403 });
          }
          const records: any[] = Array.isArray(campaign.records) ? [...campaign.records] : [];
          const idx = records.findIndex((r) => r.id === record.id);
          if (idx >= 0) records[idx] = { ...records[idx], ...record }; else records.push(record);
          return { ...campaign, records };
        });
        ok = saved !== null;
      } else {
        const owner: any = serverDb.getCampaigns().find((c: any) => String(c.id) === String(campaignId));
        if (owner && !seesAll((req as any).actor) && String(owner.officeCode || "").trim() !== officeOf((req as any).actor)) {
          return res.status(403).json({ success: false, error: "این پرونده متعلق به دفتر شما نیست." });
        }
        ok = serverDb.saveCampaignRecord(campaignId, record);
      }
      broadcastRealtimeEvent("INSPECTION_RECORD_UPDATED", { campaignId, recordId: record.id });
      return res.json({ success: ok });
    } catch (err) { return fail(res, err); }
  });

  app.delete("/api/v1/campaigns/:id", canDeleteCampaigns, async (req, res) => {
    try {
      const deleted = central() ? await docs.deleteDocument("campaigns", req.params.id) : serverDb.deleteCampaign(req.params.id);
      broadcastRealtimeEvent("CAMPAIGNS_CHANGED", { deletedId: req.params.id });
      return res.json({ success: deleted });
    } catch (err) { return fail(res, err); }
  });

  // 13. وقایع و احکام نظارتی (Audit Events)
  app.get("/api/v1/audit-events", async (req, res) => {
    try {
      const auditEvents = central() ? await docs.listDocuments("audit_events") : serverDb.getAuditEvents();
      const actor = await actorOr401(req, res); if (!actor) return;
      return res.json({ success: true, auditEvents: byOffice(actor, auditEvents, "officeCode") });
    } catch (err) { return fail(res, err); }
  });

  app.post("/api/v1/audit-events", canWriteEvents, async (req: any, res) => {
    try {
      if (!seesAll(req.actor) && String(req.body?.officeCode || "").trim() !== officeOf(req.actor)) {
        return res.status(403).json({ success: false, error: "این رویداد متعلق به دفتر شما نیست." });
      }
      const saved = central() ? await docs.upsertDocument("audit_events", req.body) : serverDb.saveAuditEvent(req.body);
      broadcastRealtimeEvent("AUDIT_EVENT_ADDED", { event: saved });
      return res.json({ success: true, event: saved });
    } catch (err) { return fail(res, err); }
  });

  app.post("/api/v1/audit-events/sync", canWriteEvents, async (req, res) => {
    try {
      const actor = (req as any).actor as Actor;
      if (!Array.isArray(req.body?.auditEvents)) return res.status(400).json({ success: false, error: "auditEvents array required" });
      const auditEvents: any[] = byOffice(actor, req.body.auditEvents, "officeCode");
      const deletedIds: string[] = seesAll(actor) && Array.isArray(req.body?.deletedIds) ? req.body.deletedIds.map(String) : [];
      if (central()) {
        await docs.upsertChangedDocuments("audit_events", auditEvents);
        for (const id of deletedIds) await docs.deleteDocument("audit_events", id);
      } else {
        const inIds = new Set(auditEvents.map((e: any) => String(e.id)));
        const rest = serverDb.getAuditEvents().filter((e: any) => !inIds.has(String(e.id)) && !deletedIds.includes(String(e.id)));
        serverDb.saveAllAuditEvents([...auditEvents, ...rest]);
      }
      broadcastRealtimeEvent("AUDIT_EVENT_ADDED", { count: auditEvents.length });
      return res.json({ success: true, count: auditEvents.length });
    } catch (err) { return fail(res, err); }
  });

  // 14. اعلانات سیستم (Notifications)
  app.get("/api/v1/notifications", async (req, res) => {
    try {
      const notifications = central() ? await docs.listDocuments("notifications") : serverDb.getNotifications();
      const actor = await actorOr401(req, res); if (!actor) return;
      return res.json({ success: true, notifications: byOffice(actor, notifications, "officeCode", true) });
    } catch (err) { return fail(res, err); }
  });

  app.post("/api/v1/notifications/sync", async (req, res) => {
    try {
      const actor = await actorOr401(req, res); if (!actor) return;
      if (!Array.isArray(req.body?.notifications)) return res.status(400).json({ success: false, error: "notifications array required" });
      const notifications: any[] = byOffice(actor, req.body.notifications, "officeCode", true);
      let deletedIds: string[] = Array.isArray(req.body?.deletedIds) ? req.body.deletedIds.map(String) : [];
      if (!seesAll(actor)) {
        // Only notifications of the user's own office may be removed.
        const own = new Set(byOffice(actor, central() ? await docs.listDocuments("notifications") : serverDb.getNotifications(), "officeCode").map((n: any) => String(n.id)));
        deletedIds = deletedIds.filter((id) => own.has(id));
      }
      if (central()) {
        await docs.upsertChangedDocuments("notifications", notifications);
        for (const id of deletedIds) await docs.deleteDocument("notifications", id);
      } else {
        const inIds = new Set(notifications.map((n: any) => String(n.id)));
        const rest = serverDb.getNotifications().filter((n: any) => !inIds.has(String(n.id)) && !deletedIds.includes(String(n.id)));
        serverDb.saveAllNotifications([...notifications, ...rest]);
      }
      return res.json({ success: true, count: notifications.length });
    } catch (err) { return fail(res, err); }
  });

  // 15. تنظیمات فیلدها و انواع دفاتر
  app.get("/api/v1/field-settings", async (req, res) => {
    try {
      const fieldSettings = central() ? await docs.getSetting("field_settings") : serverDb.getFieldSettings();
      return res.json({ success: true, fieldSettings });
    } catch (err) { return fail(res, err); }
  });

  app.post("/api/v1/field-settings/sync", requirePerm("canManageSystemConfig", "canManageOffices"), async (req, res) => {
    try {
      const { fieldSettings } = req.body;
      if (central()) await docs.saveSetting("field_settings", fieldSettings);
      else serverDb.saveFieldSettings(fieldSettings);
      return res.json({ success: true });
    } catch (err) { return fail(res, err); }
  });

  app.get("/api/v1/office-types", async (req, res) => {
    try {
      const officeTypes = central() ? await docs.listDocuments("office_types") : serverDb.getOfficeTypes();
      return res.json({ success: true, officeTypes });
    } catch (err) { return fail(res, err); }
  });

  app.post("/api/v1/office-types/sync", requirePerm("canManageSystemConfig", "canManageOffices"), async (req, res) => {
    try {
      const { officeTypes } = req.body;
      if (!Array.isArray(officeTypes)) return res.status(400).json({ success: false, error: "officeTypes array required" });
      if (central()) {
        await docs.upsertChangedDocuments("office_types", officeTypes);
        const deletedIds: string[] = Array.isArray(req.body?.deletedIds) ? req.body.deletedIds.map(String) : [];
        for (const id of deletedIds) await docs.deleteDocument("office_types", id);
      } else {
        serverDb.saveOfficeTypes(officeTypes);
      }
      return res.json({ success: true, count: officeTypes.length });
    } catch (err) { return fail(res, err); }
  });

  // 16. لاگ‌های امنیتی ورود و خروج
  app.get("/api/v1/access-logs", async (req, res) => {
    try {
      const logs = central() ? await docs.listDocuments("access_logs", 1000) : serverDb.getAccessLogs();
      const actor = await actorOr401(req, res); if (!actor) return;
      return res.json({ success: true, accessLogs: scopeLogs(actor, logs) });
    } catch (err) { return fail(res, err); }
  });

  app.post("/api/v1/access-logs", async (req, res) => {
    try {
      if (central()) {
        const log = { ...req.body, id: req.body?.id || `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
        await docs.upsertDocument("access_logs", log);
        await docs.trimCollection("access_logs", 1000);
      } else {
        serverDb.saveAccessLog(req.body);
      }
      return res.json({ success: true });
    } catch (err) { return fail(res, err); }
  });

  app.post("/api/v1/access-logs/replace", requirePerm("canManageSystemConfig", "canManageUsers"), async (req, res) => {
    try {
      const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
      if (central()) await docs.pruneDocuments("access_logs", ids);
      else serverDb.keepAccessLogs(ids);
      return res.json({ success: true });
    } catch (err) { return fail(res, err); }
  });

  app.delete("/api/v1/access-logs", requirePerm("canManageSystemConfig", "canManageUsers"), async (req, res) => {
    try {
      if (central()) await docs.pruneDocuments("access_logs", []);
      else serverDb.clearAccessLogs();
      return res.json({ success: true });
    } catch (err) { return fail(res, err); }
  });

  // 17. تنظیمات عمومی (تنظیمات مدیر، قالب اعلان‌ها، کانفیگ کانال‌ها)
  const ALLOWED_SETTING_KEYS = new Set(["admin_system_settings", "notification_templates", "notification_channel_config", "field_settings"]);

  app.get("/api/v1/settings", async (req, res) => {
    try {
      const settings = central() ? await docs.listSettings() : serverDb.getSettings();
      const actor = await actorOr401(req, res); if (!actor) return;
      return res.json({ success: true, settings: scopeSettings(actor, settings) });
    } catch (err) { return fail(res, err); }
  });

  app.put("/api/v1/settings/:key", requirePerm("canManageSystemConfig", "canManageNotifications", "canManageOffices"), async (req, res) => {
    try {
      const key = req.params.key;
      if (!ALLOWED_SETTING_KEYS.has(key)) return res.status(400).json({ success: false, error: "unknown setting key" });
      const value = req.body?.value;
      if (central()) await docs.saveSetting(key, value);
      else serverDb.saveSetting(key, value);
      broadcastRealtimeEvent("SYSTEM_STATE_REFRESH", { setting: key });
      return res.json({ success: true });
    } catch (err) { return fail(res, err); }
  });

  // =========================================================================
  // Backward Compatibility: /api/drive/* (Routing to Storage Layer)
  // =========================================================================
  app.get("/api/drive/status", (req, res) => {
    const activeProvider = storageService.getActiveProviderType();
    const isConfig = storageService.getProvider(activeProvider).isConfigured();
    res.json({
      configured: isConfig,
      storageType: activeProvider === "google_drive" ? "GOOGLE_DRIVE_CENTRAL" : "SERVER_STORAGE",
      rootFolderName: process.env.GOOGLE_DRIVE_ROOT_FOLDER_NAME || "RA_Audit_Central",
      message: isConfig
        ? `اتصال امن به ${activeProvider} فعال است.`
        : "در انتظار پیکربندی استوریج در سرور.",
    });
  });

  app.post("/api/drive/upload", async (req, res) => {
    // بازخوانی از طریق اندپوینت جدید v1 به صورت یکپارچه
    try {
      const {
        documentId,
        fileName,
        fileType,
        fileDataUrl,
        officeCode,
        applicantId,
        docType,
      } = req.body;

      if (!fileName || !fileDataUrl) {
        return res.status(400).json({ success: false, error: "اطلاعات فایل ناقص است." });
      }

      const base64Data = fileDataUrl.includes(",") ? fileDataUrl.split(",")[1] : fileDataUrl;
      const fileBuffer = Buffer.from(base64Data, "base64");

      const uploadResult = await storageService.upload({
        fileBuffer,
        originalFileName: fileName,
        mimeType: fileType || "application/octet-stream",
        fileSize: fileBuffer.length,
        officeId: officeCode,
        applicantId,
        documentType: docType || "DOCUMENTS",
        documentId,
      });

      return res.json({
        success: true,
        driveSynced: uploadResult.syncStatus === "uploaded",
        driveFileId: uploadResult.driveFileId || uploadResult.fileId,
        fileId: uploadResult.fileId,
        storageKey: uploadResult.storageKey,
        storageProvider: uploadResult.storageProvider,
        fileName: uploadResult.originalFileName,
        mimeType: uploadResult.mimeType,
        fileSize: uploadResult.fileSize,
        driveWebViewLink: uploadResult.viewUrl,
        isDuplicate: uploadResult.isDuplicate || false,
        storageType: uploadResult.storageProvider.toUpperCase(),
        syncStatus: uploadResult.syncStatus === "uploaded" ? "SUCCESS" : "PENDING",
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, syncStatus: "FAILED", error: err.message });
    }
  });

  app.get("/api/drive/file/:driveFileId", async (req, res) => {
    try {
      const { driveFileId } = req.params;
      const fileData = await storageService.download(driveFileId);
      res.setHeader("Content-Type", fileData.mimeType);
      res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(fileData.fileName)}"`);
      return res.send(fileData.buffer);
    } catch (err: any) {
      return res.status(404).json({ success: false, error: err.message });
    }
  });

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  return app;
}

// Local development / traditional Node server entrypoint.
if (!process.env.VERCEL) {
  createApp().then((app) => {
    app.listen(3000, "0.0.0.0", () => {
      console.log("RA Inspection Server running on http://0.0.0.0:3000");
    });
  }).catch((err) => {
    console.error("Failed to start server:", err);
  });
}
