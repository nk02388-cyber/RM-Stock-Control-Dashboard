# RM Stock Control Dashboard

แดชบอร์ดควบคุมสต็อกวัตถุดิบ (RM) แบบ static web app พร้อมการซิงก์ข้อมูลข้ามอุปกรณ์ผ่าน Supabase

## เปิดใช้งานในเครื่อง

โปรเจกต์นี้ไม่มีขั้นตอน build สามารถเปิดผ่าน static web server ได้ทันที เช่น

```powershell
python -m http.server 8080
```

จากนั้นเปิด `http://localhost:8080/`

## Deploy

ตั้งค่าไว้สำหรับ Netlify โดย publish จากโฟลเดอร์รากของ repository และไม่ต้องใช้ build command

## ไฟล์หลัก

- `index.html` — หน้า dashboard และ logic ทั้งหมด
- `netlify.toml` — การตั้งค่า deploy และ security headers

## หมายเหตุ

ตัวแอปโหลด Supabase JavaScript client จาก jsDelivr และเชื่อมกับ Supabase project ที่กำหนดไว้ใน `index.html`
