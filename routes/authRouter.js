import { Router } from "express";
import * as userController from "../controllers/userController.js";
import { validationRequest } from "../utils/validations.js";

const router = new Router();

// Authorization
router.post("/register", validationRequest, userController.register);
router.post("/login", validationRequest, userController.login);

export default router;
