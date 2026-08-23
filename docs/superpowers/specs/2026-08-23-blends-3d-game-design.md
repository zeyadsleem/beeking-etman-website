# مواصفة تصميم: لعبة الخلط ثلاثية الأبعاد — صفحة `/blends`

- **التاريخ:** 2026-08-23
- **الحالة:** بانتظار مراجعة المالك
- **النطاق:** إعادة بناء صفحة الخلطات بالكامل كتجربة لعبة 3D واقعية داخل المتجر

---

## 1. الهدف

تحويل صفحة الخلطات الحالية (wizard من 4 خطوات بـ HTML drag & drop) إلى **لعبة تفاعلية ثلاثية الأبعاد متكاملة في مشهد واحد مستمر**: المستخدم يختار هدفه، يتفقد العسول والمكملات ويرى فوايد كل مكوّن، يسحب المكونات بيده في وعاء زجاج شفاف، يقليب بمعلقة خشب بإصبعه، يشاهد الصب في البرطمان، ثم يطلب أي عدد من البرطمانات.

**معايير النجاح:**

1. تجربة 3D واقعية (زجاج حقيقي بانكسار ضوء، عسل لامع لزج، خشب) تعمل على الموبايل بسلاسة مقبولة.
2. المستخدم يرى فائدة كل مكوّن قبل إضافته (كارت معلومات).
3. السحب والإفلات والتقليب تفاعل مباشر بإصبع/ماوس — ليس أنيميشن سلبي.
4. الطلب بكميات متعددة (×1 ×2 ×3 ×4…) يعمل end-to-end حتى الأوردر.
5. دعم ar/en كامل وfallback بدون WebGL.

## 2. غير مستهدف (Non-goals)

- تغيير `+page.server.ts` أو مخطط قاعدة البيانات أو منطق الأسعار/المخزون.
- فيزياء rigid-body كاملة (Rapier) — الخلط محاكاة سطحية shader-based.
- تعدد المشاهد/الغرف — مشهد مطبخ عسل واحد بكاميرا تتحرك بين المحطات.
- لمس باقي صفحات الموقع.

## 3. الوضع الحالي

- `/blends/+page.svelte`: خطوات goal → base → mix → done؛ عجلة أهداف 2D، سحب HTML5، كمية ثابتة = 1.
- `$lib/blends.ts`: أنواع وأدوات (BLEND_GOALS، BASE_HONEY_OPTIONS، ADDITIVE_KEYS، DOSE_FOR، MAX_DOSE=3…).
- `+page.server.ts`: يحلّل المنتجات/الباريانتات من D1 ويُرجع `baseHoneys` و`additives` و`lang`.
- السلة: `addBlend()` يدعم `quantity`، والـ drawer فيه QuantityPicker، والـ backend (`orders.ts`) يحسب الكميات والمخزون صح.
- لا توجد أي مكتبة 3D حالياً.

## 4. تدفق اللعب — 6 محطات في مشهد واحد

الكاميرا تنتقل بحركة سينمائية ناعمة (tween) بين المحطات. شريط خطوات علوي HTML (مثل الحالي) يظل ظاهراً كمؤشر ورجوع.

### المحطة 1 — لوحة الأهداف (GoalTable)

5 بطاقات خشبية ثلاثية الأبعاد على طاولة أمام المستخدم، كل بطاقة تحمل اسم الهدف (vitality/immunity/children/digestive/energy) بأيقونة. الدوس على بطاقة → ترتفع وتلمع → الكاميرا تنتقل للمحطة 2. نص وصفي للهدف يظهر كبطاقة HTML جانبية.

### المحطة 2 — رف العسول (HoneyShelf)

5 برطمانات زجاج على رف خشبي. الدوس على برطمان → يطفو ويدور 360° أمام الكاميرا + كارت HTML يعرض: الاسم، الفوائد، السعر حسب الحجم. منتقي حجم البرطمان (نص كيلو / كيلو) HTML overlay. زر «اخترت هذا» → المحطة 3.

### المحطة 3 — طاولة التحضير (WorkTable)

