/**
 * Generates the DMoney API Testing Postman collection (v2.1) and environment file.
 * Run: node scripts/generate-collection.js
 */
const fs = require('fs');
const path = require('path');

const AUTH_HEADERS = {
    none: [],
    admin: [
        { key: 'Authorization', value: 'Bearer {{adminToken}}', type: 'text' },
        { key: 'X-AUTH-SECRET-KEY', value: '{{secretKey}}', type: 'text' }
    ],
    system: [
        { key: 'Authorization', value: 'Bearer {{systemToken}}', type: 'text' },
        { key: 'X-AUTH-SECRET-KEY', value: '{{secretKey}}', type: 'text' }
    ],
    agent: [
        { key: 'Authorization', value: 'Bearer {{agentToken}}', type: 'text' },
        { key: 'X-AUTH-SECRET-KEY', value: '{{secretKey}}', type: 'text' }
    ],
    customer1: [
        { key: 'Authorization', value: 'Bearer {{customer1Token}}', type: 'text' },
        { key: 'X-AUTH-SECRET-KEY', value: '{{secretKey}}', type: 'text' }
    ],
    customer2: [
        { key: 'Authorization', value: 'Bearer {{customer2Token}}', type: 'text' },
        { key: 'X-AUTH-SECRET-KEY', value: '{{secretKey}}', type: 'text' }
    ],
    // Deliberately missing the X-AUTH-SECRET-KEY header (negative test)
    agentMissingSecret: [
        { key: 'Authorization', value: 'Bearer {{agentToken}}', type: 'text' }
    ],
    // Deliberately missing the Authorization header (negative test)
    missingAuthWithSecret: [
        { key: 'X-AUTH-SECRET-KEY', value: '{{secretKey}}', type: 'text' }
    ]
};

