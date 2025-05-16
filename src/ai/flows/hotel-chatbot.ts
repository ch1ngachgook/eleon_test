// 'use server'
'use server';

/**
 * @fileOverview An AI chatbot for answering hotel guest questions.
 *
 * - hotelChatbot - A function that handles the chatbot interaction.
 * - HotelChatbotInput - The input type for the hotelChatbot function.
 * - HotelChatbotOutput - The return type for the hotelChatbot function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const HotelChatbotInputSchema = z.object({
  question: z.string().describe('The guest\'s question about the hotel.'),
});
export type HotelChatbotInput = z.infer<typeof HotelChatbotInputSchema>;

const HotelChatbotOutputSchema = z.object({
  answer: z.string().describe('The chatbot\'s answer to the guest\'s question.'),
});
export type HotelChatbotOutput = z.infer<typeof HotelChatbotOutputSchema>;

export async function hotelChatbot(input: HotelChatbotInput): Promise<HotelChatbotOutput> {
  return hotelChatbotFlow(input);
}

const prompt = ai.definePrompt({
  name: 'hotelChatbotPrompt',
  input: {schema: HotelChatbotInputSchema},
  output: {schema: HotelChatbotOutputSchema},
  prompt: `You are a chatbot for a hotel. Answer guest questions about the hotel amenities, hours, services, and other relevant information.

Question: {{{question}}}
`,
});

const hotelChatbotFlow = ai.defineFlow(
  {
    name: 'hotelChatbotFlow',
    inputSchema: HotelChatbotInputSchema,
    outputSchema: HotelChatbotOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
