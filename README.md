# rasht.city

سایت ساده و استاتیک برای دامنه **rasht.city** — پروژه تست اتصال به GitHub Pages.

## فایل‌ها

- `index.html` — صفحه اصلی
- `styles.css` — استایل
- `script.js` — اسکریپت کوتاه
- `CNAME` — اتصال دامنه سفارشی به GitHub Pages

## انتشار روی GitHub Pages

### ۱) ساخت مخزن و پوش

در پوشه پروژه:

```bash
git add .
git commit -m "Initial rasht.city site"
gh repo create rasht-city --public --source=. --remote=origin --push
```

یا از GitHub وب‌سایت یک مخزن خالی بسازید و:

```bash
git remote add origin https://github.com/USERNAME/rasht-city.git
git branch -M main
git push -u origin main
```

### ۲) فعال‌سازی Pages

1. مخزن → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` / پوشه `/ (root)`
4. Save

سایت معمولاً روی آدرسی شبیه این بالا می‌آید:

`https://USERNAME.github.io/rasht-city/`

### ۳) اتصال دامنه rasht.city

1. در DNS دامنه این رکوردها را بگذارید (نزد ثبت‌کننده دامنه):

| Type | Name | Value |
|------|------|--------|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `USERNAME.github.io` |

2. در GitHub Pages → **Custom domain** مقدار `rasht.city` را وارد کنید.
3. گزینه **Enforce HTTPS** را بعد از تأیید دامنه روشن کنید.

فایل `CNAME` همین مخزن قبلاً شامل `rasht.city` است.

## پیش‌نمایش محلی

فایل `index.html` را در مرورگر باز کنید، یا:

```bash
npx serve .
```
