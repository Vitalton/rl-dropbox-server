import { body } from "express-validator";

export const validationRequest = [
   body("email", "Неверный формат почты").notEmpty().isEmail(),
   body("password", "Пароль должен быть минимум 6 символов").isLength({ min: 6 }),
];
