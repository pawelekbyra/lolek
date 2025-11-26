import { getEmbedding } from './embedding';
import prisma from './prisma';

/**
 * Retrieves context for a given query using a hybrid search approach.
 *
 * @param query - The user's query.
 * @param userId - The ID of the user.
 * @returns A string containing the aggregated context.
 */
export async function retrieveContext(query: string, userId: string): Promise<string> {
  const embedding = await getEmbedding(query);

  // 1. Semantic Search (Vectors)
  const semanticFacts = await prisma.$queryRaw`
    SELECT content
    FROM "SemanticMemory"
    ORDER BY embedding <=> ${embedding}
    LIMIT 3;
  `;

  // 2. Keyword Search
  const keywordFacts = await prisma.semanticMemory.findMany({
    where: {
      content: {
        contains: query,
        mode: 'insensitive',
      },
    },
  });

  const keywordMessages = await prisma.message.findMany({
    where: {
      content: {
        contains: query,
        mode: 'insensitive',
      },
      userId: userId,
    },
  });

  // 4. Aggregation
  let context = '';

  if (Array.isArray(semanticFacts) && semanticFacts.length > 0) {
    context += '[WYSZUKIWANIE WEKTOROWE]\n';
    semanticFacts.forEach((fact: { content: string }) => {
      context += `- ${fact.content}\n`;
    });
  }

  if (keywordFacts.length > 0) {
    context += '[WYSZUKIWANIE SŁÓW KLUCZOWYCH W FAKTACH]\n';
    keywordFacts.forEach((fact: { content: string }) => {
      context += `- ${fact.content}\n`;
    });
  }

  if (keywordMessages.length > 0) {
    context += '[WYSZUKIWANIE SŁÓW KLUCZOWYCH W WIADOMOŚCIACH]\n';
    keywordMessages.forEach((message: { content: string }) => {
      context += `- ${message.content}\n`;
    });
  }


  return context;
}
