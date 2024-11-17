import jwt from "jsonwebtoken";
import User from "../models/user.js";
import asyncHandler from "express-async-handler";

export const protect = asyncHandler(async (req, res, next) => {
   let token = null;

   // Проверяем наличие заголовка авторизации и токена
   if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
   }

   if (!token) {
      return res.status(401).json({ message: "Отсутствует токен авторизации" });
   }

   try {
      // Верифицируем токен
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_TOKEN);

      // Ищем пользователя по ID, исключая поля, которые не нужны
      const user = await User.findById(decoded.id).select("-password -updatedAt -__v");

      if (!user) {
         return res.status(401).json({ message: "Пользователь не найден" });
      }

      // Если пользователь найден, добавляем его в объект запроса
      req.user = user;

      next(); // Передаём управление следующему middleware
   } catch (error) {
      // Обрабатываем разные ошибки JWT
      if (error.name === "TokenExpiredError") {
         return res.status(401).json({ message: "Токен истёк, повторите вход" });
      } else if (error.name === "JsonWebTokenError") {
         return res.status(401).json({ message: "Неверный токен" });
      } else {
         return res.status(401).json({ message: "Ошибка авторизации" });
      }
   }
});
