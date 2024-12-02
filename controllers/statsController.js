import asyncHandler from "express-async-handler";
import Season from "../models/season.js";
import mongoose from "mongoose";
import { calculateEfficiency, calculateChance } from "../utils/statistics.js";

const subtractArrays = (arr1, arr2) => {
   return arr1.map((item1) => {
      const match = arr2.find((item2) => item2.quality === item1.quality);
      if (match) {
         return {
            quality: item1.quality,
            count: item1.count - match.count,
         };
      }
      return item1;
   });
};

// Total
export const getTotalByContent = asyncHandler(async (req, res) => {
   try {
      const completedSeasons = await Season.aggregate([
         { $match: { user_id: new mongoose.Types.ObjectId(req.user.id) } },
         { $group: { _id: null, seasons: { $addToSet: "$season_number" } } },
         { $project: { _id: 0, seasons: 1 } },
      ]).then((result) => result[0]?.seasons || []);

      if (completedSeasons.length === 0) {
         return res.status(500).json({ message: "У пользователя нет сезонов!" });
      }
      // requests
      const allSeasons = await Season.aggregate([
         { $match: { user_id: new mongoose.Types.ObjectId(req.user.id) } }, // Фильтруем по user_id
         { $unwind: "$boxes" }, // Разворачиваем массив коробок
         { $unwind: "$boxes.items" }, // Разворачиваем массив предметов в каждой коробке
         {
            $group: {
               _id: {
                  type: "$boxes.type", // Группировка по типу коробки (regular, tournament)
                  quality: "$boxes.items.quality", // Группируем по качеству предметов (sport, special, etc.)
               },
               totalOpened: { $sum: "$boxes.items.quantity" }, // Считаем количество предметов с таким качеством
            },
         },
         {
            $group: {
               _id: "$_id.type", // Группируем по типу коробок
               qualities: {
                  $push: {
                     // Собираем данные по качествам
                     quality: "$_id.quality", // Качество предмета
                     count: "$totalOpened", // Количество предметов этого качества
                  },
               },
               totalBoxes: { $sum: "$totalOpened" }, // Общее количество всех предметов (коробок)
            },
         },
         {
            $unwind: "$qualities", // Разворачиваем массив качеств для сортировки
         },
         {
            $addFields: {
               sortOrder: {
                  $switch: {
                     branches: [
                        { case: { $eq: ["$qualities.quality", "sport"] }, then: 1 },
                        { case: { $eq: ["$qualities.quality", "special"] }, then: 2 },
                        { case: { $eq: ["$qualities.quality", "lux"] }, then: 3 },
                        { case: { $eq: ["$qualities.quality", "import"] }, then: 4 },
                        { case: { $eq: ["$qualities.quality", "exotic"] }, then: 5 },
                        { case: { $eq: ["$qualities.quality", "black_market"] }, then: 6 },
                     ],
                     default: 7, // В случае, если качество не совпадает, сортируем в конце
                  },
               },
            },
         },
         {
            $sort: { sortOrder: 1 }, // Сортировка по созданному полю sortOrder
         },
         {
            $group: {
               _id: "$_id", // Возвращаем тип коробки обратно
               qualities: {
                  $push: {
                     quality: "$qualities.quality", // Возвращаем отсортированные качества
                     count: "$qualities.count", // Количество предметов
                  },
               },
               totalBoxes: { $first: "$totalBoxes" }, // Сохраняем общее количество предметов
            },
         },
         {
            $project: {
               _id: 0, // Убираем поле _id
               type: "$_id", // Тип коробки (regular, tournament)
               qualities: 1, // Качества и их количество
               totalBoxes: 1, // Общее количество открытых коробок
            },
         },
      ]);

      // prepare data
      const responseBody = { regular: {}, tournament: {} };
      const totalRegular = allSeasons.find((item) => item.type === "regular");
      const totalTournament = allSeasons.find((item) => item.type === "tournament");

      let lastSeason = null;
      if (completedSeasons.length > 1) {
         lastSeason = await Season.aggregate([
            { $match: { user_id: new mongoose.Types.ObjectId(req.user.id) } }, // Фильтруем по user_id
            { $group: { _id: null, maxSeason: { $max: "$season_number" } } }, // Определяем максимальный сезон
            {
               $lookup: {
                  from: "seasons",
                  let: { userId: req.user.id, maxSeason: "$maxSeason" },
                  pipeline: [
                     {
                        $match: {
                           $expr: {
                              $and: [
                                 { $eq: ["$user_id", new mongoose.Types.ObjectId(req.user.id)] },
                                 { $eq: ["$season_number", "$$maxSeason"] }, // Фильтруем по последнему сезону
                              ],
                           },
                        },
                     },
                     { $unwind: "$boxes" }, // Разворачиваем массив коробок
                     { $unwind: "$boxes.items" }, // Разворачиваем массив предметов в коробках
                     {
                        $group: {
                           _id: {
                              type: "$boxes.type",
                              quality: "$boxes.items.quality",
                           },
                           totalOpened: { $sum: "$boxes.items.quantity" },
                        },
                     },
                     {
                        $group: {
                           _id: "$_id.type",
                           qualities: {
                              $push: {
                                 quality: "$_id.quality",
                                 count: "$totalOpened",
                              },
                           },
                           totalBoxes: { $sum: "$totalOpened" },
                        },
                     },
                     {
                        $project: {
                           _id: 0,
                           type: "$_id",
                           qualities: 1,
                           totalBoxes: 1,
                        },
                     },
                  ],
                  as: "lastSeasonData",
               },
            },
            {
               $project: {
                  _id: 0,
                  tournament: {
                     $arrayElemAt: [
                        {
                           $filter: {
                              input: "$lastSeasonData",
                              as: "item",
                              cond: { $eq: ["$$item.type", "tournament"] },
                           },
                        },
                        0,
                     ],
                  },
                  regular: {
                     $arrayElemAt: [
                        {
                           $filter: {
                              input: "$lastSeasonData",
                              as: "item",
                              cond: { $eq: ["$$item.type", "regular"] },
                           },
                        },
                        0,
                     ],
                  },
               },
            },
         ]);
      }

      if (totalRegular) {
         const totalEfficiencyRegular = calculateEfficiency(
            totalRegular.qualities,
            totalRegular.totalBoxes,
         );
         const totalChanceRegular = [];
         totalRegular.qualities.forEach((item) => {
            totalChanceRegular.push({
               quality: item.quality,
               chance: Number(calculateChance(item.count, totalRegular.totalBoxes).toFixed(2)),
            });
         });
         responseBody.regular = {
            total: totalRegular,
            efficiency: { total: totalEfficiencyRegular },
            chances: totalChanceRegular,
         };
         if (completedSeasons.length > 1 && lastSeason[0].regular) {
            const lastSeasonRegular = lastSeason[0].regular;
            const prevQualitiesRegular = subtractArrays(
               totalRegular.qualities,
               lastSeasonRegular.qualities,
            );
            const prevSeasonsRegular = {
               qualities: prevQualitiesRegular,
               type: "regular",
               totalBoxes: prevQualitiesRegular.reduce((acc, item) => acc + item.count, 0),
            };

            // Efficiency
            const lastSeasonEfficiencyRegular = calculateEfficiency(
               lastSeasonRegular.qualities,
               lastSeasonRegular.totalBoxes,
            );
            const prevSeasonsEfficiencyRegular = calculateEfficiency(
               prevSeasonsRegular.qualities,
               prevSeasonsRegular.totalBoxes,
            );
            responseBody.regular.efficiency.lastSeason = lastSeasonEfficiencyRegular;
            responseBody.regular.efficiency.prevSeasons = prevSeasonsEfficiencyRegular;
         }
      }

      if (totalTournament) {
         const totalEfficiencyTournament = calculateEfficiency(
            totalTournament.qualities,
            totalTournament.totalBoxes,
         );
         const totalChanceTournament = [];
         totalTournament.qualities.forEach((item) => {
            totalChanceTournament.push({
               quality: item.quality,
               chance: Number(calculateChance(item.count, totalTournament.totalBoxes).toFixed(2)),
            });
         });
         responseBody.tournament = {
            total: totalTournament,
            efficiency: { total: totalEfficiencyTournament },
            chances: totalChanceTournament,
         };
         if (completedSeasons.length > 1 && lastSeason[0].tournament) {
            const lastSeasonTournament = lastSeason[0].tournament;
            const prevQualitiesTournament = subtractArrays(
               totalTournament.qualities,
               lastSeasonTournament.qualities,
            );
            const prevSeasonsTournament = {
               qualities: prevQualitiesTournament,
               type: "tournament",
               totalBoxes: prevQualitiesTournament.reduce((acc, item) => acc + item.count, 0),
            };

            // Efficiency
            const lastSeasonEfficiencyTournament = calculateEfficiency(
               lastSeasonTournament.qualities,
               lastSeasonTournament.totalBoxes,
            );
            const prevSeasonsEfficiencyTournament = calculateEfficiency(
               prevSeasonsTournament.qualities,
               prevSeasonsTournament.totalBoxes,
            );
            responseBody.tournament.efficiency.lastSeason = lastSeasonEfficiencyTournament;
            responseBody.tournament.efficiency.prevSeasons = prevSeasonsEfficiencyTournament;
         }
      }

      // send response
      res.status(200).json(responseBody);
   } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Не удалось получить данные о предметах по качествам!" });
   }
});

