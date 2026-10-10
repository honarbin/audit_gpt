import { NotificationMessageTemplate, NotificationCategory } from '../types/notifications';

export const DEFAULT_NOTIFICATION_TEMPLATES: NotificationMessageTemplate[] = [
  {
    id: 'tmpl-inspection-action',
    category: 'INSPECTION_ACTION',
    name: 'درخواست بارگذاری مدارک دوره بازرسی',
    description: 'ابلاغ آغاز دوره ممیزی و درخواست بارگذاری مستندات و فرم‌های متقاضیان منتخب در مهلت مقرر',
    smsEnabled: true,
    smsPatternCode: 'AUDIT_UPLOAD_REQ',
    smsTemplate: 'دفتر محترم {office_name} (کد {office_code})؛ دوره بازرسی «{campaign_title}» آغاز گردید. لطفاً حداکثر تا تاریخ {deadline} نسبت به بارگذاری مدارک {samples_count} متقاضی در کارتابل اقدام فرمایید.\nورود به کارتابل: {action_url}\nمرکز بازرسی دفاتر صدور گواهی',
    emailEnabled: true,
    emailSubject: 'ابلاغیه رسمی: درخواست بارگذاری مستندات دوره بازرسی {campaign_title} - دفتر {office_name}',
    emailBodyHtml: `<div style="direction: rtl; font-family: Tahoma, 'Segoe UI', Arial; color: #1e293b; line-height: 1.8; max-width: 640px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff;">
  <div style="background: linear-gradient(135deg, #065f46 0%, #0f172a 100%); padding: 24px; color: #ffffff;">
    <div style="font-size: 13px; opacity: 0.85; margin-bottom: 4px;">مرکز بازرسی و نظارت دفاتر ثبت نام مرکز میانی عام</div>
    <h2 style="margin: 0; font-size: 18px; font-weight: bold;">ابلاغیه رسمی آغاز دوره ممیزی و درخواست مدارک</h2>
  </div>
  <div style="padding: 24px;">
    <p><strong>مسئول محترم دفتر ثبت نام {office_name} (کد دفتر: {office_code})</strong></p>
    <p>با سلام و احترام؛</p>
    <p>بدین‌وسیله به اطلاع می‌رساند در چارچوب نظارت دوره‌ای بر عملکرد دفاتر صدور گواهی الکترونیکی، دوره بازرسی با عنوان <strong>«{campaign_title}»</strong> فعال شده و تعداد <strong>{samples_count} فقره گواهی</strong> صادر شده توسط آن دفتر در فرآیند نمونه‌گیری هوشمند قرار گرفته است.</p>
    
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr>
          <td style="padding: 6px; color: #64748b;">کد رهگیری بازرسی:</td>
          <td style="padding: 6px; font-weight: bold; color: #0f172a;">{tracking_code}</td>
        </tr>
        <tr>
          <td style="padding: 6px; color: #64748b;">مهلت مقرر بارگذاری:</td>
          <td style="padding: 6px; font-weight: bold; color: #b45309;">{deadline}</td>
        </tr>
        <tr>
          <td style="padding: 6px; color: #64748b;">تعداد پرونده‌های نمونه:</td>
          <td style="padding: 6px; font-weight: bold; color: #0f172a;">{samples_count} متقاضی</td>
        </tr>
      </table>
    </div>

    <p>مقتضی است با مراجعه به کارتابل الکترونیکی، تصویر فرم‌های درخواست، احراز هویت و مدارک هویتی متقاضیان را پیش از پایان مهلت قانونی بارگذاری فرمایید.</p>
    
    <div style="text-align: center; margin: 28px 0;">
      <a href="{action_url}" style="background-color: #059669; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; display: inline-block;">ورود به کارتابل و بارگذاری مدارک</a>
    </div>

    <p style="font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 24px;">
      این پیام به صورت سامانه‌ای از سامانه نظارت و بازرسی دوره‌ای دفاتر صدور گواهی الکترونیکی (RA-Audit) ارسال شده است.
    </p>
  </div>
</div>`,
    inAppTitle: 'درخواست بارگذاری مدارک دوره بازرسی ({campaign_title})',
    inAppMessage: 'دفتر محترم {office_name}؛ مدارک مربوط به {samples_count} پرونده استخراج شده و منتظر بارگذاری در کارتابل می‌باشد. مهلت اقدام: {deadline}',
    variables: [
      { key: 'office_name', label: 'نام دفتر', example: 'دفتر اسناد رسمی ۱۰۲ تهران' },
      { key: 'office_code', label: 'کد دفتر', example: '102' },
      { key: 'campaign_title', label: 'عنوان دوره بازرسی', example: 'دوره ممیزی زمستان ۱۴۰۳' },
      { key: 'samples_count', label: 'تعداد نمونه‌ها', example: '۵' },
      { key: 'deadline', label: 'مهلت اقدام', example: '۱۴۰۳/۱۲/۲۰' },
      { key: 'tracking_code', label: 'کد رهگیری', example: 'RA-CAMP-8891' },
      { key: 'action_url', label: 'لینک ورود به کارتابل', example: 'https://ra-audit.gov.ir/kartable' }
    ]
  },
  {
    id: 'tmpl-defect-alert',
    category: 'DEFECT_ALERT',
    name: 'اعلام نقص مدارک و اخطار عدم انطباق',
    description: 'اطلاع‌رسانی ثبت عدم انطباق یا نقص در مدارک بارگذاری شده توسط بازرس و تعیین مهلت ۷۲ ساعته رفع نقص',
    smsEnabled: true,
    smsPatternCode: 'AUDIT_DEFECT_NOTICE',
    smsTemplate: 'اخطار رفع نقص: دفتر {office_name}؛ در مدارک بازرسی متقاضی «{applicant_name}» (کد: {tracking_code}) نقص ثبت شد: {defects_summary}\nمهلت رفع نقص: {deadline}\nلینک اقدام: {action_url}\nنظارت مرکز میانی',
    emailEnabled: true,
    emailSubject: 'فوری - اخطاریه نقص مدارک و مهلت رفع نقص - متقاضی {applicant_name} (کد دفتر: {office_code})',
    emailBodyHtml: `<div style="direction: rtl; font-family: Tahoma, 'Segoe UI', Arial; color: #1e293b; line-height: 1.8; max-width: 640px; margin: 0 auto; border: 1px solid #fecdd3; border-radius: 16px; overflow: hidden; background-color: #ffffff;">
  <div style="background: linear-gradient(135deg, #991b1b 0%, #1e1b4b 100%); padding: 24px; color: #ffffff;">
    <div style="font-size: 13px; opacity: 0.85; margin-bottom: 4px;">مرکز بازرسی و نظارت دفاتر ثبت نام مرکز میانی عام</div>
    <h2 style="margin: 0; font-size: 18px; font-weight: bold;">اخطاریه رسمی اعلام نقص و لزوم اقدام فوری</h2>
  </div>
  <div style="padding: 24px;">
    <p><strong>مسئول محترم دفتر ثبت نام {office_name}</strong></p>
    <p>پیرو بررسی مستندات بارگذاری شده توسط بازرس ممیزی، در پرونده زیر مغایرت و عدم انطباق با دستورالعمل‌های صدور گواهی مشاهده گردیده است:</p>
    
    <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 12px; padding: 16px; margin: 18px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr>
          <td style="padding: 6px; color: #881337;">نام متقاضی:</td>
          <td style="padding: 6px; font-weight: bold; color: #0f172a;">{applicant_name}</td>
        </tr>
        <tr>
          <td style="padding: 6px; color: #881337;">کد رهگیری پرونده:</td>
          <td style="padding: 6px; font-mono; font-weight: bold; color: #0f172a;">{tracking_code}</td>
        </tr>
        <tr>
          <td style="padding: 6px; color: #881337;">شرح موارد نقص:</td>
          <td style="padding: 6px; font-weight: bold; color: #b91c1c;">{defects_summary}</td>
        </tr>
        <tr>
          <td style="padding: 6px; color: #881337;">حداکثر مهلت رفع نقص:</td>
          <td style="padding: 6px; font-weight: bold; color: #dc2626;">{deadline}</td>
        </tr>
      </table>
    </div>

    <p style="color: #475569; font-size: 13px;">
      توجه: در صورت عدم بارگذاری مدارک اصلاحی یا عدم ارسال توضیحات مستند تا مهلت مقرر، موضوع مشمول بندهای تعلیق موقت فعالیت خواهد گردید.
    </p>
    
    <div style="text-align: center; margin: 24px 0;">
      <a href="{action_url}" style="background-color: #dc2626; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; display: inline-block;">مشاهده پرونده و رفع نقص فوری</a>
    </div>
  </div>
</div>`,
    inAppTitle: 'اعلام نقص در مدارک بازرسی ({applicant_name})',
    inAppMessage: 'در بررسی مدارک پرونده {applicant_name} (کد: {tracking_code}) نقص ثبت شد: {defects_summary}. مهلت اقدام: {deadline}',
    variables: [
      { key: 'office_name', label: 'نام دفتر', example: 'دفتر اسناد رسمی ۳۰۱ اصفهان' },
      { key: 'office_code', label: 'کد دفتر', example: '301' },
      { key: 'applicant_name', label: 'نام متقاضی', example: 'رضا محمدی' },
      { key: 'tracking_code', label: 'کد رهگیری پرونده', example: 'TRK-99014' },
      { key: 'defects_summary', label: 'خلاصه نقص‌های اعلامی', example: 'عدم بارگذاری تصویر کارت ملی معتبر و نقص امضا' },
      { key: 'deadline', label: 'مهلت رفع نقص', example: '۱۴۰۳/۱۲/۱۵ (۷۲ ساعت)' },
      { key: 'action_url', label: 'لینک پرونده', example: 'https://ra-audit.gov.ir/kartable?tracking=TRK-99014' }
    ]
  },
  {
    id: 'tmpl-lifecycle-suspension',
    category: 'LIFECYCLE_EVENT',
    name: 'حکم نظارتی تعلیق موقت مجوز فعالیت دفتر',
    description: 'ابلاغ رسمی تعلیق موقت صدور گواهی الکترونیکی به دلیل اتمام مهلت رفع نقص یا تخلفات آیین‌نامه‌ای',
    smsEnabled: true,
    smsPatternCode: 'AUDIT_SUSPEND_NOTICE',
    smsTemplate: 'هشدار نظارتی فوری: مجوز صدور گواهی دفتر {office_name} (کد: {office_code}) به مدت {suspension_days} روز تعلیق موقت گردید.\nعلت: {suspension_reason}\nمشاهده ابلاغیه: {action_url}\nمرکز بازرسی دفاتر صدور گواهی',
    emailEnabled: true,
    emailSubject: 'ابلاغیه رسمی: صدور حکم تعلیق موقت مجوز فعالیت صدور گواهی الکترونیکی دفتر {office_name}',
    emailBodyHtml: `<div style="direction: rtl; font-family: Tahoma, 'Segoe UI', Arial; color: #1e293b; line-height: 1.8; max-width: 640px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 16px; overflow: hidden; background-color: #ffffff;">
  <div style="background: linear-gradient(135deg, #4c1d95 0%, #0f172a 100%); padding: 24px; color: #ffffff;">
    <div style="font-size: 13px; opacity: 0.85; margin-bottom: 4px;">مرکز بازرسی و نظارت دفاتر ثبت نام مرکز میانی عام</div>
    <h2 style="margin: 0; font-size: 18px; font-weight: bold;">حکم نظارتی تعلیق موقت مجوز صدور گواهی</h2>
  </div>
  <div style="padding: 24px;">
    <p><strong>مسئول محترم دفتر ثبت نام {office_name} (کد {office_code})</strong></p>
    <p>بدین‌وسیله به اطلاع می‌رساند پیرو گزارش‌های نظارتی و بازرسی، حکم تعلیق موقت به شرح مشخصات زیر صادر و در سامانه مرکزی اعمال گردید:</p>
    
    <div style="background-color: #faf5ff; border: 1px solid #e9d5ff; border-radius: 12px; padding: 16px; margin: 18px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr>
          <td style="padding: 6px; color: #6b21a8;">مدت تعلیق:</td>
          <td style="padding: 6px; font-weight: bold; color: #0f172a;">{suspension_days} روز</td>
        </tr>
        <tr>
          <td style="padding: 6px; color: #6b21a8;">علت و مستند قانونی:</td>
          <td style="padding: 6px; font-weight: bold; color: #7e22ce;">{suspension_reason}</td>
        </tr>
        <tr>
          <td style="padding: 6px; color: #6b21a8;">تاریخ موعد انقضا/بازبینی:</td>
          <td style="padding: 6px; font-weight: bold; color: #0f172a;">{deadline}</td>
        </tr>
      </table>
    </div>

    <p style="font-size: 13px; color: #475569;">
      در مدت تعلیق، امکان صدور یا تمدید گواهی الکترونیکی در درگاه RA متوقف خواهد بود. جهت ارائه لایحه دفاعیه یا تقاضای رفع تعلیق به سامانه مراجعه فرمایید.
    </p>
    
    <div style="text-align: center; margin: 24px 0;">
      <a href="{action_url}" style="background-color: #6b21a8; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; display: inline-block;">مشاهده پرونده نظارتی و ثبت لایحه</a>
    </div>
  </div>
</div>`,
    inAppTitle: 'حکم تعلیق موقت مجوز صدور گواهی دفتر {office_name}',
    inAppMessage: 'مجوز صدور گواهی دفتر {office_name} به مدت {suspension_days} روز تعلیق شد. علت: {suspension_reason}',
    variables: [
      { key: 'office_name', label: 'نام دفتر', example: 'دفتر پیشخوان ۴۰۸ شیراز' },
      { key: 'office_code', label: 'کد دفتر', example: '408' },
      { key: 'suspension_days', label: 'مدت تعلیق (روز)', example: '۱۵' },
      { key: 'suspension_reason', label: 'علت تعلیق', example: 'عدم رفع نقص در مهلت قانونی ممیزی' },
      { key: 'deadline', label: 'موعد بازبینی', example: '۱۴۰۴/۰۱/۱۵' },
      { key: 'action_url', label: 'لینک ابلاغیه', example: 'https://ra-audit.gov.ir/offices' }
    ]
  },
  {
    id: 'tmpl-lifecycle-reinstatement',
    category: 'LIFECYCLE_EVENT',
    name: 'حکم رفع تعلیق و بازگشت به وضعیت عادی',
    description: 'ابلاغ رسمی رفع تعلیق و بازفعال‌سازی دسترسی دفتر پس از انطباق و تایید بازرس',
    smsEnabled: true,
    smsPatternCode: 'AUDIT_REINSTATE_NOTICE',
    smsTemplate: 'دفتر محترم {office_name} (کد: {office_code})؛ پیرو بررسی مدارک و احراز رفع عدم انطباق، مجوز صدور گواهی دفتر مجدداً فعال گردید.\nورود به کارتابل: {action_url}\nمرکز بازرسی دفاتر صدور گواهی',
    emailEnabled: true,
    emailSubject: 'ابلاغیه رسمی: رفع تعلیق و بازگشت به فعالیت عادی صدور گواهی - دفتر {office_name}',
    emailBodyHtml: `<div style="direction: rtl; font-family: Tahoma, 'Segoe UI', Arial; color: #1e293b; line-height: 1.8; max-width: 640px; margin: 0 auto; border: 1px solid #bbf7d0; border-radius: 16px; overflow: hidden; background-color: #ffffff;">
  <div style="background: linear-gradient(135deg, #15803d 0%, #064e3b 100%); padding: 24px; color: #ffffff;">
    <div style="font-size: 13px; opacity: 0.85; margin-bottom: 4px;">مرکز بازرسی و نظارت دفاتر ثبت نام مرکز میانی عام</div>
    <h2 style="margin: 0; font-size: 18px; font-weight: bold;">ابلاغیه رسمی رفع تعلیق و بازفعال‌سازی مجوز</h2>
  </div>
  <div style="padding: 24px;">
    <p><strong>مسئول محترم دفتر ثبت نام {office_name}</strong></p>
    <p>با سلام و احترام؛</p>
    <p>به استحضار می‌رساند با توجه به بررسی کارشناسی مستندات ارسالی و احراز انطباق کامل فرآیندها با ضوابط مرکز ریشه و مرکز میانی، <strong>حکم رفع تعلیق</strong> صادر و دسترسی‌های سامانه صدور گواهی به حالت فعال بازگردانی شد.</p>
    
    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin: 18px 0;">
      <p style="margin: 0; font-size: 13px; color: #166534; font-weight: bold;">
        وضعیت دفتر: فعال و منطبق با استاندارد ممیزی دوره‌ای
      </p>
    </div>

    <div style="text-align: center; margin: 24px 0;">
      <a href="{action_url}" style="background-color: #16a34a; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; display: inline-block;">ورود به کارتابل دفتر</a>
    </div>
  </div>
</div>`,
    inAppTitle: 'رفع تعلیق و بازگشت به فعالیت عادی ({office_name})',
    inAppMessage: 'پیرو تایید بازرس و احراز رفع عدم انطباق، مجوز صدور گواهی دفتر {office_name} مجدداً فعال گردید.',
    variables: [
      { key: 'office_name', label: 'نام دفتر', example: 'دفتر اسناد رسمی ۱۲ تبریز' },
      { key: 'office_code', label: 'کد دفتر', example: '12' },
      { key: 'action_url', label: 'لینک کارتابل', example: 'https://ra-audit.gov.ir/kartable' }
    ]
  },
  {
    id: 'tmpl-expiration-alarm',
    category: 'EXPIRATION_ALARM',
    name: 'هشدار فرارسیدن موعد انقضای مهلت اقدام',
    description: 'یادآوری خودکار ۲۴ یا ۴۸ ساعت مانده به پایان مهلت بارگذاری مدارک یا رفع نقص',
    smsEnabled: true,
    smsPatternCode: 'AUDIT_EXPIRY_ALARM',
    smsTemplate: 'یادآوری مهم ممیزی: تنها {remaining_hours} ساعت تا پایان مهلت قانونی دفتر {office_name} باقی مانده است. عدم بارگذاری موجب تعلیق خودکار خواهد شد: {action_url}',
    emailEnabled: true,
    emailSubject: 'هشدار فرارسیدن موعد پایان مهلت قانونی - دفتر {office_name}',
    emailBodyHtml: `<div style="direction: rtl; font-family: Tahoma, 'Segoe UI', Arial; color: #1e293b; line-height: 1.8; max-width: 640px; margin: 0 auto; border: 1px solid #fed7aa; border-radius: 16px; overflow: hidden; background-color: #ffffff;">
  <div style="background: linear-gradient(135deg, #c2410c 0%, #7c2d12 100%); padding: 24px; color: #ffffff;">
    <div style="font-size: 13px; opacity: 0.85; margin-bottom: 4px;">مرکز بازرسی و نظارت دفاتر ثبت نام مرکز میانی عام</div>
    <h2 style="margin: 0; font-size: 18px; font-weight: bold;">هشدار نزدیک شدن به پایان مهلت اقدام</h2>
  </div>
  <div style="padding: 24px;">
    <p><strong>مسئول محترم دفتر {office_name} (کد {office_code})</strong></p>
    <p>احتراماً به اطلاع می‌رساند تنها <strong>{remaining_hours} ساعت</strong> تا پایان مهلت تعیین‌شده جهت تکمیل مدارک بازرسی باقی مانده است.</p>
    
    <div style="background-color: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; padding: 16px; margin: 18px 0;">
      <p style="margin: 0; font-size: 13px; color: #9a3412;">
        تاریخ انقضا: <strong>{deadline}</strong>
      </p>
    </div>

    <div style="text-align: center; margin: 24px 0;">
      <a href="{action_url}" style="background-color: #ea580c; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; display: inline-block;">تکمیل و ارسال فوری مدارک</a>
    </div>
  </div>
</div>`,
    inAppTitle: 'هشدار پایان مهلت اقدام ({office_name})',
    inAppMessage: 'تنها {remaining_hours} ساعت تا پایان موعد مقرر ({deadline}) دفتر {office_name} باقی مانده است.',
    variables: [
      { key: 'office_name', label: 'نام دفتر', example: 'دفتر اسناد رسمی ۵۵ کرج' },
      { key: 'office_code', label: 'کد دفتر', example: '55' },
      { key: 'remaining_hours', label: 'ساعت باقیمانده', example: '۲۴' },
      { key: 'deadline', label: 'تاریخ موعد انقضا', example: '۱۴۰۳/۱۲/۲۸' },
      { key: 'action_url', label: 'لینک کارتابل', example: 'https://ra-audit.gov.ir/kartable' }
    ]
  },
  {
    id: 'tmpl-office-response',
    category: 'OFFICE_RESPONSE',
    name: 'اطلاع‌رسانی ارسال مدارک و پاسخ توسط دفتر',
    description: 'پیام خودکار به بازرس و سرپرست نظارت پس از بارگذاری مستندات یا رفع نقص توسط دفتر',
    smsEnabled: true,
    smsPatternCode: 'AUDIT_OFFICE_SUBMITTED',
    smsTemplate: 'سامانه بازرسی: دفتر {office_name} مدارک تکمیلی پرونده {tracking_code} را بارگذاری نمود و پرونده آماده ارزیابی بازرس می‌باشد.\nپنل بازرس: {action_url}',
    emailEnabled: true,
    emailSubject: 'ثبت پاسخ و ارسال مدارک توسط دفتر {office_name} - پرونده {tracking_code}',
    emailBodyHtml: `<div style="direction: rtl; font-family: Tahoma, 'Segoe UI', Arial; color: #1e293b; line-height: 1.8; max-width: 640px; margin: 0 auto; border: 1px solid #bfdbfe; border-radius: 16px; overflow: hidden; background-color: #ffffff;">
  <div style="background: linear-gradient(135deg, #1d4ed8 0%, #0f172a 100%); padding: 24px; color: #ffffff;">
    <div style="font-size: 13px; opacity: 0.85; margin-bottom: 4px;">مرکز بازرسی و نظارت دفاتر ثبت نام مرکز میانی عام</div>
    <h2 style="margin: 0; font-size: 18px; font-weight: bold;">اعلام بارگذاری مدارک و ثبت پاسخ دفتر</h2>
  </div>
  <div style="padding: 24px;">
    <p><strong>بازرس محترم ممیزی</strong></p>
    <p>دفتر ثبت نام <strong>{office_name}</strong> مدارک درخواستی یا رفع نقص پرونده زیر را ارسال نمود:</p>
    
    <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 16px; margin: 18px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr>
          <td style="padding: 6px; color: #1e40af;">کد پرونده:</td>
          <td style="padding: 6px; font-weight: bold; color: #0f172a;">{tracking_code}</td>
        </tr>
        <tr>
          <td style="padding: 6px; color: #1e40af;">متقاضی:</td>
          <td style="padding: 6px; font-weight: bold; color: #0f172a;">{applicant_name}</td>
        </tr>
      </table>
    </div>

    <div style="text-align: center; margin: 24px 0;">
      <a href="{action_url}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; display: inline-block;">ورود به پنل ارزیابی بازرس</a>
    </div>
  </div>
</div>`,
    inAppTitle: 'بارگذاری مدارک توسط دفتر {office_name}',
    inAppMessage: 'مدارک پرونده {tracking_code} ({applicant_name}) توسط دفتر بارگذاری شد و در نوبت بررسی بازرس قرار گرفت.',
    variables: [
      { key: 'office_name', label: 'نام دفتر', example: 'دفتر اسناد رسمی ۹ قزوین' },
      { key: 'tracking_code', label: 'کد رهگیری پرونده', example: 'TRK-4409' },
      { key: 'applicant_name', label: 'نام متقاضی', example: 'سارا احمدی' },
      { key: 'action_url', label: 'لینک پنل بررسی بازرس', example: 'https://ra-audit.gov.ir/inspection-review' }
    ]
  }
];

