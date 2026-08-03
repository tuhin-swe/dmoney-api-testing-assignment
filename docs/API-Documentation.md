# DMoney API Documentation (Endpoints Used in This Collection)

Base URL (local): `http://localhost:5000`
Full Swagger docs (backend repo): `/api-docs/user` and `/api-docs/transaction`

Every authenticated endpoint requires **both**:
- `Authorization: Bearer <jwt>`
- `X-AUTH-SECRET-KEY: <PARTNER_KEY>` — must match the backend's `PARTNER_KEY` env var (`ROADTOSDET` in this project's `.env`)

> Tip: in Postman, open the collection → **View more actions → Publish Docs** (or **Export → Generate Docs**) to get a live, browsable, shareable version of everything below, auto-generated from the actual requests.

---

## User Endpoints

### `POST /user/register` — Public (no auth)
Self-registration for Customer/Agent/Merchant. New accounts start with `status: "pending"` and cannot transact until an Admin activates them.

Request body:
```json
{ "name": "string", "email": "gmail-only", "password": "string (min 4)", "phone_number": "11 digits", "nid": "7-13 chars", "role": "Customer | Agent | Merchant" }
```
Responses: `201` created · `208` email/phone already exists · `400` validation error (invalid role, non-Gmail email, etc.)

### `POST /user/login` — Public
Body: `{ "email" | "phone_number": "...", "password": "..." }`
- **Admin** and the **SYSTEM** account (`phone_number === "SYSTEM"`) get a JWT immediately: `{ token, role, expiresIn }`.
- All other roles get `{ message, otpRequired: true }` and a 4-digit OTP (2-minute expiry) is generated and logged server-side (emailed only for `@gmail.com` addresses).

Responses: `200` · `401` wrong password · `404` user not found

### `POST /user/verify-otp` — Public
Body: `{ "identifier": "email or phone", "otp": "4-digit code" }`
On success, returns `{ token, role, expiresIn }` and clears the OTP.

**Dev/test bypass:** append `?env=dev` and set `otp` to the server's `DEFAULT_OTP` env var to skip the real OTP match/expiry check — this is what this collection uses to automate login for non-admin roles without reading the OTP from the server console/email.

Responses: `200` · `401` invalid/expired OTP · `400` no OTP on record

### `POST /user/create` — Admin only (`authenticateJWT`)
Admin-created user (role must exist in `Roles` table). Same validation as registration but not Gmail-self-service-gated the same way.

### `PUT /user/update/:id` / `PATCH /user/update/:id` — Owner or Admin (`authenticateJWT`)
Used here to **activate** users: `PATCH` body `{ "status": "active" }`.
- Only Admin can change `role`/`status` — a non-admin caller updating their own record has those fields silently stripped; updating **someone else's** record returns `403`.
- Protected system accounts (`SYSTEM`, `admin@dmoney.com`, `admin@roadtocareer.net`, `system@dmoney.com`) cannot be updated.

Responses: `200` · `403` not owner/admin or protected account · `404` user not found

### `DELETE /user/delete/:id` — Admin only
### `GET /user/list`, `/user/search/...` — read-only lookups (`publicAuthenticateJWT` — JWT only, no secret-key header required)

---

## Transaction Endpoints

All require `authenticateJWT` (Bearer JWT **and** `X-AUTH-SECRET-KEY`). The caller's token identity must match `from_account`'s `email`/`phone_number`, or the request is rejected with `403`.

**Ledger model:** every transaction writes multiple rows to one `trnxId` (double/triple-entry bookkeeping). Balance is always computed as `SUM(credit) - SUM(debit)` — there is no stored balance column.

### `POST /transaction/deposit`
Body: `{ "from_account", "to_account", "amount" }`
Two flows, both require the caller to hold an **Agent**-role token:
1. **SYSTEM → regular Agent** (`from_account.phone_number === "SYSTEM"`): tops up an Agent from the SYSTEM pool. `to_account` must be a regular Agent. No commission.
2. **Regular Agent → Customer**: Agent earns a **2.5% commission**; Customer receives the full `amount`. Enforces min/max transaction amount and the customer's balance cap.

Success (`201`) response includes `trnxId` and, for flow 2, `commission`.
Failure modes: `400` wrong account roles/same account, `208` insufficient balance / cap exceeded, `403` not the account owner or account not active, `404` account doesn't exist.

### `POST /transaction/sendmoney`
Body: `{ "from_account", "to_account", "amount" }` — **Customer → Customer only**.
System takes a **flat 5 tk** service fee from the sender (third ledger row credited to `SYSTEM`); the recipient gets the full `amount`.
Success (`201`) response includes `fee`. Also enforces the sending Customer's daily/monthly limits (`TransactionLimits` table).

### `POST /transaction/withdraw`
Body: `{ "from_account", "to_account", "amount" }` — Customer/Merchant → **Agent** only.
System fee: **1% of amount, floored to a 5 tk minimum**, debited from the sender. The Agent additionally earns a 2.5% commission on top (funded by the platform, not the customer).
Success (`201`) response includes `fee`.

### `POST /transaction/payment`
Body: `{ "from_account", "to_account", "amount", "discount_code"?, "discount_amount"? }` — Customer/Agent → **Merchant** only.
System fee: **1% of amount, floored to a 5 tk minimum**. Optional discount code (`DISCOUNT_CODE` env var) reduces the chargeable amount before the fee is computed.
Success (`201`) response includes `fee` (and `discountedTotal`/`discountedAmount` if a discount applied).

### `GET /transaction/balance/:account`, `/transaction/statement/:account`, `/transaction/limit/:account`, `/transaction/list`, `/transaction/search/:trnxId`
Read-only lookups, all behind `authenticateJWT`.

---

## HTTP status code convention (backend-wide)
| Code | Meaning |
|---|---|
| `200` / `201` | Success |
| `208` | "Soft" business-rule failure (insufficient balance, cap exceeded, duplicate registration) |
| `400` | Hard validation error (bad input, wrong account roles, limit exceeded) |
| `401` | Auth/token failure (missing/invalid JWT, missing/wrong secret key, wrong password) |
| `403` | Permission/ownership failure (acting on someone else's account, inactive account) |
| `404` | Resource not found |
