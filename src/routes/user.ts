import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { AuthenticatedRequest, UpdateUserDto } from "../types";
import prisma from "../db/client";
import { hashPassword } from "../utils/auth";
import { extractTraitsFromBio } from "../services/openai";

const userRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Get all users in the same community
  fastify.get(
    "/",
    { onRequest: [fastify.authenticate] },
    async (request: AuthenticatedRequest, reply) => {
      try {
        const { communityId } = request.user;

        const users = await prisma.user.findMany({
          where: {
            communityId,
          },
          select: {
            id: true,
            name: true,
            email: true,
            bio: true,
            createdAt: true,
          },
        });

        return reply.send({ users });
      } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: "Server error fetching users" });
      }
    }
  );

  // Get a specific user by ID
  fastify.get(
    "/:id",
    { onRequest: [fastify.authenticate] },
    async (request: AuthenticatedRequest, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { communityId } = request.user;
        const userId = parseInt(id, 10);

        if (isNaN(userId)) {
          return reply.code(400).send({ error: "Invalid user ID" });
        }

        const user = await prisma.user.findUnique({
          where: {
            id: userId,
          },
          select: {
            id: true,
            name: true,
            email: true,
            bio: true,
            communityId: true,
            createdAt: true,
          },
        });

        if (!user) {
          return reply.code(404).send({ error: "User not found" });
        }

        // Check if the user belongs to the same community
        if (user.communityId !== communityId) {
          return reply.code(403).send({ error: "Access denied" });
        }

        return reply.send({ user });
      } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: "Server error fetching user" });
      }
    }
  );

  // Update user profile
  fastify.put<{ Body: UpdateUserDto }>(
    "/",
    { onRequest: [fastify.authenticate] },
    async (request: AuthenticatedRequest, reply) => {
      try {
        const { id } = request.user;
        const { name, bio, email, password } = request.body;

        // Prepare update data
        const updateData: any = {};

        if (name) updateData.name = name;
        if (bio) {
          updateData.bio = bio;
          // Update trait vector if bio is changed
          updateData.traitVector = await extractTraitsFromBio(bio);
        }
        if (email) updateData.email = email;
        if (password) updateData.password = await hashPassword(password);

        // Only update if we have at least one field to update
        if (Object.keys(updateData).length === 0) {
          return reply.code(400).send({ error: "No fields to update" });
        }

        // Update the user
        const updatedUser = await prisma.user.update({
          where: { id },
          data: updateData,
          select: {
            id: true,
            name: true,
            email: true,
            bio: true,
            communityId: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        return reply.send({ user: updatedUser });
      } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: "Server error updating user" });
      }
    }
  );

  // Delete user
  fastify.delete(
    "/",
    { onRequest: [fastify.authenticate] },
    async (request: AuthenticatedRequest, reply) => {
      try {
        const { id } = request.user;

        await prisma.user.delete({
          where: { id },
        });

        return reply.code(204).send();
      } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: "Server error deleting user" });
      }
    }
  );
};

export default userRoutes;
