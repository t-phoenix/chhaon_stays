# Chhaon Cafe Ops — Test Credentials

## Admin (seeded on backend startup via env vars)
- Mobile: `9625005516`
- Password: set in `backend/.env` as `ADMIN_PASSWORD`
- Name: Amrit
- Role: `admin`
- Login: Admin tab on `/login` → `POST /api/auth/login`

## Staff (create via Team page or API)
- Mobile: `9000000077` (used by backend test suite)
- Passcode: `4321` (4–6 digit PIN)
- Name: TEST_Staff
- Role: `staff`
- Login: Staff tab on `/login` → `POST /api/auth/staff-login`

## Auth endpoints

### Admin login
- `POST /api/auth/login`
- Body: `{ "mobile": "<10-digit>", "password": "<password>" }`
- Sets httpOnly cookie `chhaon_access` (name configurable via `COOKIE_NAME`)

### Staff login
- `POST /api/auth/staff-login`
- Body: `{ "mobile": "<10-digit>", "passcode": "<4-6 digit PIN>" }`
- Only works for users with `role: "staff"`

### Session
- Cookie is sent automatically by the browser (`withCredentials: true`)
- API clients / tests may use `Authorization: Bearer <token>` (token value = cookie value)
- Validity: 30 days

## Role access summary

| Feature | Admin | Staff |
|---------|-------|-------|
| Orders (create, list, status) | ✓ | ✓ |
| Kitchen view | ✓ | ✓ |
| Supply requests (add, list) | ✓ | ✓ |
| Bill / order detail | ✓ | ✓ |
| Menu CRUD / prices | ✓ | ✗ |
| Dashboard / reports | ✓ | ✗ |
| Team management / passcodes | ✓ | ✗ |
| Supply aggregated / clear | ✓ | ✗ |
| Delete orders | ✓ | ✗ |
