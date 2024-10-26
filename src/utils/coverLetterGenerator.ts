import OpenAI from 'openai';

interface PersonalData {
  name: string;
  studies: string;
  experiences: string[];
}

const getOpenAIApiKey = () => {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key is not set. Please set the VITE_OPENAI_API_KEY environment variable.');
  }
  return apiKey;
};

const MAX_TOKENS = 900; // Adjust this value based on your needs

export const generateCoverLetter = async (personalData: PersonalData, jobAd: string) => {
  try {
    const apiKey = getOpenAIApiKey();
    const openai = new OpenAI({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert cover letter writer. Your task is to create a tailored cover letter based on the applicant's personal data and the job advertisement. The letter should be professional, engaging, and highlight the applicant's relevant skills and experiences."
        },
        {
          role: "user",
          content: `
            Personal Data:
            Name: ${personalData.name}
            Studies: ${personalData.studies}
            Experiences: ${personalData.experiences.join(', ')}

            Job Advertisement:
            ${jobAd}

            Please write a cover letter tailored to this job advertisement, highlighting the applicant's relevant skills and experiences. The letter should be written in the same language as the job advertisement. Keep the letter concise and within ${MAX_TOKENS} tokens.
          `
        }
      ],
      max_tokens: MAX_TOKENS,
      temperature: 0.7, // Adjust for creativity vs consistency
    });

    const generatedContent = completion.choices[0].message.content;

    if (completion.usage && completion.usage.total_tokens >= MAX_TOKENS) {
      return generatedContent + "\n\n[Note: The cover letter may be truncated due to length limitations.]";
    }

    return generatedContent;
  } catch (error: unknown) {
    console.error('Error generating cover letter:', error);
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return "Error: OpenAI API key is not set or is invalid. Please check your environment variables and ensure the VITE_OPENAI_API_KEY is correctly set.";
      }
      return `An error occurred while generating the cover letter. Please try again later. Error details: ${error.message}`;
    }
    return "An unknown error occurred while generating the cover letter. Please try again later.";
  }
};
