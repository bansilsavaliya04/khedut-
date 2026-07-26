const express = require('express');

const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { cleanText, positiveNumber } = require('../utils/input');

const router = express.Router();

const PRICE_RANGES = {
  vegetables: [25, 70],
  fruits: [50, 140],
  grains: [25, 55],
  dairy: [45, 90],
  organic: [70, 180],
  other: [40, 100]
};

router.post('/generate-description', auth, requireRole('farmer'), async (req, res) => {
  try {
    const name = cleanText(req.body.name, { max: 100, required: true });
    const category = cleanText(req.body.category, { max: 30, required: true });
    const quantity = positiveNumber(req.body.quantity, { min: 0.01, max: 10_000_000 });
    const quality = cleanText(req.body.quality, { max: 30 }) || 'premium';
    const location = cleanText(req.body.location, { max: 160 });
    const language = ['en', 'gu', 'hi'].includes(req.body.language) ? req.body.language : 'en';

    if (!name || !category || quantity === null) {
      return res.status(400).json({ message: 'Name, category and valid quantity are required' });
    }

    const descriptions = {
      en: `Fresh ${quality.toLowerCase()} ${name} from a verified local farm${location ? ` in ${location}` : ''}. Available quantity: ${quantity}. Carefully harvested, quality checked and ready for direct purchase by households, retailers and wholesale buyers.`,
      gu: `${location ? `${location}ના ` : ''}વિશ્વસનીય સ્થાનિક ખેડૂત પાસેથી તાજું ${quality} ${name}. ઉપલબ્ધ જથ્થો: ${quantity}. પાક કાળજીપૂર્વક કાપવામાં આવ્યો છે, ગુણવત્તા ચકાસેલ છે અને ઘરેલુ, રિટેલ તથા જથ્થાબંધ ખરીદદારો માટે તૈયાર છે.`,
      hi: `${location ? `${location} के ` : ''}विश्वसनीय स्थानीय किसान से ताज़ा ${quality} ${name}। उपलब्ध मात्रा: ${quantity}। फसल सावधानी से काटी गई है, गुणवत्ता जाँची गई है और घरेलू, रिटेल तथा थोक खरीदारों के लिए तैयार है।`
    };

    return res.json({ description: descriptions[language], generated: true });
  } catch (err) {
    return res.status(500).json({ message: 'Description generation failed' });
  }
});

router.post('/suggest-price', auth, requireRole('farmer'), async (req, res) => {
  try {
    const category = PRICE_RANGES[req.body.category] ? req.body.category : 'other';
    const quality = ['standard', 'premium', 'organic'].includes(req.body.qualityGrade)
      ? req.body.qualityGrade
      : 'standard';
    const [baseMin, baseMax] = PRICE_RANGES[category];
    const multiplier = quality === 'organic' ? 1.35 : quality === 'premium' ? 1.15 : 1;
    const minPrice = Math.round(baseMin * multiplier);
    const maxPrice = Math.round(baseMax * multiplier);
    const suggestedPrice = Math.round((minPrice + maxPrice) / 2);

    return res.json({
      minPrice,
      maxPrice,
      suggestedPrice,
      reason: `Indicative ${quality} ${category} range. Confirm the current APMC/local market price before finalizing.`
    });
  } catch (err) {
    return res.status(500).json({ message: 'Price suggestion failed' });
  }
});

module.exports = router;
module.exports.__test = { PRICE_RANGES };
