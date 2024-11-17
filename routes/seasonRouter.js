import { Router } from "express";
import * as seasonController from "../controllers/seasonController.js";
import * as statsController from "../controllers/statsController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = new Router();

// seasons
router.get("/seasons", protect, seasonController.getSeasons);
router.get("/seasons/completed", protect, seasonController.getCompletedSeasons);
router.get("/seasons/:id", protect, seasonController.getSeason);

router.post("/seasons/new", protect, seasonController.createSeason);
router.patch("/seasons/:id", protect, seasonController.updateSeason);

// statistics
router.get("/stats/total/qualities", protect, statsController.getTotalByContent);
router.get("/stats/total/seasons", protect, statsController.getTotalBySeasons);
router.get("/stats/total/probability", protect, statsController.getTotalProbabilityByContent);
router.get("/stats/seasons/:number/qualities", protect, statsController.getSeasonByContent);
router.get(
   "/stats/seasons/:number/probability",
   protect,
   statsController.getSeasonProbabilityByContent,
);

export default router;
