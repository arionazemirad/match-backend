import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { AuthenticatedRequest, CreateLikeDto } from "../types";
import prisma from "../db/client";
import {
  findCompatibleUsers,
  createMatchIfMutualLike,
} from "../services/matching";

const matchRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Get potential matches for the current user
  fastify.get(
    "/potential",
    { onRequest: [fastify.authenticate] },
    async (request: AuthenticatedRequest, reply) => {
      try {
        const { id } = request.user;
        const limit = request.query?.limit
          ? parseInt(request.query.limit as string, 10)
          : 5;

        if (isNaN(limit) || limit < 1 || limit > 20) {
          return reply
            .code(400)
            .send({ error: "Limit must be between 1 and 20" });
        }

        // Get compatible users
        const potentialMatches = await findCompatibleUsers(id, limit);

        return reply.send({ matches: potentialMatches });
      } catch (error) {
        request.log.error(error);
        return reply
          .code(500)
          .send({
            error:
              error instanceof Error
                ? error.message
                : "Server error finding matches",
          });
      }
    }
  );

  // Get all current matches
  fastify.get(
    "/",
    { onRequest: [fastify.authenticate] },
    async (request: AuthenticatedRequest, reply) => {
      try {
        const { id } = request.user;

        // Get all matches involving the current user
        const matches = await prisma.match.findMany({
          where: {
            OR: [{ userAId: id }, { userBId: id }],
          },
          include: {
            userA: {
              select: {
                id: true,
                name: true,
                bio: true,
              },
            },
            userB: {
              select: {
                id: true,
                name: true,
                bio: true,
              },
            },
            // Get the most recent message for each match
            messages: {
              orderBy: {
                createdAt: "desc",
              },
              take: 1,
              select: {
                id: true,
                text: true,
                createdAt: true,
                read: true,
                senderId: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        // Format the results to include the matched user (not the current user)
        const formattedMatches = matches.map((match) => {
          const matchedUser = match.userAId === id ? match.userB : match.userA;
          const lastMessage =
            match.messages.length > 0 ? match.messages[0] : null;

          return {
            matchId: match.id,
            createdAt: match.createdAt,
            user: matchedUser,
            lastMessage,
            unreadCount: lastMessage
              ? lastMessage.senderId !== id && !lastMessage.read
                ? 1
                : 0
              : 0,
          };
        });

        return reply.send({ matches: formattedMatches });
      } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: "Server error fetching matches" });
      }
    }
  );

  // Like a user (potentially creating a match)
  fastify.post<{ Body: CreateLikeDto }>(
    "/like",
    { onRequest: [fastify.authenticate] },
    async (request: AuthenticatedRequest, reply) => {
      try {
        const { id: fromUserId } = request.user;
        const { toUserId } = request.body;

        if (fromUserId === toUserId) {
          return reply.code(400).send({ error: "Cannot like yourself" });
        }

        // Check if users are in the same community
        const toUser = await prisma.user.findUnique({
          where: { id: toUserId },
          select: { communityId: true },
        });

        if (!toUser) {
          return reply.code(404).send({ error: "User not found" });
        }

        if (toUser.communityId !== request.user.communityId) {
          return reply
            .code(403)
            .send({ error: "Cannot like users from different communities" });
        }

        // Check if already liked
        const existingLike = await prisma.like.findUnique({
          where: {
            fromUserId_toUserId: {
              fromUserId,
              toUserId,
            },
          },
        });

        if (existingLike) {
          return reply.code(400).send({ error: "User already liked" });
        }

        // Create the like
        await prisma.like.create({
          data: {
            fromUser: { connect: { id: fromUserId } },
            toUser: { connect: { id: toUserId } },
          },
        });

        // Check if this creates a match
        const match = await createMatchIfMutualLike(fromUserId, toUserId);

        return reply.code(201).send({
          success: true,
          isMatch: !!match,
          match: match
            ? {
                id: match.id,
                createdAt: match.createdAt,
              }
            : null,
        });
      } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: "Server error creating like" });
      }
    }
  );

  // Unlike a user
  fastify.delete(
    "/like/:userId",
    { onRequest: [fastify.authenticate] },
    async (request: AuthenticatedRequest, reply) => {
      try {
        const { id: fromUserId } = request.user;
        const { userId } = request.params as { userId: string };
        const toUserId = parseInt(userId, 10);

        if (isNaN(toUserId)) {
          return reply.code(400).send({ error: "Invalid user ID" });
        }

        // Delete the like
        try {
          await prisma.like.delete({
            where: {
              fromUserId_toUserId: {
                fromUserId,
                toUserId,
              },
            },
          });
        } catch (error) {
          return reply.code(404).send({ error: "Like not found" });
        }

        // If there was a match, delete it
        const match = await prisma.match.findFirst({
          where: {
            OR: [
              { userAId: fromUserId, userBId: toUserId },
              { userAId: toUserId, userBId: fromUserId },
            ],
          },
        });

        if (match) {
          await prisma.match.delete({
            where: { id: match.id },
          });
        }

        return reply.code(200).send({
          success: true,
          matchDeleted: !!match,
        });
      } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: "Server error deleting like" });
      }
    }
  );

  // Get a specific match detail
  fastify.get(
    "/:matchId",
    { onRequest: [fastify.authenticate] },
    async (request: AuthenticatedRequest, reply) => {
      try {
        const { id: userId } = request.user;
        const { matchId } = request.params as { matchId: string };
        const matchIdNum = parseInt(matchId, 10);

        if (isNaN(matchIdNum)) {
          return reply.code(400).send({ error: "Invalid match ID" });
        }

        // Get the match
        const match = await prisma.match.findUnique({
          where: { id: matchIdNum },
          include: {
            userA: {
              select: {
                id: true,
                name: true,
                bio: true,
                email: true,
              },
            },
            userB: {
              select: {
                id: true,
                name: true,
                bio: true,
                email: true,
              },
            },
          },
        });

        if (!match) {
          return reply.code(404).send({ error: "Match not found" });
        }

        // Check if the user is part of this match
        if (match.userAId !== userId && match.userBId !== userId) {
          return reply
            .code(403)
            .send({ error: "Not authorized to view this match" });
        }

        // Get the matched user (not the current user)
        const matchedUser =
          match.userAId === userId ? match.userB : match.userA;

        return reply.send({
          match: {
            id: match.id,
            createdAt: match.createdAt,
            user: matchedUser,
          },
        });
      } catch (error) {
        request.log.error(error);
        return reply
          .code(500)
          .send({ error: "Server error fetching match details" });
      }
    }
  );
};

export default matchRoutes;
