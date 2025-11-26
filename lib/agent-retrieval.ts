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
    FROM "SemanticFact"
    ORDER BY embedding <=> ${embedding}
    LIMIT 3;
  `;

  // 2. Keyword Search
  const keywordFacts = await prisma.semanticFact.findMany({
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

  // 3. Graph Traversal
  const graphEntities = await prisma.graphEntity.findMany({
    where: {
      name: {
        contains: query,
        mode: 'insensitive',
      },
    },
    include: {
      relations: {
        include: {
          relatedEntity: true,
        },
      },
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

  if (graphEntities.length > 0) {
    context += '[KONTEKST Z GRAFU]\n';
    graphEntities.forEach((entity: { name: string; relations: { type: string; relatedEntity: { name: string } }[] }) => {
      entity.relations.forEach(relation => {
        context += `- ${entity.name} ${relation.type} ${relation.relatedEntity.name}\n`;
      });
    });
  }

  return context;
}
