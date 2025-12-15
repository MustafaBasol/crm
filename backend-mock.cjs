const { createServer } = require('http');
const { URL } = require('url');

const readJsonBody = (req) => new Promise((resolve) => {
  let raw = '';
  req.on('data', (chunk) => {
    raw += chunk;
    if (raw.length > 1_000_000) {
      raw = raw.slice(0, 1_000_000);
    }
  });
  req.on('end', () => {
    if (!raw) return resolve({});
    try {
      resolve(JSON.parse(raw));
    } catch {
      resolve({});
    }
  });
});

const json = (res, status, payload, headers = {}) => {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    ...headers,
  });
  res.end(JSON.stringify(payload));
};

const notFound = (res, path) => json(res, 404, { message: `Mock API - Route not found (${path})` });

const CSRF_TOKEN = 'mock-csrf-token';

const mockTenant = {
  id: 'tenant-1',
  name: 'Demo Company',
  slug: 'demo-company',
  companyName: 'Demo Company Ltd.',
  taxNumber: '1234567890',
  website: 'https://demo.com',
  taxOffice: 'Istanbul Tax Office',
  mersisNumber: '1234567890123456',
  kepAddress: 'demo@hs02.kep.tr',
  siretNumber: '12345678901234',
  sirenNumber: '123456789',
  apeCode: '6201Z',
  tvaNumber: 'FR12345678901',
  rcsNumber: 'RCS Paris 123456789',
  steuernummer: '123/456/78901',
  umsatzsteuerID: 'DE123456789',
  handelsregisternummer: 'HRB 12345',
  finanzamt: 'Berlin Mitte',
  einNumber: '12-3456789',
  taxIDNumber: '987-65-4321',
  businessLicense: 'BL123456',
  salesTaxNumber: 'ST987654'
};

const mockUser = {
  id: 'user-1',
  email: 'demo@demo.com',
  firstName: 'Demo',
  lastName: 'User',
  role: 'USER',
  tenantId: mockTenant.id,
  isEmailVerified: true,
  lastLoginAt: new Date().toISOString(),
  lastLoginTimeZone: 'Europe/Istanbul',
  lastLoginUtcOffsetMinutes: 180,
};

const mockToken = 'mock-jwt-token';

