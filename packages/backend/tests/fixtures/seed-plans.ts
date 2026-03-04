import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { conversations, messages, toolCalls } from '../../src/db/schema.js';
import * as schema from '../../src/db/schema.js';

/**
 * Seed plan-related test data: conversations with assistant messages
 * containing various plan-like content.
 *
 * Conversations:
 *   plan-conv-1: Assistant message with numbered action plan (5 steps)
 *   plan-conv-2: Assistant message with checkbox plan (4 steps, 2 checked)
 *   plan-conv-3: Assistant message with explanatory list (NOT a plan)
 *   plan-conv-4: Assistant message with short 2-step plan (NOT a plan - too few steps)
 *   plan-conv-5: Assistant message with explicit Step N pattern (3 steps)
 *   plan-conv-6: Assistant message with multiple plans in one message
 */
export async function seedPlanData(db: BetterSQLite3Database<typeof schema>) {
  // Insert conversations
  db.insert(conversations).values([
    { id: 'plan-conv-1', agent: 'claude-code', project: 'project-alpha', title: 'Numbered Plan Conv', createdAt: '2026-01-20T10:00:00Z', updatedAt: '2026-01-20T10:30:00Z', model: 'claude-sonnet-4-5' },
    { id: 'plan-conv-2', agent: 'claude-code', project: 'project-alpha', title: 'Checkbox Plan Conv', createdAt: '2026-01-20T11:00:00Z', updatedAt: '2026-01-20T11:30:00Z', model: 'claude-sonnet-4-5' },
    { id: 'plan-conv-3', agent: 'claude-code', project: 'project-beta', title: 'Explanatory List Conv', createdAt: '2026-01-20T12:00:00Z', updatedAt: '2026-01-20T12:30:00Z', model: 'claude-haiku-4-5' },
    { id: 'plan-conv-4', agent: 'cursor', project: 'project-beta', title: 'Short List Conv', createdAt: '2026-01-20T13:00:00Z', updatedAt: '2026-01-20T13:30:00Z', model: 'gpt-4o' },
    { id: 'plan-conv-5', agent: 'claude-code', project: 'project-alpha', title: 'Explicit Step Conv', createdAt: '2026-01-20T14:00:00Z', updatedAt: '2026-01-20T14:30:00Z', model: 'claude-sonnet-4-5' },
    { id: 'plan-conv-6', agent: 'claude-code', project: 'project-alpha', title: 'Multiple Plans Conv', createdAt: '2026-01-20T15:00:00Z', updatedAt: '2026-01-20T15:30:00Z', model: 'claude-sonnet-4-5' },
  ]).run();

  // Insert messages
  db.insert(messages).values([
    // plan-conv-1: Numbered action plan with 5 steps
    { id: 'plan-msg-1a', conversationId: 'plan-conv-1', role: 'user', content: 'How do I set up the project?', createdAt: '2026-01-20T10:00:00Z', model: null },
    { id: 'plan-msg-1b', conversationId: 'plan-conv-1', role: 'assistant', content: `Here's the setup plan:\n\n1. Create the project directory structure\n2. Install the required dependencies\n3. Configure the database connection\n4. Run the initial migration\n5. Start the development server`, createdAt: '2026-01-20T10:01:00Z', model: 'claude-sonnet-4-5' },
    { id: 'plan-msg-1c', conversationId: 'plan-conv-1', role: 'assistant', content: `I've completed creating the project directory structure. Moving to the next step.`, createdAt: '2026-01-20T10:05:00Z', model: 'claude-sonnet-4-5' },

    // plan-conv-2: Checkbox plan with 4 steps (2 checked)
    { id: 'plan-msg-2a', conversationId: 'plan-conv-2', role: 'user', content: 'What needs to be done?', createdAt: '2026-01-20T11:00:00Z', model: null },
    { id: 'plan-msg-2b', conversationId: 'plan-conv-2', role: 'assistant', content: `Here's the checklist:\n\n- [x] Create the API routes\n- [x] Add input validation\n- [ ] Write unit tests\n- [ ] Deploy to staging`, createdAt: '2026-01-20T11:01:00Z', model: 'claude-sonnet-4-5' },

    // plan-conv-3: Explanatory list (NOT actionable, no imperative verbs)
    { id: 'plan-msg-3a', conversationId: 'plan-conv-3', role: 'user', content: 'Why did the build fail?', createdAt: '2026-01-20T12:00:00Z', model: null },
    { id: 'plan-msg-3b', conversationId: 'plan-conv-3', role: 'assistant', content: `The build failed for several reasons:\n\n1. The dependency version is outdated\n2. The configuration file has syntax errors\n3. The TypeScript types are incompatible\n4. The test suite has failing assertions`, createdAt: '2026-01-20T12:01:00Z', model: 'claude-haiku-4-5' },

    // plan-conv-4: Short 2-step plan (below minimum)
    { id: 'plan-msg-4a', conversationId: 'plan-conv-4', role: 'user', content: 'Fix this issue', createdAt: '2026-01-20T13:00:00Z', model: null },
    { id: 'plan-msg-4b', conversationId: 'plan-conv-4', role: 'assistant', content: `I'll fix this:\n\n1. Update the config file\n2. Restart the server`, createdAt: '2026-01-20T13:01:00Z', model: 'gpt-4o' },

    // plan-conv-5: Explicit Step N pattern
    { id: 'plan-msg-5a', conversationId: 'plan-conv-5', role: 'user', content: 'Walk me through the process', createdAt: '2026-01-20T14:00:00Z', model: null },
    { id: 'plan-msg-5b', conversationId: 'plan-conv-5', role: 'assistant', content: `Here's how to do it:\n\nStep 1: Create the new component file\nStep 2: Add the component to the router\nStep 3: Write integration tests`, createdAt: '2026-01-20T14:01:00Z', model: 'claude-sonnet-4-5' },

    // plan-conv-6: Multiple plans in one message
    { id: 'plan-msg-6a', conversationId: 'plan-conv-6', role: 'user', content: 'Set up both frontend and backend', createdAt: '2026-01-20T15:00:00Z', model: null },
    { id: 'plan-msg-6b', conversationId: 'plan-conv-6', role: 'assistant', content: `Frontend setup:\n\n1. Install Vue and dependencies\n2. Create the main App component\n3. Configure the router\n\nBackend setup:\n\n1. Initialize the Fastify server\n2. Add database connection\n3. Register API routes`, createdAt: '2026-01-20T15:01:00Z', model: 'claude-sonnet-4-5' },
  ]).run();

  // Insert tool calls for plan-conv-1 (used for tool call correlation tests)
  db.insert(toolCalls).values([
    { id: 'plan-tc-1', messageId: 'plan-msg-1b', conversationId: 'plan-conv-1', name: 'Write', input: { path: 'src/index.ts' }, output: { success: true }, status: 'completed', duration: 150, createdAt: '2026-01-20T10:02:00Z' },
    { id: 'plan-tc-2', messageId: 'plan-msg-1b', conversationId: 'plan-conv-1', name: 'Bash', input: { command: 'npm install' }, output: { stdout: 'ok' }, status: 'completed', duration: 3000, createdAt: '2026-01-20T10:03:00Z' },
  ]).run();
}

