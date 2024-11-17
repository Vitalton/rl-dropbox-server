const coefficient = {
   sport: 1,
   special: 5,
   lux: 25,
   import: 125,
   exotic: 625,
   black_market: 3125,
};

const labels = {
   regular: "Сезонные контейнеры",
   tournament: "Турнирные контейнеры",
};

const calculateChance = (value, total) => {
   if (total === 0) {
      throw new Error("Total cannot be zero");
   }
   return (value / total) * 100;
};

const calculateEfficiency = (array, totalBoxes) => {
   if (!Array.isArray(array)) {
      throw new Error("Input must be an array");
   }
   if (totalBoxes === 0) {
      throw new Error("Total boxes cannot be zero");
   }
   const itemByQuality = array.map((item) => {
      if (!item || !item.quality || item.count === undefined) {
         throw new Error("Invalid item format");
      }
      const qualityCoefficient = coefficient[item.quality];
      if (qualityCoefficient === undefined) {
         throw new Error(`Unknown quality: ${item.quality}`);
      }
      return qualityCoefficient * calculateChance(item.count, totalBoxes);
   });
   return itemByQuality.reduce((acc, curr) => acc + curr, 0);
};

export { labels, calculateEfficiency, calculateChance };
