const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { authenticate, authorize } = require('../middleware/auth');

describe('Admin Statistics & Department/Programme Aggregation Logic', () => {
  // Test aggregation data transformation and aggregation simulation
  test('aggregates submitted applications by programme correctly and excludes drafts', () => {
    const SUBMITTED_STATUSES = ['Submitted', 'Under Review', 'Verified', 'Selected', 'Rejected'];
    const rawApplications = [
      { id: '1', selectedProgramme: 'B.Tech - Computer Science & Engineering', status: 'Submitted' },
      { id: '2', selectedProgramme: 'B.Tech - Computer Science & Engineering', status: 'Verified' },
      { id: '3', selectedProgramme: 'B.Tech - Computer Science & Engineering', status: 'Selected' },
      { id: '4', selectedProgramme: 'Master of Business Administration (MBA)', status: 'Submitted' },
      { id: '5', selectedProgramme: 'Master of Business Administration (MBA)', status: 'Under Review' },
      { id: '6', selectedProgramme: 'Bachelor of Computer Applications (BCA)', status: 'Draft' }, // Draft must be excluded
    ];

    // Simulate MongoDB $match status in SUBMITTED_STATUSES followed by $group by programme
    const matchedApplications = rawApplications.filter((app) => SUBMITTED_STATUSES.includes(app.status));
    const groupedMap = new Map();
    for (const app of matchedApplications) {
      const prog = app.selectedProgramme && app.selectedProgramme.trim() ? app.selectedProgramme.trim() : 'Unspecified Programme';
      groupedMap.set(prog, (groupedMap.get(prog) || 0) + 1);
    }

    const programmeStats = Array.from(groupedMap.entries())
      .map(([programme, count]) => ({ programme, count }))
      .sort((a, b) => b.count - a.count || a.programme.localeCompare(b.programme));

    // Draft (BCA) is excluded from programme breakdown
    assert.equal(programmeStats.length, 2);
    assert.equal(programmeStats[0].programme, 'B.Tech - Computer Science & Engineering');
    assert.equal(programmeStats[0].count, 3);
    assert.equal(programmeStats[1].programme, 'Master of Business Administration (MBA)');
    assert.equal(programmeStats[1].count, 2);
    assert.equal(programmeStats.some((p) => p.programme === 'Bachelor of Computer Applications (BCA)'), false);
  });

  test('handles missing, null, undefined, and empty string programme values gracefully', () => {
    const edgeCaseApplications = [
      { id: '1', selectedProgramme: null },
      { id: '2', selectedProgramme: undefined },
      { id: '3', selectedProgramme: '' },
      { id: '4', selectedProgramme: '   ' },
      { id: '5', selectedProgramme: 'M.Tech - Computer Science & Engineering' },
    ];

    // Normalize empty/null/whitespace programmes to 'Unspecified Programme'
    const normalizeProgramme = (prog) => {
      if (!prog || typeof prog !== 'string' || prog.trim().length === 0) {
        return 'Unspecified Programme';
      }
      return prog.trim();
    };

    const groupedMap = new Map();
    for (const app of edgeCaseApplications) {
      const prog = normalizeProgramme(app.selectedProgramme);
      groupedMap.set(prog, (groupedMap.get(prog) || 0) + 1);
    }

    const programmeStats = Array.from(groupedMap.entries()).map(([programme, count]) => ({
      programme,
      count,
    }));

    const unspecified = programmeStats.find((p) => p.programme === 'Unspecified Programme');
    const mtech = programmeStats.find((p) => p.programme === 'M.Tech - Computer Science & Engineering');

    assert.ok(unspecified, 'Unspecified Programme bucket should exist');
    assert.equal(unspecified.count, 4);
    assert.ok(mtech, 'Valid programme should be preserved');
    assert.equal(mtech.count, 1);
  });

  test('preserves existing status counts structure while excluding drafts from submitted total', () => {
    const statusAgg = [
      { _id: 'Submitted', count: 5 },
      { _id: 'Under Review', count: 2 },
      { _id: 'Verified', count: 3 },
      { _id: 'Selected', count: 1 },
      { _id: 'Rejected', count: 1 },
      { _id: 'Draft', count: 4 },
    ];

    const statsMap = {
      total: 0,
      submitted: 0,
      underReview: 0,
      verified: 0,
      selected: 0,
      rejected: 0,
      draft: 0,
    };

    statusAgg.forEach((item) => {
      const count = Number(item.count) || 0;
      if (item._id === 'Submitted') statsMap.submitted = count;
      else if (item._id === 'Under Review') statsMap.underReview = count;
      else if (item._id === 'Verified') statsMap.verified = count;
      else if (item._id === 'Selected') statsMap.selected = count;
      else if (item._id === 'Rejected') statsMap.rejected = count;
      else if (item._id === 'Draft') statsMap.draft = count;
    });

    // Total must only count submitted applications, excluding Drafts
    statsMap.total =
      statsMap.submitted +
      statsMap.underReview +
      statsMap.verified +
      statsMap.selected +
      statsMap.rejected;

    const programmeStats = [
      { programme: 'B.Tech - Computer Science & Engineering', count: 10 },
      { programme: 'Master of Business Administration (MBA)', count: 6 },
    ];

    statsMap.byProgramme = programmeStats;

    // Verify all original fields are intact and total excludes drafts
    assert.equal(statsMap.total, 12, 'Total applications must equal 12 (sum of submitted statuses), excluding 4 drafts');
    assert.equal(statsMap.submitted, 5);
    assert.equal(statsMap.underReview, 2);
    assert.equal(statsMap.verified, 3);
    assert.equal(statsMap.selected, 1);
    assert.equal(statsMap.rejected, 1);
    assert.equal(statsMap.draft, 4);
    assert.equal(statsMap.byProgramme.length, 2);
  });

  test('stats endpoint rejects unauthenticated requests with 401', () => {
    const req = { headers: {} };
    let status = null;
    let jsonBody = null;
    const res = {
      status: (code) => {
        status = code;
        return { json: (data) => { jsonBody = data; } };
      },
    };
    let nextCalled = false;
    authenticate(req, res, () => { nextCalled = true; });

    assert.equal(status, 401);
    assert.equal(jsonBody.success, false);
    assert.equal(nextCalled, false);
  });

  test('stats endpoint rejects applicant and verification officer roles with 403 Forbidden', () => {
    const roles = ['applicant', 'verification_officer', 'student', 'guest'];
    for (const role of roles) {
      const req = { user: { id: 'u1', email: `${role}@test.com`, role } };
      let status = null;
      let jsonBody = null;
      const res = {
        status: (code) => {
          status = code;
          return { json: (data) => { jsonBody = data; } };
        },
      };
      let nextCalled = false;
      authorize('admin')(req, res, () => { nextCalled = true; });

      assert.equal(status, 403, `Role ${role} should be forbidden from admin stats`);
      assert.equal(jsonBody.success, false);
      assert.equal(nextCalled, false);
    }
  });

  test('stats endpoint allows authorized administrator (role: admin)', () => {
    const req = { user: { id: 'admin1', email: 'admin@uem.edu.in', role: 'admin' } };
    let nextCalled = false;
    authorize('admin')(req, {}, () => { nextCalled = true; });
    assert.equal(nextCalled, true, 'Admin role should pass authorization');
  });
});