export const getTotalBySeasons = asyncHandler(async (req, res) => {
   try {
      const result = await Season.aggregate([
         { $match: { user_id: new mongoose.Types.ObjectId(req.user.id) } }, // Filter by user_id
         { $unwind: "$boxes" }, // Unwind boxes array
         { $unwind: "$boxes.items" }, // Unwind items array inside each box
         {
            $group: {
               _id: {
                  type: "$boxes.type", // Group by box type (regular, tournament)
                  season: "$season_number", // Group by season number
               },
               totalOpened: { $sum: "$boxes.items.quantity" }, // Sum item quantities for that season
            },
         },
         {
            $sort: { "_id.season": 1 }, // Sort by season_number in ascending order
         },
         {
            $group: {
               _id: "$_id.type", // Group by box type
               seasons: {
                  $push: {
                     season: "$_id.season", // Season number
                     count: "$totalOpened", // Number of items opened in this season
                  },
               },
            },
         },
         {
            $project: {
               _id: 0, // Remove _id field
               type: "$_id", // Box type (regular, tournament)
               seasons: 1, // Keep seasons and their counts
            },
         },
      ]);

      const regularData = result.find((item) => item.type === "regular");
      const tournamentData = result.find((item) => item.type === "tournament");

      res.status(200).json({ regular: regularData, tournament: tournamentData });
   } catch (error) {
      res.status(500).json({ message: "Не удалось получить данные о коробках по сезонам!" });
   }
});

