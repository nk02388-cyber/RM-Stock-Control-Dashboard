# RM Stock Control Dashboard

แดชบอร์ดควบคุมสต็อกวัตถุดิบ (RM) แบบ static web app เปิดได้ทันทีโดยไม่ต้องล็อกอิน

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
- `pk-template.css` — รูปแบบหน้าจอที่ปรับจาก PK Dashboard ให้ใช้กับข้อมูล RM
- `rm-incoming.js`, `rm-incoming-core.js`, `rm-incoming.css` — ขั้นตอน QR รับเข้า พิมพ์ป้ายพาเลต และจัดเก็บที่ดัดแปลงจาก PK WMS สำหรับ RM
- `netlify.toml` — การตั้งค่า deploy และ security headers

ดู [QR-CODE.md](QR-CODE.md) สำหรับวิธีรับเข้าและจัดเก็บด้วย QR

## หมายเหตุ

เวอร์ชันสาธารณะนี้แสดงข้อมูลที่ฝังในหน้าเว็บและข้อมูลที่บันทึกในเบราว์เซอร์เครื่องนั้น ไม่มีการอ่านหรือเขียนฐานข้อมูล Supabase และไม่ซิงก์ข้อมูลข้ามเครื่อง เพื่อไม่เปิดสิทธิ์แก้ไขสต็อกสาธารณะ หากต้องการซิงก์ข้ามเครื่องโดยไม่ล็อกอิน ต้องออกแบบ API และสิทธิ์ฝั่งเซิร์ฟเวอร์ใหม่ก่อน
