import bcrypt from "bcrypt";
import asyncHandler from "express-async-handler";
import User from "../models/user.js";
import { validationResult } from "express-validator";
import jwt from "jsonwebtoken";

const generateToken = (id) => {
   return jwt.sign({ id }, process.env.JWT_ACCESS_TOKEN, {
      expiresIn: "7d",
   });
};

const registration = async (data, role = "user") => {
   const userExists = await User.findOne({ email: data.email });
   if (userExists) return { status: 409 };

   // Hash password
   const salt = await bcrypt.genSalt(10);
   const passwordHash = await bcrypt.hash(data.password || "Password2024", salt);

   // Create user
   const newUser = await User.create({
      ...data,
      role: role,
      password: passwordHash,
   });
   const { password, updatedAt, __v, ...userData } = newUser._doc;
   if (newUser) {
      return {
         status: 201,
         data: {
            ...userData,
            token: generateToken(userData._id),
         },
      };
   } else return { status: 400 };
};

export const register = asyncHandler(async (req, res) => {
   const status = {
      409: { status: 409, message: "Пользователь уже существует" },
      400: { status: 400, message: "Не удалось зарегистрировать пользователя" },
   };
   const user = await registration(req.body);
   if (user.status === 201)
      res.status(201).json({ message: "Пользователь успешно зарегистрирован!" });
   if (user.status in status) {
      const result = status[user.status];
      res.status(result.status).json({ message: result.message });
   }
});

export const login = asyncHandler(async (req, res) => {
   const errors = validationResult(req);
   if (!errors.isEmpty()) {
      res.status(400).json({ message: "Неверно заполнены данные" });
   }
   const user = await User.findOne({ email: req.body.email });
   if (user && (await bcrypt.compare(req.body.password, user.password))) {
      const { password, updatedAt, __v, ...userData } = user._doc;

      res.status(201).json({
         ...userData,
         token: generateToken(userData._id),
      });
   } else {
      res.status(401).json({ message: "Данные недействительны" });
   }
});

export const getUser = asyncHandler(async (req, res) => {
   try {
      const user = await User.findById(req.params.id);
      const { password, updatedAt, __v, ...userData } = user._doc;
      res.status(200).json({
         ...userData,
         token: generateToken(userData._id),
      });
   } catch (err) {
      res.status(500).json({ message: "Не удалось найти пользователя" });
   }
});

export const update = asyncHandler(async (req, res) => {
   const errors = validationResult(req);
   if (!errors.isEmpty()) {
      res.status(400).json({ message: "Неверно заполнены данные" });
   }
   try {
      const user = await User.findById(req.params.id);

      if (!user) {
         res.status(404).json({ message: "Пользователь не найден" });
      }

      if (user._id.toString() !== req.user._id.toString()) {
         res.status(401).json({ message: "Доступ запрещен" });
      }
      const updatedUser = await User.findByIdAndUpdate(
         req.user._id,
         {
            $set: {
               email: req.body.email,
            },
         },
         { new: true },
      );
      const { password, updatedAt, __v, ...userData } = updatedUser._doc;

      res.status(200).json({
         ...userData,
         message: "Данные пользователя обновлены!",
      });
   } catch (err) {
      res.status(500).json({ message: "Не удалось обновить данные пользователя" });
   }
});

export const updatePassword = asyncHandler(async (req, res) => {
   const errors = validationResult(req);
   if (!errors.isEmpty()) {
      res.status(400).json({ message: "Неверно заполнены данные" });
   }
   try {
      const user = await User.findById(req.params.id);

      if (!user) {
         res.status(404).json({ message: "Пользователь не найден" });
      }

      if (user._id.toString() !== req.user._id.toString()) {
         res.status(401).json({ message: "Доступ запрещен" });
      }

      if (!(await bcrypt.compare(req.body.oldPassword, user.password))) {
         res.status(401).json({ message: "Неверно указан старый пароль" });
      }

      const newPassword = req.body.newPassword;
      const salt = await bcrypt.genSalt(10);
      const hashedNewPassword = await bcrypt.hash(newPassword, salt);

      const updatedUser = await User.findByIdAndUpdate(
         req.user._id,
         {
            $set: {
               password: hashedNewPassword,
            },
         },
         { new: true },
      );

      res.status(200).json({
         message: "Пароль успешно обновлен!",
      });
   } catch (err) {
      res.status(500).json({ message: "Не удалось обновить пароль!" });
   }
});
