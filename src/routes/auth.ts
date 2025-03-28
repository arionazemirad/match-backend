import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { CreateUserDto, LoginDto } from "../types";
import prisma from "../db/client";
import { hashPassword, verifyPassword } from "../utils/auth";
import { extractTraitsFromBio } from "../services/openai";

const authRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Register a new user
  fastify.post<{ Body: CreateUserDto }>("/register", async (request, reply) => {
    try {
      const { email, password, name, bio, communityId } = request.body;

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return reply.code(400).send({ error: "Email already in use" });
      }

      // Check if the community exists
      const community = await prisma.community.findUnique({
        where: { id: communityId },
      });

      if (!community) {
        return reply.code(404).send({ error: "Community not found" });
      }

      // Hash the password
      const hashedPassword = await hashPassword(password);

      // Extract trait vector from bio if provided
      let traitVector = null;
      if (bio) {
        traitVector = await extractTraitsFromBio(bio);
      }

      // Create the user
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          bio,
          traitVector,
          community: {
            connect: { id: communityId },
          },
        },
        select: {
          id: true,
          email: true,
          name: true,
          bio: true,
          communityId: true,
          createdAt: true,
        },
      });

      // Generate token
      const token = fastify.jwt.sign(
        {
          id: user.id,
          email: user.email,
          communityId: user.communityId,
        },
        { expiresIn: "7d" }
      );

      return reply.code(201).send({ user, token });
    } catch (error) {
      request.log.error(error);
      return reply
        .code(500)
        .send({ error: "Server error during registration" });
    }
  });

  // User login
  fastify.post<{ Body: LoginDto }>("/login", async (request, reply) => {
    try {
      const { email, password } = request.body;

      // Find the user
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        return reply.code(401).send({ error: "Invalid credentials" });
      }

      // Verify password
      const isPasswordValid = await verifyPassword(password, user.password);

      if (!isPasswordValid) {
        return reply.code(401).send({ error: "Invalid credentials" });
      }

      // Generate token
      const token = fastify.jwt.sign(
        {
          id: user.id,
          email: user.email,
          communityId: user.communityId,
        },
        { expiresIn: "7d" }
      );

      return reply.send({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          bio: user.bio,
          communityId: user.communityId,
        },
        token,
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: "Server error during login" });
    }
  });

  // Get current user profile
  fastify.get(
    "/me",
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const { id } = request.user as { id: number };

        const user = await prisma.user.findUnique({
          where: { id },
          select: {
            id: true,
            email: true,
            name: true,
            bio: true,
            communityId: true,
            community: {
              select: {
                name: true,
                slug: true,
              },
            },
          },
        });

        if (!user) {
          return reply.code(404).send({ error: "User not found" });
        }

        return reply.send({ user });
      } catch (error) {
        request.log.error(error);
        return reply
          .code(500)
          .send({ error: "Server error fetching user profile" });
      }
    }
  );
};

export default authRoutes;
