import OpenAI from "openai";
import { config } from "dotenv";
import { TraitExtractorResult, UserTraits } from "../types";

// Load environment variables
config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Extract personality traits, interests, and values from a user's bio using OpenAI
 * @param bio User's bio text
 * @returns Extracted traits, interests, and values
 */
export const extractTraitsFromBio = async (
  bio: string
): Promise<UserTraits> => {
  try {
    // Default values in case the API call fails
    const defaultTraits: UserTraits = {
      personalityTraits: {},
      interests: [],
      values: [],
    };

    if (!bio || bio.trim() === "") {
      return defaultTraits;
    }

    const prompt = `
      Extract personality traits, interests, and values from the following user bio. 
      Return a JSON object with the following structure:
      {
        "personalityTraits": { 
          "extroversion": float between 0-1, 
          "agreeableness": float between 0-1,
          "conscientiousness": float between 0-1,
          "neuroticism": float between 0-1,
          "openness": float between 0-1
        },
        "interests": [array of interest keywords],
        "values": [array of personal values]
      }

      User Bio: "${bio}"
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "You are a personality trait extractor. Extract personality traits, interests, and values from user bios.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.5,
      max_tokens: 500,
    });

    // Extract the content from the response
    const content = response.choices[0]?.message?.content;

    if (!content) {
      return defaultTraits;
    }

    // Parse the JSON response
    try {
      // Find the JSON object in the response (it may be surrounded by text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedResult = JSON.parse(jsonMatch[0]) as TraitExtractorResult;
        return parsedResult.traits || defaultTraits;
      }

      return defaultTraits;
    } catch (parseError) {
      console.error("Failed to parse OpenAI response:", parseError);
      return defaultTraits;
    }
  } catch (error) {
    console.error("OpenAI API error:", error);
    // Return default traits on error
    return {
      personalityTraits: {},
      interests: [],
      values: [],
    };
  }
};
