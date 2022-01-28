import Router from 'express';
import userController from '../controllers/user-controller.js';
import {body} from 'express-validator';
import authMiddleware from '../middlewares/auth-middleware.js';
const routerAuth = new Router();

routerAuth.post('/registration',body('email').isEmail(),body('password').isLength({min: 3, max:32}), userController.registration);
routerAuth.post('/login', userController.login);
routerAuth.post('/logout', userController.logout);
routerAuth.get('/activate/:link', userController.activate);
routerAuth.get('/refresh', userController.refresh);
routerAuth.get('/users',authMiddleware, userController.getUsers);

export default routerAuth