const STORAGE_KEY = 'ra_audit_notification_templates_v2';

/**
 * Loads notification templates from local storage or returns defaults
 */
export function loadNotificationTemplates(): NotificationMessageTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_TEMPLATES;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Ensure any newly added default templates are also included
      const existingIds = new Set(parsed.map(t => t.id));
      const missingDefaults = DEFAULT_NOTIFICATION_TEMPLATES.filter(d => !existingIds.has(d.id));
      return [...parsed, ...missingDefaults];
    }
    return DEFAULT_NOTIFICATION_TEMPLATES;
  } catch (err) {
    console.warn('Error loading notification templates from storage:', err);
    return DEFAULT_NOTIFICATION_TEMPLATES;
  }
}

/**
 * Saves notification templates to local storage
 */
export function saveNotificationTemplates(templates: NotificationMessageTemplate[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch (err) {
    console.error('Error saving notification templates:', err);
  }
}

/**
 * Resets templates back to official system defaults
 */
export function resetNotificationTemplatesToDefault(): NotificationMessageTemplate[] {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Error resetting notification templates:', err);
  }
  return DEFAULT_NOTIFICATION_TEMPLATES;
}

/**
 * Renders a template string by replacing placeholder tokens {key} with actual values
 */
export function renderTemplateText(template: string, variables: Record<string, string | number | undefined>): string {
  let output = template;
  for (const [key, value] of Object.entries(variables)) {
    const token = new RegExp(`\\{${key}\\}`, 'g');
    output = output.replace(token, value !== undefined && value !== null ? String(value) : '');
  }
  return output;
}

/**
 * Calculates SMS character count and SMS parts (Persian standard: 70 chars for 1st part, 67 for concatenated parts)
 */
export function calculateSmsMetrics(text: string): { charCount: number; partsCount: number; isPersian: boolean } {
  const charCount = text.length;
  // Persian / Unicode SMS logic
  const isPersian = /[\u0600-\u06FF]/.test(text);
  let partsCount = 1;
  if (isPersian) {
    if (charCount > 70) {
      partsCount = Math.ceil(charCount / 67);
    }
  } else {
    if (charCount > 160) {
      partsCount = Math.ceil(charCount / 153);
    }
  }
  return { charCount, partsCount: Math.max(1, partsCount), isPersian };
}