export const getTotalProbabilityByContent = asyncHandler(async (req, res) => {
   try {
      const result = await Season.aggregate([
         { $match: { user_id: new mongoose.Types.ObjectId(req.user.id) } }, // Фильтруем по пользователю
         // 1. Разворачиваем массив коробок и предметов внутри них
         { $unwind: "$boxes" },
         { $unwind: "$boxes.items" },

         // 2. Фильтруем только коробки типа "regular"
         { $match: { "boxes.type": "regular" } },

         // 3. Группируем по `box_variant` и `quality`, подсчитывая общее количество предметов
         {
            $group: {
               _id: { box_variant: "$boxes.box_variant", quality: "$boxes.items.quality" },
               count: { $sum: "$boxes.items.quantity" },
            },
         },

         // 4. Группируем по `variant`, чтобы создать список качеств с их количеством
         {
            $group: {
               _id: "$_id.box_variant",
               totalCount: { $sum: "$count" },
               qualities: {
                  $push: {
                     quality: "$_id.quality",
                     count: "$count",
                  },
               },
            },
         },

         // 5. Рассчитываем процент для каждого качества
         {
            $project: {
               _id: 0,
               box_variant: "$_id",
               qualities: {
                  $arrayToObject: {
                     $map: {
                        input: "$qualities",
                        as: "quality",
                        in: {
                           k: "$$quality.quality",
                           v: {
                              $round: [
                                 {
                                    $multiply: [
                                       { $divide: ["$$quality.count", "$totalCount"] },
                                       100,
                                    ],
                                 },
                                 2,
                              ],
                           },
                        },
                     },
                  },
               },
            },
         },
         {
            $addFields: {
               sortOrder: {
                  $indexOfArray: [["sport", "special", "lux", "import", "golden"], "$box_variant"],
               },
            },
         },

         // 7. Сортируем по `sortOrder`
         { $sort: { sortOrder: 1 } },

         // 8. Убираем временное поле `sortOrder`
         { $project: { sortOrder: 0 } },
      ]);

      res.status(200).json(result);
   } catch (error) {
      res.status(500).json({
         message: "Не удалось получить статистику по качеству для regular коробок!",
      });
      console.error("Ошибка при получении статистики по качеству для regular коробок:", error);
   }
});

