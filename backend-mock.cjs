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
    accountId: 'cust-1',
    dueAt: null,
    completed: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

let crmTasks = [
  {
    id: 'task-1',
    title: 'Sözleşme taslağı gönder',
    opportunityId: null,
    accountId: 'cust-1',
    dueAt: null,
    completed: false,
    assigneeUserId: 'user-2',
    createdByUserId: mockUser.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'task-2',
    title: 'Teklif revizyonu için takip',
    opportunityId: null,
    accountId: 'cust-2',
    dueAt: null,
    completed: false,
    assigneeUserId: null,
    createdByUserId: mockUser.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// CRM automation (stage change -> create task)
let crmAutomationStageTaskRules = [
  {
    id: 'rule-1',
    tenantId: mockTenant.id,
    enabled: false,
    fromStageId: null,
    toStageId: 'st-2',
    titleTemplate: 'Auto task: {{toStage}}',
    dueInDays: 2,
    assigneeTarget: 'owner',
    assigneeUserId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// CRM automation (stale deal reminder -> create task)
let crmAutomationStaleDealRules = [
  {
    id: 'stale-rule-1',
    tenantId: mockTenant.id,
    enabled: false,
    staleDays: 30,
    stageId: null,
    titleTemplate: 'Stale task: {{opportunityName}}',
    dueInDays: 0,
    assigneeTarget: 'owner',
    assigneeUserId: null,
    cooldownDays: 7,
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

  // CRM Reports (mock)
  if (path === '/api/crm/reports/pipeline-health' && req.method === 'GET') {
    const url = new URL(req.url, 'http://localhost');
    const staleDaysRaw = url.searchParams.get('staleDays');
    const staleDays = Math.max(1, Math.min(3650, Math.floor(Number(staleDaysRaw || 30) || 30)));
    const now = Date.now();
    const staleBefore = now - staleDays * 24 * 60 * 60 * 1000;

    const stageNameById = new Map((crmStages || []).map((s) => [s.id, s.name]));
    const byStageMap = new Map();
    const totalsByCurrency = {};

    for (const opp of crmOpportunities || []) {
      if (String(opp.status || 'open') !== 'open') continue;
      const stageId = String(opp.stageId || '').trim();
      const stageName = stageNameById.get(stageId) || stageId;
      const updatedAt = opp.updatedAt ? new Date(opp.updatedAt).getTime() : now;
      const currency = String(opp.currency || 'TRY').toUpperCase();
      const amount = Number(opp.amount) || 0;
      totalsByCurrency[currency] = (totalsByCurrency[currency] || 0) + amount;

      const row = byStageMap.get(stageId) || {
        stageId,
        stageName,
        count: 0,
        totalsByCurrency: {},
        avgAgeDays: 0,
        staleCount: 0,
      };
      row.count += 1;
      row.totalsByCurrency[currency] = (row.totalsByCurrency[currency] || 0) + amount;
      row.avgAgeDays += (now - updatedAt) / (1000 * 60 * 60 * 24);
      if (updatedAt < staleBefore) row.staleCount += 1;
      byStageMap.set(stageId, row);
    }

    const byStage = Array.from(byStageMap.values()).map((r) => ({
      ...r,
      avgAgeDays: r.count > 0 ? Math.round((r.avgAgeDays / r.count) * 10) / 10 : 0,
    }));

    const staleDealsCount = (crmOpportunities || []).filter((o) => {
      if (String(o.status || 'open') !== 'open') return false;
      const updatedAt = o.updatedAt ? new Date(o.updatedAt).getTime() : now;
      return updatedAt < staleBefore;
    }).length;

    return json(res, 200, {
      staleDays,
      openCount: (crmOpportunities || []).filter((o) => String(o.status || 'open') === 'open').length,
      totalsByCurrency,
      byStage,
      staleDealsCount,
      winRate: null,
      winRateBreakdown: { byOwner: [], byTeamMember: [], byStage: [] },
      winRateRange: { start: null, end: null },
    });
  }

  if (path === '/api/crm/reports/funnel' && req.method === 'GET') {
    const url = new URL(req.url, 'http://localhost');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const stageTransitions = {
      range: { start: startDate || null, end: endDate || null },
      avgDaysInStage: [],
      transitions: [],
    };

    const won = (crmOpportunities || []).filter((o) => String(o.status || 'open') === 'won').length;
    const lost = (crmOpportunities || []).filter((o) => String(o.status || 'open') === 'lost').length;
    const opportunities = (crmOpportunities || []).length;
    const closed = won + lost;

    return json(res, 200, {
      range: { start: null, end: null },
      counts: { leads: (crmLeads || []).length, contacts: (crmContacts || []).length, opportunities, won, lost },
      rates: { contactPerLead: null, opportunityPerContact: null, winRate: closed > 0 ? won / closed : null },
      stageTransitions,
    });
  }

  if (path === '/api/crm/reports/forecast' && req.method === 'GET') {
    const url = new URL(req.url, 'http://localhost');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const now = new Date();

    const parseDate = (v) => {
      if (!v) return null;
      const d = new Date(String(v));
      return Number.isFinite(d.getTime()) ? d : null;
    };

    const rangeStart = parseDate(startDate) || now;
    const rangeEnd = parseDate(endDate) || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const startOfDay = (date) => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      return d;
    };
    const startOfWeekMonday = (date) => {
      const d = startOfDay(date);
      const day = d.getDay();
      const diff = (day === 0 ? -6 : 1 - day);
      d.setDate(d.getDate() + diff);
      return d;
    };
    const bucketKey = (date, bucket) => {
      const base = bucket === 'week' ? startOfWeekMonday(date) : startOfDay(date);
      return base.toISOString().slice(0, 10);
    };

    const openStages = (crmStages || []).filter((s) => !s.isClosedWon && !s.isClosedLost).sort((a, b) => (a.order || 0) - (b.order || 0));
    const stageProb = new Map();
    if (openStages.length > 0) {
      const n = openStages.length;
      for (let i = 0; i < n; i += 1) stageProb.set(openStages[i].id, (i + 1) / (n + 1));
    }

    const totalsByCurrency = {};
    const byBucket = {};

    for (const opp of crmOpportunities || []) {
      if (String(opp.status || 'open') !== 'open') continue;
      if (!opp.expectedCloseDate) continue;
      const expectedCloseDate = new Date(opp.expectedCloseDate);
      if (!Number.isFinite(expectedCloseDate.getTime())) continue;
      if (expectedCloseDate < rangeStart || expectedCloseDate > rangeEnd) continue;

      const currency = String(opp.currency || 'TRY').trim().toUpperCase() || 'TRY';
      const amount = Number(opp.amount) || 0;
      const probRaw = typeof opp.probability === 'number' ? opp.probability : null;
      const stageBased = stageProb.get(String(opp.stageId || ''));
      const prob = (probRaw != null && Number.isFinite(probRaw)) ? Math.max(0, Math.min(1, probRaw)) : (stageBased != null ? stageBased : 0);
      const weighted = amount * prob;

      totalsByCurrency[currency] = totalsByCurrency[currency] || { raw: 0, weighted: 0, count: 0 };
      totalsByCurrency[currency].raw += amount;
      totalsByCurrency[currency].weighted += weighted;
      totalsByCurrency[currency].count += 1;

      const bucket = bucketKey(expectedCloseDate, 'week');
      byBucket[bucket] = byBucket[bucket] || {};
      byBucket[bucket][currency] = byBucket[bucket][currency] || { raw: 0, weighted: 0, count: 0 };
      byBucket[bucket][currency].raw += amount;
      byBucket[bucket][currency].weighted += weighted;
      byBucket[bucket][currency].count += 1;
    }

    const bucketKeys = Object.keys(byBucket).sort();
    return json(res, 200, {
      range: { start: rangeStart.toISOString(), end: rangeEnd.toISOString() },
      totalsByCurrency,
      byWeek: bucketKeys.map((week) => ({ week, totalsByCurrency: byBucket[week] })),
    });
  }

  if (path === '/api/crm/reports/activity' && req.method === 'GET') {
    const url = new URL(req.url, 'http://localhost');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const bucket = url.searchParams.get('bucket') === 'day' ? 'day' : 'week';
    const now = new Date();
    const parseDate = (v) => {
      if (!v) return null;
      const d = new Date(String(v));
      return Number.isFinite(d.getTime()) ? d : null;
    };
    const rangeStart = parseDate(startDate) || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const rangeEnd = parseDate(endDate) || now;

    const startOfDay = (date) => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      return d;
    };
    const startOfWeekMonday = (date) => {
      const d = startOfDay(date);
      const day = d.getDay();
      const diff = (day === 0 ? -6 : 1 - day);
      d.setDate(d.getDate() + diff);
      return d;
    };
    const bucketKey = (date, bucketName) => {
      const base = bucketName === 'week' ? startOfWeekMonday(date) : startOfDay(date);
      return base.toISOString().slice(0, 10);
    };

    const totalsByUser = {};
    const series = {};

    for (const a of (crmActivities || [])) {
      const createdAt = new Date(a.createdAt || a.updatedAt || now.toISOString());
      if (!Number.isFinite(createdAt.getTime())) continue;
      if (createdAt < rangeStart || createdAt > rangeEnd) continue;
      const userId = String(a.createdByUserId || mockUser.id);

      totalsByUser[userId] = totalsByUser[userId] || { activities: 0, tasksCreated: 0, tasksCompleted: 0 };
      totalsByUser[userId].activities += 1;

      const k = bucketKey(createdAt, bucket);
      series[k] = series[k] || { activities: 0, tasksCreated: 0, tasksCompleted: 0 };
      series[k].activities += 1;
    }

    for (const t of (crmTasks || [])) {
      const createdAt = new Date(t.createdAt || t.updatedAt || now.toISOString());
      if (!Number.isFinite(createdAt.getTime())) continue;
      if (createdAt < rangeStart || createdAt > rangeEnd) continue;
      const userId = String(t.createdByUserId || t.assigneeUserId || mockUser.id);
      const completed = Boolean(t.completed);

      totalsByUser[userId] = totalsByUser[userId] || { activities: 0, tasksCreated: 0, tasksCompleted: 0 };
      totalsByUser[userId].tasksCreated += 1;
      if (completed) totalsByUser[userId].tasksCompleted += 1;

      const k = bucketKey(createdAt, bucket);
      series[k] = series[k] || { activities: 0, tasksCreated: 0, tasksCompleted: 0 };
      series[k].tasksCreated += 1;
      if (completed) series[k].tasksCompleted += 1;
    }

    const seriesKeys = Object.keys(series).sort();
    return json(res, 200, {
      range: { start: rangeStart.toISOString(), end: rangeEnd.toISOString() },
      bucket,
      totalsByUser,
      series: seriesKeys.map((k) => ({ bucketStart: k, ...series[k] })),
    });
  }

  if (path === '/api/crm/reports/pipeline-health/export-csv' && req.method === 'GET') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="crm_pipeline_health_mock.csv"');
    return res.end('\uFEFFStage,Count,Avg Age (days),Stale Count,Totals By Currency (JSON)\nLead,0,0,0,{}');
  }

  if (path === '/api/crm/reports/funnel/export-csv' && req.method === 'GET') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="crm_funnel_mock.csv"');
    return res.end(
      '\uFEFFSection,Key,Value,Extra\nCounts,Leads,0,\nCounts,Contacts,0,\nCounts,Opportunities,0,\nCounts,Won,0,\nCounts,Lost,0,\nRates,Win Rate,,',
    );
  }

  if (path === '/api/crm/reports/forecast/export-csv' && req.method === 'GET') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="crm_forecast_mock.csv"');
    return res.end('\uFEFFWeek,Currency,Raw,Weighted,Count\n');
  }

  if (path === '/api/crm/reports/activity/export-csv' && req.method === 'GET') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="crm_activity_mock.csv"');
    return res.end('\uFEFFBucketStart,Activities,TasksCreated,TasksCompleted\n');
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
      const probability = (typeof body.probability === 'number' || typeof body.probability === 'string')
        ? Number(body.probability)
        : null;
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
        probability: (probability != null && Number.isFinite(probability)) ? Math.max(0, Math.min(1, probability)) : null,
        status: 'open',
        teamUserIds: Array.from(new Set([mockUser.id, ...teamUserIds])),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      crmOpportunities = [opp, ...crmOpportunities];
      return json(res, 200, opp);
    });
  }

  // CRM Automation - stage task rules
  if (path === '/api/crm/automation/stage-task-rules' && req.method === 'GET') {
    return json(res, 200, Array.isArray(crmAutomationStageTaskRules) ? crmAutomationStageTaskRules : []);
  }
  if (path === '/api/crm/automation/stage-task-rules' && req.method === 'POST') {
    return readJsonBody(req).then((body) => {
      const toStageId = typeof body.toStageId === 'string' ? body.toStageId.trim() : '';
      if (!toStageId || !ensureStageExists(toStageId)) {
        return json(res, 400, { message: 'toStageId geçersiz' });
      }

      const fromStageId = typeof body.fromStageId === 'string' ? body.fromStageId.trim() : null;
      if (fromStageId && !ensureStageExists(fromStageId)) {
        return json(res, 400, { message: 'fromStageId geçersiz' });
      }

      const enabled = typeof body.enabled === 'boolean' ? body.enabled : true;
      const titleTemplate = typeof body.titleTemplate === 'string' && body.titleTemplate.trim()
        ? body.titleTemplate.trim()
        : 'Auto task: {{toStage}}';

      const dueInDaysRaw = (typeof body.dueInDays === 'number' || typeof body.dueInDays === 'string')
        ? Number(body.dueInDays)
        : 0;
      const dueInDays = Number.isFinite(dueInDaysRaw) ? Math.max(0, Math.min(3650, Math.floor(dueInDaysRaw))) : 0;

      const assigneeTargetRaw = typeof body.assigneeTarget === 'string' ? body.assigneeTarget : 'owner';
      const assigneeTarget = ['owner', 'mover', 'specific'].includes(assigneeTargetRaw) ? assigneeTargetRaw : 'owner';
      const assigneeUserId = typeof body.assigneeUserId === 'string' ? body.assigneeUserId : null;
      if (assigneeTarget === 'specific' && !assigneeUserId) {
        return json(res, 400, { message: 'assigneeTarget=specific için assigneeUserId zorunlu' });
      }

      const rule = {
        id: randomId('rule'),
        tenantId: mockTenant.id,
        enabled,
        fromStageId: fromStageId || null,
        toStageId,
        titleTemplate,
        dueInDays,
        assigneeTarget,
        assigneeUserId: assigneeUserId || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      crmAutomationStageTaskRules = [rule, ...(Array.isArray(crmAutomationStageTaskRules) ? crmAutomationStageTaskRules : [])];
      return json(res, 200, rule);
    });
  }
  const crmAutomationRuleMatch = path.match(/^\/api\/crm\/automation\/stage-task-rules\/([^/]+)$/);
  if (crmAutomationRuleMatch && req.method === 'PATCH') {
    const id = crmAutomationRuleMatch[1];
    return readJsonBody(req).then((body) => {
      const list = Array.isArray(crmAutomationStageTaskRules) ? crmAutomationStageTaskRules : [];
      const idx = list.findIndex((r) => r.id === id);
      if (idx < 0) return json(res, 404, { message: 'Rule bulunamadı' });

      const next = { ...list[idx] };
      if (typeof body.enabled === 'boolean') next.enabled = body.enabled;

      if (typeof body.toStageId === 'string') {
        const v = body.toStageId.trim();
        if (!v || !ensureStageExists(v)) return json(res, 400, { message: 'toStageId geçersiz' });
        next.toStageId = v;
      }

      if (typeof body.fromStageId === 'string') {
        const v = body.fromStageId.trim();
        if (!v || !ensureStageExists(v)) return json(res, 400, { message: 'fromStageId geçersiz' });
        next.fromStageId = v;
      }
      if (body.fromStageId === null) next.fromStageId = null;

      if (typeof body.titleTemplate === 'string' && body.titleTemplate.trim()) {
        next.titleTemplate = body.titleTemplate.trim();
      }

      if (typeof body.dueInDays === 'number' || typeof body.dueInDays === 'string') {
        const v = Number(body.dueInDays);
        if (!Number.isFinite(v)) return json(res, 400, { message: 'dueInDays geçersiz' });
        next.dueInDays = Math.max(0, Math.min(3650, Math.floor(v)));
      }

      if (typeof body.assigneeTarget === 'string') {
        const v = body.assigneeTarget;
        if (!['owner', 'mover', 'specific'].includes(v)) return json(res, 400, { message: 'assigneeTarget geçersiz' });
        next.assigneeTarget = v;
      }

      if (typeof body.assigneeUserId === 'string') next.assigneeUserId = body.assigneeUserId;
      if (body.assigneeUserId === null) next.assigneeUserId = null;
      if (next.assigneeTarget === 'specific' && !next.assigneeUserId) {
        return json(res, 400, { message: 'assigneeTarget=specific için assigneeUserId zorunlu' });
      }

      next.updatedAt = new Date().toISOString();
      crmAutomationStageTaskRules[idx] = next;
      return json(res, 200, next);
    });
  }

  // CRM Automation - stale deal rules
  if (path === '/api/crm/automation/stale-deal-rules' && req.method === 'GET') {
    const rules = Array.isArray(crmAutomationStaleDealRules) ? crmAutomationStaleDealRules : [];
    return json(res, 200, { items: rules });
  }

  if (path === '/api/crm/automation/stale-deal-rules' && req.method === 'POST') {
    return readJsonBody(req).then((body) => {
      const enabled = typeof body.enabled === 'boolean' ? body.enabled : true;

      const staleDaysRaw = (typeof body.staleDays === 'number' || typeof body.staleDays === 'string')
        ? Number(body.staleDays)
        : 30;
      const staleDays = Number.isFinite(staleDaysRaw) ? Math.max(0, Math.min(3650, Math.floor(staleDaysRaw))) : 30;

      const stageId = typeof body.stageId === 'string' && body.stageId.trim() ? body.stageId.trim() : null;
      if (stageId && !ensureStageExists(stageId)) {
        return json(res, 400, { message: 'stageId geçersiz' });
      }

      const titleTemplate = typeof body.titleTemplate === 'string' && body.titleTemplate.trim()
        ? body.titleTemplate.trim()
        : 'Stale task: {{opportunityName}}';

      const dueInDaysRaw = (typeof body.dueInDays === 'number' || typeof body.dueInDays === 'string')
        ? Number(body.dueInDays)
        : 0;
      const dueInDays = Number.isFinite(dueInDaysRaw) ? Math.max(0, Math.min(3650, Math.floor(dueInDaysRaw))) : 0;

      const cooldownDaysRaw = (typeof body.cooldownDays === 'number' || typeof body.cooldownDays === 'string')
        ? Number(body.cooldownDays)
        : 7;
      const cooldownDays = Number.isFinite(cooldownDaysRaw) ? Math.max(0, Math.min(3650, Math.floor(cooldownDaysRaw))) : 7;

      const assigneeTargetRaw = typeof body.assigneeTarget === 'string' ? body.assigneeTarget : 'owner';
      const assigneeTarget = ['owner', 'mover', 'specific'].includes(assigneeTargetRaw) ? assigneeTargetRaw : 'owner';
      const assigneeUserId = typeof body.assigneeUserId === 'string' ? body.assigneeUserId : null;
      if (assigneeTarget === 'specific' && !assigneeUserId) {
        return json(res, 400, { message: 'assigneeTarget=specific için assigneeUserId zorunlu' });
      }

      const rule = {
        id: randomId('stale-rule'),
        tenantId: mockTenant.id,
        enabled,
        staleDays,
        stageId,
        titleTemplate,
        dueInDays,
        assigneeTarget,
        assigneeUserId: assigneeTarget === 'specific' ? (assigneeUserId || null) : null,
        cooldownDays,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      crmAutomationStaleDealRules = [rule, ...(Array.isArray(crmAutomationStaleDealRules) ? crmAutomationStaleDealRules : [])];
      return json(res, 200, rule);
    });
  }

  const crmStaleRuleMatch = path.match(/^\/api\/crm\/automation\/stale-deal-rules\/([^/]+)$/);
  if (crmStaleRuleMatch && req.method === 'PATCH') {
    const id = crmStaleRuleMatch[1];
    return readJsonBody(req).then((body) => {
      const list = Array.isArray(crmAutomationStaleDealRules) ? crmAutomationStaleDealRules : [];
      const idx = list.findIndex((r) => r.id === id);
      if (idx < 0) return json(res, 404, { message: 'Rule bulunamadı' });

      const next = { ...list[idx] };
      if (typeof body.enabled === 'boolean') next.enabled = body.enabled;

      if (typeof body.staleDays === 'number' || typeof body.staleDays === 'string') {
        const v = Number(body.staleDays);
        if (!Number.isFinite(v)) return json(res, 400, { message: 'staleDays geçersiz' });
        next.staleDays = Math.max(0, Math.min(3650, Math.floor(v)));
      }

      if ('stageId' in body) {
        if (typeof body.stageId === 'string' && body.stageId.trim()) {
          const v = body.stageId.trim();
          if (!ensureStageExists(v)) return json(res, 400, { message: 'stageId geçersiz' });
          next.stageId = v;
        } else if (body.stageId === null) {
          next.stageId = null;
        }
      }

      if (typeof body.titleTemplate === 'string' && body.titleTemplate.trim()) {
        next.titleTemplate = body.titleTemplate.trim();
      }

      if (typeof body.dueInDays === 'number' || typeof body.dueInDays === 'string') {
        const v = Number(body.dueInDays);
        if (!Number.isFinite(v)) return json(res, 400, { message: 'dueInDays geçersiz' });
        next.dueInDays = Math.max(0, Math.min(3650, Math.floor(v)));
      }

      if (typeof body.cooldownDays === 'number' || typeof body.cooldownDays === 'string') {
        const v = Number(body.cooldownDays);
        if (!Number.isFinite(v)) return json(res, 400, { message: 'cooldownDays geçersiz' });
        next.cooldownDays = Math.max(0, Math.min(3650, Math.floor(v)));
      }

      if (typeof body.assigneeTarget === 'string') {
        const v = body.assigneeTarget;
        if (!['owner', 'mover', 'specific'].includes(v)) return json(res, 400, { message: 'assigneeTarget geçersiz' });
        next.assigneeTarget = v;
      }

      if (typeof body.assigneeUserId === 'string') next.assigneeUserId = body.assigneeUserId;
      if (body.assigneeUserId === null) next.assigneeUserId = null;
      if (next.assigneeTarget === 'specific' && !next.assigneeUserId) {
        return json(res, 400, { message: 'assigneeTarget=specific için assigneeUserId zorunlu' });
      }
      if (next.assigneeTarget !== 'specific') next.assigneeUserId = null;

      next.updatedAt = new Date().toISOString();
      crmAutomationStaleDealRules[idx] = next;
      return json(res, 200, next);
    });
  }

  if (path === '/api/crm/automation/run/stale-deals' && req.method === 'POST') {
    const rules = (Array.isArray(crmAutomationStaleDealRules) ? crmAutomationStaleDealRules : []).filter((r) => r && r.enabled === true);
    const now = Date.now();

    let scannedOpportunities = 0;
    let createdTasks = 0;

    for (const rule of rules) {
      const staleDays = Math.max(0, Math.min(3650, Math.floor(Number(rule.staleDays || 30))));
      const staleBefore = now - staleDays * 24 * 60 * 60 * 1000;

      const matches = (crmOpportunities || []).filter((o) => {
        if (!o || String(o.status || 'open') !== 'open') return false;
        if (rule.stageId && String(o.stageId) !== String(rule.stageId)) return false;
        const updatedAt = o.updatedAt ? new Date(o.updatedAt).getTime() : now;
        return updatedAt < staleBefore;
      });

      scannedOpportunities += matches.length;

      for (const opp of matches) {
        const cooldownDays = Math.max(0, Math.min(3650, Math.floor(Number(rule.cooldownDays || 7))));
        const cooldownCutoff = now - cooldownDays * 24 * 60 * 60 * 1000;
        const already = (crmTasks || []).some((t) => {
          if (!t) return false;
          if (String(t.opportunityId || '') !== String(opp.id)) return false;
          if (String(t.source || '') !== 'automation_stale_deal') return false;
          if (String(t.sourceRuleId || '') !== String(rule.id)) return false;
          const createdAt = t.createdAt ? new Date(t.createdAt).getTime() : 0;
          return createdAt >= cooldownCutoff;
        });
        if (already) continue;

        const title = String(rule.titleTemplate || 'Stale task: {{opportunityName}}')
          .replaceAll('{{opportunityName}}', String(opp.name || ''))
          .slice(0, 220);

        const dueAt = rule.dueInDays > 0
          ? new Date(Date.now() + Number(rule.dueInDays) * 24 * 60 * 60 * 1000).toISOString()
          : null;

        const assigneeUserId = rule.assigneeTarget === 'owner'
          ? (opp.ownerUserId || null)
          : (rule.assigneeTarget === 'mover'
            ? mockUser.id
            : (rule.assigneeTarget === 'specific' ? (rule.assigneeUserId || null) : null));

        if (!assigneeUserId) continue;

        const task = {
          id: randomId('task'),
          title,
          opportunityId: opp.id,
          accountId: opp.accountId || null,
          dueAt,
          completed: false,
          assigneeUserId,
          createdByUserId: mockUser.id,
          source: 'automation_stale_deal',
          sourceRuleId: rule.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        crmTasks = [task, ...(Array.isArray(crmTasks) ? crmTasks : [])];
        createdTasks += 1;
      }
    }

    return json(res, 200, { rules: rules.length, scannedOpportunities, createdTasks });
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
      const prevStageId = crmOpportunities[idx].stageId;
      const updated = { ...crmOpportunities[idx], stageId, updatedAt: new Date().toISOString() };
      crmOpportunities[idx] = updated;

      // Best-effort automation: never block stage move
      try {
        const rules = Array.isArray(crmAutomationStageTaskRules) ? crmAutomationStageTaskRules : [];
        const toStage = crmStages.find((s) => s.id === stageId);
        const toStageName = toStage?.name || stageId;

        const matches = rules.filter((r) => {
          if (!r || r.enabled !== true) return false;
          if (String(r.toStageId) !== String(stageId)) return false;
          if (r.fromStageId == null) return true;
          return String(r.fromStageId) === String(prevStageId);
        });

        for (const rule of matches) {
          const title = String(rule.titleTemplate || 'Auto task: {{toStage}}')
            .replaceAll('{{toStage}}', toStageName);

          const dueAt = rule.dueInDays > 0
            ? new Date(Date.now() + Number(rule.dueInDays) * 24 * 60 * 60 * 1000).toISOString()
            : null;

          const assigneeUserId = rule.assigneeTarget === 'owner'
            ? (updated.ownerUserId || null)
            : (rule.assigneeTarget === 'mover'
              ? mockUser.id
              : (rule.assigneeTarget === 'specific' ? (rule.assigneeUserId || null) : null));

          const task = {
            id: randomId('task'),
            title,
            opportunityId: updated.id,
            accountId: null,
            dueAt,
            completed: false,
            assigneeUserId,
            createdByUserId: mockUser.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          crmTasks = [task, ...(Array.isArray(crmTasks) ? crmTasks : [])];
        }
      } catch {
        // ignore
      }

      return json(res, 200, updated);
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

      if (typeof body.probability === 'number' || typeof body.probability === 'string') {
        const probability = Number(body.probability);
        next.probability = Number.isFinite(probability) ? Math.max(0, Math.min(1, probability)) : next.probability;
      }
      if (body.probability === null) next.probability = null;

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
    const accountId = url.searchParams.get('accountId');
    if (opportunityId && accountId) {
      return json(res, 400, { message: 'opportunityId ve accountId birlikte kullanılamaz' });
    }
    const list = Array.isArray(crmActivities) ? crmActivities : [];
    if (opportunityId) {
      return json(res, 200, list.filter((a) => a.opportunityId === opportunityId));
    }
    if (accountId) {
      return json(res, 200, list.filter((a) => a.accountId === accountId));
    }
    return json(res, 200, list);
  }
  if (path === '/api/crm/activities' && req.method === 'POST') {
    return readJsonBody(req).then((body) => {
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      if (!title) return json(res, 400, { message: 'title zorunlu' });

      const opportunityId = typeof body.opportunityId === 'string' ? body.opportunityId : null;
      const accountId = typeof body.accountId === 'string' ? body.accountId : null;
      if (opportunityId && accountId) return json(res, 400, { message: 'opportunityId ve accountId birlikte kullanılamaz' });

      if (!opportunityId && !accountId) {
        return json(res, 400, { message: 'opportunityId veya accountId zorunlu' });
      }

      const activity = {
        id: randomId('activity'),
        title,
        type: typeof body.type === 'string' ? body.type.trim() : '',
        opportunityId,
        accountId,
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

      const nextOpportunityId = typeof body.opportunityId === 'string' ? body.opportunityId : undefined;
      const nextAccountId = typeof body.accountId === 'string' ? body.accountId : undefined;
      if (nextOpportunityId && nextAccountId) {
        return json(res, 400, { message: 'opportunityId ve accountId birlikte kullanılamaz' });
      }

      const next = { ...crmActivities[idx] };
      if (typeof body.title === 'string') next.title = body.title.trim();
      if (typeof body.type === 'string') next.type = body.type.trim();
      if (typeof body.opportunityId === 'string') next.opportunityId = body.opportunityId;
      if (body.opportunityId === null) next.opportunityId = null;
      if (typeof body.accountId === 'string') next.accountId = body.accountId;
      if (body.accountId === null) next.accountId = null;
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

  // CRM Tasks
  if (path === '/api/crm/tasks' && req.method === 'GET') {
    const opportunityId = url.searchParams.get('opportunityId');
    const accountId = url.searchParams.get('accountId');
    if (opportunityId && accountId) {
      return json(res, 400, { message: 'opportunityId ve accountId birlikte kullanılamaz' });
    }

    const list = Array.isArray(crmTasks) ? crmTasks : [];
    if (opportunityId) {
      return json(res, 200, list.filter((t) => t.opportunityId === opportunityId));
    }
    if (accountId) {
      return json(res, 200, list.filter((t) => t.accountId === accountId));
    }
    return json(res, 200, list);
  }
  if (path === '/api/crm/tasks' && req.method === 'POST') {
    return readJsonBody(req).then((body) => {
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      if (!title) return json(res, 400, { message: 'title zorunlu' });

      const opportunityId = typeof body.opportunityId === 'string' ? body.opportunityId : null;
      const accountId = typeof body.accountId === 'string' ? body.accountId : null;
      if (opportunityId && accountId) return json(res, 400, { message: 'opportunityId ve accountId birlikte kullanılamaz' });
      if (!opportunityId && !accountId) {
        return json(res, 400, { message: 'opportunityId veya accountId zorunlu' });
      }

      const task = {
        id: randomId('task'),
        title,
        opportunityId,
        accountId,
        dueAt: typeof body.dueAt === 'string' ? body.dueAt : null,
        completed: !!body.completed,
        assigneeUserId: typeof body.assigneeUserId === 'string' ? body.assigneeUserId : null,
        createdByUserId: mockUser.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      crmTasks = [task, ...(Array.isArray(crmTasks) ? crmTasks : [])];
      return json(res, 200, task);
    });
  }
  const crmTaskMatch = path.match(/^\/api\/crm\/tasks\/([^/]+)$/);
  if (crmTaskMatch && req.method === 'PATCH') {
    const id = crmTaskMatch[1];
    return readJsonBody(req).then((body) => {
      const idx = (Array.isArray(crmTasks) ? crmTasks : []).findIndex((x) => x.id === id);
      if (idx < 0) return json(res, 404, { message: 'Task bulunamadı' });

      const nextOpportunityId = typeof body.opportunityId === 'string' ? body.opportunityId : undefined;
      const nextAccountId = typeof body.accountId === 'string' ? body.accountId : undefined;
      if (nextOpportunityId && nextAccountId) {
        return json(res, 400, { message: 'opportunityId ve accountId birlikte kullanılamaz' });
      }

      const next = { ...crmTasks[idx] };
      if (typeof body.title === 'string') next.title = body.title.trim();
      if (typeof body.opportunityId === 'string') next.opportunityId = body.opportunityId;
      if (body.opportunityId === null) next.opportunityId = null;
      if (typeof body.accountId === 'string') next.accountId = body.accountId;
      if (body.accountId === null) next.accountId = null;
      if (typeof body.dueAt === 'string') next.dueAt = body.dueAt;
      if (body.dueAt === null) next.dueAt = null;
      if (typeof body.completed === 'boolean') next.completed = body.completed;
      if (typeof body.assigneeUserId === 'string') next.assigneeUserId = body.assigneeUserId;
      if (body.assigneeUserId === null) next.assigneeUserId = null;
      next.updatedAt = new Date().toISOString();

      crmTasks[idx] = next;
      return json(res, 200, next);
    });
  }
  if (crmTaskMatch && req.method === 'DELETE') {
    const id = crmTaskMatch[1];
    const before = Array.isArray(crmTasks) ? crmTasks : [];
    const next = before.filter((x) => x.id !== id);
    if (next.length === before.length) return json(res, 404, { message: 'Task bulunamadı' });
    crmTasks = next;
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