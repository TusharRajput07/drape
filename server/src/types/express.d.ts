// Adds the logged-in user (set by middlewares/authenticate.ts) to Express's Request.
declare global {
  namespace Express {
    interface Request {
      user?: { id: string };
    }
  }
}

export {};
