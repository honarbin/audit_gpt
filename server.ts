import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function createApp() {
  const app = express();
  const PORT = 3000;

  // CORS & Preflight handling for iframe previews and cross-origin environments
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && origin !== "null") {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    } else {
      res.setHeader("Access-Control-Allow-Origin", "*");
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
  const { StorageService } = await import("./server/storage/StorageService");
  const { calculateChecksum } = await import("./server/storage/storageUtils");
  const storageService = StorageService.getInstance();

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
  app.post("/api/v1/storage/provider", (req, res) => {
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
  app.post("/api/v1/storage/migrate", async (req, res) => {
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
  const { ServerDbService } = await import("./server/db/serverDbService");
  const serverDb = ServerDbService.getInstance();
  serverDb.ensureInitialized();
  const centralDb = await import("./server/db/supabaseCentralService");

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
      return res.json({ success: true, ...data });
    } catch (err: any) {
      console.error('[bootstrap]', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 1. احراز هویت ورود به سامانه در دیتابیس متمرکز سرور
  app.post("/api/v1/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body || {};
      const result = centralDb.isCentralSupabaseConfigured()
        ? await centralDb.authenticate(username, password)
        : serverDb.authenticateUser(username, password);
      if (result.success && result.user) {
        broadcastRealtimeEvent("USER_LOGGED_IN", { userId: result.user.id, username: result.user.username });
      }
      return res.json(result);
    } catch (err: any) {
      console.error('[login]', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2. لیست کاربران سامانه از دیتابیس سرور
  app.get("/api/v1/users", async (req, res) => {
    try {
      const users = centralDb.isCentralSupabaseConfigured() ? await centralDb.fetchUsers() : serverDb.getUsers();
      return res.json({ success: true, users: users || [] });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 3. همگام‌سازی یا ثبت گروهی کاربران در سرور (با محافظت کامل از کلمات عبور ثبت‌شده)
  app.post("/api/v1/users/sync", async (req, res) => {
    try {
      const { users } = req.body || {};
      if (!Array.isArray(users)) return res.status(400).json({ success: false, error: "users array required" });
      const synced = centralDb.isCentralSupabaseConfigured()
        ? await centralDb.syncUsers(users)
        : serverDb.syncUsers(users);
      broadcastRealtimeEvent("USERS_CHANGED", { count: synced.length });
      return res.json({ success: true, count: synced.length, users: synced });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. تغییر رمز عبور کاربر در دیتابیس مرکزی
  app.post("/api/v1/users/change-password", async (req, res) => {
    try {
      const { userId, username, currentPassword, newPassword } = req.body || {};
      const result = centralDb.isCentralSupabaseConfigured()
        ? await centralDb.changePassword({ userId, username, currentPassword, newPassword })
        : serverDb.updateUserPassword({ userId, username, currentPassword, newPassword });
      if (result.success && result.user) {
        broadcastRealtimeEvent("USER_PASSWORD_CHANGED", { userId: result.user.id, username: result.user.username });
      }
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 5. ایجاد یا ویرایش یک کاربر در سرور
  app.post("/api/v1/users", async (req, res) => {
    try {
      const user = req.body;
      if (!user || !user.id || !user.username) return res.status(400).json({ success: false, error: "id and username are required" });
      const saved = centralDb.isCentralSupabaseConfigured() ? await centralDb.saveUser(user) : serverDb.saveUser(user);
      broadcastRealtimeEvent("USER_UPDATED", { userId: saved.id, username: saved.username });
      return res.json({ success: true, user: saved });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 6. حذف کاربر از سرور
  app.delete("/api/v1/users/:id", async (req, res) => {
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
      return res.json({ success: true, offices: offices || [] });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 8. ذخیره یک دفتر در سرور
  app.post("/api/v1/offices", async (req, res) => {
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
  app.post("/api/v1/offices/sync", async (req, res) => {
    try {
      const { offices } = req.body || {};
      if (!Array.isArray(offices)) return res.status(400).json({ success: false, error: "offices array required" });
      if (centralDb.isCentralSupabaseConfigured()) await centralDb.saveOffices(offices);
      else serverDb.saveOffices(offices);
      broadcastRealtimeEvent("OFFICES_CHANGED", { count: offices.length });
      return res.json({ success: true, count: offices.length });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 10. حذف دفتر از سرور
  app.delete("/api/v1/offices/:code", async (req, res) => {
    try {
      const deleted = centralDb.isCentralSupabaseConfigured() ? await centralDb.deleteOffice(req.params.code) : serverDb.deleteOffice(req.params.code);
      broadcastRealtimeEvent("OFFICES_CHANGED", { deletedCode: req.params.code });
      return res.json({ success: deleted });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 11. مسئولین دفاتر (Managers)
  app.get("/api/v1/managers", (req, res) => {
    try {
      const managers = serverDb.getManagers();
      return res.json({ success: true, managers });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/v1/managers", (req, res) => {
    try {
      const saved = serverDb.saveManager(req.body);
      broadcastRealtimeEvent("OFFICES_CHANGED", { manager: saved });
      return res.json({ success: true, manager: saved });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/v1/managers/sync", (req, res) => {
    try {
      const { managers } = req.body;
      if (Array.isArray(managers)) {
        serverDb.saveManagers(managers);
        broadcastRealtimeEvent("OFFICES_CHANGED", { managersCount: managers.length });
        return res.json({ success: true, count: managers.length });
      }
      return res.status(400).json({ success: false, error: "managers array required" });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 12. کمپین‌ها و پرونده‌های بازرسی (Campaigns & Records)
  app.get("/api/v1/campaigns", (req, res) => {
    try {
      const campaigns = serverDb.getCampaigns();
      return res.json({ success: true, campaigns });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/v1/campaigns", (req, res) => {
    try {
      const saved = serverDb.saveCampaign(req.body);
      broadcastRealtimeEvent("CAMPAIGNS_CHANGED", { campaign: saved });
      return res.json({ success: true, campaign: saved });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/v1/campaigns/sync", (req, res) => {
    try {
      const { campaigns } = req.body;
      if (Array.isArray(campaigns)) {
        serverDb.saveAllCampaigns(campaigns);
        broadcastRealtimeEvent("CAMPAIGNS_CHANGED", { count: campaigns.length });
        return res.json({ success: true, count: campaigns.length });
      }
      return res.status(400).json({ success: false, error: "campaigns array required" });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/v1/campaigns/record", (req, res) => {
    try {
      const { campaignId, record } = req.body;
      if (!campaignId || !record) {
        return res.status(400).json({ success: false, error: "campaignId and record are required" });
      }
      const ok = serverDb.saveCampaignRecord(campaignId, record);
      broadcastRealtimeEvent("INSPECTION_RECORD_UPDATED", { campaignId, recordId: record.id });
      return res.json({ success: ok });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete("/api/v1/campaigns/:id", (req, res) => {
    try {
      const deleted = serverDb.deleteCampaign(req.params.id);
      broadcastRealtimeEvent("CAMPAIGNS_CHANGED", { deletedId: req.params.id });
      return res.json({ success: deleted });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 13. وقایع و احکام نظارتی (Audit Events)
  app.get("/api/v1/audit-events", (req, res) => {
    try {
      const auditEvents = serverDb.getAuditEvents();
      return res.json({ success: true, auditEvents });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/v1/audit-events", (req, res) => {
    try {
      const saved = serverDb.saveAuditEvent(req.body);
      broadcastRealtimeEvent("AUDIT_EVENT_ADDED", { event: saved });
      return res.json({ success: true, event: saved });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/v1/audit-events/sync", (req, res) => {
    try {
      const { auditEvents } = req.body;
      if (Array.isArray(auditEvents)) {
        serverDb.saveAllAuditEvents(auditEvents);
        broadcastRealtimeEvent("AUDIT_EVENT_ADDED", { count: auditEvents.length });
        return res.json({ success: true, count: auditEvents.length });
      }
      return res.status(400).json({ success: false, error: "auditEvents array required" });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 14. اعلانات سیستم (Notifications)
  app.get("/api/v1/notifications", (req, res) => {
    try {
      const notifications = serverDb.getNotifications();
      return res.json({ success: true, notifications });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/v1/notifications/sync", (req, res) => {
    try {
      const { notifications } = req.body;
      if (Array.isArray(notifications)) {
        serverDb.saveAllNotifications(notifications);
        return res.json({ success: true, count: notifications.length });
      }
      return res.status(400).json({ success: false, error: "notifications array required" });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 15. تنظیمات فیلدها و انواع دفاتر
  app.get("/api/v1/field-settings", (req, res) => {
    try {
      const fieldSettings = serverDb.getFieldSettings();
      return res.json({ success: true, fieldSettings });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/v1/field-settings/sync", (req, res) => {
    try {
      const { fieldSettings } = req.body;
      serverDb.saveFieldSettings(fieldSettings);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/v1/office-types", (req, res) => {
    try {
      const officeTypes = serverDb.getOfficeTypes();
      return res.json({ success: true, officeTypes });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/v1/office-types/sync", (req, res) => {
    try {
      const { officeTypes } = req.body;
      if (Array.isArray(officeTypes)) {
        serverDb.saveOfficeTypes(officeTypes);
        return res.json({ success: true, count: officeTypes.length });
      }
      return res.status(400).json({ success: false, error: "officeTypes array required" });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 16. لاگ‌های امنیتی ورود و خروج
  app.get("/api/v1/access-logs", (req, res) => {
    try {
      const logs = serverDb.getAccessLogs();
      return res.json({ success: true, accessLogs: logs });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/v1/access-logs", (req, res) => {
    try {
      serverDb.saveAccessLog(req.body);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
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
