import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { findUserByEmail, findUserById, createUser } from '../db/queries/users.js';
import { AppError } from '../middleware/error-handler.js';
import type { TokenPayload, User } from '../types/index.js';

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '1h';
const REFRESH_TOKEN_EXPIRY = '7d';
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

class AuthService {
  async register(email: string, password: string) {
    // Check if user exists
    const existing = await findUserByEmail(email);
    if (existing) {
      throw new AppError(409, 'email_exists', 'Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Create user
    const user = await createUser(email, passwordHash);

    // Generate tokens
    const accessToken = this.generateAccessToken(user.id, user.email);
    const refreshToken = this.generateRefreshToken(user.id);

    // Store refresh token
    await this.storeRefreshToken(user.id, refreshToken);

    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken,
    };
  }

  async login(email: string, password: string) {
    const user = await findUserByEmail(email);
    if (!user) return null;

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) return null;

    // Generate tokens
    const accessToken = this.generateAccessToken(user.id, user.email);
    const refreshToken = this.generateRefreshToken(user.id);

    // Store refresh token
    await this.storeRefreshToken(user.id, refreshToken);

    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken,
    };
  }

  async refreshTokens(refreshToken: string) {
    // Verify the refresh token
    const payload = this.verifyRefreshToken(refreshToken);
    if (!payload) return null;

    // Check if refresh token is valid in database
    const valid = await this.validateRefreshToken(payload.userId, refreshToken);
    if (!valid) return null;

    // Get user
    const user = await findUserById(payload.userId);
    if (!user) return null;

    // Revoke old refresh token
    await this.revokeRefreshToken(payload.userId, refreshToken);

    // Generate new tokens
    const newAccessToken = this.generateAccessToken(user.id, user.email);
    const newRefreshToken = this.generateRefreshToken(user.id);

    // Store new refresh token
    await this.storeRefreshToken(user.id, newRefreshToken);

    return {
      user: this.sanitizeUser(user),
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(userId: string): Promise<void> {
    // Revoke all refresh tokens for user
    await db.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
  }

  private generateAccessToken(userId: string, email: string): string {
    return jwt.sign(
      { userId, email } as TokenPayload,
      config.JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
  }

  private generateRefreshToken(userId: string): string {
    return jwt.sign(
      { userId, type: 'refresh' },
      config.JWT_REFRESH_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRY }
    );
  }

  private verifyRefreshToken(token: string): { userId: string } | null {
    try {
      const payload = jwt.verify(token, config.JWT_REFRESH_SECRET) as {
        userId: string;
        type: string;
      };
      if (payload.type !== 'refresh') return null;
      return { userId: payload.userId };
    } catch {
      return null;
    }
  }

  private async storeRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const hash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

    await db.query(
      `INSERT INTO sessions (user_id, refresh_token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, hash, expiresAt]
    );
  }

  private async validateRefreshToken(userId: string, refreshToken: string): Promise<boolean> {
    const result = await db.query(
      `SELECT refresh_token_hash FROM sessions
       WHERE user_id = $1 AND expires_at > NOW()`,
      [userId]
    );

    for (const row of result.rows) {
      if (await bcrypt.compare(refreshToken, row.refresh_token_hash)) {
        return true;
      }
    }
    return false;
  }

  private async revokeRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const result = await db.query(
      `SELECT id, refresh_token_hash FROM sessions WHERE user_id = $1`,
      [userId]
    );

    for (const row of result.rows) {
      if (await bcrypt.compare(refreshToken, row.refresh_token_hash)) {
        await db.query('DELETE FROM sessions WHERE id = $1', [row.id]);
        return;
      }
    }
  }

  private sanitizeUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      subscriptionStatus: user.subscriptionStatus,
      trialEndsAt: user.trialEndsAt,
    };
  }
}

export const authService = new AuthService();
