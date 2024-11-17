import { Router } from "express";
import * as userController from "../controllers/userController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = new Router();

router.get("/:id", protect, userController.getUser);
router.patch("/:id/password", protect, userController.updatePassword);
router.patch("/:id", protect, userController.update);

export default router;
