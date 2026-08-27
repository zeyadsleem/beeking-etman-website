import type { AdditiveKey, BaseHoneyOption } from "$lib/blends";

export interface BenefitText {
  ar: string;
  en: string;
}

/**
 * Hardcoded default benefits used as fallback when no DB override exists.
 */
export const DEFAULT_HONEY_BENEFITS: Record<BaseHoneyOption["id"], BenefitText> = {
  clover: {
    ar: "عسل البرسيم الكلاسيكي: طعم لطيف محبوب للكل، غني بمضادات الأكسدة الطبيعية ووقود سريع لجسمك.",
    en: "Classic clover honey: a gentle, family-favorite taste rich in natural antioxidants and quick body fuel.",
  },
  citrus: {
    ar: "عسل الموالح المنعش برائحة الليمون والبرتقال، يساعد في تهدئة الحلق ومنح إحساس بالانتعاش.",
    en: "Refreshing citrus honey with lemon-orange aroma; traditionally used to soothe the throat and lift the mood.",
  },
  marjoram: {
    ar: "عسل البردقوش العطري المعروف دعم صحة المعدة والجهاز الهضمي وتخفيف الانتفاخ بعد الأكل.",
    en: "Aromatic marjoram honey, traditionally valued for digestive comfort and easing bloating after meals.",
  },
  sidr: {
    ar: "عسل السدر الفاخر، تاج العسول المصري: قوام كثيف ونكهة غنية، مشهور بدعم المناعة والطاقة العامة.",
    en: "Premium sidr honey, the crown of Egyptian honeys: dense texture and rich flavor, famed for immunity and vitality support.",
  },
  blackseed: {
    ar: "عسل حبة البركة ممزوج ببذرة البركة المباركة، معروف منذ القدم بدعم المناعة والتوازن العام للجسم.",
    en: "Black seed honey blended with blessed nigella seeds, long prized for immune support and overall balance.",
  },
};

/**
 * Legacy export kept for backward compatibility. Prefer `DEFAULT_HONEY_BENEFITS`.
 */
export const HONEY_BENEFITS = DEFAULT_HONEY_BENEFITS;

export const DEFAULT_ADDITIVE_BENEFITS: Record<AdditiveKey, BenefitText> = {
  royalJelly: {
    ar: "غذاء ملكات النحل: وجبة الملكة الوحيدة في الخلية، مصدر مركز لفيتامينات B ومعروف بدعم الطاقة والخصوبة والنشاط الذهني.",
    en: "Royal jelly: the queen bee's exclusive food, a concentrated B-vitamin source known to support energy, fertility and mental sharpness.",
  },
  propolis: {
    ar: "البروبليس: صمغ الخلية المطهّر الذي يحمي النحل من الجراثيم، مشهور بدعم المناعة وتهدئة الحلق والفم.",
    en: "Propolis: the hive's protective resin that keeps bees germ-free, renowned for immune support and soothing throat comfort.",
  },
  ginseng: {
    ar: "جذر الجينسنج: مقوّي الجسم الشهير في الطب الصيني، يساعد على تحمل التعب وزيادة التركيز والقدرة البدنية.",
    en: "Ginseng root: the famous adaptogen of Chinese tradition, helps fight fatigue while boosting focus and physical stamina.",
  },
  palmPollen: {
    ar: "طلع النخل: كنز الطاقة الطبيعي للمتزوجين، غني بالمعادن ومعروف تقليدياً بدعم القوة والحيوية.",
    en: "Palm pollen: nature's energy treasure, mineral-rich and traditionally known for supporting strength and vigor.",
  },
  beePollen: {
    ar: "حبوب اللقاح: غذاء كامل بكل معناه، يجمع بين البروتين والفيتامينات ومضادات الأكسدة لدعم النشاط اليومي.",
    en: "Bee pollen: a true superfood combining protein, vitamins and antioxidants for everyday wellness.",
  },
};

/**
 * Legacy export kept for backward compatibility. Prefer `DEFAULT_ADDITIVE_BENEFITS`.
 */
export const ADDITIVE_BENEFITS = DEFAULT_ADDITIVE_BENEFITS;

export const HONEY_COLORS: Record<BaseHoneyOption["id"], string> = {
  clover: "#e8a020",
  citrus: "#f0b73a",
  marjoram: "#c97f1d",
  sidr: "#a85a10",
  blackseed: "#6b3a08",
};

export const INGREDIENT_COLORS: Record<AdditiveKey, string> = {
  royalJelly: "#f2ead9",
  propolis: "#8a7a2a",
  ginseng: "#d9b95c",
  palmPollen: "#caa64a",
  beePollen: "#e6b800",
};
