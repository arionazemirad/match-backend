import { FastifyRequest, FastifyReply } from "fastify";
import { QuestionType } from "@prisma/client";

// Extend FastifyRequest to include user information
export interface AuthenticatedRequest extends FastifyRequest {
  user: {
    id: number;
    email: string;
    communityId: number;
  };
}

// User types
export interface CreateUserDto {
  email: string;
  password: string;
  name: string;
  bio?: string;
  communityId: number;
}

export interface UpdateUserDto {
  name?: string;
  bio?: string;
  email?: string;
  password?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

// Community types
export interface CreateCommunityDto {
  name: string;
  slug: string;
}

export interface UpdateCommunityDto {
  name?: string;
  slug?: string;
}

// Question types
export interface CreateQuestionDto {
  text: string;
  type: QuestionType;
  communityId: number;
}

export interface UpdateQuestionDto {
  text?: string;
  type?: QuestionType;
}

// Answer types
export interface CreateAnswerDto {
  questionId: number;
  value: string;
}

// Like types
export interface CreateLikeDto {
  toUserId: number;
}

// Message types
export interface CreateMessageDto {
  receiverId: number;
  text: string;
}

// Match types
export interface MatchDto {
  userId: number;
  matchedUserId: number;
}

// User traits
export interface UserTraits {
  personalityTraits: {
    [key: string]: number; // e.g., { "extroversion": 0.8, "openness": 0.6 }
  };
  interests: string[];
  values: string[];
}

// OpenAI interface
export interface TraitExtractorResult {
  traits: UserTraits;
}

// Route handler types
export type RouteHandler = (
  request: FastifyRequest,
  reply: FastifyReply
) => Promise<void>;
export type AuthenticatedRouteHandler = (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => Promise<void>;