const organizations = [
  {
    id: 'org-1',
    name: 'Demo Organization',
    plan: 'PRO',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const organizationMembers = [
  {
    id: 'member-1',
    user: {
      id: mockUser.id,
      firstName: mockUser.firstName,
      lastName: mockUser.lastName,
      email: mockUser.email,
      lastLoginAt: mockUser.lastLoginAt,
      lastLoginTimeZone: mockUser.lastLoginTimeZone,
    },
    role: 'OWNER',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'member-2',
    user: {
      id: 'user-2',
      firstName: 'Ayşe',
      lastName: 'Yılmaz',
      email: 'ayse@example.com',
      lastLoginAt: null,
      lastLoginTimeZone: null,
    },
    role: 'MEMBER',
    createdAt: new Date().toISOString(),
  },
];

const customers = [
  {
    id: 'cust-1',
    name: 'Acme A.Ş.',
    email: 'contact@acme.com',
    phone: '+90 212 000 0000',
    address: 'İstanbul',
    taxNumber: '1234567890',
    company: 'Acme',
    balance: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cust-2',
    name: 'Beta Ltd.',
    email: 'hello@beta.com',
    phone: '+90 216 000 0000',
    address: 'İstanbul',
    taxNumber: '0987654321',
    company: 'Beta',
    balance: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// CRM in-memory store
let crmPipeline = {
  id: 'pl-1',
  name: 'Default Pipeline',
};
let crmStages = [
  { id: 'st-1', name: 'Lead', order: 1, isClosedWon: false, isClosedLost: false },
  { id: 'st-2', name: 'Qualified', order: 2, isClosedWon: false, isClosedLost: false },
  { id: 'st-3', name: 'Proposal', order: 3, isClosedWon: false, isClosedLost: false },
  { id: 'st-4', name: 'Negotiation', order: 4, isClosedWon: false, isClosedLost: false },
  { id: 'st-5', name: 'Won', order: 5, isClosedWon: true, isClosedLost: false },
  { id: 'st-6', name: 'Lost', order: 6, isClosedWon: false, isClosedLost: true },
];
let crmOpportunities = [];

let crmLeads = [
  {
    id: 'lead-1',
    name: 'Acme - İlgili Kişi',
    email: 'lead@acme.com',
    phone: '+90 555 000 0001',
    company: 'Acme A.Ş.',
    status: 'New',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

let crmContacts = [
  {
    id: 'contact-1',
    name: 'Ayşe Yılmaz',
    email: 'ayse@example.com',
    phone: '+90 555 000 0002',
    company: 'Beta Ltd.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

let crmActivities = [
  {
    id: 'activity-1',
    title: 'İlk görüşme planla',
    type: 'Call',
    opportunityId: null,
    dueAt: null,
    completed: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const ensureStageExists = (stageId) => crmStages.some((s) => s.id === stageId);
const randomId = (prefix) => `${prefix}-${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;

const normalizePath = (pathname) => {
  // App dev'de /api ile çağırıyor; mock'ta her iki hali de kabul edelim.
  if (pathname.startsWith('/api/')) return pathname;
  if (pathname === '/api') return '/api';
  // health gibi bazı endpointler /health üzerinden gelebiliyor
  return pathname;
};

const toApiPath = (pathname) => (pathname.startsWith('/api/') ? pathname : `/api${pathname}`);

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = normalizePath(url.pathname);
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  // CSRF token (frontend mutating requests add X-CSRF-Token if captured)
  res.setHeader('X-CSRF-Token', CSRF_TOKEN);
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Health (prefix'siz de gelebiliyor)
  if (path === '/health' || path === '/api/health') {
    return json(res, 200, { status: 'ok', timestamp: new Date().toISOString() });
  }
  if (path === '/health/email' || path === '/api/health/email') {
    return json(res, 200, { provider: 'mock', from: 'no-reply@example.com' });
  }

  // Tenants
  if (path === '/tenants/current' || path === '/api/tenants/current') {
    return json(res, 200, {
      id: mockTenant.id,
      name: mockTenant.name,
      slug: mockTenant.slug,
      subscriptionPlan: 'PRO',
      status: 'active',
      maxUsers: 3,
      effectiveMaxUsers: 3,
    });
  }

  // Auth
  if (path === '/api/auth/login' && req.method === 'POST') {
    return readJsonBody(req).then((body) => {
      const email = typeof body.email === 'string' && body.email.trim() ? body.email.trim() : mockUser.email;
      const user = { ...mockUser, email };
      return json(res, 200, {
        user,
        tenant: {
          id: mockTenant.id,
          name: mockTenant.name,
          slug: mockTenant.slug,
          subscriptionPlan: 'PRO',
          status: 'active',
          maxUsers: 3,
          effectiveMaxUsers: 3,
        },
        token: mockToken,
      });
    });
  }
  if (path === '/api/auth/me' && req.method === 'GET') {
    return json(res, 200, {
      user: mockUser,
      tenant: {
        id: mockTenant.id,
        name: mockTenant.name,
        slug: mockTenant.slug,
        subscriptionPlan: 'PRO',
        status: 'active',
        maxUsers: 3,
        effectiveMaxUsers: 3,
      },
    });
  }
  if ((path === '/api/auth/refresh-token' || path === '/api/auth/refresh') && req.method === 'POST') {
    return json(res, 200, { token: mockToken, expiresIn: '15m' });
  }

  // Organizations
  if (path === '/api/organizations' && req.method === 'GET') {
    return json(res, 200, organizations);
  }
  const orgMembersMatch = path.match(/^\/api\/organizations\/([^/]+)\/members$/);
  if (orgMembersMatch && req.method === 'GET') {
    return json(res, 200, organizationMembers);
  }
  const orgInvitesMatch = path.match(/^\/api\/organizations\/([^/]+)\/invites$/);
  if (orgInvitesMatch && req.method === 'GET') {
    return json(res, 200, []);
  }
  const orgStatsMatch = path.match(/^\/api\/organizations\/([^/]+)\/membership-stats$/);
  if (orgStatsMatch && req.method === 'GET') {
    return json(res, 200, {
      plan: 'PRO',
      currentMembers: organizationMembers.length,
      maxMembers: 3,
      canAddMore: true,
    });
  }

  // Customers
  if (path === '/api/customers' && req.method === 'GET') {
    return json(res, 200, customers);
  }

  // Fiscal periods
  if ((path === '/api/fiscal-periods' || path === '/fiscal-periods') && req.method === 'GET') {
    // UI listelerken array bekliyor
    return json(res, 200, []);
  }

  // Bank accounts
  if ((path === '/api/bank-accounts' || path === '/bank-accounts') && req.method === 'GET') {
    // UI listelerken array bekliyor
    return json(res, 200, []);
  }

  // CRM
  if (path === '/api/crm/pipeline/bootstrap' && req.method === 'POST') {
    if (!crmPipeline) {
      crmPipeline = { id: 'pl-1', name: 'Default Pipeline' };
    }
    if (!Array.isArray(crmStages) || crmStages.length === 0) {
      crmStages = [
        { id: 'st-1', name: 'Lead', order: 1, isClosedWon: false, isClosedLost: false },
      ];
    }
    return json(res, 200, { pipeline: crmPipeline, stages: crmStages });
  }
  if (path === '/api/crm/board' && req.method === 'GET') {
    return json(res, 200, {
      pipeline: crmPipeline,
      stages: crmStages,
      opportunities: crmOpportunities,
    });
  }
  if (path === '/api/crm/opportunities' && req.method === 'POST') {
    return readJsonBody(req).then((body) => {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const accountId = typeof body.accountId === 'string' ? body.accountId : '';
      if (!name || !accountId) {
        return json(res, 400, { message: 'name ve accountId zorunlu' });
      }
      const stageId = typeof body.stageId === 'string' && ensureStageExists(body.stageId)
        ? body.stageId
        : (crmStages[0]?.id || 'st-1');
      const amount = Number(body.amount || 0);
      const currency = typeof body.currency === 'string' ? body.currency : 'TRY';
      const expectedCloseDate = typeof body.expectedCloseDate === 'string' ? body.expectedCloseDate : null;
      const teamUserIds = Array.isArray(body.teamUserIds) ? body.teamUserIds.filter((x) => typeof x === 'string') : [mockUser.id];
      const opp = {
        id: randomId('opp'),
        name,
        amount: Number.isFinite(amount) ? amount : 0,
        currency,
        stageId,
        accountId,
        ownerUserId: mockUser.id,
        expectedCloseDate,
        status: 'open',
        teamUserIds: Array.from(new Set([mockUser.id, ...teamUserIds])),
      };
      crmOpportunities = [opp, ...crmOpportunities];
      return json(res, 200, opp);
    });
  }
  const crmMoveMatch = path.match(/^\/api\/crm\/opportunities\/([^/]+)\/move$/);
  if (crmMoveMatch && req.method === 'POST') {
    const oppId = crmMoveMatch[1];
    return readJsonBody(req).then((body) => {
      const stageId = typeof body.stageId === 'string' ? body.stageId : '';
      if (!stageId || !ensureStageExists(stageId)) {
        return json(res, 400, { message: 'stageId geçersiz' });
      }
      const idx = crmOpportunities.findIndex((o) => o.id === oppId);
      if (idx < 0) return json(res, 404, { message: 'Opportunity bulunamadı' });
      crmOpportunities[idx] = { ...crmOpportunities[idx], stageId };
      return json(res, 200, crmOpportunities[idx]);
    });
  }
  const crmTeamMatch = path.match(/^\/api\/crm\/opportunities\/([^/]+)\/team$/);
  if (crmTeamMatch && req.method === 'POST') {
    const oppId = crmTeamMatch[1];
    return readJsonBody(req).then((body) => {
      const userIds = Array.isArray(body.userIds) ? body.userIds.filter((x) => typeof x === 'string') : [];
      const idx = crmOpportunities.findIndex((o) => o.id === oppId);
      if (idx < 0) return json(res, 404, { message: 'Opportunity bulunamadı' });
      crmOpportunities[idx] = { ...crmOpportunities[idx], teamUserIds: Array.from(new Set([mockUser.id, ...userIds])) };
      return json(res, 200, crmOpportunities[idx]);
    });
  }

  const crmOpportunityMatch = path.match(/^\/api\/crm\/opportunities\/([^/]+)$/);
  if (crmOpportunityMatch && req.method === 'PATCH') {
    const oppId = crmOpportunityMatch[1];
    return readJsonBody(req).then((body) => {
      const idx = crmOpportunities.findIndex((o) => o.id === oppId);
      if (idx < 0) return json(res, 404, { message: 'Opportunity bulunamadı' });

      const next = { ...crmOpportunities[idx] };
      if (typeof body.name === 'string') next.name = body.name.trim();
      if (typeof body.accountId === 'string') next.accountId = body.accountId;
      if (typeof body.currency === 'string') next.currency = body.currency;

      if (typeof body.amount === 'number' || typeof body.amount === 'string') {
        const amount = Number(body.amount);
        next.amount = Number.isFinite(amount) ? amount : next.amount;
      }

      if (typeof body.expectedCloseDate === 'string') next.expectedCloseDate = body.expectedCloseDate;
      if (body.expectedCloseDate === null) next.expectedCloseDate = null;

      crmOpportunities[idx] = next;
      return json(res, 200, next);
    });
  }

  // CRM Leads
  if (path === '/api/crm/leads' && req.method === 'GET') {
    return json(res, 200, Array.isArray(crmLeads) ? crmLeads : []);
  }
  if (path === '/api/crm/leads' && req.method === 'POST') {
    return readJsonBody(req).then((body) => {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name) return json(res, 400, { message: 'name zorunlu' });

      const lead = {
        id: randomId('lead'),
        name,
        email: typeof body.email === 'string' ? body.email.trim() : '',
        phone: typeof body.phone === 'string' ? body.phone.trim() : '',
        company: typeof body.company === 'string' ? body.company.trim() : '',
        status: typeof body.status === 'string' ? body.status.trim() : '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      crmLeads = [lead, ...(Array.isArray(crmLeads) ? crmLeads : [])];
      return json(res, 200, lead);
    });
  }
  const crmLeadMatch = path.match(/^\/api\/crm\/leads\/([^/]+)$/);
  if (crmLeadMatch && req.method === 'PATCH') {
    const id = crmLeadMatch[1];
    return readJsonBody(req).then((body) => {
      const idx = (Array.isArray(crmLeads) ? crmLeads : []).findIndex((x) => x.id === id);
      if (idx < 0) return json(res, 404, { message: 'Lead bulunamadı' });

      const next = { ...crmLeads[idx] };
      if (typeof body.name === 'string') next.name = body.name.trim();
      if (typeof body.email === 'string') next.email = body.email.trim();
      if (typeof body.phone === 'string') next.phone = body.phone.trim();
      if (typeof body.company === 'string') next.company = body.company.trim();
      if (typeof body.status === 'string') next.status = body.status.trim();
      next.updatedAt = new Date().toISOString();

      crmLeads[idx] = next;
      return json(res, 200, next);
    });
  }
  if (crmLeadMatch && req.method === 'DELETE') {
    const id = crmLeadMatch[1];
    const before = Array.isArray(crmLeads) ? crmLeads : [];
    const next = before.filter((x) => x.id !== id);
    if (next.length === before.length) return json(res, 404, { message: 'Lead bulunamadı' });
    crmLeads = next;
    return json(res, 204, {});
  }

  // CRM Contacts
  if (path === '/api/crm/contacts' && req.method === 'GET') {
    return json(res, 200, Array.isArray(crmContacts) ? crmContacts : []);
  }
  if (path === '/api/crm/contacts' && req.method === 'POST') {
    return readJsonBody(req).then((body) => {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name) return json(res, 400, { message: 'name zorunlu' });

      const contact = {
        id: randomId('contact'),
        name,
        email: typeof body.email === 'string' ? body.email.trim() : '',
        phone: typeof body.phone === 'string' ? body.phone.trim() : '',
        company: typeof body.company === 'string' ? body.company.trim() : '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      crmContacts = [contact, ...(Array.isArray(crmContacts) ? crmContacts : [])];
      return json(res, 200, contact);
    });
  }
  const crmContactMatch = path.match(/^\/api\/crm\/contacts\/([^/]+)$/);
  if (crmContactMatch && req.method === 'PATCH') {
    const id = crmContactMatch[1];
    return readJsonBody(req).then((body) => {
      const idx = (Array.isArray(crmContacts) ? crmContacts : []).findIndex((x) => x.id === id);
      if (idx < 0) return json(res, 404, { message: 'Contact bulunamadı' });

      const next = { ...crmContacts[idx] };
      if (typeof body.name === 'string') next.name = body.name.trim();
      if (typeof body.email === 'string') next.email = body.email.trim();
      if (typeof body.phone === 'string') next.phone = body.phone.trim();
      if (typeof body.company === 'string') next.company = body.company.trim();
      next.updatedAt = new Date().toISOString();

      crmContacts[idx] = next;
      return json(res, 200, next);
    });
  }
  if (crmContactMatch && req.method === 'DELETE') {
    const id = crmContactMatch[1];
    const before = Array.isArray(crmContacts) ? crmContacts : [];
    const next = before.filter((x) => x.id !== id);
    if (next.length === before.length) return json(res, 404, { message: 'Contact bulunamadı' });
    crmContacts = next;
    return json(res, 204, {});
  }

  // CRM Activities
  if (path === '/api/crm/activities' && req.method === 'GET') {
    const opportunityId = url.searchParams.get('opportunityId');
    const list = Array.isArray(crmActivities) ? crmActivities : [];
    if (opportunityId) {
      return json(res, 200, list.filter((a) => a.opportunityId === opportunityId));
    }
    return json(res, 200, list);
  }
  if (path === '/api/crm/activities' && req.method === 'POST') {
    return readJsonBody(req).then((body) => {
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      if (!title) return json(res, 400, { message: 'title zorunlu' });

      const activity = {
        id: randomId('activity'),
        title,
        type: typeof body.type === 'string' ? body.type.trim() : '',
        opportunityId: typeof body.opportunityId === 'string' ? body.opportunityId : null,
        dueAt: typeof body.dueAt === 'string' ? body.dueAt : null,
        completed: !!body.completed,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      crmActivities = [activity, ...(Array.isArray(crmActivities) ? crmActivities : [])];
      return json(res, 200, activity);
    });
  }
  const crmActivityMatch = path.match(/^\/api\/crm\/activities\/([^/]+)$/);
  if (crmActivityMatch && req.method === 'PATCH') {
    const id = crmActivityMatch[1];
    return readJsonBody(req).then((body) => {
      const idx = (Array.isArray(crmActivities) ? crmActivities : []).findIndex((x) => x.id === id);
      if (idx < 0) return json(res, 404, { message: 'Activity bulunamadı' });

      const next = { ...crmActivities[idx] };
      if (typeof body.title === 'string') next.title = body.title.trim();
      if (typeof body.type === 'string') next.type = body.type.trim();
      if (typeof body.opportunityId === 'string') next.opportunityId = body.opportunityId;
      if (body.opportunityId === null) next.opportunityId = null;
      if (typeof body.dueAt === 'string') next.dueAt = body.dueAt;
      if (body.dueAt === null) next.dueAt = null;
      if (typeof body.completed === 'boolean') next.completed = body.completed;
      next.updatedAt = new Date().toISOString();

      crmActivities[idx] = next;
      return json(res, 200, next);
    });
  }
  if (crmActivityMatch && req.method === 'DELETE') {
    const id = crmActivityMatch[1];
    const before = Array.isArray(crmActivities) ? crmActivities : [];
    const next = before.filter((x) => x.id !== id);
    if (next.length === before.length) return json(res, 404, { message: 'Activity bulunamadı' });
    crmActivities = next;
    return json(res, 204, {});
  }

  // Generic safe fallbacks for browsing UI
  if (path.startsWith('/api/') && req.method === 'GET') {
    // Return empty list for list-ish resources by default
    const emptyListHints = [
      'invoices',
      'expenses',
      'products',
      'suppliers',
      'bank-accounts',
      'fiscal-periods',
      'sales',
      'reports',
      'notifications',
      'categories',
      'product-categories',
    ];
    if (emptyListHints.some((k) => path.includes(`/${k}`))) {
      return json(res, 200, []);
    }
    return json(res, 200, { ok: true });
  }

  return notFound(res, path);
});

const PORT = Number(process.env.MOCK_PORT || 3002);
server.listen(PORT, () => {
  console.log(`🚀 Mock API server running on http://localhost:${PORT}`);
  console.log('ℹ️  Supports /api/auth/login (any email/password)');
  console.log('ℹ️  Tip: NestJS backend uses 3001 by default; keep ports separate to avoid conflicts.');
});