import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const leadReceipts=sqliteTable('lead_receipts',{
 id:text('id').primaryKey(),keyHash:text('key_hash').notNull().unique(),payloadHash:text('payload_hash').notNull(),status:text('status').notNull(),createdAt:integer('created_at').notNull()
});
export const leadRateLimits=sqliteTable('lead_rate_limits',{
 key:text('key').primaryKey(),count:integer('count').notNull(),expiresAt:integer('expires_at').notNull()
});