function makeUrl(rawPath, query) {
    const url = {
        raw: '{{baseUrl}}' + rawPath + (query ? '?' + query.map(q => `${q.key}=${q.value}`).join('&') : ''),
        host: ['{{baseUrl}}'],
        path: rawPath.replace(/^\//, '').split('/')
    };
    if (query) url.query = query.map(q => ({ key: q.key, value: q.value }));
    return url;
}

function makeRequest({ name, method, urlPath, query, authAs = 'none', body, tests = [], prerequest }) {
    const headers = [...AUTH_HEADERS[authAs]];
    if (body) headers.push({ key: 'Content-Type', value: 'application/json', type: 'text' });

    const item = {
        name,
        request: {
            method,
            header: headers,
            url: makeUrl(urlPath, query)
        },
        response: []
    };

    if (body) {
        item.request.body = { mode: 'raw', raw: JSON.stringify(body, null, 2), options: { raw: { language: 'json' } } };
    }

    const events = [];
    if (prerequest) {
        events.push({ listen: 'prerequest', script: { type: 'text/javascript', exec: prerequest.split('\n') } });
    }
    if (tests.length) {
        events.push({ listen: 'test', script: { type: 'text/javascript', exec: tests.join('\n').split('\n') } });
    }
    if (events.length) item.event = events;

    return item;
}

// ── Collection-level pre-request script: seeds unique run data once per run ──
const collectionPreRequest = `
if (!pm.collectionVariables.get('runSuffix')) {
    const suffix = Date.now().toString().slice(-8);
    pm.collectionVariables.set('runSuffix', suffix);
    pm.collectionVariables.set('password', 'Test@1234');

    pm.collectionVariables.set('customer1Name', 'Test Customer One');
    pm.collectionVariables.set('customer1Email', 'dmoney.cust1.' + suffix + '@gmail.com');
    pm.collectionVariables.set('customer1Phone', '011' + suffix);
    pm.collectionVariables.set('customer1Nid', '1' + suffix);

    pm.collectionVariables.set('customer2Name', 'Test Customer Two');
    pm.collectionVariables.set('customer2Email', 'dmoney.cust2.' + suffix + '@gmail.com');
    pm.collectionVariables.set('customer2Phone', '012' + suffix);
    pm.collectionVariables.set('customer2Nid', '2' + suffix);

    pm.collectionVariables.set('agentName', 'Test Agent One');
    pm.collectionVariables.set('agentEmail', 'dmoney.agent.' + suffix + '@gmail.com');
    pm.collectionVariables.set('agentPhone', '013' + suffix);
    pm.collectionVariables.set('agentNid', '3' + suffix);

    pm.collectionVariables.set('merchantName', 'Test Merchant One');
    pm.collectionVariables.set('merchantEmail', 'dmoney.merch.' + suffix + '@gmail.com');
    pm.collectionVariables.set('merchantPhone', '014' + suffix);
    pm.collectionVariables.set('merchantNid', '4' + suffix);

    pm.collectionVariables.set('dupEmailPhone', '015' + suffix);
    pm.collectionVariables.set('badRolePhone', '016' + suffix);
    pm.collectionVariables.set('badRoleEmail', 'dmoney.badrole.' + suffix + '@gmail.com');
    pm.collectionVariables.set('nonGmailPhone', '017' + suffix);
    pm.collectionVariables.set('nonGmailEmail', 'dmoney.badmail.' + suffix + '@yahoo.com');
}
`.trim();

// ─────────────────────────────────────────────────────────────────────────
// Folder 1 — Registration
// ─────────────────────────────────────────────────────────────────────────
const folderRegistration = {
    name: '01 - User Registration',
    item: [
        makeRequest({
            name: 'TC01 - Register Customer1 (Positive)',
            method: 'POST', urlPath: '/user/register',
            body: { name: '{{customer1Name}}', email: '{{customer1Email}}', password: '{{password}}', phone_number: '{{customer1Phone}}', nid: '{{customer1Nid}}', role: 'Customer' },
            tests: [
                `pm.test("TC01: Register Customer1 returns 201 Created", () => pm.response.to.have.status(201));`,
                `const jsonData = pm.response.json();`,
                `pm.test("TC01: Response contains a user id and status 'pending'", () => {`,
                `    pm.expect(jsonData.user).to.have.property('id');`,
                `    pm.expect(jsonData.user.status).to.eql('pending');`,
                `});`,
                `if (jsonData.user && jsonData.user.id) { pm.collectionVariables.set('customer1Id', jsonData.user.id); }`
            ]
        }),
        makeRequest({
            name: 'TC02 - Register Customer2 (Positive)',
            method: 'POST', urlPath: '/user/register',
            body: { name: '{{customer2Name}}', email: '{{customer2Email}}', password: '{{password}}', phone_number: '{{customer2Phone}}', nid: '{{customer2Nid}}', role: 'Customer' },
            tests: [
                `pm.test("TC02: Register Customer2 returns 201 Created", () => pm.response.to.have.status(201));`,
                `const jsonData = pm.response.json();`,
                `pm.test("TC02: Response contains a user id and status 'pending'", () => {`,
                `    pm.expect(jsonData.user).to.have.property('id');`,
                `    pm.expect(jsonData.user.status).to.eql('pending');`,
                `});`,
                `if (jsonData.user && jsonData.user.id) { pm.collectionVariables.set('customer2Id', jsonData.user.id); }`
            ]
        }),
        makeRequest({
            name: 'TC03 - Register Agent (Positive)',
            method: 'POST', urlPath: '/user/register',
            body: { name: '{{agentName}}', email: '{{agentEmail}}', password: '{{password}}', phone_number: '{{agentPhone}}', nid: '{{agentNid}}', role: 'Agent' },
            tests: [
                `pm.test("TC03: Register Agent returns 201 Created", () => pm.response.to.have.status(201));`,
                `const jsonData = pm.response.json();`,
                `pm.test("TC03: Response contains a user id and status 'pending'", () => {`,
                `    pm.expect(jsonData.user).to.have.property('id');`,
                `    pm.expect(jsonData.user.status).to.eql('pending');`,
                `});`,
                `if (jsonData.user && jsonData.user.id) { pm.collectionVariables.set('agentId', jsonData.user.id); }`
            ]
        }),
        makeRequest({
            name: 'TC04 - Register Merchant (Positive)',
            method: 'POST', urlPath: '/user/register',
            body: { name: '{{merchantName}}', email: '{{merchantEmail}}', password: '{{password}}', phone_number: '{{merchantPhone}}', nid: '{{merchantNid}}', role: 'Merchant' },
            tests: [
                `pm.test("TC04: Register Merchant returns 201 Created", () => pm.response.to.have.status(201));`,
                `const jsonData = pm.response.json();`,
                `pm.test("TC04: Response contains a user id and status 'pending'", () => {`,
                `    pm.expect(jsonData.user).to.have.property('id');`,
                `    pm.expect(jsonData.user.status).to.eql('pending');`,
                `});`,
                `if (jsonData.user && jsonData.user.id) { pm.collectionVariables.set('merchantId', jsonData.user.id); }`
            ]
        }),
        makeRequest({
            name: 'TC05 - Register Duplicate Email (Negative)',
            method: 'POST', urlPath: '/user/register',
            body: { name: 'Duplicate Email User', email: '{{customer1Email}}', password: '{{password}}', phone_number: '{{dupEmailPhone}}', nid: '999999999', role: 'Customer' },
            tests: [
                `pm.test("TC05: Duplicate email registration returns 208", () => pm.response.to.have.status(208));`,
                `pm.test("TC05: Error message reports the email already exists", () => {`,
                `    pm.expect(pm.response.json().message.toLowerCase()).to.include('already exists');`,
                `});`
            ]
        }),
        makeRequest({
            name: 'TC06 - Register Invalid Role (Negative)',
            method: 'POST', urlPath: '/user/register',
            body: { name: 'Bad Role User', email: '{{badRoleEmail}}', password: '{{password}}', phone_number: '{{badRolePhone}}', nid: '888888888', role: 'SuperAdmin' },
            tests: [
                `pm.test("TC06: Registering with an invalid role returns 400", () => pm.response.to.have.status(400));`,
                `pm.test("TC06: Error message lists the allowed roles", () => {`,
                `    pm.expect(pm.response.json().message).to.include('Role must be one of');`,
                `});`
            ]
        }),
        makeRequest({
            name: 'TC07 - Register Non-Gmail Email (Negative)',
            method: 'POST', urlPath: '/user/register',
            body: { name: 'Non Gmail User', email: '{{nonGmailEmail}}', password: '{{password}}', phone_number: '{{nonGmailPhone}}', nid: '777777777', role: 'Customer' },
            tests: [
                `pm.test("TC07: Registering with a non-Gmail email returns 400", () => pm.response.to.have.status(400));`,
                `pm.test("TC07: Error message enforces the Gmail-only rule", () => {`,
                `    pm.expect(pm.response.json().message.toLowerCase()).to.include('gmail');`,
                `});`
            ]
        })
    ]
};

// ─────────────────────────────────────────────────────────────────────────
// Folder 2 — Admin login & activation
// ─────────────────────────────────────────────────────────────────────────
const folderAdmin = {
    name: '02 - Admin Login & User Activation',
    item: [
        makeRequest({
            name: 'TC08 - Admin Login (Positive)',
            method: 'POST', urlPath: '/user/login',
            body: { email: 'admin@dmoney.com', password: '1234' },
            tests: [
                `pm.test("TC08: Admin login returns 200", () => pm.response.to.have.status(200));`,
                `const jsonData = pm.response.json();`,
                `pm.test("TC08: Admin receives a JWT directly (no OTP step)", () => {`,
                `    pm.expect(jsonData).to.have.property('token');`,
                `    pm.expect(jsonData.role).to.eql('Admin');`,
                `});`,
                `pm.collectionVariables.set('adminToken', jsonData.token);`
            ]
        }),
        makeRequest({
            name: 'TC09 - Admin Login Wrong Password (Negative)',
            method: 'POST', urlPath: '/user/login',
            body: { email: 'admin@dmoney.com', password: 'wrongpassword' },
            tests: [
                `pm.test("TC09: Wrong password returns 401", () => pm.response.to.have.status(401));`,
                `pm.test("TC09: Error message indicates incorrect password", () => {`,
                `    pm.expect(pm.response.json().message).to.include('Password incorrect');`,
                `});`
            ]
        }),
        makeRequest({
            name: 'TC10 - Admin Activates Customer1 (Positive)',
            method: 'PATCH', urlPath: '/user/update/{{customer1Id}}', authAs: 'admin',
            body: { status: 'active' },
            tests: [
                `pm.test("TC10: Activating Customer1 returns 200", () => pm.response.to.have.status(200));`,
                `pm.test("TC10: Customer1 status becomes 'active'", () => {`,
                `    pm.expect(pm.response.json().user.status).to.eql('active');`,
                `});`
            ]
        }),
        makeRequest({
            name: 'TC11 - Admin Activates Customer2 (Positive)',
            method: 'PATCH', urlPath: '/user/update/{{customer2Id}}', authAs: 'admin',
            body: { status: 'active' },
            tests: [
                `pm.test("TC11: Activating Customer2 returns 200", () => pm.response.to.have.status(200));`,
                `pm.test("TC11: Customer2 status becomes 'active'", () => {`,
                `    pm.expect(pm.response.json().user.status).to.eql('active');`,
                `});`
            ]
        }),
        makeRequest({
            name: 'TC12 - Admin Activates Agent (Positive)',
            method: 'PATCH', urlPath: '/user/update/{{agentId}}', authAs: 'admin',
            body: { status: 'active' },
            tests: [
                `pm.test("TC12: Activating Agent returns 200", () => pm.response.to.have.status(200));`,
                `pm.test("TC12: Agent status becomes 'active'", () => {`,
                `    pm.expect(pm.response.json().user.status).to.eql('active');`,
                `});`
            ]
        }),
        makeRequest({
            name: 'TC13 - Admin Activates Merchant (Positive)',
            method: 'PATCH', urlPath: '/user/update/{{merchantId}}', authAs: 'admin',
            body: { status: 'active' },
            tests: [
                `pm.test("TC13: Activating Merchant returns 200", () => pm.response.to.have.status(200));`,
                `pm.test("TC13: Merchant status becomes 'active'", () => {`,
                `    pm.expect(pm.response.json().user.status).to.eql('active');`,
                `});`
            ]
        })
    ]
};

// ─────────────────────────────────────────────────────────────────────────
// Folder 3 — Login & OTP verification
// ─────────────────────────────────────────────────────────────────────────
const folderLogin = {
    name: '03 - Login & OTP Verification',
    item: [
        makeRequest({
            name: 'TC14a - Agent Login - Request OTP (Positive)',
            method: 'POST', urlPath: '/user/login',
            body: { phone_number: '{{agentPhone}}', password: '{{password}}' },
            tests: [
                `pm.test("TC14: Agent login returns 200 and requires OTP", () => pm.response.to.have.status(200));`,
                `pm.test("TC14: Response indicates otpRequired = true", () => {`,
                `    pm.expect(pm.response.json().otpRequired).to.eql(true);`,
                `});`
            ]
        }),
        makeRequest({
            name: 'TC14b - Agent Verify OTP - Dev Bypass (Positive)',
            method: 'POST', urlPath: '/user/verify-otp',
            query: [{ key: 'env', value: 'dev' }],
            body: { identifier: '{{agentPhone}}', otp: '{{defaultOtp}}' },
            tests: [
                `pm.test("TC14: Agent OTP verification returns 200", () => pm.response.to.have.status(200));`,
                `const jsonData = pm.response.json();`,
                `pm.test("TC14: JWT issued with role 'Agent'", () => {`,
                `    pm.expect(jsonData).to.have.property('token');`,
                `    pm.expect(jsonData.role).to.eql('Agent');`,
                `});`,
                `pm.collectionVariables.set('agentToken', jsonData.token);`
            ]
        }),
        makeRequest({
            name: 'TC15 - Non-Admin Cannot Activate Another Account (Negative)',
            method: 'PATCH', urlPath: '/user/update/{{customer2Id}}', authAs: 'agent',
            body: { status: 'active' },
            tests: [
                `pm.test("TC15: Agent updating another user's account returns 403", () => pm.response.to.have.status(403));`,
                `pm.test("TC15: Error message denies cross-account access", () => {`,
                `    pm.expect(pm.response.json().message).to.include('own account');`,
                `});`
            ]
        }),
        makeRequest({
            name: 'TC16 - Customer1 Login - Request OTP (Positive)',
            method: 'POST', urlPath: '/user/login',
            body: { phone_number: '{{customer1Phone}}', password: '{{password}}' },
            tests: [
                `pm.test("TC16: Customer1 login returns 200 and requires OTP", () => pm.response.to.have.status(200));`,
                `pm.test("TC16: Response indicates otpRequired = true", () => {`,
                `    pm.expect(pm.response.json().otpRequired).to.eql(true);`,
                `});`
            ]
        }),
        makeRequest({
            name: 'TC17 - Customer1 Verify OTP - Wrong Code (Negative)',
            method: 'POST', urlPath: '/user/verify-otp',
            body: { identifier: '{{customer1Phone}}', otp: '9999' },
            tests: [
                `pm.test("TC17: Wrong OTP returns 401", () => pm.response.to.have.status(401));`,
                `pm.test("TC17: Error message indicates invalid OTP", () => {`,
                `    pm.expect(pm.response.json().message).to.include('Invalid OTP');`,
                `});`
            ]
        }),
        makeRequest({
            name: 'TC18 - Customer1 Verify OTP - Correct / Dev Bypass (Positive)',
            method: 'POST', urlPath: '/user/verify-otp',
            query: [{ key: 'env', value: 'dev' }],
            body: { identifier: '{{customer1Phone}}', otp: '{{defaultOtp}}' },
            tests: [
                `pm.test("TC18: Correct OTP verification returns 200", () => pm.response.to.have.status(200));`,
                `const jsonData = pm.response.json();`,
                `pm.test("TC18: JWT issued with role 'Customer'", () => {`,
                `    pm.expect(jsonData).to.have.property('token');`,
                `    pm.expect(jsonData.role).to.eql('Customer');`,
                `});`,
                `pm.collectionVariables.set('customer1Token', jsonData.token);`
            ]
        }),
        makeRequest({
            name: 'TC19a - Customer2 Login - Request OTP (Positive)',
            method: 'POST', urlPath: '/user/login',
            body: { phone_number: '{{customer2Phone}}', password: '{{password}}' },
            tests: [
                `pm.test("TC19: Customer2 login returns 200 and requires OTP", () => pm.response.to.have.status(200));`,
                `pm.test("TC19: Response indicates otpRequired = true", () => {`,
                `    pm.expect(pm.response.json().otpRequired).to.eql(true);`,
                `});`
            ]
        }),
        makeRequest({
            name: 'TC19b - Customer2 Verify OTP - Dev Bypass (Positive)',
            method: 'POST', urlPath: '/user/verify-otp',
            query: [{ key: 'env', value: 'dev' }],
            body: { identifier: '{{customer2Phone}}', otp: '{{defaultOtp}}' },
            tests: [
                `pm.test("TC19: Customer2 OTP verification returns 200", () => pm.response.to.have.status(200));`,
                `const jsonData = pm.response.json();`,
                `pm.test("TC19: JWT issued with role 'Customer'", () => {`,
                `    pm.expect(jsonData).to.have.property('token');`,
                `    pm.expect(jsonData.role).to.eql('Customer');`,
                `});`,
                `pm.collectionVariables.set('customer2Token', jsonData.token);`
            ]
        }),
        makeRequest({
            name: 'TC20a - Merchant Login - Request OTP (Positive)',
            method: 'POST', urlPath: '/user/login',
            body: { phone_number: '{{merchantPhone}}', password: '{{password}}' },
            tests: [
                `pm.test("TC20: Merchant login returns 200 and requires OTP", () => pm.response.to.have.status(200));`,
                `pm.test("TC20: Response indicates otpRequired = true", () => {`,
                `    pm.expect(pm.response.json().otpRequired).to.eql(true);`,
                `});`
            ]
        }),
        makeRequest({
            name: 'TC20b - Merchant Verify OTP - Dev Bypass (Positive)',
            method: 'POST', urlPath: '/user/verify-otp',
            query: [{ key: 'env', value: 'dev' }],
            body: { identifier: '{{merchantPhone}}', otp: '{{defaultOtp}}' },
            tests: [
                `pm.test("TC20: Merchant OTP verification returns 200", () => pm.response.to.have.status(200));`,
                `const jsonData = pm.response.json();`,
                `pm.test("TC20: JWT issued with role 'Merchant'", () => {`,
                `    pm.expect(jsonData).to.have.property('token');`,
                `    pm.expect(jsonData.role).to.eql('Merchant');`,
                `});`,
                `pm.collectionVariables.set('merchantToken', jsonData.token);`
            ]
        })
    ]
};

// ─────────────────────────────────────────────────────────────────────────
// Folder 4 — Transactions
// ─────────────────────────────────────────────────────────────────────────
const folderTransactions = {
    name: '04 - Transactions (Deposit, SendMoney, Withdraw, Payment)',
    item: [
        makeRequest({
            name: 'TC21a - SYSTEM Login (Positive)',
            method: 'POST', urlPath: '/user/login',
            body: { email: 'system@dmoney.com', password: '1234' },
            tests: [
                `pm.test("TC21: SYSTEM login returns 200", () => pm.response.to.have.status(200));`,
                `const jsonData = pm.response.json();`,
                `pm.test("TC21: SYSTEM receives a JWT directly (no OTP step)", () => {`,
                `    pm.expect(jsonData).to.have.property('token');`,
                `});`,
                `pm.collectionVariables.set('systemToken', jsonData.token);`
            ]
        }),
        makeRequest({
            name: 'TC21b - SYSTEM Deposits 5000 to Agent (Positive)',
            method: 'POST', urlPath: '/transaction/deposit', authAs: 'system',
            body: { from_account: 'SYSTEM', to_account: '{{agentPhone}}', amount: 5000 },
            tests: [
                `pm.test("TC21: SYSTEM to Agent deposit returns 201", () => pm.response.to.have.status(201));`,
                `const jsonData = pm.response.json();`,
                `pm.test("TC21: Agent balance reflects the 5000 tk credit", () => {`,
                `    pm.expect(jsonData.agentBalance).to.eql(5000);`,
                `});`
            ]
        }),
        makeRequest({
            name: 'TC22 - SYSTEM Deposit to Customer (Negative)',
            method: 'POST', urlPath: '/transaction/deposit', authAs: 'system',
            body: { from_account: 'SYSTEM', to_account: '{{customer1Phone}}', amount: 1000 },
            tests: [
                `pm.test("TC22: SYSTEM depositing directly to a Customer returns 400", () => pm.response.to.have.status(400));`,
                `pm.test("TC22: Error message restricts SYSTEM deposits to Agent accounts", () => {`,
                `    pm.expect(pm.response.json().message).to.include('regular Agent');`,
                `});`
            ]
        }),
        makeRequest({
            name: 'TC23 - Agent Deposits 2000 to Customer1 (Positive - assert commission)',
            method: 'POST', urlPath: '/transaction/deposit', authAs: 'agent',
            body: { from_account: '{{agentPhone}}', to_account: '{{customer1Phone}}', amount: 2000 },
            tests: [
                `pm.test("TC23: Agent to Customer1 deposit returns 201", () => pm.response.to.have.status(201));`,
                `const jsonData = pm.response.json();`,
                `pm.test("TC23: Deposit commission equals 50 tk (2.5% of 2000)", () => {`,
                `    pm.expect(jsonData.commission).to.eql(50);`,
                `});`
            ]
        }),
        makeRequest({
            name: 'TC24 - Agent Deposit to Merchant (Negative)',
            method: 'POST', urlPath: '/transaction/deposit', authAs: 'agent',
            body: { from_account: '{{agentPhone}}', to_account: '{{merchantPhone}}', amount: 500 },
            tests: [
                `pm.test("TC24: Agent depositing to a Merchant returns 400", () => pm.response.to.have.status(400));`,
                `pm.test("TC24: Error message restricts deposit recipients to Customer accounts", () => {`,
                `    pm.expect(pm.response.json().message).to.include('Customer');`,
                `});`
            ]
        }),
        makeRequest({
            name: 'TC25 - Deposit Missing X-AUTH-SECRET-KEY Header (Negative)',
            method: 'POST', urlPath: '/transaction/deposit', authAs: 'agentMissingSecret',
            body: { from_account: '{{agentPhone}}', to_account: '{{customer1Phone}}', amount: 100 },
            tests: [
                `pm.test("TC25: Missing partner secret key header returns 401", () => pm.response.to.have.status(401));`,
                `pm.test("TC25: Error message reports secret key validation failure", () => {`,
                `    pm.expect(pm.response.json().message).to.include('Secret auth key');`,
                `});`
            ]
        }),
        makeRequest({
            name: 'TC26 - Customer1 Sends 1000 to Customer2 (Positive - assert service fee)',
            method: 'POST', urlPath: '/transaction/sendmoney', authAs: 'customer1',
            body: { from_account: '{{customer1Phone}}', to_account: '{{customer2Phone}}', amount: 1000 },
            tests: [
                `pm.test("TC26: SendMoney Customer1 -> Customer2 returns 201", () => pm.response.to.have.status(201));`,
                `const jsonData = pm.response.json();`,
                `pm.test("TC26: Service fee equals the flat 5 tk SendMoney fee", () => {`,
                `    pm.expect(jsonData.fee).to.eql(5);`,
                `});`
            ]
        }),
        makeRequest({
            name: 'TC27 - SendMoney To Self (Negative)',
            method: 'POST', urlPath: '/transaction/sendmoney', authAs: 'customer1',
            body: { from_account: '{{customer1Phone}}', to_account: '{{customer1Phone}}', amount: 100 },
            tests: [
                `pm.test("TC27: Sending money to the same account returns 400", () => pm.response.to.have.status(400));`,
                `pm.test("TC27: Error message forbids same from/to account", () => {`,
                `    pm.expect(pm.response.json().message).to.include('cannot be the same');`,
                `});`
            ]
        }),
        makeRequest({
            name: 'TC28 - Customer2 Cashout 500 from Agent (Positive - assert service fee)',
            method: 'POST', urlPath: '/transaction/withdraw', authAs: 'customer2',
            body: { from_account: '{{customer2Phone}}', to_account: '{{agentPhone}}', amount: 500 },
            tests: [
                `pm.test("TC28: Withdraw Customer2 from Agent returns 201", () => pm.response.to.have.status(201));`,
                `const jsonData = pm.response.json();`,
                `pm.test("TC28: Withdraw service fee equals 5 tk (1% floored to the 5 tk minimum)", () => {`,
                `    pm.expect(jsonData.fee).to.eql(5);`,
                `});`
            ]
        }),
        makeRequest({
            name: 'TC29 - Customer2 Pays 400 to Merchant (Positive - assert service fee)',
            method: 'POST', urlPath: '/transaction/payment', authAs: 'customer2',
            body: { from_account: '{{customer2Phone}}', to_account: '{{merchantPhone}}', amount: 400 },
            tests: [
                `pm.test("TC29: Payment Customer2 -> Merchant returns 201", () => pm.response.to.have.status(201));`,
                `const jsonData = pm.response.json();`,
                `pm.test("TC29: Payment service fee equals 5 tk (1% floored to the 5 tk minimum)", () => {`,
                `    pm.expect(jsonData.fee).to.eql(5);`,
                `});`
            ]
        }),
        makeRequest({
            name: 'TC30 - Payment Without Auth Token (Negative)',
            method: 'POST', urlPath: '/transaction/payment', authAs: 'missingAuthWithSecret',
            body: { from_account: '{{customer2Phone}}', to_account: '{{merchantPhone}}', amount: 100 },
            tests: [
                `pm.test("TC30: Payment without an Authorization header returns 401", () => pm.response.to.have.status(401));`,
                `pm.test("TC30: Error message reports no token found", () => {`,
                `    pm.expect(pm.response.json().message).to.include('No Token Found');`,
                `});`
            ]
        })
    ]
};

const collection = {
    info: {
        name: 'DMoney API Testing - Assignment 2 (Batch 19)',
        description: 'Postman collection covering user registration, admin activation, login/OTP, and the full deposit -> sendmoney -> withdraw -> payment ledger flow for the DMoney Mobile Financial Service API. Generated for API Testing Assignment 2.',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        _postman_id: 'dmoney-api-testing-assignment2'
    },
    event: [
        { listen: 'prerequest', script: { type: 'text/javascript', exec: collectionPreRequest.split('\n') } }
    ],
    variable: [
        { key: 'runSuffix', value: '' },
        { key: 'password', value: '' },
        { key: 'customer1Name', value: '' }, { key: 'customer1Email', value: '' }, { key: 'customer1Phone', value: '' }, { key: 'customer1Nid', value: '' }, { key: 'customer1Id', value: '' }, { key: 'customer1Token', value: '' },
        { key: 'customer2Name', value: '' }, { key: 'customer2Email', value: '' }, { key: 'customer2Phone', value: '' }, { key: 'customer2Nid', value: '' }, { key: 'customer2Id', value: '' }, { key: 'customer2Token', value: '' },
        { key: 'agentName', value: '' }, { key: 'agentEmail', value: '' }, { key: 'agentPhone', value: '' }, { key: 'agentNid', value: '' }, { key: 'agentId', value: '' }, { key: 'agentToken', value: '' },
        { key: 'merchantName', value: '' }, { key: 'merchantEmail', value: '' }, { key: 'merchantPhone', value: '' }, { key: 'merchantNid', value: '' }, { key: 'merchantId', value: '' }, { key: 'merchantToken', value: '' },
        { key: 'dupEmailPhone', value: '' }, { key: 'badRolePhone', value: '' }, { key: 'badRoleEmail', value: '' }, { key: 'nonGmailPhone', value: '' }, { key: 'nonGmailEmail', value: '' },
        { key: 'adminToken', value: '' }, { key: 'systemToken', value: '' }
    ],
    item: [folderRegistration, folderAdmin, folderLogin, folderTransactions]
};

const environment = {
    id: 'dmoney-local-env',
    name: 'DMoney - Local',
    values: [
        { key: 'baseUrl', value: 'http://localhost:5000', enabled: true },
        { key: 'secretKey', value: 'ROADTOSDET', enabled: true },
        { key: 'defaultOtp', value: '0000', enabled: true }
    ],
    _postman_variable_scope: 'environment'
};

const outDir = path.join(__dirname, '..', 'postman');
fs.writeFileSync(path.join(outDir, 'DMoney-API-Testing.postman_collection.json'), JSON.stringify(collection, null, 2));
fs.writeFileSync(path.join(outDir, 'DMoney-Local.postman_environment.json'), JSON.stringify(environment, null, 2));
console.log('Collection and environment written to', outDir);
