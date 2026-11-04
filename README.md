# 🔔 Buzly - Smart Restaurant Order Pager & Queue Web App (SaaS)
### نظام بيجر واستدعاء الزبائن الذكي متعدد المطاعم (Commercial Multi-Tenant B2B Platform)

> منصة تجارية متكاملة وبديل رقمي فاخر لأجهزة البيجر البلاستيكية المكلفة والقابلة للضياع والأعطال. يعمل مباشرة عبر متصفح جوال الزبون مع دعم إشعارات الشاشة المغلقة (Web Push)، وشاشات التلفاز الذكية (Kitchen TV)، وطباعة ستاندات الطاولات.

---

## 🚀 المميزات الرئيسية (Core Capabilities)

### 1. المنظومة متعددة المتاجر (Multi-Tenant SaaS `/[slug]/...`)
- **بنية المستأجرين المستقلة:** كل مطعم يمتلك رابطاً خاصاً (`/[slug]/staff`, `/[slug]/tv`, `/[slug]/track`) وطابور طلبات معزول بالكامل.
- **تخصيص الهوية البصرية:** التحكم الكامل باسم المطعم، الشعار (Logo)، واختيار ألوان العلامة التجارية (زمردي، كهرماني، أزرق ملكي، وردي، بنفسجي).
- **حماية الكاشير برقم سري (PIN Guard):** شاشة الكاشير محمية برمز سري من 4 أرقام لمنع دخول الزبائن إليها.

### 2. شاشة التلفاز الذكية للمطبخ والصالة (`/[slug]/tv`)
- واجهة أفقية مخصصة لشاشات التلفاز الذكية (16:9 Landscape) بدقة عالية.
- مقسمة إلى عمودين عملاقين: **"قيد التحضير (Preparing)"** و **"جاهز للاستلام (Ready Now)"**.
- **رنين فندقي ووميض تلقائي:** عند جاهزية أي طلب، تطلق الشاشة جرس تنبيه فاخر لتنبيه الزبائن في الصالة.
- ساعة رقمية حية مع عداد الثواني وحساب دقيق للمدة المنقضية.

### 3. إشعارات الويب الحقيقية في الخلفية (Web Push & Locked Screen Support)
- **دعم الشاشة المغلقة:** إرسال إشعارات نظام فورية عبر بروتوكول VAPID حتى لو كان الهاتف مقفلاً تماماً أو المتصفح مغلقاً.
- **محرك الحماية الثلاثية (KeepAwake Triple Shield):**
  - بقاء الشاشة يقظة تلقائياً عبر `Screen Wake Lock API`.
  - جلسة صوت صامتة تبقي التطبيق نشطاً في خلفية متصفح سفاري (iOS Safari).
  - إمكانية تثبيت التطبيق كـ PWA أصلي على الآيفون والأندرويد بنقرة واحدة.

### 4. استوديو الهوية ومولد ستاندات الطاولات (`/[slug]/admin`)
- **طباعة ستاند الباركود للطاولات (Printable Table Stand):**
  - تصميم ستاند مقاس A5 جاهز للطباعة الفورية على الطاولات والكاونتر بشعار المطعم وكود الـ QR المباشر وتعليمات واضحة للزبون.

### 5. تحليلات كفاءة وسرعة المطبخ (`/[slug]/admin/analytics`)
- حساب دقيق لمؤشرات الأداء:
  - إجمالي طلبات اليوم.
  - متوسط وقت التحضير (Prep Time).
  - سرعة استلام العميل بعد النداء (Pickup Delay).
  - مخطط بياني لتوزيع الطلبات وساعات الذروة (Peak Hours).

---

## 🛠️ التقنيات المستخدمة (Tech Stack)

- **Framework:** Next.js (App Router, TypeScript)
- **Styling & UI:** Tailwind CSS, Lucide React, Framer Motion
- **Sound Synthesis:** Web Audio API (توليد أصوات حقيقية بدون ملفات خارجية)
- **PWA & Notifications:** Service Worker, Web Push API, VAPID
- **Database & Realtime:** Supabase Realtime (مع دعم فوري للمزامنة الصفرية عبر `BroadcastChannel` و `LocalStorage`)

---

## ⚡ التشغيل السريع محلياً (Local Development)

```bash
# 1. استنساخ المشروع
git clone https://github.com/abod6911/buzly-smart-pager.git

# 2. الدخول للمجلد
cd buzly-smart-pager

# 3. تثبيت الحزم
npm install

# 4. تشغيل خادم التطوير
npm run dev
```

افتح المتصفح على: `http://localhost:3000`

### روابط المطعم التجريبي الافتراضي (`demo-cafe`):
- **بوابة المنصة الرئيسية:** `http://localhost:3000`
- **كاشير المطعم (PIN: `1234`):** `http://localhost:3000/demo-cafe/staff`
- **شاشة التلفاز الذكية TV:** `http://localhost:3000/demo-cafe/tv`
- **شاشة العميل بالجوال:** `http://localhost:3000/demo-cafe/track/104`
- **إعدادات الهوية وطباعة الستاند:** `http://localhost:3000/demo-cafe/admin`
- **تحليلات سرعة المطبخ:** `http://localhost:3000/demo-cafe/admin/analytics`

---

## 🗄️ إعداد قاعدة بيانات Supabase (اختياري للإنتاج)

1. أنشئ مشروعاً على [Supabase](https://supabase.com).
2. افتح الـ **SQL Editor** والصق محتوى ملف `supabase_schema_v3.sql` واضغط **Run**.
3. أضف بيانات الربط في ملف `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## 📄 الترخيص
مرخص ومطور لصالح Buzly SaaS Platform © 2026.
