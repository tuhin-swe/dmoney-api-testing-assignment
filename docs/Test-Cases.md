# DMoney API Testing — Test Cases (Assignment 2, Batch 19)

30 test cases (positive + negative) covering the required flow: register 2 Customers + 1 Agent + 1 Merchant → Admin activates all four → SYSTEM funds the Agent → Agent deposits to a Customer (commission asserted) → Customer sends money to another Customer (service fee asserted) → that Customer cashes out from the Agent (service fee asserted) → that Customer pays a Merchant.

Every test case below is implemented as one or more requests in [`postman/DMoney-API-Testing.postman_collection.json`](../postman/DMoney-API-Testing.postman_collection.json), with the corresponding `pm.test()` assertions. Run order matters — the collection must be executed top to bottom (Newman/Collection Runner does this by default) because later requests depend on tokens/IDs captured by earlier ones.

**Fee/commission reference** (seeded in the `Commissions` table — see [`migrations/create_commission_table.js`](../../dmoney-transaction-api/migrations/create_commission_table.js)):
| Transaction | Rule | 
|---|---|
| Deposit | Agent earns 2.5% commission (platform-funded), customer receives full amount |
| Withdraw | System fee: 1% of amount, floored to a 5 tk minimum |
| SendMoney | System fee: flat 5 tk |
| Payment | System fee: 1% of amount, floored to a 5 tk minimum |

---

## 01 — User Registration

| TC ID | Title | Type | Endpoint | Input Summary | Expected Result / Assertions |
|---|---|---|---|---|---|
| TC01 | Register Customer1 | Positive | `POST /user/register` | Valid Gmail email, 11-digit phone, role=Customer | `201 Created`; response has `user.id`; `user.status === 'pending'` |
| TC02 | Register Customer2 | Positive | `POST /user/register` | Valid Gmail email, role=Customer | `201 Created`; `user.id` present; `status === 'pending'` |
| TC03 | Register Agent | Positive | `POST /user/register` | Valid Gmail email, role=Agent | `201 Created`; `user.id` present; `status === 'pending'` |
| TC04 | Register Merchant | Positive | `POST /user/register` | Valid Gmail email, role=Merchant | `201 Created`; `user.id` present; `status === 'pending'` |
| TC05 | Register — Duplicate Email | Negative | `POST /user/register` | Reuses Customer1's email with a new phone number | `208`; message includes "already exists" |
| TC06 | Register — Invalid Role | Negative | `POST /user/register` | `role: "SuperAdmin"` (not in Customer/Agent/Merchant) | `400`; message includes "Role must be one of" |
| TC07 | Register — Non-Gmail Email | Negative | `POST /user/register` | Email domain `@yahoo.com` | `400`; message enforces Gmail-only rule |

## 02 — Admin Login & User Activation

| TC ID | Title | Type | Endpoint | Input Summary | Expected Result / Assertions |
|---|---|---|---|---|---|
| TC08 | Admin Login | Positive | `POST /user/login` | `admin@dmoney.com` / `1234` | `200`; JWT `token` returned directly (Admin skips OTP); `role === 'Admin'` |
| TC09 | Admin Login — Wrong Password | Negative | `POST /user/login` | Correct email, wrong password | `401`; message includes "Password incorrect" |
| TC10 | Admin Activates Customer1 | Positive | `PATCH /user/update/:id` | `{status:"active"}`, Admin token | `200`; `user.status === 'active'` |
| TC11 | Admin Activates Customer2 | Positive | `PATCH /user/update/:id` | `{status:"active"}`, Admin token | `200`; `user.status === 'active'` |
| TC12 | Admin Activates Agent | Positive | `PATCH /user/update/:id` | `{status:"active"}`, Admin token | `200`; `user.status === 'active'` |
| TC13 | Admin Activates Merchant | Positive | `PATCH /user/update/:id` | `{status:"active"}`, Admin token | `200`; `user.status === 'active'` |

## 03 — Login & OTP Verification

