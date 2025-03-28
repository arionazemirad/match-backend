import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import swagger from "@fastify/swagger";
import { config } from "dotenv";

// Routes
import authRoutes from "./routes/auth";
import userRoutes from "./routes/user";
import communityRoutes from "./routes/community";
import matchRoutes from "./routes/match";
import messageRoutes from "./routes/message";
import questionRoutes from "./routes/question";

// Initialize environment variables
config();

// Create Fastify instance
const server: FastifyInstance = Fastify({
  logger: process.env.NODE_ENV === "development",
});

// Register plugins
server.register(cors, {
  origin: true, // Reflect the request origin
  credentials: true,
});

server.register(jwt, {
  secret: process.env.JWT_SECRET || "supersecret",
});

// Swagger documentation
server.register(swagger, {
  routePrefix: "/documentation",
  swagger: {
    info: {
      title: "Dating App API",
      description: "API documentation for the multi-tenant dating application",
      version: "1.0.0",
    },
    externalDocs: {
      url: "https://swagger.io",
      description: "Find more info here",
    },
    host: `${process.env.HOST || "localhost"}:${process.env.PORT || 3000}`,
    schemes: ["http", "https"],
    consumes: ["application/json"],
    produces: ["application/json"],
  },
  exposeRoute: true,
});

// Authentication verification decorator
server.decorate("authenticate", async (request: any, reply: any) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({ error: "Unauthorized" });
  }
});

// Register routes
server.register(authRoutes, { prefix: "/api/auth" });
server.register(userRoutes, { prefix: "/api/users" });
server.register(communityRoutes, { prefix: "/api/communities" });
server.register(matchRoutes, { prefix: "/api/matches" });
server.register(messageRoutes, { prefix: "/api/messages" });
server.register(questionRoutes, { prefix: "/api/questions" });

// Root route
server.get("/", async (request, reply) => {
  return { status: "OK", message: "Dating App API is running" };
});

// Start server
const start = async () => {
  try {
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
    const host = process.env.HOST || "0.0.0.0";

    await server.listen({ port, host });
    console.log(`Server is running on ${host}:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