// ── Test content strings for unit tests ─────────────────────────────

export const NUMBERED_ACTION_PLAN = `Here's the setup plan:

1. Create the project directory structure
2. Install the required dependencies
3. Configure the database connection
4. Run the initial migration
5. Start the development server`;

export const CHECKBOX_PLAN = `Here's the checklist:

- [x] Create the API routes
- [x] Add input validation
- [ ] Write unit tests
- [ ] Deploy to staging`;

export const EXPLICIT_STEP_PLAN = `Here's how to do it:

Step 1: Create the new component file
Step 2: Add the component to the router
Step 3: Write integration tests`;

export const EXPLANATORY_LIST = `The build failed for several reasons:

1. The dependency version is outdated
2. The configuration file has syntax errors
3. The TypeScript types are incompatible
4. The test suite has failing assertions`;

export const SHORT_PLAN = `I'll fix this:

1. Update the config file
2. Restart the server`;

export const MULTIPLE_PLANS = `Frontend setup:

1. Install Vue and dependencies
2. Create the main App component
3. Configure the router

Backend setup:

1. Initialize the Fastify server
2. Add database connection
3. Register API routes`;

export const MIXED_CONTENT = `Let me explain how this works. The system uses a pub/sub architecture for real-time updates.

Here are the implementation steps:

1. Create the WebSocket handler
2. Add the pub/sub event system
3. Connect the frontend listener
4. Test the real-time flow

This approach ensures low latency and reliable delivery.`;