وعاء زجاجي شفاف (MixingBowl) على الطاولة بداخله العسل الأساسي المختار (سطح سائل). حول الوعاء 5 أكواب صغيرة فيها المكملات (حبوب لقاح ذهبية، غذاء ملكات كريمي، بروبليس عنبري، جينسنج جذور، طلع نخيل).

- **دوس على مكوّن** → كارت HTML: صورة المنتج، الفوائد، السعر، عدّاد الجرعات (+/−)، وسهم «اسحبه للوعاء». المكملات الموصى بها للهدف عليها علامة.
- **سحب المكوّن فوق الوعاء** (raycasting + pointer) → الجرعة تسقط داخل الوعاء بأنيميشن splash وجزيئات، وعدّاد الجرعات يزيد (حد أقصى MAX_DOSE=3 كما هو).
- شريط جانبي يلخص المكونات المضافة والإجمالي المالي لحظياً.
- زر «ابدأ التقليب» يظهر بعد إضافة أول جرعة.

### المحطة 4 — التقليب (Stirring)

المستخدم يمسك المعلقة الخشب: pointer down على المعلقة → تتبع المؤشر؛ التحرك الدائري حول مركز الوعاء يحرّك المعلقة ويحرك السطح.

- **التقدم**: كل دورة كاملة ≈ نقاط تقدم؛ الدورات الجزئية تُحتسب نسبياً، مع مدة أدنى ~2 ثانية تفاعل فعلي. عند ~3 دورات كاملة يصل mixProgress إلى 100%. حلقة تقدم حول الوعاء + رسائل مرحلية («لسه، كمّل…» → «خلط جيد!»).
- **البصريات**: ألوان المكونات تذوب تدريجياً في قاعدة العسل (mixing uniform في shader)، تموجات تتبع اتجاه التقليب، لمعان يزداد بالتجانس.
- زر تخطٍّ صغير للأجهزة الضعيفة/من لا يرغب.

### المحطة 5 — الصب (Pouring)

أنيميشن تلقائي (~4 ثوانٍ): الوعاء يرتفع ويميل فوق البرطمان الفاضي، شلال عسل (tube mesh متحرك)، مستوى البرطمان يرتفع حتى الامتلاء، ثم يهبط غطاؤه. Confetti خفيف + انتقال للمحطة 6.

### المحطة 6 — الطلب (JarStation)

البرطمان الممتلئ في المركز يدور ببطء. لوحة HTML: ملخص التركيب والأسعار (كما في stepDone الحالي)، **منتقي كمية ×1..×10** (مقيد بالمخزون)، زر «أضف للسلة» يستدعي `addBlend({..., quantity})` ثم `openDrawer()`. وزر «اصنع خلطة أخرى» يعيد ضبط اللعبة.

## 5. المعمارية وهيكل الملفات

```
src/lib/blend-lab/            # مجلد جديد منفصل عن blends.ts لتجنب تعارض أسماء الاستيراد
├── game-state.svelte.ts        # BlendsGame class (runes): آلة حالة واحدة للمشهد كله
├── benefits.ts                 # BENEFITS (ar/en لكل base honey وadditive) + INGREDIENT_COLORS
└── scene/
    ├── HoneyScene.svelte       # جذر Threlte: Canvas + Environment HDRI + CameraRig + المحطات
    ├── CameraRig.svelte        # انتقالات كاميرا tweened حسب gameState.step
    ├── stations/
    │   ├── GoalTable.svelte    # المحطة 1
    │   ├── HoneyShelf.svelte   # المحطة 2
    │   ├── WorkTable.svelte    # المحطة 3+4 (الوعاء + الأكواب + المعلقة)
    │   └── JarStation.svelte   # المحطة 5+6 (البرطمان + الصب)
    ├── models/
    │   ├── GlassBowl.svelte    # LatheGeometry + MeshPhysicalMaterial(transmission)
    │   ├── HoneyJar.svelte     # برطمان زجاج + غطاء معدني + LiquidHoney داخله
    │   ├── WoodenSpoon.svelte  # procedural + خامات خشب PBR
    │   ├── LiquidHoney.svelte  # shader مخصص: مستوى سائل، تموج، خلط ألوان، fillLevel
    │   └── IngredientCup.svelte# كوب مكمل (شكل حسب النوع)
    └── interactions/
        ├── PointerRaycaster.ts # مساعد hover/click/drag عبر raycasting
        ├── DragToBowl.ts       # منطق سحب المكملات للوعاء
        └── StirController.ts   # حساب الدورات وتقدم الخلط من حركة المؤشر
src/routes/blends/+page.svelte  # shell رفيع: header + <HoneyScene> client-only كسول + Overlays
```

