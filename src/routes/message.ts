import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { AuthenticatedRequest, CreateMessageDto } from "../types";
import prisma from "../db/client";

const messageRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Get all messages in a match
  fastify.get(
    "/match/:matchId",
    { onRequest: [fastify.authenticate] },
    async (request: AuthenticatedRequest, reply) => {
      try {
        const { id: userId } = request.user;
        const { matchId } = request.params as { matchId: string };
        const matchIdNum = parseInt(matchId, 10);

        if (isNaN(matchIdNum)) {
          return reply.code(400).send({ error: "Invalid match ID" });
        }

        // Verify the match exists and user is part of it
        const match = await prisma.match.findUnique({
          where: { id: matchIdNum },
          select: {
            userAId: true,
            userBId: true,
          },
        });

        if (!match) {
          return reply.code(404).send({ error: "Match not found" });
        }

        if (match.userAId !== userId && match.userBId !== userId) {
          return reply
            .code(403)
            .send({ error: "Not authorized to view these messages" });
        }

        // Get messages for the match
        const messages = await prisma.message.findMany({
          where: {
            matchId: matchIdNum,
          },
          orderBy: {
            createdAt: "asc",
          },
          select: {
            id: true,
            text: true,
            read: true,
            createdAt: true,
            senderId: true,
            receiverId: true,
          },
        });

        // Mark unread messages as read if they were sent to this user
        const unreadMessageIds = messages
          .filter((msg) => msg.receiverId === userId && !msg.read)
          .map((msg) => msg.id);

        if (unreadMessageIds.length > 0) {
          await prisma.message.updateMany({
            where: {
              id: {
                in: unreadMessageIds,
              },
            },
            data: {
              read: true,
            },
          });
        }

        return reply.send({ messages });
      } catch (error) {
        request.log.error(error);
        return reply
          .code(500)
          .send({ error: "Server error fetching messages" });
      }
    }
  );

  // Send a message to a user
  fastify.post<{ Body: CreateMessageDto }>(
    "/",
    { onRequest: [fastify.authenticate] },
    async (request: AuthenticatedRequest, reply) => {
      try {
        const { id: senderId } = request.user;
        const { receiverId, text } = request.body;

        if (senderId === receiverId) {
          return reply
            .code(400)
            .send({ error: "Cannot send a message to yourself" });
        }

        // Check if there's a match between these users
        const match = await prisma.match.findFirst({
          where: {
            OR: [
              { userAId: senderId, userBId: receiverId },
              { userAId: receiverId, userBId: senderId },
            ],
          },
        });

        if (!match) {
          return reply.code(403).send({
            error: "You must match with a user before sending messages",
          });
        }

        // Create the message
        const message = await prisma.message.create({
          data: {
            text,
            sender: { connect: { id: senderId } },
            receiver: { connect: { id: receiverId } },
            match: { connect: { id: match.id } },
          },
          select: {
            id: true,
            text: true,
            read: true,
            createdAt: true,
            senderId: true,
            receiverId: true,
            matchId: true,
          },
        });

        return reply.code(201).send({ message });
      } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: "Server error sending message" });
      }
    }
  );

  // Mark a message as read
  fastify.put(
    "/:messageId/read",
    { onRequest: [fastify.authenticate] },
    async (request: AuthenticatedRequest, reply) => {
      try {
        const { id: userId } = request.user;
        const { messageId } = request.params as { messageId: string };
        const messageIdNum = parseInt(messageId, 10);

        if (isNaN(messageIdNum)) {
          return reply.code(400).send({ error: "Invalid message ID" });
        }

        // Find the message
        const message = await prisma.message.findUnique({
          where: { id: messageIdNum },
        });

        if (!message) {
          return reply.code(404).send({ error: "Message not found" });
        }

        // Check if the user is the receiver of this message
        if (message.receiverId !== userId) {
          return reply
            .code(403)
            .send({ error: "Not authorized to mark this message as read" });
        }

        // Update the message
        const updatedMessage = await prisma.message.update({
          where: { id: messageIdNum },
          data: {
            read: true,
          },
          select: {
            id: true,
            text: true,
            read: true,
            createdAt: true,
            senderId: true,
            receiverId: true,
          },
        });

        return reply.send({ message: updatedMessage });
      } catch (error) {
        request.log.error(error);
        return reply
          .code(500)
          .send({ error: "Server error marking message as read" });
      }
    }
  );

  // Get unread message count
  fastify.get(
    "/unread",
    { onRequest: [fastify.authenticate] },
    async (request: AuthenticatedRequest, reply) => {
      try {
        const { id: userId } = request.user;

        // Count unread messages
        const unreadCount = await prisma.message.count({
          where: {
            receiverId: userId,
            read: false,
          },
        });

        // Get matches with unread messages
        const matchesWithUnread = await prisma.match.findMany({
          where: {
            OR: [{ userAId: userId }, { userBId: userId }],
            messages: {
              some: {
                receiverId: userId,
                read: false,
              },
            },
          },
          select: {
            id: true,
            userAId: true,
            userBId: true,
            _count: {
              select: {
                messages: {
                  where: {
                    receiverId: userId,
                    read: false,
                  },
                },
              },
            },
          },
        });

        // Format the response
        const matchCounts = matchesWithUnread.map((match) => ({
          matchId: match.id,
          userId: match.userAId === userId ? match.userBId : match.userAId,
          unreadCount: match._count.messages,
        }));

        return reply.send({
          totalUnread: unreadCount,
          matches: matchCounts,
        });
      } catch (error) {
        request.log.error(error);
        return reply
          .code(500)
          .send({ error: "Server error fetching unread counts" });
      }
    }
  );
};

export default messageRoutes;
