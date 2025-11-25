import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIStream, StreamingTextResponse } from 'ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

export const runtime = 'edge';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const response = await genAI
    .getGenerativeModel({ model: 'gemini-pro' })
    .generateContentStream({
      contents: messages.map((m: any) => ({
        role: m.role,
        parts: [{ text: m.content }],
      })),
      // tools: [
      //   {
      //     functionDeclarations: [
      //       {
      //         name: 'read_own_code',
      //         description: 'Read the content of a file in the repository.',
      //         parameters: {
      //           type: 'object',
      //           properties: {
      //             filepath: {
      //               type: 'string',
      //               description: 'The path of the file to read.',
      //             },
      //           },
      //           required: ['filepath'],
      //         },
      //       },
      //       {
      //         name: 'create_feature_branch',
      //         description: 'Create a new feature branch.',
      //         parameters: {
      //           type: 'object',
      //           properties: {
      //             branch_name: {
      //               type: 'string',
      //               description: 'The name of the new branch.',
      //             },
      //           },
      //           required: ['branch_name'],
      //         },
      //       },
      //       {
      //         name: 'propose_change',
      //         description: 'Propose a change to a file.',
      //         parameters: {
      //           type: 'object',
      //           properties: {
      //             filepath: {
      //               type: 'string',
      //               description: 'The path of the file to change.',
      //             },
      //             change: {
      //               type: 'string',
      //               description: 'The proposed change.',
      //             },
      //           },
      //           required: ['filepath', 'change'],
      //         },
      //       },
      //     ],
      //   },
      // ],
    });

  const stream = GoogleAIStream(response);

  return new StreamingTextResponse(stream);
}
