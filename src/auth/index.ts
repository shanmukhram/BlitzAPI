/**
 * Authentication module exports
 */
export { JWTService, authenticate, optionalAuthenticate } from './jwt.js';
export type { JWTConfig, JWTPayload } from './jwt.js';
export { PasswordService, passwordService } from './password.js';
