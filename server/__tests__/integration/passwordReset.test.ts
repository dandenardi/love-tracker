const sendPasswordResetEmail = jest.fn().mockResolvedValue(undefined);
jest.mock('../../services/emailService', () => ({
  sendPasswordResetEmail: (...args: any[]) => sendPasswordResetEmail(...args),
}));

import request from 'supertest';
import app from '../../app';
import pool from '../../db/pool';

async function registerUser(alias: string) {
  const email = `${alias.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;
  const res = await request(app).post('/auth/register').send({ email, password: 'password123', alias });
  return { ...(res.body as { userId: string; accessToken: string; refreshToken: string }), email };
}

function extractToken(): string {
  const [, resetUrl] = sendPasswordResetEmail.mock.calls[sendPasswordResetEmail.mock.calls.length - 1];
  const token = new URL(resetUrl).searchParams.get('token');
  if (!token) throw new Error('No token found in reset URL');
  return token;
}

afterAll(async () => {
  await pool.end();
});

beforeEach(() => {
  sendPasswordResetEmail.mockClear();
});

describe('password reset flow (real DB)', () => {
  it('lets a user reset their password and log in with the new one, not the old one', async () => {
    const user = await registerUser('Carol');

    const forgotRes = await request(app).post('/auth/forgot-password').send({ email: user.email });
    expect(forgotRes.status).toBe(200);
    expect(forgotRes.body).toEqual({ status: 'ok' });
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);

    const token = extractToken();

    const resetRes = await request(app)
      .post('/auth/reset-password')
      .send({ token, newPassword: 'newpassword456' });
    expect(resetRes.status).toBe(200);

    const oldLogin = await request(app).post('/auth/login').send({ email: user.email, password: 'password123' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app).post('/auth/login').send({ email: user.email, password: 'newpassword456' });
    expect(newLogin.status).toBe(200);
  });

  it('rejects reusing the same reset token twice', async () => {
    const user = await registerUser('Dave');

    await request(app).post('/auth/forgot-password').send({ email: user.email });
    const token = extractToken();

    const firstReset = await request(app)
      .post('/auth/reset-password')
      .send({ token, newPassword: 'firstpassword1' });
    expect(firstReset.status).toBe(200);

    const secondReset = await request(app)
      .post('/auth/reset-password')
      .send({ token, newPassword: 'secondpassword2' });
    expect(secondReset.status).toBe(400);
  });

  it('invalidates existing refresh tokens once the password is reset', async () => {
    const user = await registerUser('Erin');

    await request(app).post('/auth/forgot-password').send({ email: user.email });
    const token = extractToken();

    await request(app).post('/auth/reset-password').send({ token, newPassword: 'brandnewpass1' });

    const refreshRes = await request(app).post('/auth/refresh').send({ refreshToken: user.refreshToken });
    expect(refreshRes.status).toBe(401);
  });

  it('returns a generic ok response even for a nonexistent email (no enumeration)', async () => {
    const res = await request(app).post('/auth/forgot-password').send({ email: 'nobody-here@test.local' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});
