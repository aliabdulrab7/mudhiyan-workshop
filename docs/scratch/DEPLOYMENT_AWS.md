# دليل النشر اليدوي على AWS (Mudhiyan Workshop)

هذا الدليل يشرح كيفية تحديث النظام يدوياً على خادم AWS.

### 1. الدخول إلى الخادم عبر SSH
استخدم Terminal أو PowerShell للدخول:
```bash
ssh -i your-key.pem ubuntu@your-aws-ip
```

### 2. الانتقال إلى مجلد المشروع
```bash
cd /var/www/mudhiyan
```

### 3. سحب آخر التحديثات من GitHub
```bash
git pull origin master
```

### 4. تثبيت التبعيات الجديدة (Dependencies)
```bash
npm install --prefix client --production=false
npm install --prefix server
```

### 5. بناء واجهة المستخدم (Build React)
```bash
npm run build --prefix client
```

### 6. إعادة تشغيل الخادم باستخدام PM2
```bash
pm2 restart mudhiyan
```

### 7. التأكد من حالة النظام
```bash
pm2 status
```

---

> [!TIP]
> بعد تنفيذ `npm run build` في المجلد `client` سيقوم Vite بتوليد ملفات جديدة في `client/dist`. تأكد من أن خادم Express (الذي يعمل بـ PM2) يقوم بتقديم هذه الملفات.
