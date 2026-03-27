# Kovalam HMS — Hospital Management System

A full-featured Hospital Management System built with **Next.js 14**, **MongoDB Atlas**, and **NextAuth.js**.

---

## 🚀 Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Environment

Create a `.env` file in the root with the following:

```env
MONGODB_URI=mongodb+srv://nithulps:nithul123@cluster0.t55o5tr.mongodb.net/hms?retryWrites=true&w=majority&appName=Cluster0
NEXTAUTH_SECRET=3RMTzIHKJLhA/LhwaR/vBHTVQ+fYSdvrWC05cmqI/fQ=
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_HOSPITAL_NAME=Doctors medical center
NEXT_PUBLIC_HOSPITAL_ADDRESS=123 Main Street, City - 000001
NEXT_PUBLIC_HOSPITAL_PHONE=+91 00000 00000
```

### 3. Seed the Database

Run the seed script to populate MongoDB with default users, patients, medicines, and procedures:

```bash
$env:MONGODB_URI="mongodb+srv://nithulps:nithul123@cluster0.t55o5tr.mongodb.net/hms?retryWrites=true&w=majority&appName=Cluster0"; npx ts-node --project tsconfig.seed.json scripts/seed.ts
```

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔐 Login Credentials

All accounts use the same default password: **`password123`**

| Role       | Email               | Password      |
|------------|---------------------|---------------|
| Admin      | `admin@hms.com`     | `password123` |
| Doctor     | `doctor@hms.com`    | `password123` |
| Pharmacy   | `pharmacy@hms.com`  | `password123` |
| Front Desk | `frontdesk@hms.com` | `password123` |

> ⚠️ Change these credentials before deploying to production.

---

## 🗄️ Database

- **Provider**: MongoDB Atlas
- **Cluster**: `cluster0.t55o5tr.mongodb.net`
- **Database name**: `hms`
- **Connection**: Managed via `lib/mongoose.ts` using a cached connection pattern for Next.js

---

## 👥 Roles & Access

| Role        | Access Areas                                                    |
|-------------|-----------------------------------------------------------------|
| `admin`     | Dashboard, Patients, Users, Expenses, Reports, Settings         |
| `doctor`    | Dashboard, Patient Consultations, Prescriptions                 |
| `pharmacy`  | Dashboard, Medicines, Stock, Billing                            |
| `frontdesk` | Dashboard, Patient Registration, Visits, Billing                |

---

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: MongoDB Atlas + Mongoose
- **Auth**: NextAuth.js (JWT strategy)
- **Styling**: Tailwind CSS + shadcn/ui
- **Language**: TypeScript