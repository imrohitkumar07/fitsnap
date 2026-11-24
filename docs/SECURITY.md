# FitSnap Security & OWASP Compliance Architecture

**Version**: 1.0.0  
**Author**: FitSnap Engineering  
**Classification**: Production Security Specification & Audit Report  

---

## 1. Executive Summary & Security Objectives
FitSnap is a health-technology application handling sensitive personal biometric information, including dietary consumption, caloric intake, body weight, anthropometric measurements, and meal photography. This document outlines the defense-in-depth architecture implemented across client, API gateway, ML inference service, and database persistence tiers in accordance with the **OWASP Top 10 (2021)** security standards.

---

## 2. Threat Modeling & Security Boundaries

```
[ Client: React Vite PWA ]
          │
          │ HTTPS (TLS 1.3) / Strict CORS
          ▼
[ Express API Gateway (Port 3001) ]
  ├── Zod Schema Validation Filter
  ├── JWT Auth & Refresh Token Interceptor
  ├── EXIF Stripping (Sharp)
  └── Audit Logging Service
          ├── Parameterized Prisma ORM ──▶ [ SQLite / PostgreSQL Database ]
          └── Internal HTTP (mTLS)       ──▶ [ FastAPI ConvNeXt V2 Service (Port 8000) ]
```

---

## 3. OWASP Top 10 Audit & Mitigation Matrix

### A01: Broken Access Control
- **Authentication Gateway**: All private endpoints (`/api/profile`, `/api/food`, `/api/water`, `/api/workouts`, `/api/weight`, `/api/fasting`, `/api/planner`, `/api/social`, `/api/settings`) are guarded by `authMiddleware`.
- **Tenant Isolation**: Every database query explicitly filters by `userId: req.user.userId`. Users cannot read, mutate, or delete another user's logs, fasting sessions, or grocery lists.
- **Admin Moderation**: Administrative operations (`PATCH /api/social/admin/posts/:id/hide`) require `role === 'admin'` or authenticated administrative rights and write directly to an immutable `AuditLog` table.

### A02: Cryptographic Failures & Credential Protection
- **Password Hashing**: User credentials are encrypted using `bcrypt` with salt rounds = 10 (or Argon2id). Raw passwords are never persisted or logged.
- **Token Lifecycle**:
  - Access Token: Short-lived HMAC-SHA256 JWT containing only `{ userId, email }`.
  - Refresh Token: High-entropy UUID stored in the database with single-use rotation. Upon each refresh, the old token is revoked and a new pair is issued, preventing replay attacks.
- **Secrets Management**: Secrets live exclusively in server-side `.env` (`GEMINI_API_KEY`, `JWT_SECRET`, `DATABASE_URL`). Zero client exposure.

### A03: Injection (SQL & NoSQL)
- **Parameterized SQL**: All database access is governed by **Prisma ORM**, which utilizes fully parameterized query builders, eliminating SQL injection vulnerabilities.
- **Input Sanitation**: Every HTTP payload is parsed against strict **Zod** validation schemas (`schemas.ts`). Malformed, oversized, or unauthorized fields are rejected before hitting controllers.

### A04: Insecure Design & Privacy Protections
- **Private EXIF Metadata Stripping**: Camera and gallery uploads pass through an image preprocessor that strips all GPS geographic coordinates, camera serial numbers, and device fingerprints prior to storing files in `/uploads/`.
- **GDPR Compliance**: Endpoints provide full user data export (`GET /api/profile/export`) in machine-readable JSON format, and right-to-be-forgotten deletion (`DELETE /api/profile/account`).

### A05: Security Misconfiguration
- **CORS Whitelist**: Explicitly restricted to trusted origin URLs (`localhost:5173`, production domains). Wildcard `*` origins are disabled in production.
- **Payload Limits**: Strict body parsers (`limit: '15mb'`) prevent heap exhaustion from oversized request payloads.

### A06: Vulnerable and Outdated Components
- **Automated Dependabot / Lockfile Pinning**: Both `package-lock.json` and virtual environments lock all dependency trees.
- **Zero Raw Code Execution**: No `eval()`, `exec()`, or dynamic runtime script interpretation.

### A07: Identification and Authentication Failures
- **Anti-Brute Force**: In-memory rate limiting and audit logging track failed login attempts.
- **Secure Password Policies**: Minimum 6-character length enforcement with client-side real-time inline validation.

### A08: Software and Data Integrity Failures
- **Database Backup Integrity**: Automated database backup script (`scripts/backup-db.js`) executes SQLite header verification (`SQLite format 3\0`) on every snapshot before marking it valid.
- **Retention Policies**: Automated pruning retains only the 10 most recent verified backups to prevent disk exhaustion.

### A09: Security Logging and Monitoring Failures
- **Structured Audit Trails**: Sensitive operations generate an entry in the `AuditLog` model:
  - `USER_LOGIN`
  - `DEMO_LOGIN`
  - `UPDATE_GOAL`
  - `ADMIN_HIDE_POST`
  - `DELETE_ACCOUNT`
- **Health Probes**: `/api/health` reports live database connectivity (`SELECT 1`), uptime, and memory consumption.

### A10: Server-Side Request Forgery (SSRF)
- **Controlled Outbound Calls**: External calls are limited to certified endpoints:
  - Google Gemini API (`generativelanguage.googleapis.com`)
  - Open Food Facts API (`world.openfoodfacts.org`)
  - Internal ConvNeXt V2 inference service (`localhost:8000`)

---

## 4. Medical & Regulatory Disclaimer
FitSnap AI nutrition estimations, portion sizing, and coaching insights are generated via deep neural networks and heuristics. They are provided solely for educational and self-tracking purposes and do **not** constitute medical advice, diagnosis, or treatment plans. This notice is visibly displayed across all AI confirmation and coaching views.
