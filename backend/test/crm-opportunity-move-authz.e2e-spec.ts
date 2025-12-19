import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('CRM opportunity stage move authz (e2e)', () => {
  let app: INestApplication;
  let server: any;

  let ownerToken = '';
  let memberToken = '';
  let memberUserId = '';
  let orgAdminToken = '';
  let orgAdminUserId = '';
  let orgId = '';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    server = app.getHttpServer();

    // 1) Register tenant owner (tenant_admin)
    const ownerEmail = `crm-owner-${Date.now()}@example.com`;
    const ownerPass = 'OwnerPass123!';

    const ownerRes = await request(server)
      .post('/auth/register')
      .send({
        email: ownerEmail,
        password: ownerPass,
        firstName: 'CRM',
        lastName: 'Owner',
        companyName: `CRM Owner Co ${Date.now()}`,
      })
      .expect(201);

    ownerToken = String(ownerRes.body?.token || '');
    expect(ownerToken).toBeTruthy();

    // 2) Upgrade subscription to allow member invites (starter plans can be limited)
    await request(server)
      .patch('/tenants/my-tenant/subscription')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ plan: 'professional', users: 4, billing: 'monthly' })
      .expect(200);

    // 3) Create org + invite member
    const orgRes = await request(server)
      .post('/organizations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: `CRM Org ${Date.now()}` })
      .expect((r) => {
        if (r.status !== 200 && r.status !== 201) {
          throw new Error(`Unexpected org create status: ${r.status}`);
        }
      });

    orgId = String(orgRes.body?.id || '');
    expect(orgId).toBeTruthy();

    // 4) Invite + register regular MEMBER
    const memberEmail = `crm-member-${Date.now()}@example.com`;
    const memberPass = 'MemberPass123!';

    const inviteMemberRes = await request(server)
      .post(`/organizations/${orgId}/invite`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: memberEmail, role: 'MEMBER' })
      .expect((r) => {
        if (r.status !== 200 && r.status !== 201) {
          throw new Error(`Unexpected invite(MEMBER) status: ${r.status}`);
        }
      });

    const memberInviteToken = String(inviteMemberRes.body?.token || '');
    expect(memberInviteToken).toBeTruthy();

    await request(server)
      .post(`/public/invites/${encodeURIComponent(memberInviteToken)}/register`)
      .send({ password: memberPass })
      .expect((r) => {
        if (r.status !== 200 && r.status !== 201) {
          throw new Error(
            `Unexpected public invite register(MEMBER) status: ${r.status}`,
          );
        }
      });

    const memberLoginRes = await request(server)
      .post('/auth/login')
      .send({ email: memberEmail, password: memberPass })
      .expect(200);

    memberToken = String(
      memberLoginRes.body?.accessToken || memberLoginRes.body?.token || '',
    );
    expect(memberToken).toBeTruthy();

    const memberMeRes = await request(server)
      .get('/auth/me')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    memberUserId = String(memberMeRes.body?.user?.id || '');
    expect(memberUserId).toBeTruthy();

    // 5) Invite + register org ADMIN (role-based stage move should allow)
    const orgAdminEmail = `crm-orgadmin-${Date.now()}@example.com`;
    const orgAdminPass = 'OrgAdminPass123!';

    const inviteAdminRes = await request(server)
      .post(`/organizations/${orgId}/invite`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: orgAdminEmail, role: 'ADMIN' })
      .expect((r) => {
        if (r.status !== 200 && r.status !== 201) {
          throw new Error(`Unexpected invite(ADMIN) status: ${r.status}`);
        }
      });

    const adminInviteToken = String(inviteAdminRes.body?.token || '');
    expect(adminInviteToken).toBeTruthy();

    await request(server)
      .post(`/public/invites/${encodeURIComponent(adminInviteToken)}/register`)
      .send({ password: orgAdminPass })
      .expect((r) => {
        if (r.status !== 200 && r.status !== 201) {
          throw new Error(
            `Unexpected public invite register(ADMIN) status: ${r.status}`,
          );
        }
      });

    const adminLoginRes = await request(server)
      .post('/auth/login')
      .send({ email: orgAdminEmail, password: orgAdminPass })
      .expect(200);

    orgAdminToken = String(
      adminLoginRes.body?.accessToken || adminLoginRes.body?.token || '',
    );
    expect(orgAdminToken).toBeTruthy();

    const adminMeRes = await request(server)
      .get('/auth/me')
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .expect(200);

    orgAdminUserId = String(adminMeRes.body?.user?.id || '');
    expect(orgAdminUserId).toBeTruthy();

    // Note: we keep user count low here; role promotion is exercised in the test.
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('denies stage move for MEMBER, allows for org ADMIN and org OWNER (via role promotion) and tenant owner', async () => {
    // 1) Bootstrap pipeline for stages
    const bootstrapRes = await request(server)
      .post('/crm/pipeline/bootstrap')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({})
      .expect((r) => {
        if (r.status !== 200 && r.status !== 201) {
          throw new Error(`Unexpected bootstrap status: ${r.status}`);
        }
      });

    const stageIds = bootstrapRes.body?.stageIds as unknown;
    expect(Array.isArray(stageIds)).toBe(true);
    expect((stageIds as any[]).length).toBeGreaterThanOrEqual(2);

    // 2) Create customer + opportunity (include member on team)
    const customerRes = await request(server)
      .post('/customers')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: `CRM Customer ${Date.now()}` })
      .expect(201);

    const customerId = String(customerRes.body?.id || '');
    expect(customerId).toBeTruthy();

    const oppRes = await request(server)
      .post('/crm/opportunities')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        accountId: customerId,
        name: `CRM Opp ${Date.now()}`,
        amount: 0,
        currency: 'TRY',
        // Regular member is explicitly on the team; org admin is NOT.
        teamUserIds: [memberUserId],
      })
      .expect((r) => {
        if (r.status !== 200 && r.status !== 201) {
          throw new Error(`Unexpected opp create status: ${r.status}`);
        }
      });

    const oppId = String(oppRes.body?.id || '');
    const currentStageId = String(oppRes.body?.stageId || '');
    expect(oppId).toBeTruthy();
    expect(currentStageId).toBeTruthy();

    const candidates = stageIds as any[];
    const moveStageId =
      String(candidates[1] || '') !== currentStageId
        ? String(candidates[1] || '')
        : String(candidates[2] || '');

    expect(moveStageId).toBeTruthy();

    // 3) Member cannot move stage
    await request(server)
      .post(`/crm/opportunities/${encodeURIComponent(oppId)}/move`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ stageId: moveStageId })
      .expect(403);

    // 4) Org ADMIN can move stage (role-based)
    const adminMovedRes = await request(server)
      .post(`/crm/opportunities/${encodeURIComponent(oppId)}/move`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({ stageId: moveStageId })
      .expect((r) => {
        if (r.status !== 200 && r.status !== 201) {
          throw new Error(`Unexpected org-admin move status: ${r.status}`);
        }
      });

    expect(String(adminMovedRes.body?.stageId || '')).toBe(moveStageId);

    // 4.1) Promote org ADMIN to org OWNER, then ensure stage move still allowed
    const membersRes = await request(server)
      .get(`/organizations/${encodeURIComponent(orgId)}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const members = Array.isArray(membersRes.body) ? membersRes.body : [];
    const adminMembership = members.find(
      (m: any) => m?.user?.id === orgAdminUserId,
    );
    const adminMemberId = String(adminMembership?.id || '');
    expect(adminMemberId).toBeTruthy();

    await request(server)
      .patch(
        `/organizations/${encodeURIComponent(orgId)}/members/${encodeURIComponent(adminMemberId)}`,
      )
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'OWNER' })
      .expect(200);

    const ownerMovedRes = await request(server)
      .post(`/crm/opportunities/${encodeURIComponent(oppId)}/move`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({ stageId: moveStageId })
      .expect((r) => {
        if (r.status !== 200 && r.status !== 201) {
          throw new Error(
            `Unexpected org-owner(promoted) move status: ${r.status}`,
          );
        }
      });

    expect(String(ownerMovedRes.body?.stageId || '')).toBe(moveStageId);

    // 5) Owner can move stage (idempotent OK)
    const movedRes = await request(server)
      .post(`/crm/opportunities/${encodeURIComponent(oppId)}/move`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ stageId: moveStageId })
      .expect((r) => {
        if (r.status !== 200 && r.status !== 201) {
          throw new Error(`Unexpected move status: ${r.status}`);
        }
      });

    expect(String(movedRes.body?.stageId || '')).toBe(moveStageId);
  });

  it('allows stage move for opportunity owner even if org role is MEMBER', async () => {
    // 1) Ensure stages exist
    const bootstrapRes = await request(server)
      .post('/crm/pipeline/bootstrap')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({})
      .expect((r) => {
        if (r.status !== 200 && r.status !== 201) {
          throw new Error(`Unexpected bootstrap status: ${r.status}`);
        }
      });

    const stageIds = bootstrapRes.body?.stageIds as unknown;
    expect(Array.isArray(stageIds)).toBe(true);
    expect((stageIds as any[]).length).toBeGreaterThanOrEqual(2);

    // 2) Member creates a customer + opportunity (member becomes opportunity owner)
    const customerRes = await request(server)
      .post('/customers')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ name: `CRM Member Customer ${Date.now()}` })
      .expect(201);

    const customerId = String(customerRes.body?.id || '');
    expect(customerId).toBeTruthy();

    const oppRes = await request(server)
      .post('/crm/opportunities')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        accountId: customerId,
        name: `CRM Member Opp ${Date.now()}`,
        amount: 0,
        currency: 'TRY',
      })
      .expect((r) => {
        if (r.status !== 200 && r.status !== 201) {
          throw new Error(`Unexpected opp create(member) status: ${r.status}`);
        }
      });

    const oppId = String(oppRes.body?.id || '');
    const currentStageId = String(oppRes.body?.stageId || '');
    expect(oppId).toBeTruthy();
    expect(currentStageId).toBeTruthy();

    const candidates = stageIds as any[];
    const moveStageId =
      String(candidates[1] || '') !== currentStageId
        ? String(candidates[1] || '')
        : String(candidates[2] || '');
    expect(moveStageId).toBeTruthy();

    // 3) Member can move stage because they are the opportunity owner
    const movedRes = await request(server)
      .post(`/crm/opportunities/${encodeURIComponent(oppId)}/move`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ stageId: moveStageId })
      .expect((r) => {
        if (r.status !== 200 && r.status !== 201) {
          throw new Error(`Unexpected owner(member) move status: ${r.status}`);
        }
      });

    expect(String(movedRes.body?.stageId || '')).toBe(moveStageId);
  });
});
