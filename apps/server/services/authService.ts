import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db/pool';
import { RegisterPayload, LoginPayload, AuthResponse, RefreshResponse } from '@love/shared';

const JWT_SECRET = process.env.JWT_SECRET as string;
const ACCESS_TOKEN_EXPIRE = process.env.ACCESS_TOKEN_EXPIRE || '15m';
const REFRESH_TOKEN_EXPIRE_DAYS = 30;

export class AuthService {
  static async register(payload: RegisterPayload): Promise<AuthResponse> {
    const { email, password, alias } = payload;
    const passwordHash = await bcrypt.hash(password, 10);
    const createdAt = Date.now();

    const result = await pool.query(
      'INSERT INTO users (email, password_hash, alias, created_at) VALUES ($1, $2, $3, $4) RETURNING id',
      [email.toLowerCase(), passwordHash, alias, createdAt]
    );

    const userId = result.rows[0].id;
    return this.generateAuthResponse(userId, email, alias);
  }

  static async login(payload: LoginPayload): Promise<AuthResponse> {
    const { email, password } = payload;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      throw new Error('Invalid email or password');
    }

    return this.generateAuthResponse(user.id, user.email, user.alias);
  }

  static async refresh(refreshToken: string): Promise<RefreshResponse> {
    const result = await pool.query('SELECT * FROM refresh_tokens WHERE token_hash = $1', [refreshToken]);
    const storedToken = result.rows[0];

    if (!storedToken || BigInt(storedToken.expires_at) < BigInt(Date.now())) {
      throw new Error('Invalid or expired refresh token');
    }

    const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [storedToken.user_id]);
    const user = userResult.rows[0];

    const accessToken = jwt.sign(
      { id: storedToken.user_id, email: user.email },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRE as any }
    );

    return { accessToken };
  }

  static async generateInviteCode(userId: string): Promise<{ code: string; expiresAt: number }> {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    const expiresAt = Date.now() + 30 * 60 * 1000; // 30 mins

    await pool.query(
      'UPDATE users SET invite_code = $1, invite_expires = $2 WHERE id = $3',
      [code, expiresAt, userId]
    );

    return { code, expiresAt };
  }

  static async pair(userId: string, code: string): Promise<{ partnerId: string; partnerAlias: string }> {
    const result = await pool.query(
      'SELECT id, alias, invite_expires FROM users WHERE invite_code = $1',
      [code.toUpperCase()]
    );
    const partner = result.rows[0];

    if (!partner || BigInt(partner.invite_expires) < BigInt(Date.now())) {
      throw new Error('Invalid or expired invite code');
    }

    if (partner.id === userId) {
      throw new Error('You cannot pair with yourself');
    }

    // Bi-directional link
    await pool.query('BEGIN');
    try {
      await pool.query('UPDATE users SET partner_id = $1, invite_code = NULL, invite_expires = NULL WHERE id = $2', [partner.id, userId]);
      await pool.query('UPDATE users SET partner_id = $1 WHERE id = $2', [userId, partner.id]);
      await pool.query('COMMIT');
    } catch (e) {
      await pool.query('ROLLBACK');
      throw e;
    }

    return { partnerId: partner.id, partnerAlias: partner.alias };
  }

  private static async generateAuthResponse(userId: string, email: string, alias: string): Promise<AuthResponse> {
    const accessToken = jwt.sign({ id: userId, email }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRE as any });
    const refreshToken = uuidv4();
    const expiresAt = Date.now() + REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60 * 1000;

    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_at) VALUES ($1, $2, $3, $4)',
      [userId, refreshToken, expiresAt, Date.now()]
    );

    return { userId, accessToken, refreshToken, alias };
  }
}