// Season
export const getSeasonByContent = asyncHandler(async (req, res) => {
   try {
      const season_number = Number(req.params.number);
      const completedSeasons = await Season.aggregate([
         { $match: { user_id: new mongoose.Types.ObjectId(req.user.id) } },
         { $group: { _id: null, seasons: { $addToSet: "$season_number" } } },
         { $project: { _id: 0, seasons: 1 } },
      ]).then((result) => result[0]?.seasons || []);

      if (completedSeasons.length === 0) {
         return res.status(500).json({ message: "У пользователя нет сезонов!" });
      }
      if (!completedSeasons.includes(season_number)) {
         return res.status(500).json({ message: "У пользователя нет такого сезона!" });
      }
      const selectedSeason = await Season.aggregate([
         {
            $match: {
               user_id: new mongoose.Types.ObjectId(req.user.id),
               season_number: season_number,
            },
         },
         { $unwind: "$boxes" },
         { $unwind: "$boxes.items" },
         {
            $group: {
               _id: {
                  type: "$boxes.type",
                  quality: "$boxes.items.quality",
               },
               totalOpened: { $sum: "$boxes.items.quantity" },
            },
         },
         {
            $group: {
               _id: "$_id.type",
               qualities: {
                  $push: {
                     quality: "$_id.quality",
                     count: "$totalOpened",
                  },
               },
               totalBoxes: { $sum: "$totalOpened" },
            },
         },
         {
            $unwind: "$qualities",
         },
         {
            $addFields: {
               sortOrder: {
                  $switch: {
                     branches: [
                        { case: { $eq: ["$qualities.quality", "sport"] }, then: 1 },
                        { case: { $eq: ["$qualities.quality", "special"] }, then: 2 },
                        { case: { $eq: ["$qualities.quality", "lux"] }, then: 3 },
                        { case: { $eq: ["$qualities.quality", "import"] }, then: 4 },
                        { case: { $eq: ["$qualities.quality", "exotic"] }, then: 5 },
                        { case: { $eq: ["$qualities.quality", "black_market"] }, then: 6 },
                     ],
                     default: 7,
                  },
               },
            },
         },
         {
            $sort: { sortOrder: 1 },
         },
         {
            $group: {
               _id: "$_id",
               qualities: {
                  $push: {
                     quality: "$qualities.quality",
                     count: "$qualities.count",
                  },
               },
               totalBoxes: { $first: "$totalBoxes" },
            },
         },
         {
            $project: {
               _id: 0,
               type: "$_id",
               qualities: 1,
               totalBoxes: 1,
            },
         },
      ]);

      // prepare data
      const responseBody = { regular: {}, tournament: {} };
      const totalRegular = selectedSeason.find((item) => item.type === "regular");
      const totalTournament = selectedSeason.find((item) => item.type === "tournament");

      if (totalRegular) {
         const totalEfficiencyRegular = calculateEfficiency(
            totalRegular.qualities,
            totalRegular.totalBoxes,
         );
         const totalChanceRegular = [];
         totalRegular.qualities.forEach((item) => {
            totalChanceRegular.push({
               quality: item.quality,
               chance: Number(calculateChance(item.count, totalRegular.totalBoxes).toFixed(2)),
            });
         });
         responseBody.regular = {
            total: totalRegular,
            efficiency: { total: totalEfficiencyRegular },
            chances: totalChanceRegular,
         };
      }

      if (totalTournament) {
         const totalEfficiencyTournament = calculateEfficiency(
            totalTournament.qualities,
            totalTournament.totalBoxes,
         );
         const totalChanceTournament = [];
         totalTournament.qualities.forEach((item) => {
            totalChanceTournament.push({
               quality: item.quality,
               chance: Number(calculateChance(item.count, totalTournament.totalBoxes).toFixed(2)),
            });
         });
         responseBody.tournament = {
            total: totalTournament,
            efficiency: { total: totalEfficiencyTournament },
            chances: totalChanceTournament,
         };
      }

      // send response
      res.status(200).json(responseBody);
   } catch (error) {
      console.error(error);
      res.status(500).json({
         message: "Не удалось получить статистику по качеству для данного сезона!",
      });
   }
});

