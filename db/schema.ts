import { sql } from 'drizzle-orm';
import { sqliteTable, integer, text, blob, index, check } from 'drizzle-orm/sqlite-core';
export const content = sqliteTable('content', {
  id: integer('id').primaryKey(), revision: integer('revision').notNull().default(1), data: text('data').notNull()
}, t => [check('content_singleton', sql`${t.id} = 1`)]);
export const sessions = sqliteTable('sessions', {
  tokenHash: text('token_hash').primaryKey(), expiresAt: integer('expires_at').notNull(), authFingerprint: text('auth_fingerprint')
}, t => [index('sessions_expiry').on(t.expiresAt)]);
export const loginLimits = sqliteTable('login_limits', {
  key: text('key').primaryKey(), count: integer('count').notNull(), resetAt: integer('reset_at').notNull()
}, t => [index('login_limits_expiry').on(t.resetAt)]);
export const icons = sqliteTable('icons', {
  memberId: text('member_id').primaryKey(), mime: text('mime').notNull(), bytes: blob('bytes', {mode:'buffer'}).notNull()
});
export const adminAuth = sqliteTable('admin_auth', {
  id: integer('id').primaryKey(), passwordHash: text('password_hash').notNull(), ownerId: text('owner_id'), updatedAt: integer('updated_at').notNull()
}, t => [check('auth_singleton', sql`${t.id} = 1`)]);
