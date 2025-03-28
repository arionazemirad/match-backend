import { FastifyInstance, FastifyPluginAsync } from "fastify";
import {
  AuthenticatedRequest,
  CreateAnswerDto,
  CreateQuestionDto,
  UpdateQuestionDto,
} from "../types";
import prisma from "../db/client";

const questionRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Get all questions for a community
  fastify.get("/community/:communityId", async (request, reply) => {
    try {
      const { communityId } = request.params as { communityId: string };
      const communityIdNum = parseInt(communityId, 10);

      if (isNaN(communityIdNum)) {
        return reply.code(400).send({ error: "Invalid community ID" });
      }

      // Check if community exists
      const community = await prisma.community.findUnique({
        where: { id: communityIdNum },
      });

      if (!community) {
        return reply.code(404).send({ error: "Community not found" });
      }

      // Get questions
      const questions = await prisma.question.findMany({
        where: {
          communityId: communityIdNum,
        },
        select: {
          id: true,
          text: true,
          type: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      return reply.send({ questions });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: "Server error fetching questions" });
    }
  });

  // Create a new question
  fastify.post<{ Body: CreateQuestionDto }>(
    "/",
    { onRequest: [fastify.authenticate] },
    async (request: AuthenticatedRequest, reply) => {
      try {
        const { text, type, communityId } = request.body;
        const { communityId: userCommunityId } = request.user;

        // Check if the community exists
        const community = await prisma.community.findUnique({
          where: { id: communityId },
        });

        if (!community) {
          return reply.code(404).send({ error: "Community not found" });
        }

        // Ensure the user belongs to the community they're creating a question for
        if (communityId !== userCommunityId) {
          return reply
            .code(403)
            .send({
              error: "Not authorized to create questions for this community",
            });
        }

        // Create the question
        const question = await prisma.question.create({
          data: {
            text,
            type,
            community: {
              connect: { id: communityId },
            },
          },
          select: {
            id: true,
            text: true,
            type: true,
            communityId: true,
            createdAt: true,
          },
        });

        return reply.code(201).send({ question });
      } catch (error) {
        request.log.error(error);
        return reply
          .code(500)
          .send({ error: "Server error creating question" });
      }
    }
  );

  // Update a question
  fastify.put<{ Body: UpdateQuestionDto }>(
    "/:id",
    { onRequest: [fastify.authenticate] },
    async (request: AuthenticatedRequest, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { text, type } = request.body;
        const questionId = parseInt(id, 10);
        const { communityId: userCommunityId } = request.user;

        if (isNaN(questionId)) {
          return reply.code(400).send({ error: "Invalid question ID" });
        }

        // Get the question and check if it belongs to the user's community
        const question = await prisma.question.findUnique({
          where: { id: questionId },
        });

        if (!question) {
          return reply.code(404).send({ error: "Question not found" });
        }

        if (question.communityId !== userCommunityId) {
          return reply
            .code(403)
            .send({ error: "Not authorized to update this question" });
        }

        // Prepare update data
        const updateData: any = {};
        if (text) updateData.text = text;
        if (type) updateData.type = type;

        // Only update if we have at least one field to update
        if (Object.keys(updateData).length === 0) {
          return reply.code(400).send({ error: "No fields to update" });
        }

        // Update the question
        const updatedQuestion = await prisma.question.update({
          where: { id: questionId },
          data: updateData,
          select: {
            id: true,
            text: true,
            type: true,
            communityId: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        return reply.send({ question: updatedQuestion });
      } catch (error) {
        request.log.error(error);
        return reply
          .code(500)
          .send({ error: "Server error updating question" });
      }
    }
  );

  // Delete a question
  fastify.delete(
    "/:id",
    { onRequest: [fastify.authenticate] },
    async (request: AuthenticatedRequest, reply) => {
      try {
        const { id } = request.params as { id: string };
        const questionId = parseInt(id, 10);
        const { communityId: userCommunityId } = request.user;

        if (isNaN(questionId)) {
          return reply.code(400).send({ error: "Invalid question ID" });
        }

        // Get the question and check if it belongs to the user's community
        const question = await prisma.question.findUnique({
          where: { id: questionId },
        });

        if (!question) {
          return reply.code(404).send({ error: "Question not found" });
        }

        if (question.communityId !== userCommunityId) {
          return reply
            .code(403)
            .send({ error: "Not authorized to delete this question" });
        }

        // Delete the question
        await prisma.question.delete({
          where: { id: questionId },
        });

        return reply.code(204).send();
      } catch (error) {
        request.log.error(error);
        return reply
          .code(500)
          .send({ error: "Server error deleting question" });
      }
    }
  );

  // Get questions for the current user's community
  fastify.get(
    "/",
    { onRequest: [fastify.authenticate] },
    async (request: AuthenticatedRequest, reply) => {
      try {
        const { communityId } = request.user;

        // Get questions
        const questions = await prisma.question.findMany({
          where: {
            communityId,
          },
          select: {
            id: true,
            text: true,
            type: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        });

        return reply.send({ questions });
      } catch (error) {
        request.log.error(error);
        return reply
          .code(500)
          .send({ error: "Server error fetching questions" });
      }
    }
  );

  // Answer a question
  fastify.post<{ Body: CreateAnswerDto }>(
    "/answer",
    { onRequest: [fastify.authenticate] },
    async (request: AuthenticatedRequest, reply) => {
      try {
        const { id: userId, communityId } = request.user;
        const { questionId, value } = request.body;

        // Check if the question exists and belongs to the user's community
        const question = await prisma.question.findUnique({
          where: { id: questionId },
        });

        if (!question) {
          return reply.code(404).send({ error: "Question not found" });
        }

        if (question.communityId !== communityId) {
          return reply
            .code(403)
            .send({ error: "Not authorized to answer this question" });
        }

        // Check if user already answered this question
        const existingAnswer = await prisma.answer.findUnique({
          where: {
            userId_questionId: {
              userId,
              questionId,
            },
          },
        });

        let answer;

        if (existingAnswer) {
          // Update the existing answer
          answer = await prisma.answer.update({
            where: {
              userId_questionId: {
                userId,
                questionId,
              },
            },
            data: {
              value,
            },
            select: {
              id: true,
              value: true,
              userId: true,
              questionId: true,
              createdAt: true,
              updatedAt: true,
            },
          });
        } else {
          // Create a new answer
          answer = await prisma.answer.create({
            data: {
              value,
              user: {
                connect: { id: userId },
              },
              question: {
                connect: { id: questionId },
              },
            },
            select: {
              id: true,
              value: true,
              userId: true,
              questionId: true,
              createdAt: true,
              updatedAt: true,
            },
          });
        }

        return reply.code(201).send({ answer });
      } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: "Server error saving answer" });
      }
    }
  );

  // Get a user's answers
  fastify.get(
    "/answers",
    { onRequest: [fastify.authenticate] },
    async (request: AuthenticatedRequest, reply) => {
      try {
        const { id: userId } = request.user;

        // Get the user's answers
        const answers = await prisma.answer.findMany({
          where: {
            userId,
          },
          select: {
            id: true,
            value: true,
            questionId: true,
            createdAt: true,
            question: {
              select: {
                text: true,
                type: true,
              },
            },
          },
        });

        return reply.send({ answers });
      } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: "Server error fetching answers" });
      }
    }
  );

  // Get a specific user's answers (for viewing profiles)
  fastify.get(
    "/answers/:userId",
    { onRequest: [fastify.authenticate] },
    async (request: AuthenticatedRequest, reply) => {
      try {
        const { userId } = request.params as { userId: string };
        const targetUserId = parseInt(userId, 10);
        const { communityId } = request.user;

        if (isNaN(targetUserId)) {
          return reply.code(400).send({ error: "Invalid user ID" });
        }

        // Check if the target user is in the same community
        const targetUser = await prisma.user.findUnique({
          where: { id: targetUserId },
          select: { communityId: true },
        });

        if (!targetUser) {
          return reply.code(404).send({ error: "User not found" });
        }

        if (targetUser.communityId !== communityId) {
          return reply
            .code(403)
            .send({ error: "Not authorized to view this user's answers" });
        }

        // Get the user's answers
        const answers = await prisma.answer.findMany({
          where: {
            userId: targetUserId,
          },
          select: {
            id: true,
            value: true,
            questionId: true,
            createdAt: true,
            question: {
              select: {
                text: true,
                type: true,
              },
            },
          },
        });

        return reply.send({ answers });
      } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: "Server error fetching answers" });
      }
    }
  );
};

export default questionRoutes;
