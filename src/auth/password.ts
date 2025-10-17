import bcrypt from 'bcryptjs';

/**
 * Password hashing utilities using bcrypt
 */
export class PasswordService {
  private saltRounds: number;

  constructor(saltRounds = 10) {
    this.saltRounds = saltRounds;
  }

  /**
   * Hash a password
   */
  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  /**
   * Verify a password against a hash
   */
  async verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Check if a hash needs to be rehashed (e.g., salt rounds changed)
   */
  needsRehash(hash: string): boolean {
    const rounds = bcrypt.getRounds(hash);
    return rounds !== this.saltRounds;
  }
}

/**
 * Default password service instance
 */
export const passwordService = new PasswordService();
