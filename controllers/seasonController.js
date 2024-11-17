import asyncHandler from "express-async-handler";
import Season from "../models/season.js";
import mongoose from "mongoose";

export const getSeasons = asyncHandler(async (req, res) => {
   try {
      const seasons = await Season.find({ user_id: req.user.id });
      res.status(200).json({ seasons });
   } catch (error) {
      res.status(500).json({ message: "Не удалось получить данные о сезонах пользователя!" });
   }
});
export const getCompletedSeasons = asyncHandler(async (req, res) => {
   try {
      const completedSeasons = await Season.aggregate([
         { $match: { user_id: new mongoose.Types.ObjectId(req.user.id) } }, // Шаг 1: фильтрация по user_id
         { $group: { _id: null, seasons: { $addToSet: "$season_number" } } }, // Шаг 2: группировка и сбор уникальных номеров сезонов
         { $project: { _id: 0, seasons: 1 } }, // Шаг 3: исключение поля _id и возврат только массива номеров сезонов
      ]).then((result) => result[0]?.seasons || []);
      if (completedSeasons.length > 0) completedSeasons.sort((a, b) => a - b);
      res.status(200).json(completedSeasons);
   } catch (error) {
      res.status(500).json({ message: "Ошибка при получении номеров сезонов!" });
   }
});

// CRUD for season
export const getSeason = asyncHandler(async (req, res) => {
   try {
      const season = await Season.findOne({
         user_id: req.user.id,
         season_number: req.params.id,
      });
      const { _id, boxes, ...seasonData } = season._doc;
      res.status(200).json({ id: _id, boxes });
   } catch (error) {
      res.status(500).json({ message: "Не удалось получить данные о данном сезоне" });
   }
});

export const createSeason = asyncHandler(async (req, res) => {
   try {
      // Ищем существующий сезон по user_id и номеру сезона
      let season = await Season.findOne({
         user_id: req.user.id,
         season_number: req.body.season_number,
      });

      // Если сезона нет, создаем новый
      if (!season) {
         const result = await Season.create({
            user_id: req.user.id,
            season_number: req.body.season_number,
            boxes: req.body.boxes, // Добавляем переданные коробки
         });
         return res.status(201).json({ message: "Сезон успешно создан!" });
      }

      // Проверяем типы коробок в существующем сезоне
      const existingBoxTypes = new Set(season.boxes.map((box) => box.type));
      const newBoxType = req.body.boxes[0].type; // Предполагаем, что все коробки в req.body.boxes одного типа

      if (existingBoxTypes.has(newBoxType) || existingBoxTypes.size === 2) {
         // Если пользователь пытается добавить коробки того же типа, возвращаем ошибку
         return res
            .status(409)
            .json({ message: `Коробки данного типа уже существуют в этом сезоне!` });
      }
      // Если в сезоне есть коробки только одного типа, добавляем новый тип
      season.boxes = [...season.boxes, ...req.body.boxes];
      await season.save();

      return res.status(200).json({ message: `Новые коробки успешно добавлены к сезону.` });
   } catch (error) {
      res.status(500).json({ message: "Не удалось записать данные о сезоне!" });
   }
});

export const updateSeason = asyncHandler(async (req, res) => {
   try {
      const boxes = req.body;
      if (boxes.length === 0) {
         await Season.findByIdAndDelete(req.params.id);
         return res.status(200).json({ message: "Сезон успешно удален!" });
      }
      await Season.findByIdAndUpdate(req.params.id, { $set: { boxes } });
      res.status(200).json({ message: "Данные о сезоне успешно обновлены!" });
   } catch (error) {
      res.status(500).json({ message: "Не удалось обновить данные о сезоне!" });
   }
});