**قواعد:**

- `game-state.svelte.ts` مصدر الحقيقة الوحيد؛ مكوّنات 3D تقرأ منه وتكتب إليه. لا حالة مشهد مكررة.
- كل مكوّن 3D مسؤولية واحدة وقابل للاختبار المنطقي (منطق التقدم/الألوان في TS خالص قابل للـ unit test، منفصل عن الرسم).
- Overlays (كروت المعلومات، الشريط المالي، منتقي الكمية) HTML عادي فوق الـ canvas — إتاحة وصول أفضل من رسمها داخل WebGL.

### الاعتمادات الجديدة

`@threlte/core@^9`, `@threlte/extras@^9`, `three`, `@types/three` — تُحمّل كسولاً عبر dynamic import داخل `+page.svelte` فقط.

## 6. آلة الحالة (BlendsGame)

```ts
type Step = "goal" | "honey" | "prep" | "stir" | "pour" | "order";
class BlendsGame {
  step: Step;
  goal: BlendGoalId | null;
  honeyOption: BaseHoneyOption["id"] | null;
  jarSize: JarSize;
  doses: Record<AdditiveKey, number>; // كما هي
  inspected: AdditiveKey | null; // مكوّن تحت الفحص (كارت)
  mixProgress: number; // 0..1
  jarFill: number; // 0..1 خلال الصب
  quantity: number; // 1..10
  // دوال: selectGoal, selectHoney, addDose(key, n), removeDose,
  // startStir, recordStirDelta(rad), finishStir, playPour, setQuantity, reset
}
```

انتقالات أحادية الاتجاه مع إمكانية الرجوع بخطوة (زر الرجوع في شريط الخطوات) — الرجوع بعد الصب غير مسموح (خلطة صُبت = اكتملت).

## 7. تفاصيل المشهد والواقعية

- **الإضاءة**: HDRI بيئي دافئ (Poly Haven CC0 مثل `brown_photostudio` أو ما يناسب) + DirectionalLight رئيسي بظلال ناعمة + rim light عسلي.
- **الزجاج**: `MeshPhysicalMaterial { transmission: 1, roughness: 0.05–0.15, ior: 1.5, thickness, clearcoat }` للوعاء والبرطمان والأكواب.
- **العسل**: ShaderMaterial مخصص فوق MeshPhysicalMaterial أساسي:
  - uniforms: `uBaseColor` (لون العسل المختار)، `uIngredientColors[5]` بأوزان الجرعات، `uMixProgress`، `uFill`، `uTime`، `uStirVelocity`.
  - تموج جيبي مضاعع يشتد مع سرعة التقليب؛ لون نهائي = lerp تدريجي نحو المتوسط المرجّح للمكونات.
- **الألوان المرجعية** (INGREDIENT_COLORS): برسيم ذهبي فاتح، سدر عنبري غامق، موالح ذهبي، بردقوش كهرماني، حبة بركة داكن؛ ملكات كريمي، بروبليس أخضر-عنبري، جينسنج أصفر باهت، طلع/لقاح أصفر ذهبي.
- **الخشب**: خامات Poly Haven CC0 (rough wood / walnut) على الطاولة والرف والمعلقة.
- **المكملات**: أشكال procedural بسيطة عالية الخامة (كرات لقاح، معجون كريمي للملكات، بلورات بروبليس، جذور جينسنج lathe، سنابل طلع).
- **الجسيمات**: splash قطرات عند إضافة جرعة، confetti خفيف بعد الصب — InstancedMesh بسيط.

## 8. البيانات الجديدة

### benefits.ts

