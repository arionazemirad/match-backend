import prisma from "../db/client";
import { calculateUserSimilarity } from "../utils/vector";
import { UserTraits } from "../types";

/**
 * Find compatible users for a given user within the same community
 * Uses cosine similarity on trait vectors to determine compatibility
 *
 * @param userId The ID of the user seeking matches
 * @param limit The maximum number of matches to return (default: 5)
 * @returns Array of matching user profiles with similarity scores
 */
export const findCompatibleUsers = async (
  userId: number,
  limit: number = 5
) => {
  // Get the user's profile including their community ID and trait vector
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      communityId: true,
      traitVector: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (!user.traitVector) {
    throw new Error("User does not have trait vector data");
  }

  // Get other users from the same community
  const communityUsers = await prisma.user.findMany({
    where: {
      communityId: user.communityId,
      id: { not: userId }, // Exclude the current user
    },
    select: {
      id: true,
      name: true,
      bio: true,
      traitVector: true,
      // Get users who have not been liked by the current user yet
      likesReceived: {
        where: {
          fromUserId: userId,
        },
      },
    },
  });

  // Filter out users who have already been liked by the current user
  const potentialMatches = communityUsers.filter(
    (user) => user.likesReceived.length === 0 && user.traitVector
  );

  // Calculate similarity scores for each potential match
  const matchesWithScores = potentialMatches.map((potentialMatch) => {
    // Calculate similarity score using the trait vectors
    const userTraits = user.traitVector as unknown as UserTraits;
    const matchTraits = potentialMatch.traitVector as unknown as UserTraits;

    const similarityScore = calculateUserSimilarity(userTraits, matchTraits);

    return {
      id: potentialMatch.id,
      name: potentialMatch.name,
      bio: potentialMatch.bio,
      similarityScore,
    };
  });

  // Sort matches by similarity score (descending) and limit to requested count
  return matchesWithScores
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, limit);
};

/**
 * Check if two users have a mutual like (match)
 *
 * @param userAId First user ID
 * @param userBId Second user ID
 * @returns Boolean indicating if a mutual match exists
 */
export const checkMutualLike = async (
  userAId: number,
  userBId: number
): Promise<boolean> => {
  // Check if userA likes userB
  const aLikesB = await prisma.like.findUnique({
    where: {
      fromUserId_toUserId: {
        fromUserId: userAId,
        toUserId: userBId,
      },
    },
  });

  // Check if userB likes userA
  const bLikesA = await prisma.like.findUnique({
    where: {
      fromUserId_toUserId: {
        fromUserId: userBId,
        toUserId: userAId,
      },
    },
  });

  // Return true if both likes exist (mutual match)
  return !!aLikesB && !!bLikesA;
};

/**
 * Create a match between two users if they have a mutual like
 *
 * @param userAId First user ID
 * @param userBId Second user ID
 * @returns Created match object or null if no mutual like
 */
export const createMatchIfMutualLike = async (
  userAId: number,
  userBId: number
) => {
  // Check if there's a mutual like
  const hasMutualLike = await checkMutualLike(userAId, userBId);

  if (!hasMutualLike) {
    return null;
  }

  // Check if a match already exists
  const existingMatch = await prisma.match.findFirst({
    where: {
      OR: [
        { userAId, userBId },
        { userAId: userBId, userBId: userAId },
      ],
    },
  });

  if (existingMatch) {
    return existingMatch;
  }

  // Create a new match
  return await prisma.match.create({
    data: {
      userAId,
      userBId,
    },
  });
};