| TC ID | Title | Type | Endpoint | Input Summary | Expected Result / Assertions |
|---|---|---|---|---|---|
| TC14 | Agent Login + OTP Verify (dev bypass) | Positive | `POST /user/login` → `POST /user/verify-otp?env=dev` | Agent phone/password, then `DEFAULT_OTP` | Login: `200`, `otpRequired: true`. Verify: `200`; `token` present; `role === 'Agent'` |
| TC15 | Non-Admin Cannot Activate Another Account | Negative | `PATCH /user/update/:id` | Agent's own token used to PATCH Customer2's record | `403`; message includes "own account" |
| TC16 | Customer1 Login — Request OTP | Positive | `POST /user/login` | Customer1 phone/password | `200`; `otpRequired: true` |
| TC17 | Customer1 Verify OTP — Wrong Code | Negative | `POST /user/verify-otp` | Deliberately wrong 4-digit OTP, no dev bypass | `401`; message includes "Invalid OTP" |
| TC18 | Customer1 Verify OTP — Correct (dev bypass) | Positive | `POST /user/verify-otp?env=dev` | `DEFAULT_OTP` | `200`; `token` present; `role === 'Customer'` |
| TC19 | Customer2 Login + OTP Verify | Positive | `POST /user/login` → `POST /user/verify-otp?env=dev` | Customer2 phone/password, then `DEFAULT_OTP` | `200` on both; `token` present; `role === 'Customer'` |
| TC20 | Merchant Login + OTP Verify | Positive | `POST /user/login` → `POST /user/verify-otp?env=dev` | Merchant phone/password, then `DEFAULT_OTP` | `200` on both; `token` present; `role === 'Merchant'` |

## 04 — Transactions (Deposit → SendMoney → Withdraw → Payment)

| TC ID | Title | Type | Endpoint | Input Summary | Expected Result / Assertions |
|---|---|---|---|---|---|
| TC21 | SYSTEM Login + Deposit 5000 to Agent | Positive | `POST /user/login` → `POST /transaction/deposit` | `system@dmoney.com`/`1234` (no OTP), then `from_account:"SYSTEM", to_account:<agent>, amount:5000` | `201`; **`agentBalance === 5000`** |
| TC22 | SYSTEM Deposit to Customer | Negative | `POST /transaction/deposit` | `from_account:"SYSTEM", to_account:<customer1>` | `400`; message restricts SYSTEM deposits to regular Agent accounts |
| TC23 | Agent Deposits 2000 to Customer1 | Positive | `POST /transaction/deposit` | Agent token, `to_account:<customer1>, amount:2000` | `201`; **`commission === 50`** (2.5% of 2000) |
| TC24 | Agent Deposit to Merchant | Negative | `POST /transaction/deposit` | Agent token, `to_account:<merchant>` | `400`; message restricts deposit recipients to Customer accounts |
| TC25 | Deposit — Missing `X-AUTH-SECRET-KEY` Header | Negative | `POST /transaction/deposit` | Valid Bearer token, secret-key header omitted | `401`; message includes "Secret auth key" |
| TC26 | Customer1 Sends 1000 to Customer2 | Positive | `POST /transaction/sendmoney` | Customer1 token, `to_account:<customer2>, amount:1000` | `201`; **`fee === 5`** (flat SendMoney fee) |
| TC27 | SendMoney to Self | Negative | `POST /transaction/sendmoney` | `from_account === to_account` | `400`; message: "cannot be the same" |
| TC28 | Customer2 Cashes Out 500 from Agent | Positive | `POST /transaction/withdraw` | Customer2 token, `to_account:<agent>, amount:500` | `201`; **`fee === 5`** (1% of 500, floored to 5 tk minimum) |
| TC29 | Customer2 Pays 400 to Merchant | Positive | `POST /transaction/payment` | Customer2 token, `to_account:<merchant>, amount:400` | `201`; **`fee === 5`** (1% of 400 = 4, floored to 5 tk minimum) |
| TC30 | Payment Without Auth Token | Negative | `POST /transaction/payment` | `Authorization` header omitted | `401`; message: "No Token Found!" |

---

### Notes on test design
- **Positive/negative split:** 20 positive, 10 negative — enough negative coverage of auth (missing token, missing partner secret key, wrong password, wrong OTP), authorization (cross-account update), and business-rule validation (invalid role, non-Gmail email, duplicate email, same-account transfer, wrong deposit direction) without duplicating the same failure mode twice.
- **Independent, re-runnable data:** a collection-level pre-request script seeds a unique `runSuffix` (from the current timestamp) once per run, generating unique phone numbers/emails for all test users — so the whole collection can be re-run against the same database without hitting duplicate-user conflicts.
- **OTP automation:** the backend has a built-in dev bypass (`POST /user/verify-otp?env=dev` with `otp` equal to the server's `DEFAULT_OTP` env var) intended for exactly this kind of automated testing — see `controllers/users/user.controller.js: verifyOtp`. Without it, OTP values are only visible in the server console/email and can't be scripted.
