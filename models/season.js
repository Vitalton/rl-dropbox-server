import { model, Schema } from "mongoose";

// Схема для предметов, выпавших из коробок
const itemSchema = new Schema(
   {
      quality: {
         type: String,
         enum: ["sport", "special", "lux", "import", "exotic", "black_market"], // 6 видов качества
         required: true,
      },
      quantity: {
         type: Number,
         required: true,
      },
   },
   { _id: false },
);

// Схема для коробок, которые открывает пользователь
const boxSchema = new Schema(
   {
      type: {
         type: String,
         enum: ["regular", "tournament"], // Тип коробки: обычная или турнирная
         required: true,
      },
      box_variant: {
         type: String,
         enum: ["sport", "special", "lux", "import", "golden"], // Варианты для обычных коробок
         required: function () {
            return this.type === "regular"; // Вариант обязателен только для обычных коробок
         },
      },
      items: [itemSchema], // Массив предметов
   },
   { _id: false },
);

// Схема для сезонов
const seasonSchema = new Schema({
   user_id: {
      type: Schema.Types.ObjectId, // Ссылка на пользователя
      ref: "User",
      required: true,
   },
   season_number: {
      type: Number, // Номер сезона
      required: true,
   },
   boxes: [boxSchema], // Массив коробок, открытых пользователем в сезоне
});

export default model("Season", seasonSchema);