export const getSeasonProbabilityByContent = asyncHandler(async (req, res) => {
   try {
      const season_number = Number(req.params.number);
      const completedSeasons = await Season.aggregate([
         { $match: { user_id: new mongoose.Types.ObjectId(req.user.id) } },
         { $group: { _id: null, seasons: { $addToSet: "$season_number" } } },
         { $project: { _id: 0, seasons: 1 } },
      ]).then((result) => result[0]?.seasons || []);

      if (completedSeasons.length === 0) {
         return res.status(500).json({ message: "У пользователя нет сезонов!" });
      }
      if (!completedSeasons.includes(season_number)) {
         return res.status(500).json({ message: "У пользователя нет такого сезона!" });
      }
      const result = await Season.aggregate([
         {
            $match: {
               user_id: new mongoose.Types.ObjectId(req.user.id),
               season_number: season_number,
            },
         }, // Фильтруем по пользователю
         // 1. Разворачиваем массив коробок и предметов внутри них
         { $unwind: "$boxes" },
         { $unwind: "$boxes.items" },

         // 2. Фильтруем только коробки типа "regular"
         { $match: { "boxes.type": "regular" } },

         // 3. Группируем по `box_variant` и `quality`, подсчитывая общее количество предметов
         {
            $group: {
               _id: { box_variant: "$boxes.box_variant", quality: "$boxes.items.quality" },
               count: { $sum: "$boxes.items.quantity" },
            },
         },

         // 4. Группируем по `variant`, чтобы создать список качеств с их количеством
         {
            $group: {
               _id: "$_id.box_variant",
               totalCount: { $sum: "$count" },
               qualities: {
                  $push: {
                     quality: "$_id.quality",
                     count: "$count",
                  },
               },
            },
         },

         // 5. Рассчитываем процент для каждого качества
         {
            $project: {
               _id: 0,
               box_variant: "$_id",
               qualities: {
                  $arrayToObject: {
                     $map: {
                        input: "$qualities",
                        as: "quality",
                        in: {
                           k: "$$quality.quality",
                           v: {
                              $round: [
                                 {
                                    $multiply: [
                                       { $divide: ["$$quality.count", "$totalCount"] },
                                       100,
                                    ],
                                 },
                                 2,
                              ],
                           },
                        },
                     },
                  },
               },
            },
         },
         {
            $addFields: {
               sortOrder: {
                  $indexOfArray: [["sport", "special", "lux", "import", "golden"], "$box_variant"],
               },
            },
         },

         // 7. Сортируем по `sortOrder`
         { $sort: { sortOrder: 1 } },

         // 8. Убираем временное поле `sortOrder`
         { $project: { sortOrder: 0 } },
      ]);

      res.status(200).json(result);
   } catch (error) {
      res.status(500).json({
         message: "Не удалось получить статистику по качеству для regular коробок!",
      });
      console.error("Ошибка при получении статистики по качеству для regular коробок:", error);
   }
});
