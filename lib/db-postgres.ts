import { neon, NeonQueryFunction } from '@neondatabase/serverless';

let sql: NeonQueryFunction<false, false>;

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 100;
const QUERY_TIMEOUT_MS = 10000; // Increased to 10 seconds

async function queryWithTimeout(query: Promise<any>) {
  return Promise.race([
    query,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Query timed out')), QUERY_TIMEOUT_MS)
    ),
  ]);
}

async function executeWithRetry(queryFn: () => Promise<any>) {
  let lastError: Error | undefined;
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      return await queryWithTimeout(queryFn());
    } catch (error: any) {
      lastError = error;
      if (error.message === 'Query timed out' || error.name === 'NeonDbError') {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * Math.pow(2, i)));
      } else {
        throw error;
      }
    }
  }
  const finalError = new Error(`Query failed after ${MAX_RETRIES} retries: ${lastError?.message}`);
  console.error("DB QUERY FAILED:", lastError);
  throw finalError;
}

function getDb() {
  if (!sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    sql = neon(process.env.DATABASE_URL);
  }

  // Wrap the sql function to include retry logic
  const wrappedSql: any = (strings: TemplateStringsArray, ...values: any[]) => {
    return executeWithRetry(() => sql(strings, ...values));
  }

  // Copy properties from the original sql function, like `sql.query`
  Object.assign(wrappedSql, {
    query: (query: string, params: any[]) => {
      return executeWithRetry(() => sql.query(query, params));
    }
  });

  return wrappedSql as NeonQueryFunction<false, false> & { query: (query: string, params: any[]) => Promise<any> };
}


// --- Chat Message Functions ---
export async function getChatMessages(sessionId: string): Promise<any[]> {
    const sql = getDb();
    const result = await sql`
        SELECT role, content FROM "Message"
        WHERE "conversationId" = ${sessionId}
        ORDER BY timestamp ASC;
    `;
    return result.map(msg => ({
        role: msg.role,
        parts: [{ type: 'text', text: msg.content }]
    }));
}

export async function addChatMessage(sessionId: string, role: string, content: string): Promise<void> {
    const sql = getDb();
    await sql`
        INSERT INTO "Message" ("conversationId", role, content)
        VALUES (${sessionId}, ${role}, ${content});
    `;
}
