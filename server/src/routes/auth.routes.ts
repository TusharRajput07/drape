import { Router } from 'express';
import * as auth from '../controllers/auth.controller.js';
import { loginLimit, signupLimit } from '../middlewares/rate-limit.js';
import { validate } from '../middlewares/validate.js';
import { loginSchema, signupSchema } from '../validators/auth.schema.js';

// The only public routes (02 §6.1).
export const authRouter = Router();

authRouter.post('/signup', signupLimit, validate({ body: signupSchema }), auth.signup);
authRouter.post('/login', loginLimit, validate({ body: loginSchema }), auth.login);
authRouter.post('/refresh', auth.refresh);
authRouter.post('/logout', auth.logout);
