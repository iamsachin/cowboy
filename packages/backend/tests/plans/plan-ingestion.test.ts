import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { sql } from 'drizzle-orm';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import * as schema from '../../src/db/schema.js';
import { seedPlanData } from '../fixtures/seed-plans.js';
import { extractPlans, inferStepCompletion } from '../../src/ingestion/plan-extractor.js';
import { generateId } from '../../src/ingestion/id-generator.js';

const MIGRATIONS = path.resolve(import.meta.dirname, '../../drizzle');

/**
 * Simulate the plan extraction portion of ingestion:
 * For each assistant message, extract plans and insert them into the DB.
 */
function runPlanExtraction(
  testDb: BetterSQLite3Database<typeof schema>,
) {
  // Get all conversations with messages
  const allMessages = testDb.select().from(schema.messages).all();
  const allToolCalls = testDb.select().from(schema.toolCalls).all();
  const conversations = testDb.select().from(schema.conversations).all();

  for (const conv of conversations) {
    const convMessages = allMessages
      .filter(m => m.conversationId === conv.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    const convToolCalls = allToolCalls
      .filter(tc => tc.conversationId === conv.id);

    testDb.transaction((tx) => {
      for (const msg of convMessages) {
        if (msg.role === 'assistant' && msg.content) {
          const extracted = extractPlans(msg.content, msg.id);

          const laterMessages = convMessages
            .filter(m => m.createdAt > msg.createdAt)
            .map(m => ({ role: m.role, content: m.content }));
          const toolCallsForContext = convToolCalls
            .map(tc => ({ name: tc.name, input: tc.input, status: tc.status }));
          const completionContext = { laterMessages, toolCalls: toolCallsForContext };

          for (const plan of extracted) {
            const stepsWithStatus = plan.steps.map(s => ({
              ...s,
              status: inferStepCompletion(s, completionContext),
            }));
            const completedCount = stepsWithStatus.filter(s => s.status === 'complete').length;
            const planStatus = completedCount === plan.steps.length ? 'complete'
              : completedCount === 0 ? (stepsWithStatus.some(s => s.status === 'incomplete') ? 'not-started' : 'unknown')
              : 'partial';

            const planId = generateId(conv.id, 'plan', msg.id, plan.title);
            tx.insert(schema.plans).values({
              id: planId,
              conversationId: conv.id,
              sourceMessageId: msg.id,
              title: plan.title,
              totalSteps: plan.steps.length,
              completedSteps: completedCount,
              status: planStatus,
              createdAt: msg.createdAt,
            }).onConflictDoNothing({ target: schema.plans.id }).run();

            for (const step of stepsWithStatus) {
              tx.insert(schema.planSteps).values({
                id: generateId(planId, String(step.stepNumber)),
                planId,
                stepNumber: step.stepNumber,
                content: step.content,
                status: step.status,
                createdAt: msg.createdAt,
              }).onConflictDoNothing({ target: schema.planSteps.id }).run();
            }
          }
        }
      }
    });
  }
}

describe('Plan Ingestion Integration', () => {
  const testDbPath = path.join(
    tmpdir(),
    `cowboy-test-plan-ingest-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
  );
  let sqlite: InstanceType<typeof Database>;
  let testDb: BetterSQLite3Database<typeof schema>;

  beforeAll(() => {
    sqlite = new Database(testDbPath);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    testDb = drizzle({ client: sqlite, schema });
    migrate(testDb, { migrationsFolder: MIGRATIONS });
  });

  afterAll(() => {
    sqlite.close();
    try {
      fs.unlinkSync(testDbPath);
      fs.unlinkSync(testDbPath + '-wal');
      fs.unlinkSync(testDbPath + '-shm');
    } catch {
      // Files may not exist
    }
  });

  beforeEach(() => {
    sqlite.exec('DELETE FROM plan_steps');
    sqlite.exec('DELETE FROM plans');
    sqlite.exec('DELETE FROM token_usage');
    sqlite.exec('DELETE FROM tool_calls');
    sqlite.exec('DELETE FROM messages');
    sqlite.exec('DELETE FROM conversations');
  });

  it('extracts plans from seeded conversations and stores them in DB', async () => {
    await seedPlanData(testDb);
    runPlanExtraction(testDb);

    const planCount = testDb.get<{ count: number }>(
      sql`SELECT COUNT(*) as count FROM plans`,
    )!.count;

    // Expected plans:
    // plan-conv-1: 1 numbered plan (5 steps)
    // plan-conv-2: 1 checkbox plan (4 steps)
    // plan-conv-3: 0 (explanatory, no action verbs)
    // plan-conv-4: 0 (only 2 steps)
    // plan-conv-5: 1 explicit Step N plan (3 steps)
    // plan-conv-6: 2 plans (frontend + backend, each 3 steps)
    // Total: 5 plans
    expect(planCount).toBe(5);
  });

  it('stores correct step counts for extracted plans', async () => {
    await seedPlanData(testDb);
    runPlanExtraction(testDb);

    const stepCount = testDb.get<{ count: number }>(
      sql`SELECT COUNT(*) as count FROM plan_steps`,
    )!.count;

    // 5 + 4 + 3 + 3 + 3 = 18 steps total
    expect(stepCount).toBe(18);
  });

  it('does not extract plans from non-actionable lists', async () => {
    await seedPlanData(testDb);
    runPlanExtraction(testDb);

    // plan-conv-3 has an explanatory list -- should produce no plans
    const conv3Plans = testDb.get<{ count: number }>(
      sql`SELECT COUNT(*) as count FROM plans WHERE conversation_id = 'plan-conv-3'`,
    )!.count;
    expect(conv3Plans).toBe(0);
  });

  it('does not extract plans from too-short lists', async () => {
    await seedPlanData(testDb);
    runPlanExtraction(testDb);

    // plan-conv-4 has a 2-step list -- should produce no plans
    const conv4Plans = testDb.get<{ count: number }>(
      sql`SELECT COUNT(*) as count FROM plans WHERE conversation_id = 'plan-conv-4'`,
    )!.count;
    expect(conv4Plans).toBe(0);
  });

  it('produces no duplicates on re-ingestion (deterministic IDs)', async () => {
    await seedPlanData(testDb);
    runPlanExtraction(testDb);

    const firstCount = testDb.get<{ count: number }>(
      sql`SELECT COUNT(*) as count FROM plans`,
    )!.count;

    // Run extraction again (simulates re-ingestion)
    runPlanExtraction(testDb);

    const secondCount = testDb.get<{ count: number }>(
      sql`SELECT COUNT(*) as count FROM plans`,
    )!.count;

    expect(secondCount).toBe(firstCount);

    // Also check steps
    const stepCountFirst = testDb.get<{ count: number }>(
      sql`SELECT COUNT(*) as count FROM plan_steps`,
    )!.count;
    runPlanExtraction(testDb);
    const stepCountSecond = testDb.get<{ count: number }>(
      sql`SELECT COUNT(*) as count FROM plan_steps`,
    )!.count;
    expect(stepCountSecond).toBe(stepCountFirst);
  });

  it('correctly infers completion status for checkbox plans', async () => {
    await seedPlanData(testDb);
    runPlanExtraction(testDb);

    // plan-conv-2 has checkbox plan with 2 checked, 2 unchecked
    const conv2Plan = testDb.get<{ status: string; completed_steps: number; total_steps: number }>(
      sql`SELECT status, completed_steps, total_steps FROM plans WHERE conversation_id = 'plan-conv-2'`,
    );
    expect(conv2Plan).toBeDefined();
    expect(conv2Plan!.total_steps).toBe(4);
    expect(conv2Plan!.completed_steps).toBe(2);
    expect(conv2Plan!.status).toBe('partial');
  });

  it('sets step statuses correctly for checkbox plans', async () => {
    await seedPlanData(testDb);
    runPlanExtraction(testDb);

    // Get plan from plan-conv-2
    const conv2Plan = testDb.get<{ id: string }>(
      sql`SELECT id FROM plans WHERE conversation_id = 'plan-conv-2'`,
    );
    expect(conv2Plan).toBeDefined();

    const steps = sqlite.prepare(
      `SELECT step_number, status FROM plan_steps WHERE plan_id = ? ORDER BY step_number`,
    ).all(conv2Plan!.id) as Array<{ step_number: number; status: string }>;

    expect(steps).toHaveLength(4);
    expect(steps[0].status).toBe('complete');   // [x]
    expect(steps[1].status).toBe('complete');   // [x]
    expect(steps[2].status).toBe('incomplete'); // [ ]
    expect(steps[3].status).toBe('incomplete'); // [ ]
  });

  it('maintains foreign key integrity for plans and plan_steps', async () => {
    await seedPlanData(testDb);
    runPlanExtraction(testDb);

    // All plans must reference existing conversations
    const orphanPlans = sqlite.prepare(
      'SELECT COUNT(*) as count FROM plans WHERE conversation_id NOT IN (SELECT id FROM conversations)',
    ).get() as { count: number };
    expect(orphanPlans.count).toBe(0);

    // All plans must reference existing messages
    const orphanPlanMessages = sqlite.prepare(
      'SELECT COUNT(*) as count FROM plans WHERE source_message_id NOT IN (SELECT id FROM messages)',
    ).get() as { count: number };
    expect(orphanPlanMessages.count).toBe(0);

    // All plan_steps must reference existing plans
    const orphanSteps = sqlite.prepare(
      'SELECT COUNT(*) as count FROM plan_steps WHERE plan_id NOT IN (SELECT id FROM plans)',
    ).get() as { count: number };
    expect(orphanSteps.count).toBe(0);
  });
});
