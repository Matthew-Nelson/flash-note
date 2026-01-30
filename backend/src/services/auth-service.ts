import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config, BCRYPT_ROUNDS } from '../config.js';
import { db } from '../db/index.js';
import { findUserByEmail, findUserById, createUser } from '../db/queries/users.js';
import { AppError } from '../middleware/error-handler.js';
import { generateCsrfToken } from '../middleware/csrf.js';
import { lockoutService } from './lockout-service.js';
import { tokenService } from './token-service.js';
import { emailService } from './email-service.js';
import type { TokenPayload, User } from '../types/index.js';

const ACCESS_TOKEN_EXPIRY = '1h';
const REFRESH_TOKEN_EXPIRY = '7d';
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

// SECURITY: Dummy hash for timing-safe password comparison when user doesn't exist
// This prevents timing attacks that could reveal whether an email is registered
// Generated with bcrypt.hashSync('dummy_password_never_matches', 12)
const DUMMY_HASH = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYq1IpHBBUGK';

interface LoginContext {
  ipAddress?: string;
  userAgent?: string;
}

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

    // Generate and send verification email
    // SECURITY: Do this after user creation to ensure audit trail
    try {
      const verificationToken = await tokenService.createToken(user.id, 'email_verification');
      await emailService.sendVerificationEmail(email, verificationToken);
    } catch (error) {
      // Log error but don't fail registration - user can resend verification
      console.error('Failed to send verification email:', error);
    }

    // Generate tokens
    const accessToken = this.generateAccessToken(user.id, user.email, user.tokenVersion);
    const refreshToken = this.generateRefreshToken(user.id);

    // Store refresh token
    await this.storeRefreshToken(user.id, refreshToken);

    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken,
      csrfToken: generateCsrfToken(user.id),
      emailVerificationRequired: true,
    };
  }

  async login(email: string, password: string, context: LoginContext = {}) {
    const user = await findUserByEmail(email);

    // SECURITY: Always perform bcrypt comparison to prevent timing attacks
    // If user doesn't exist, compare against dummy hash
    // This ensures consistent response time regardless of whether email exists
    const hashToCompare = user?.passwordHash ?? DUMMY_HASH;
    const validPassword = await bcrypt.compare(password, hashToCompare);

    // If user doesn't exist or password is wrong, record failure (if user exists) and return null
    if (!user || !validPassword) {
      if (user) {
        // Record failed attempt - may trigger lockout
        // SECURITY: Wrap in try-catch to fail-secure. If lockout service fails,
        // we still reject the login but don't want to leak error info or crash.
        try {
          await lockoutService.recordFailedAttempt(user.id, context);
        } catch (error) {
          // Log error for investigation but continue with login rejection
          // This prevents lockout service failures from blocking the auth flow
          console.error('Lockout service error during failed attempt recording:', error);
        }
      }
      return null;
    }

    // SECURITY: Check lockout status AFTER password validation
    // This prevents lockout status from being a timing oracle
    // Even if password is correct, locked accounts cannot log in
    let lockoutStatus;
    try {
      lockoutStatus = await lockoutService.getAccountLockoutStatus(user.id);
    } catch (error) {
      // SECURITY: Fail-secure - if we can't check lockout status, deny access
      // Log error for investigation
      console.error('Lockout service error during status check:', error);
      return null;
    }

    if (lockoutStatus.isLocked) {
      // Don't reveal that the password was correct - return same error as invalid credentials
      return null;
    }

    // Success - reset failed attempts counter
    // SECURITY: Wrap in try-catch - if reset fails, still allow login but log error
    // The user has valid credentials and isn't locked, so blocking them here
    // would be unnecessarily disruptive
    try {
      await lockoutService.resetFailedAttempts(user.id);
    } catch (error) {
      // Log error but don't block successful login
      console.error('Lockout service error during failed attempts reset:', error);
    }

    // Generate tokens
    const accessToken = this.generateAccessToken(user.id, user.email, user.tokenVersion);
    const refreshToken = this.generateRefreshToken(user.id);

    // Store refresh token
    await this.storeRefreshToken(user.id, refreshToken);

    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken,
      csrfToken: generateCsrfToken(user.id),
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
    const newAccessToken = this.generateAccessToken(user.id, user.email, user.tokenVersion);
    const newRefreshToken = this.generateRefreshToken(user.id);

    // Store new refresh token
    await this.storeRefreshToken(user.id, newRefreshToken);

    return {
      user: this.sanitizeUser(user),
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      csrfToken: generateCsrfToken(user.id),
    };
  }

  async logout(userId: string): Promise<void> {
    // Revoke all refresh tokens for user
    await db.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
  }

  private generateAccessToken(userId: string, email: string, tokenVersion: number): string {
    // SECURITY: Explicitly specify HS256 algorithm
    // SECURITY: Include tokenVersion to enable immediate invalidation on password reset
    return jwt.sign(
      { userId, email, tokenVersion } as TokenPayload,
      config.JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY, algorithm: 'HS256' }
    );
  }

  private generateRefreshToken(userId: string): string {
    // SECURITY: Explicitly specify HS256 algorithm
    return jwt.sign(
      { userId, type: 'refresh' },
      config.JWT_REFRESH_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRY, algorithm: 'HS256' }
    );
  }

  private verifyRefreshToken(token: string): { userId: string } | null {
    try {
      // SECURITY: Explicitly specify algorithm to prevent algorithm confusion attacks
      const payload = jwt.verify(token, config.JWT_REFRESH_SECRET, {
        algorithms: ['HS256'],
      }) as {
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
      emailVerified: user.emailVerified,
    };
  }
}

export const authService = new AuthService();
