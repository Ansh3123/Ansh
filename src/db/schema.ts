import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp, numeric, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  credits: numeric('credits', { precision: 10, scale: 2 }).default('100.00'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const gameHistory = pgTable('game_history', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  gameId: text('game_id').notNull(),
  wager: numeric('wager', { precision: 10, scale: 2 }).notNull(),
  winnings: numeric('winnings', { precision: 10, scale: 2 }).notNull(),
  win: boolean('win').notNull(),
  timestamp: timestamp('timestamp').defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  gameHistory: many(gameHistory),
}));

export const gameHistoryRelations = relations(gameHistory, ({ one }) => ({
  author: one(users, {
    fields: [gameHistory.userId],
    references: [users.id],
  }),
}));
