import { FastifyInstance, FastifyPluginAsync } from "fastify";
import {
  AuthenticatedRequest,
  CreateCommunityDto,
  UpdateCommunityDto,
} from "../types";
import prisma from "../db/client";

const communityRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  // Get all communities
  fastify.get("/", async (request, reply) => {
    try {
      const communities = await prisma.community.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
          _count: {
            select: {
              users: true,
            },
          },
        },
      });

      return reply.send({ communities });
    } catch (error) {
      request.log.error(error);
      return reply
        .code(500)
        .send({ error: "Server error fetching communities" });
    }
  });

  // Get a specific community by slug
  fastify.get("/:slug", async (request, reply) => {
    try {
      const { slug } = request.params as { slug: string };

      const community = await prisma.community.findUnique({
        where: {
          slug,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
          _count: {
            select: {
              users: true,
            },
          },
        },
      });

      if (!community) {
        return reply.code(404).send({ error: "Community not found" });
      }

      return reply.send({ community });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: "Server error fetching community" });
    }
  });

  // Create a new community
  fastify.post<{ Body: CreateCommunityDto }>("/", async (request, reply) => {
    try {
      const { name, slug } = request.body;

      // Check if slug is already in use
      const existingCommunity = await prisma.community.findUnique({
        where: { slug },
      });

      if (existingCommunity) {
        return reply.code(400).send({ error: "Slug already in use" });
      }

      // Create the community
      const community = await prisma.community.create({
        data: {
          name,
          slug,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
        },
      });

      return reply.code(201).send({ community });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: "Server error creating community" });
    }
  });

  // Update a community
  fastify.put<{ Body: UpdateCommunityDto }>(
    "/:id",
    { onRequest: [fastify.authenticate] },
    async (request: AuthenticatedRequest, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { name, slug } = request.body;
        const communityId = parseInt(id, 10);

        if (isNaN(communityId)) {
          return reply.code(400).send({ error: "Invalid community ID" });
        }

        // Check if the authenticated user belongs to this community (for admin rights check)
        const userCommunityId = request.user.communityId;
        if (userCommunityId !== communityId) {
          return reply
            .code(403)
            .send({ error: "Unauthorized to update this community" });
        }

        // Prepare update data
        const updateData: any = {};
        if (name) updateData.name = name;
        if (slug) {
          // Check if slug is already in use by another community
          const existingCommunity = await prisma.community.findUnique({
            where: { slug },
          });

          if (existingCommunity && existingCommunity.id !== communityId) {
            return reply.code(400).send({ error: "Slug already in use" });
          }

          updateData.slug = slug;
        }

        // Only update if we have at least one field to update
        if (Object.keys(updateData).length === 0) {
          return reply.code(400).send({ error: "No fields to update" });
        }

        // Update the community
        const community = await prisma.community.update({
          where: { id: communityId },
          data: updateData,
          select: {
            id: true,
            name: true,
            slug: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        return reply.send({ community });
      } catch (error) {
        request.log.error(error);
        return reply
          .code(500)
          .send({ error: "Server error updating community" });
      }
    }
  );

  // Get users in a community
  fastify.get("/:id/users", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const communityId = parseInt(id, 10);

      if (isNaN(communityId)) {
        return reply.code(400).send({ error: "Invalid community ID" });
      }

      // Check if community exists
      const community = await prisma.community.findUnique({
        where: { id: communityId },
      });

      if (!community) {
        return reply.code(404).send({ error: "Community not found" });
      }

      // Get users from the community
      const users = await prisma.user.findMany({
        where: {
          communityId,
        },
        select: {
          id: true,
          name: true,
          bio: true,
          createdAt: true,
        },
      });

      return reply.send({
        community: {
          id: community.id,
          name: community.name,
          slug: community.slug,
        },
        users,
      });
    } catch (error) {
      request.log.error(error);
      return reply
        .code(500)
        .send({ error: "Server error fetching community users" });
    }
  });
};

export default communityRoutes;
