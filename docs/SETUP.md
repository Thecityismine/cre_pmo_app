# CRE PMO V2 — Setup Guide

## Tech Stack
- React 18 + Vite + TypeScript
- Tailwind CSS v4
- Firebase (Auth, Firestore, Storage, Functions)
- Zustand (state management)
- React Router v6
- Lucide React (icons)

## 1. Firebase Project Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project: `cre-pmo-v2`
3. Enable these services:
   - **Authentication** → Sign-in methods → Email/Password + Google
   - **Firestore Database** → Start in production mode
   - **Storage** → Default bucket
4. Go to **Project Settings → Your apps → Add app → Web**
5. Copy the config values into `.env.local`

## 2. Environment Variables

Copy the Firebase SDK config into `.env.local`:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

⚠️ `.env.local` is in `.gitignore` — it will NOT be committed to GitHub.

## 3. Run Development Server

```bash
npm install
npm run dev
```

App will be at: http://localhost:5173

## 4. Migrate V1 Data

1. Export JSON backup from V1 app
2. Place at: `scripts/v1-backup.json`
3. Download Firebase service account key:
   - Firebase Console → Project Settings → Service Accounts → Generate new private key
   - Save as: `scripts/serviceAccountKey.json` (⚠️ NEVER commit this file)
4. Install admin SDK: `npm install firebase-admin --save-dev`
5. Run: `node scripts/migrate-v1-data.mjs`

## 5. Vercel Deployment

1. Push to GitHub
2. Connect repo on [vercel.com](https://vercel.com)
3. Add environment variables in Vercel dashboard (same as `.env.local`)
4. Deploy

## Firestore Collections

| Collection | Description |
|---|---|
| `projects` | All CRE projects |
| `tasks` | Project tasks / checklist items |
| `contacts` | Project contacts |
| `masterTasks` | Global task template library |
| `users` | User profiles and roles |
| `budgetItems` | Budget line items per project |

## Folder Structure

```
src/
├── components/
│   ├── layout/        # Sidebar, Topbar, AppLayout
│   └── ui/            # Shared UI primitives
├── features/          # Feature-specific components (future)
├── hooks/             # useAuth, useProjects, etc.
├── lib/               # firebase.ts
├── pages/             # Route-level page components
├── store/             # Zustand stores
└── types/             # TypeScript types
```
