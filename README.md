# AI-Powered Dating App Backend

A complete TypeScript backend for a multi-tenant AI-powered dating app using Node.js, Fastify, and Prisma ORM with PostgreSQL.

## Features

- **Multi-tenancy**: Communities (e.g., Discord servers, interest groups) have their own matchmaking pools
- **AI-powered matching**: Uses OpenAI to extract personality traits from user bios
- **Matching algorithm**: Cosine similarity on trait vectors to find compatible users
- **Authentication**: JWT-based authentication system
- **Messaging**: Real-time messaging between matched users
- **Likes & Matches**: Users can like profiles and create matches when mutual

## Tech Stack

- **TypeScript**: Type-safe JavaScript
- **Node.js**: JavaScript runtime
- **Fastify**: Fast and low overhead web framework
- **Prisma ORM**: Type-safe database client
- **PostgreSQL**: Relational database
- **OpenAI API**: AI integration for trait extraction
- **JWT**: Token-based authentication

## Project Structure

```
/src
  /controllers   - Logic handlers
  /db            - Prisma schema and client
  /routes        - API routes (auth, users, communities, matches, messages)
  /services      - Business logic services (matching, OpenAI integration)
  /types         - TypeScript types and interfaces
  /utils         - Helper functions
  server.ts      - Main server entry point
/prisma
  schema.prisma  - Database schema
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/me` - Get current user profile

### Users

- `GET /api/users` - Get all users in same community
- `GET /api/users/:id` - Get a specific user
- `PUT /api/users` - Update user profile
- `DELETE /api/users` - Delete current user

### Communities

- `GET /api/communities` - Get all communities
- `GET /api/communities/:slug` - Get a specific community
- `POST /api/communities` - Create a new community
- `PUT /api/communities/:id` - Update a community
- `GET /api/communities/:id/users` - Get users in a community

### Matching

- `GET /api/matches/potential` - Get potential matches
- `GET /api/matches` - Get all current matches
- `POST /api/matches/like` - Like a user
- `DELETE /api/matches/like/:userId` - Unlike a user
- `GET /api/matches/:matchId` - Get match details

### Messaging

- `GET /api/messages/match/:matchId` - Get messages in a match
- `POST /api/messages` - Send a message
- `PUT /api/messages/:messageId/read` - Mark message as read
- `GET /api/messages/unread` - Get unread message count

### Questions & Answers

- `GET /api/questions` - Get questions for current community
- `POST /api/questions` - Create a new question
- `PUT /api/questions/:id` - Update a question
- `DELETE /api/questions/:id` - Delete a question
- `POST /api/questions/answer` - Answer a question
- `GET /api/questions/answers` - Get current user's answers
- `GET /api/questions/answers/:userId` - Get another user's answers

## Setup & Installation

### Prerequisites

- Node.js (v14+)
- PostgreSQL database
- OpenAI API key

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```
DATABASE_URL="postgresql://username:password@localhost:5432/matchapp?schema=public"
JWT_SECRET="your-super-secret-jwt-token"
SALT_ROUNDS=10
OPENAI_API_KEY="your-openai-api-key"
PORT=3000
HOST="0.0.0.0"
NODE_ENV="development"
```

### Installation

1. Clone the repository

```bash
git clone https://github.com/yourusername/match-backend.git
cd match-backend
```

2. Install dependencies

```bash
npm install
```

3. Generate Prisma client

```bash
npm run prisma:generate
```

4. Run database migrations

```bash
npm run prisma:migrate
```

5. Start the development server

```bash
npm run dev
```

## Production Deployment

1. Build the TypeScript code

```bash
npm run build
```

2. Start the production server

```bash
npm start
```

## License

MIT