```ts
export interface BenefitText {
  ar: string;
  en: string;
}
export const HONEY_BENEFITS: Record<BaseHoneyOption["id"], BenefitText>;
export const ADDITIVE_BENEFITS: Record<AdditiveKey, BenefitText>;
export const HONEY_COLORS: Record<BaseHoneyOption["id"], string>; // hex
export const INGREDIENT_COLORS: Record<AdditiveKey, string>;
```

النصوص: فقرتان قصيرتان لكل مكوّن (فوائد طبيعية معروفة بصياغة تجارية حذرة دون ادعاءات طبية قاطعة) — يراجعها المالك.

### توسعة $lib/blends.ts

إضافة `MAX_ORDER_QTY = 10`. لا تغييرات breaking.

## 9. i18n

مفاتيح جديدة تحت `blends.game.*` في `messages.ts` (ar/en): عناوين المحطات، تعليمات السحب/التقليب («امسك المعلقة وحرّكها في دوائر»)، حالات التقدم، أزرار («ابدأ التقليب»، «تخطى»، «أضف للسلة»)، منتقي الكمية، رسالة fallback. لا تُحذف المفاتيح القديمة إلا إن لم تعد تستخدم بعد انتهاء إعادة البناء.

## 10. تكامل السلة

`orderBlend` الحالي يتوسع: `addBlend({ ..., quantity: game.quantity })`. القيود: `stock` للـ variant الأساسي يقيّد الكمية (نفس منطق `adjustQuantity`). الإضافات تُحسب لكل برطمان تلقائياً في الـ backend الحالي.

## 11. الأداء والفولباك

- Dynamic import لمشهد Threlte — لا يؤثر على بقية الموقع.
- `dpr = min(devicePixelRatio, 2)` + خفض إلى 1.25 على الأجهزة الضعيفة (كشف عبر قياس FPS أول 3 ثوانٍ).
- ظلال منخفضة الدقة، `frameloop="demand"` حيث ممكن.
- Fallback: لو فشل إنشاء WebGL context → نفس التدفق بواجهة HTML الحالية المحسّنة (تبقى نسخة مبسطة من الـ wizard الحالي) + رسالة توضيحية.
- prefers-reduced-motion: تقصير الانتقالات وإتاحة زر تخطي التقليب افتراضياً.

## 12. الأصول ومصادرها (كلها CC0 / آمنة تجارياً)

| الأصل                                 | المصدر                                      |
| ------------------------------------- | ------------------------------------------- |
| HDRI الإضاءة                          | Poly Haven (CC0)                            |
| خامات الخشب (albedo/roughness/normal) | Poly Haven (CC0)                            |
| الوعاء/البرطمان/الأكواب/المعلقة       | procedural (Lathe/Capsule/Torus) بخامات PBR |
| المكملات                              | procedural meshes                           |
| أيقونات UI                            | موجودة/inline SVG                           |

لا موديلات خارجية برخص مشكوك فيها؛ إن احتجنا موديلاً جاهزاً سيكون من Poly Haven/Kenney CC0 فقط.

## 13. الاختبارات

- **Unit (vitest)**: `BlendsGame` — الانتقالات، حدود الجرعات، `recordStirDelta` → mixProgress، قيود quantity بالمخزون، سلامة benefits/colors (كل المفاتيح مغطاة ar/en). منطق خلط الألوان (weighted lerp) كدالة خالصة.
- **E2E (playwright)**: smoke — الصفحة تفتح، fallback يظهر عند تعطيل WebGL (emulate)، إضافة خلطة للسلة عبر المسار الاحتياطي.
- **اختبار يدوي**: جولة كاملة على Chrome desktop + Android mid-range.

## 14. المخاطر

| خطر                                  | التخفيف                                         |
| ------------------------------------ | ----------------------------------------------- |
| أداء transmission على موبايلات ضعيفة | جودة تكيفية + خفض DPR + fallback                |
| تعقيد shader العسل                   | البدء بـ lerp لوني + تموج بسيط ثم تحسين تدريجي  |
| حجم الحزمة                           | chunk منفصل lazy-loaded                         |
| صعوبة التقليب باللمس                 | هندسة تحكم متسامحة (دورات جزئية تحسب) + زر تخطي |
