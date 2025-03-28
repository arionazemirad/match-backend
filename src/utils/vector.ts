import { UserTraits } from "../types";

interface VectorMap {
  [key: string]: number;
}

/**
 * Calculate the cosine similarity between two vectors
 * @param vectorA First vector
 * @param vectorB Second vector
 * @returns Similarity score between 0 and 1
 */
export const cosineSimilarity = (
  vectorA: VectorMap,
  vectorB: VectorMap
): number => {
  // Get all unique keys from both vectors
  const keys = new Set([...Object.keys(vectorA), ...Object.keys(vectorB)]);

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  // Calculate dot product and norms
  for (const key of keys) {
    const valueA = vectorA[key] || 0;
    const valueB = vectorB[key] || 0;

    dotProduct += valueA * valueB;
    normA += valueA * valueA;
    normB += valueB * valueB;
  }

  // Avoid division by zero
  if (normA === 0 || normB === 0) {
    return 0;
  }

  // Calculate cosine similarity
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

/**
 * Convert user traits to a flat vector for similarity calculation
 * @param traits User traits object
 * @returns Flat vector representation
 */
export const traitsToVector = (traits: UserTraits): VectorMap => {
  const vector: VectorMap = {};

  // Add personality traits
  Object.entries(traits.personalityTraits).forEach(([trait, value]) => {
    vector[`personality_${trait}`] = value;
  });

  // Add interests (with a weight of 1.0)
  traits.interests.forEach((interest) => {
    vector[`interest_${interest}`] = 1.0;
  });

  // Add values (with a weight of 1.0)
  traits.values.forEach((value) => {
    vector[`value_${value}`] = 1.0;
  });

  return vector;
};

/**
 * Calculate similarity score between two users based on their trait vectors
 * @param userATraits First user's traits
 * @param userBTraits Second user's traits
 * @returns Similarity score between 0 and 1
 */
export const calculateUserSimilarity = (
  userATraits: UserTraits,
  userBTraits: UserTraits
): number => {
  const vectorA = traitsToVector(userATraits);
  const vectorB = traitsToVector(userBTraits);

  return cosineSimilarity(vectorA, vectorB);
};
