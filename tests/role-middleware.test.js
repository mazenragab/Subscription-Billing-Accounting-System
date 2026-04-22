import test from 'node:test';
import assert from 'node:assert/strict';
import { requireRoles } from '../src/middleware/role.middleware.js';

function createNextRecorder() {
  const calls = [];
  const next = (arg) => calls.push(arg);
  return { calls, next };
}

test('requireRoles allows authorized user role', () => {
  const middleware = requireRoles(['OWNER', 'ADMIN']);
  const req = { user: { role: 'ADMIN' } };
  const { calls, next } = createNextRecorder();

  middleware(req, {}, next);

  assert.equal(calls.length, 1);
  assert.equal(calls[0], undefined);
});

test('requireRoles rejects when role is missing', () => {
  const middleware = requireRoles(['OWNER', 'ADMIN']);
  const req = { user: {} };
  const { calls, next } = createNextRecorder();

  middleware(req, {}, next);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].statusCode, 403);
});

test('requireRoles rejects unauthorized role', () => {
  const middleware = requireRoles(['OWNER', 'ADMIN']);
  const req = { user: { role: 'VIEWER' } };
  const { calls, next } = createNextRecorder();

  middleware(req, {}, next);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].statusCode, 403);
});
