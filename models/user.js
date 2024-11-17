import { model, Schema } from "mongoose";

// Схема для пользователей
const UserSchema = new Schema(
   {
      email: {
         type: String,
         required: true,
         unique: true,
      },
      password: {
         type: String,
         required: true,
      },
      role: {
         type: String,
         default: "user",
      },
      isVerified: {
         type: Boolean,
         default: false,
      },
   },
   { timestamps: true },
);

export default model("User", UserSchema);
