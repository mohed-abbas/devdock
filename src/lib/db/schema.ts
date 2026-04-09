import {
  pgTable,
  pgEnum,
  text,
  varchar,
  timestamp,
  uuid,
  boolean,
  jsonb,
  integer,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['admin', 'user']);

export const environmentStatusEnum = pgEnum('environment_status', [
  'stopped',
  'starting',
  'running',
  'stopping',
  'error',
]);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').default('user').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const environments = pgTable('environments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull(),
  repoUrl: text('repo_url'),
  branch: varchar('branch', { length: 255 }),
  status: environmentStatusEnum('status').default('stopped').notNull(),
  composeConfig: jsonb('compose_config'),
  dockerProjectName: varchar('docker_project_name', { length: 255 }),
  networkName: varchar('network_name', { length: 255 }),
  memoryLimit: integer('memory_limit'),
  cpuLimit: integer('cpu_limit'),
  lastActivityAt: timestamp('last_activity_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('env_slug_user_idx').on(table.slug, table.userId),
]);
