import * as dotenv from "dotenv";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import mongoose from "mongoose";

import authRouter from "./routes/authRouter.js";
import userRouter from "./routes/userRouter.js";
import seasonRouter from "./routes/seasonRouter.js";

dotenv.config();

const app = express();

// Middlewares
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: process.env.CLIENT_URL }));

// Routes
app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/drops", seasonRouter);

const start = async () => {
   try {
      // Start DB
      await mongoose.connect(process.env.DB_URL);
      console.log("Connected to DB");
      // Start server
      app.listen(process.env.PORT || 8000, (err) => {
         if (err) {
            return console.log(err);
         }

         console.log(`Server started on port ${process.env.PORT}`);
      });
   } catch (e) {
      console.error(e);
   }
};

start();
