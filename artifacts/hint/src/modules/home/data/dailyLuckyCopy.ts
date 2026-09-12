import type { HintLanguage } from "../../../lib/i18n";
import type { DailyLuckyItem } from "../types/home.types";

type LuckyCategory = Exclude<DailyLuckyItem["key"], "number">;
type LuckyPair = readonly [name: string, advice: string];

/** Canonical English names remain artwork keys; only display copy is localized. */
export const DAILY_LUCKY_COPY: Record<Exclude<HintLanguage, "en">, Record<LuckyCategory, Record<string, LuckyPair>>> = {
  "zh": {
    "color": {
      "Sky Blue": [
        "天蓝色",
        "适合平静地回应"
      ],
      "Sage Green": [
        "鼠尾草绿",
        "适合找回踏实感"
      ],
      "Lavender": [
        "薰衣草紫",
        "适合柔和地专注"
      ],
      "Sunset Pink": [
        "晚霞粉",
        "适合传递温暖"
      ],
      "Ocean Blue": [
        "海洋蓝",
        "适合清晰地思考"
      ],
      "Cream White": [
        "奶油白",
        "适合清爽地开始"
      ],
      "Mocha Brown": [
        "摩卡棕",
        "适合保持稳定的精力"
      ],
      "Peach": [
        "蜜桃色",
        "适合带来温暖，不添压力"
      ],
      "Mint Green": [
        "薄荷绿",
        "适合清新地重新调整"
      ],
      "Lilac": [
        "丁香紫",
        "适合带着想象专注"
      ],
      "Coral": [
        "珊瑚色",
        "适合真诚地向前推进"
      ],
      "Butter Yellow": [
        "奶油黄",
        "适合保持乐观"
      ],
      "Rose Pink": [
        "玫瑰粉",
        "适合温柔的自信"
      ],
      "Dusty Blue": [
        "雾蓝色",
        "适合温和地守住边界"
      ],
      "Emerald Green": [
        "祖母绿",
        "适合带来成长的活力"
      ],
      "Champagne": [
        "香槟色",
        "适合感受精致与从容"
      ],
      "Soft Gray": [
        "柔灰色",
        "适合让事情保持简单"
      ],
      "Ivory": [
        "象牙白",
        "适合安静的清晰感"
      ],
      "Terracotta": [
        "陶土色",
        "适合踏实的温暖"
      ],
      "Plum": [
        "梅子紫",
        "适合更深入地倾听直觉"
      ],
      "Aqua": [
        "水蓝色",
        "适合轻松交流"
      ],
      "Baby Blue": [
        "婴儿蓝",
        "适合柔和地开始"
      ],
      "Blush Pink": [
        "腮红粉",
        "适合接受关心"
      ],
      "Caramel": [
        "焦糖色",
        "适合稳定的舒适感"
      ],
      "Olive Green": [
        "橄榄绿",
        "适合作出务实的选择"
      ],
      "Burgundy": [
        "酒红色",
        "适合保持沉着自主"
      ],
      "Midnight Blue": [
        "午夜蓝",
        "适合平静地专注"
      ],
      "Apricot": [
        "杏色",
        "适合温柔的勇气"
      ],
      "Mauve": [
        "灰紫色",
        "适合静心反思"
      ],
      "Honey Beige": [
        "蜂蜜米色",
        "适合轻松的节奏"
      ]
    },
    "jewelry": {
      "Gold Ring": [
        "金戒指",
        "适合安静的自信"
      ],
      "Silver Ring": [
        "银戒指",
        "适合清楚的边界"
      ],
      "Pearl Earrings": [
        "珍珠耳环",
        "让这一天的感受柔和一些"
      ],
      "Gold Necklace": [
        "金项链",
        "适合温暖地被看见"
      ],
      "Silver Necklace": [
        "银项链",
        "让回应保持分寸"
      ],
      "Rose Quartz": [
        "粉晶",
        "适合更温暖的语气"
      ],
      "Moonstone": [
        "月光石",
        "适合安静地倾听直觉"
      ],
      "Amethyst": [
        "紫水晶",
        "适合顺着直觉专注"
      ],
      "Pearl Bracelet": [
        "珍珠手链",
        "适合从容优雅的节奏"
      ],
      "Hoop Earrings": [
        "圈形耳环",
        "适合更大胆的心情"
      ],
      "Star Necklace": [
        "星星项链",
        "适合感受自己被看见"
      ],
      "Heart Pendant": [
        "爱心吊坠",
        "适合更温暖的话语"
      ],
      "Crystal Earrings": [
        "水晶耳环",
        "适合轻盈感"
      ],
      "Sapphire Ring": [
        "蓝宝石戒指",
        "适合作出清晰的决定"
      ],
      "Emerald Pendant": [
        "祖母绿吊坠",
        "适合带来成长的活力"
      ],
      "Opal Ring": [
        "欧泊戒指",
        "适合信任细微的差别"
      ],
      "Silver Bangle": [
        "银手镯",
        "适合保持稳定的意图"
      ],
      "Charm Bracelet": [
        "挂饰手链",
        "适合留下小小的提醒"
      ],
      "Butterfly Necklace": [
        "蝴蝶项链",
        "适合小小的转变"
      ],
      "Sun Pendant": [
        "太阳吊坠",
        "适合明亮的自信"
      ],
      "Moon Pendant": [
        "月亮吊坠",
        "帮助说出安静的感受"
      ],
      "Diamond Studs": [
        "钻石耳钉",
        "适合精致而清晰的感觉"
      ],
      "Rose Gold Ring": [
        "玫瑰金戒指",
        "适合柔和的自信"
      ],
      "Quartz Bracelet": [
        "石英手链",
        "适合重新整理情绪"
      ],
      "Zodiac Necklace": [
        "星座项链",
        "适合相信自己的时机"
      ],
      "Clover Charm": [
        "三叶草挂饰",
        "适合美好的时机"
      ],
      "Shell Necklace": [
        "贝壳项链",
        "适合更柔和的节奏"
      ],
      "Birthstone Ring": [
        "生辰石戒指",
        "适合属于自己的好运"
      ],
      "Gem Earrings": [
        "宝石耳环",
        "适合一点闪耀"
      ],
      "Infinity Bracelet": [
        "无限符号手链",
        "适合保持连结"
      ]
    },
    "food": {
      "Bubble Tea": [
        "珍珠奶茶",
        "适合让心情稍稍明亮"
      ],
      "Avocado": [
        "牛油果",
        "适合保持稳定的精力"
      ],
      "Strawberry": [
        "草莓",
        "适合甜甜地重新调整"
      ],
      "Matcha": [
        "抹茶",
        "适合柔和地专注"
      ],
      "Croissant": [
        "可颂",
        "适合为早晨添点浪漫"
      ],
      "Ramen": [
        "拉面",
        "适合舒适感与专注"
      ],
      "Fried Rice": [
        "炒饭",
        "适合用好手边已有的东西"
      ],
      "Sushi": [
        "寿司",
        "适合清爽地向前推进"
      ],
      "Yogurt": [
        "酸奶",
        "适合温和地开始"
      ],
      "Chocolate": [
        "巧克力",
        "适合稍稍调整心情"
      ],
      "Blueberries": [
        "蓝莓",
        "适合清晰的头脑"
      ],
      "Salmon": [
        "三文鱼",
        "适合踏实的力量"
      ],
      "Iced Coffee": [
        "冰咖啡",
        "适合开始行动"
      ],
      "Macarons": [
        "马卡龙",
        "适合一个赏心悦目的停顿"
      ],
      "Donut": [
        "甜甜圈",
        "适合一点玩心"
      ],
      "Dumplings": [
        "饺子",
        "适合感受被照顾"
      ],
      "Mango": [
        "芒果",
        "适合明亮的活力"
      ],
      "Pancakes": [
        "松饼",
        "适合慢慢开始"
      ],
      "Tacos": [
        "塔可饼",
        "适合随兴的计划"
      ],
      "Salad": [
        "沙拉",
        "适合更轻盈的节奏"
      ],
      "Ice Cream": [
        "冰淇淋",
        "适合温柔地奖励自己"
      ],
      "Cheesecake": [
        "芝士蛋糕",
        "适合温柔地款待自己"
      ],
      "Acai Bowl": [
        "巴西莓碗",
        "适合清新的活力"
      ],
      "Apple": [
        "苹果",
        "适合清爽地重新调整"
      ],
      "Grapes": [
        "葡萄",
        "适合轻松的甜意"
      ],
      "Pasta": [
        "意大利面",
        "适合不用多想的舒适感"
      ],
      "Waffles": [
        "华夫饼",
        "适合温馨的早晨"
      ],
      "Honey Toast": [
        "蜂蜜吐司",
        "适合带来温暖"
      ]
    },
    "carry": {
      "AirPods Case": [
        "AirPods 耳机盒",
        "适合保护自己的心情"
      ],
      "Lip Balm": [
        "润唇膏",
        "把舒适留在身边"
      ],
      "Hair Ties": [
        "发圈",
        "适合把事情处理妥当"
      ],
      "Phone": [
        "手机",
        "适合传递一条真诚的消息"
      ],
      "Sunglasses": [
        "太阳镜",
        "适合守住自己的边界"
      ],
      "Water Bottle": [
        "水瓶",
        "适合保持稳定的精力"
      ],
      "Perfume": [
        "香水",
        "适合重新调整周围的氛围"
      ],
      "Canvas Bag": [
        "帆布包",
        "适合少带一点混乱"
      ],
      "Notebook": [
        "笔记本",
        "适合抓住一闪而过的想法"
      ],
      "Keychain": [
        "钥匙扣",
        "适合一次清楚的转换"
      ],
      "Lipstick": [
        "口红",
        "适合作为自信的小提示"
      ],
      "Hand Cream": [
        "护手霜",
        "适合小小的照顾"
      ],
      "Ring": [
        "戒指",
        "适合记住自己的意图"
      ],
      "Bracelet": [
        "手链",
        "适合保持踏实稳定"
      ],
      "Necklace": [
        "项链",
        "适合把心中的意图留在身边"
      ],
      "Mirror": [
        "镜子",
        "适合关照一下自己"
      ],
      "Charger": [
        "充电器",
        "适合恢复能量"
      ],
      "Wallet": [
        "钱包",
        "适合现实生活中的好运"
      ],
      "Scrunchie": [
        "布艺发圈",
        "适合轻松地重新调整"
      ],
      "Claw Clip": [
        "抓夹",
        "适合迅速集中注意力"
      ],
      "Camera": [
        "相机",
        "适合留意美好"
      ],
      "Earbuds Case": [
        "入耳式耳机盒",
        "适合把平静留在身边"
      ],
      "Makeup Bag": [
        "化妆包",
        "适合感受准备妥当"
      ],
      "Crystal Charm": [
        "水晶挂饰",
        "适合一个小仪式"
      ],
      "Coin Purse": [
        "零钱包",
        "适合有意识地花钱"
      ],
      "Pen": [
        "笔",
        "适合把想法说清楚"
      ],
      "Mini Plush": [
        "迷你毛绒玩偶",
        "适合带来舒适感"
      ],
      "Travel Mug": [
        "随行杯",
        "适合把温暖带在身边"
      ],
      "Glasses": [
        "眼镜",
        "适合看得清楚"
      ],
      "Headphones": [
        "头戴式耳机",
        "适合保护专注"
      ]
    },
    "flower": {
      "Sunflower": [
        "向日葵",
        "适合让自信被看见"
      ],
      "Rose": [
        "玫瑰",
        "适合温柔而有原则"
      ],
      "Tulip": [
        "郁金香",
        "适合新的开始"
      ],
      "Daisy": [
        "雏菊",
        "适合轻盈感"
      ],
      "Lavender": [
        "薰衣草",
        "让转个不停的思绪安静下来"
      ],
      "Peony": [
        "牡丹",
        "接受温柔，不必道歉"
      ],
      "Lily": [
        "百合",
        "适合清爽的情绪空间"
      ],
      "Cherry Blossom": [
        "樱花",
        "适合短暂而甜美的时刻"
      ],
      "Hydrangea": [
        "绣球花",
        "适合温柔的丰盛感"
      ],
      "Orchid": [
        "兰花",
        "适合优雅的耐心"
      ],
      "Jasmine": [
        "茉莉",
        "适合安静地发光"
      ],
      "Camellia": [
        "山茶花",
        "适合稳定的情意"
      ],
      "Iris": [
        "鸢尾花",
        "适合相信自己的眼光"
      ],
      "Magnolia": [
        "木兰花",
        "适合踏实而从容的优雅"
      ],
      "Dandelion": [
        "蒲公英",
        "适合带着希望重新调整"
      ],
      "Marigold": [
        "万寿菊",
        "适合温暖的勇气"
      ],
      "Baby's Breath": [
        "满天星",
        "适合轻柔的支持"
      ],
      "Gardenia": [
        "栀子花",
        "适合清楚表达温柔"
      ],
      "Lotus": [
        "莲花",
        "适合清净地向上生长"
      ],
      "Poppy Seed": [
        "罂粟籽",
        "适合大胆发挥创造力"
      ],
      "Pink Camellia": [
        "粉色山茶花",
        "适合谦和的自信"
      ],
      "Forget-Me-Not": [
        "勿忘我",
        "适合有意义的联系"
      ],
      "Hibiscus": [
        "木槿",
        "适合表达温暖"
      ],
      "Ranunculus": [
        "花毛茛",
        "适合层次丰富的感受"
      ],
      "Anemone": [
        "银莲花",
        "适合真诚的柔软"
      ],
      "Sweet Pea": [
        "香豌豆花",
        "适合温柔的开始"
      ],
      "Cosmos": [
        "波斯菊",
        "适合平衡的美感"
      ],
      "Snapdragon": [
        "金鱼草",
        "适合清楚地表达"
      ],
      "Morning Glory": [
        "牵牛花",
        "适合重新开始"
      ],
      "Freesia": [
        "小苍兰",
        "适合明亮而真诚的心意"
      ]
    }
  },
  "es": {
    "color": {
      "Sky Blue": [
        "Azul cielo",
        "Para responder con calma"
      ],
      "Sage Green": [
        "Verde salvia",
        "Para sentir los pies en la tierra"
      ],
      "Lavender": [
        "Lavanda",
        "Para concentrarte con suavidad"
      ],
      "Sunset Pink": [
        "Rosa atardecer",
        "Para aportar calidez"
      ],
      "Ocean Blue": [
        "Azul océano",
        "Para pensar con claridad"
      ],
      "Cream White": [
        "Blanco crema",
        "Para empezar con claridad"
      ],
      "Mocha Brown": [
        "Marrón moca",
        "Para mantener una energía estable"
      ],
      "Peach": [
        "Melocotón",
        "Para aportar calidez sin presión"
      ],
      "Mint Green": [
        "Verde menta",
        "Para un reinicio fresco"
      ],
      "Lilac": [
        "Lila",
        "Para concentrarte con imaginación"
      ],
      "Coral": [
        "Coral",
        "Para avanzar con honestidad"
      ],
      "Butter Yellow": [
        "Amarillo mantequilla",
        "Para el optimismo"
      ],
      "Rose Pink": [
        "Rosa",
        "Para una confianza tierna"
      ],
      "Dusty Blue": [
        "Azul empolvado",
        "Para unos límites amables"
      ],
      "Emerald Green": [
        "Verde esmeralda",
        "Para la energía de crecer"
      ],
      "Champagne": [
        "Champán",
        "Para sentirte con un toque de refinamiento"
      ],
      "Soft Gray": [
        "Gris suave",
        "Para mantener las cosas sencillas"
      ],
      "Ivory": [
        "Marfil",
        "Para una claridad serena"
      ],
      "Terracotta": [
        "Terracota",
        "Para una calidez con los pies en la tierra"
      ],
      "Plum": [
        "Ciruela",
        "Para una intuición más profunda"
      ],
      "Aqua": [
        "Aguamarina",
        "Para una comunicación ligera"
      ],
      "Baby Blue": [
        "Azul bebé",
        "Para un comienzo más suave"
      ],
      "Blush Pink": [
        "Rosa rubor",
        "Para recibir cuidado"
      ],
      "Caramel": [
        "Caramelo",
        "Para un bienestar estable"
      ],
      "Olive Green": [
        "Verde oliva",
        "Para decisiones prácticas"
      ],
      "Burgundy": [
        "Burdeos",
        "Para mantener la serenidad y el dominio propio"
      ],
      "Midnight Blue": [
        "Azul medianoche",
        "Para concentrarte con calma"
      ],
      "Apricot": [
        "Albaricoque",
        "Para una valentía amable"
      ],
      "Mauve": [
        "Malva",
        "Para momentos de reflexión"
      ],
      "Honey Beige": [
        "Beige miel",
        "Para un ritmo fácil"
      ]
    },
    "jewelry": {
      "Gold Ring": [
        "Anillo de oro",
        "Para una confianza serena"
      ],
      "Silver Ring": [
        "Anillo de plata",
        "Para unos límites claros"
      ],
      "Pearl Earrings": [
        "Pendientes de perlas",
        "Suavizan cómo recibes el día"
      ],
      "Gold Necklace": [
        "Collar de oro",
        "Para hacerte visible con calidez"
      ],
      "Silver Necklace": [
        "Collar de plata",
        "Para responder con mesura"
      ],
      "Rose Quartz": [
        "Cuarzo rosa",
        "Para un tono más cálido"
      ],
      "Moonstone": [
        "Piedra lunar",
        "Para una intuición tranquila"
      ],
      "Amethyst": [
        "Amatista",
        "Para concentrarte desde la intuición"
      ],
      "Pearl Bracelet": [
        "Pulsera de perlas",
        "Para un ritmo con gracia"
      ],
      "Hoop Earrings": [
        "Pendientes de aro",
        "Para un ánimo más audaz"
      ],
      "Star Necklace": [
        "Collar de estrella",
        "Para sentir que te ven"
      ],
      "Heart Pendant": [
        "Colgante de corazón",
        "Para unas palabras más cálidas"
      ],
      "Crystal Earrings": [
        "Pendientes de cristal",
        "Para sentir ligereza"
      ],
      "Sapphire Ring": [
        "Anillo de zafiro",
        "Para decisiones claras"
      ],
      "Emerald Pendant": [
        "Colgante de esmeralda",
        "Para la energía de crecer"
      ],
      "Opal Ring": [
        "Anillo de ópalo",
        "Para confiar en los matices"
      ],
      "Silver Bangle": [
        "Brazalete de plata",
        "Para una intención firme"
      ],
      "Charm Bracelet": [
        "Pulsera de dijes",
        "Para pequeños recordatorios"
      ],
      "Butterfly Necklace": [
        "Collar de mariposa",
        "Para pequeñas transformaciones"
      ],
      "Sun Pendant": [
        "Colgante de sol",
        "Para una confianza luminosa"
      ],
      "Moon Pendant": [
        "Colgante de luna",
        "Ayuda a nombrar sentimientos silenciosos"
      ],
      "Diamond Studs": [
        "Pendientes de botón con diamantes",
        "Para una claridad refinada"
      ],
      "Rose Gold Ring": [
        "Anillo de oro rosa",
        "Para una confianza suave"
      ],
      "Quartz Bracelet": [
        "Pulsera de cuarzo",
        "Para reajustar las emociones"
      ],
      "Zodiac Necklace": [
        "Collar del zodiaco",
        "Para confiar en tus tiempos"
      ],
      "Clover Charm": [
        "Dije de trébol",
        "Para un momento oportuno y dulce"
      ],
      "Shell Necklace": [
        "Collar de concha",
        "Para un ritmo más suave"
      ],
      "Birthstone Ring": [
        "Anillo de piedra de nacimiento",
        "Para tu suerte personal"
      ],
      "Gem Earrings": [
        "Pendientes de gemas",
        "Para un poco de brillo"
      ],
      "Infinity Bracelet": [
        "Pulsera de infinito",
        "Para mantener la conexión"
      ]
    },
    "food": {
      "Bubble Tea": [
        "Té de burbujas",
        "Para levantar un poquito el ánimo"
      ],
      "Avocado": [
        "Aguacate",
        "Para mantener una energía estable"
      ],
      "Strawberry": [
        "Fresa",
        "Para un dulce reinicio"
      ],
      "Matcha": [
        "Matcha",
        "Para concentrarte con suavidad"
      ],
      "Croissant": [
        "Cruasán",
        "Para darle romanticismo a la mañana"
      ],
      "Ramen": [
        "Ramen",
        "Para sentir bienestar y concentración"
      ],
      "Fried Rice": [
        "Arroz frito",
        "Para aprovechar lo que tienes"
      ],
      "Sushi": [
        "Sushi",
        "Para avanzar con claridad"
      ],
      "Yogurt": [
        "Yogur",
        "Para un comienzo amable"
      ],
      "Chocolate": [
        "Chocolate",
        "Para un pequeño reajuste del ánimo"
      ],
      "Blueberries": [
        "Arándanos",
        "Para una mente clara"
      ],
      "Salmon": [
        "Salmón",
        "Para una fuerza con los pies en la tierra"
      ],
      "Iced Coffee": [
        "Café helado",
        "Para ponerte en movimiento"
      ],
      "Macarons": [
        "Macarons",
        "Para una pausa bonita"
      ],
      "Donut": [
        "Dónut",
        "Para un ánimo juguetón"
      ],
      "Dumplings": [
        "Dumplings",
        "Para sentirte arropado"
      ],
      "Mango": [
        "Mango",
        "Para una energía luminosa"
      ],
      "Pancakes": [
        "Tortitas",
        "Para empezar despacio"
      ],
      "Tacos": [
        "Tacos",
        "Para planes espontáneos"
      ],
      "Salad": [
        "Ensalada",
        "Para un ritmo más ligero"
      ],
      "Ice Cream": [
        "Helado",
        "Para una recompensa suave"
      ],
      "Cheesecake": [
        "Tarta de queso",
        "Para tratarte con cariño"
      ],
      "Acai Bowl": [
        "Bol de açaí",
        "Para una energía fresca"
      ],
      "Apple": [
        "Manzana",
        "Para un reinicio fresco y nítido"
      ],
      "Grapes": [
        "Uvas",
        "Para una dulzura sencilla"
      ],
      "Pasta": [
        "Pasta",
        "Para sentir bienestar sin darle tantas vueltas"
      ],
      "Waffles": [
        "Gofres",
        "Para una mañana acogedora"
      ],
      "Honey Toast": [
        "Tostada con miel",
        "Para aportar calidez"
      ]
    },
    "carry": {
      "AirPods Case": [
        "Estuche de AirPods",
        "Para proteger tu ánimo"
      ],
      "Lip Balm": [
        "Bálsamo labial",
        "Ten el bienestar cerca"
      ],
      "Hair Ties": [
        "Gomas del pelo",
        "Para resolver lo que tienes entre manos"
      ],
      "Phone": [
        "Teléfono",
        "Para un mensaje sincero"
      ],
      "Sunglasses": [
        "Gafas de sol",
        "Para mantener tu límite"
      ],
      "Water Bottle": [
        "Botella de agua",
        "Para mantener una energía estable"
      ],
      "Perfume": [
        "Perfume",
        "Para renovar el ambiente que te rodea"
      ],
      "Canvas Bag": [
        "Bolsa de lona",
        "Para llevar menos caos"
      ],
      "Notebook": [
        "Cuaderno",
        "Para atrapar ese pensamiento"
      ],
      "Keychain": [
        "Llavero",
        "Para una transición clara"
      ],
      "Lipstick": [
        "Pintalabios",
        "Para un recordatorio de confianza"
      ],
      "Hand Cream": [
        "Crema de manos",
        "Para pequeños cuidados"
      ],
      "Ring": [
        "Anillo",
        "Para recordar tu intención"
      ],
      "Bracelet": [
        "Pulsera",
        "Para mantenerte firme"
      ],
      "Necklace": [
        "Collar",
        "Para tener cerca tu intención"
      ],
      "Mirror": [
        "Espejo",
        "Para mirar cómo te encuentras"
      ],
      "Charger": [
        "Cargador",
        "Para recuperar energía"
      ],
      "Wallet": [
        "Cartera",
        "Para la suerte en lo práctico"
      ],
      "Scrunchie": [
        "Coletero de tela",
        "Para un reajuste sencillo"
      ],
      "Claw Clip": [
        "Pinza del pelo",
        "Para concentrarte rápidamente"
      ],
      "Camera": [
        "Cámara",
        "Para fijarte en la belleza"
      ],
      "Earbuds Case": [
        "Estuche de auriculares",
        "Para tener la calma cerca"
      ],
      "Makeup Bag": [
        "Neceser de maquillaje",
        "Para sentir que estás preparado"
      ],
      "Crystal Charm": [
        "Dije de cristal",
        "Para un pequeño ritual"
      ],
      "Coin Purse": [
        "Monedero",
        "Para gastar con conciencia"
      ],
      "Pen": [
        "Bolígrafo",
        "Para poner palabras a ese pensamiento"
      ],
      "Mini Plush": [
        "Minipeluche",
        "Para sentir consuelo"
      ],
      "Travel Mug": [
        "Taza de viaje",
        "Para llevar calidez contigo"
      ],
      "Glasses": [
        "Gafas",
        "Para ver con claridad"
      ],
      "Headphones": [
        "Auriculares de diadema",
        "Para proteger tu concentración"
      ]
    },
    "flower": {
      "Sunflower": [
        "Girasol",
        "Para una confianza visible"
      ],
      "Rose": [
        "Rosa",
        "Para una suavidad que mantiene sus criterios"
      ],
      "Tulip": [
        "Tulipán",
        "Para un nuevo comienzo"
      ],
      "Daisy": [
        "Margarita",
        "Para sentir ligereza"
      ],
      "Lavender": [
        "Lavanda",
        "Calma la mente que no deja de moverse"
      ],
      "Peony": [
        "Peonía",
        "Recibe la suavidad sin disculparte"
      ],
      "Lily": [
        "Lirio",
        "Para un espacio emocional despejado"
      ],
      "Cherry Blossom": [
        "Flor de cerezo",
        "Para un dulce instante fugaz"
      ],
      "Hydrangea": [
        "Hortensia",
        "Para una abundancia amable"
      ],
      "Orchid": [
        "Orquídea",
        "Para una paciencia elegante"
      ],
      "Jasmine": [
        "Jazmín",
        "Para un brillo sereno"
      ],
      "Camellia": [
        "Camelia",
        "Para un afecto estable"
      ],
      "Iris": [
        "Iris",
        "Para confiar en tu mirada"
      ],
      "Magnolia": [
        "Magnolia",
        "Para una gracia con los pies en la tierra"
      ],
      "Dandelion": [
        "Diente de león",
        "Para un reinicio esperanzado"
      ],
      "Marigold": [
        "Clavel de Indias",
        "Para una valentía cálida"
      ],
      "Baby's Breath": [
        "Paniculata",
        "Para un apoyo ligero"
      ],
      "Gardenia": [
        "Gardenia",
        "Para una ternura clara"
      ],
      "Lotus": [
        "Loto",
        "Para elevarte con claridad"
      ],
      "Poppy Seed": [
        "Semilla de amapola",
        "Para una audacia creativa"
      ],
      "Pink Camellia": [
        "Camelia rosa",
        "Para una confianza modesta"
      ],
      "Forget-Me-Not": [
        "Nomeolvides",
        "Para un contacto con significado"
      ],
      "Hibiscus": [
        "Hibisco",
        "Para una calidez expresiva"
      ],
      "Ranunculus": [
        "Ranúnculo",
        "Para sentimientos con matices"
      ],
      "Anemone": [
        "Anémona",
        "Para una suavidad honesta"
      ],
      "Sweet Pea": [
        "Guisante de olor",
        "Para comienzos tiernos"
      ],
      "Cosmos": [
        "Cosmos",
        "Para una belleza equilibrada"
      ],
      "Snapdragon": [
        "Boca de dragón",
        "Para hablar con claridad"
      ],
      "Morning Glory": [
        "Campanilla",
        "Para volver a empezar"
      ],
      "Freesia": [
        "Fresia",
        "Para una honestidad luminosa"
      ]
    }
  },
  "ja": {
    "color": {
      "Sky Blue": [
        "空色",
        "穏やかな返事に"
      ],
      "Sage Green": [
        "セージグリーン",
        "落ち着きを取り戻すために"
      ],
      "Lavender": [
        "ラベンダー色",
        "柔らかな集中に"
      ],
      "Sunset Pink": [
        "夕焼けピンク",
        "温もりを添えるために"
      ],
      "Ocean Blue": [
        "オーシャンブルー",
        "すっきり考えるために"
      ],
      "Cream White": [
        "クリームホワイト",
        "まっさらな始まりに"
      ],
      "Mocha Brown": [
        "モカブラウン",
        "安定した活力に"
      ],
      "Peach": [
        "ピーチ色",
        "無理のない温かさに"
      ],
      "Mint Green": [
        "ミントグリーン",
        "新鮮な気分転換に"
      ],
      "Lilac": [
        "ライラック色",
        "夢見るような集中に"
      ],
      "Coral": [
        "コーラル色",
        "素直に前へ進むために"
      ],
      "Butter Yellow": [
        "バターイエロー",
        "前向きな気持ちに"
      ],
      "Rose Pink": [
        "ローズピンク",
        "やさしい自信に"
      ],
      "Dusty Blue": [
        "ダスティブルー",
        "やさしく境界を守るために"
      ],
      "Emerald Green": [
        "エメラルドグリーン",
        "成長する力に"
      ],
      "Champagne": [
        "シャンパン色",
        "洗練された気分に"
      ],
      "Soft Gray": [
        "ソフトグレー",
        "シンプルに保つために"
      ],
      "Ivory": [
        "アイボリー",
        "静かな明晰さに"
      ],
      "Terracotta": [
        "テラコッタ色",
        "地に足のついた温もりに"
      ],
      "Plum": [
        "プラム色",
        "より深い直感に"
      ],
      "Aqua": [
        "アクア色",
        "軽やかなやり取りに"
      ],
      "Baby Blue": [
        "ベビーブルー",
        "柔らかな始まりに"
      ],
      "Blush Pink": [
        "ブラッシュピンク",
        "いたわりを受け取るために"
      ],
      "Caramel": [
        "キャラメル色",
        "変わらない心地よさに"
      ],
      "Olive Green": [
        "オリーブグリーン",
        "実用的な選択に"
      ],
      "Burgundy": [
        "バーガンディ",
        "自分らしい落ち着きに"
      ],
      "Midnight Blue": [
        "ミッドナイトブルー",
        "落ち着いた集中に"
      ],
      "Apricot": [
        "アプリコット色",
        "穏やかな勇気に"
      ],
      "Mauve": [
        "モーブ色",
        "振り返る気分に"
      ],
      "Honey Beige": [
        "ハニーベージュ",
        "無理のないリズムに"
      ]
    },
    "jewelry": {
      "Gold Ring": [
        "ゴールドリング",
        "静かな自信に"
      ],
      "Silver Ring": [
        "シルバーリング",
        "明確な境界を守るために"
      ],
      "Pearl Earrings": [
        "パールのイヤリング",
        "一日の受け止め方を柔らかく"
      ],
      "Gold Necklace": [
        "ゴールドネックレス",
        "温かな存在感に"
      ],
      "Silver Necklace": [
        "シルバーネックレス",
        "落ち着いた返事を思い出して"
      ],
      "Rose Quartz": [
        "ローズクォーツ",
        "より温かい言葉遣いに"
      ],
      "Moonstone": [
        "ムーンストーン",
        "静かな直感に"
      ],
      "Amethyst": [
        "アメジスト",
        "直感を生かした集中に"
      ],
      "Pearl Bracelet": [
        "パールブレスレット",
        "優雅なペースに"
      ],
      "Hoop Earrings": [
        "フープイヤリング",
        "少し大胆な気分に"
      ],
      "Star Necklace": [
        "星のネックレス",
        "見てもらえている感覚に"
      ],
      "Heart Pendant": [
        "ハートのペンダント",
        "温かい言葉に"
      ],
      "Crystal Earrings": [
        "クリスタルのイヤリング",
        "軽やかさを添えるために"
      ],
      "Sapphire Ring": [
        "サファイアリング",
        "明確な決断に"
      ],
      "Emerald Pendant": [
        "エメラルドのペンダント",
        "成長する力に"
      ],
      "Opal Ring": [
        "オパールリング",
        "微妙な違いを信じるために"
      ],
      "Silver Bangle": [
        "シルバーバングル",
        "ぶれない意図を保つために"
      ],
      "Charm Bracelet": [
        "チャームブレスレット",
        "小さな気づきの目印に"
      ],
      "Butterfly Necklace": [
        "蝶のネックレス",
        "小さな変化に"
      ],
      "Sun Pendant": [
        "太陽のペンダント",
        "明るい自信に"
      ],
      "Moon Pendant": [
        "月のペンダント",
        "静かな気持ちに名前をつけて"
      ],
      "Diamond Studs": [
        "ダイヤのスタッドピアス",
        "洗練された明晰さに"
      ],
      "Rose Gold Ring": [
        "ローズゴールドリング",
        "柔らかな自信に"
      ],
      "Quartz Bracelet": [
        "クォーツブレスレット",
        "気持ちの切り替えに"
      ],
      "Zodiac Necklace": [
        "星座のネックレス",
        "自分のタイミングを信じるために"
      ],
      "Clover Charm": [
        "クローバーのチャーム",
        "うれしいタイミングに"
      ],
      "Shell Necklace": [
        "貝殻のネックレス",
        "より穏やかなペースに"
      ],
      "Birthstone Ring": [
        "誕生石のリング",
        "自分らしい幸運に"
      ],
      "Gem Earrings": [
        "宝石のイヤリング",
        "小さなきらめきに"
      ],
      "Infinity Bracelet": [
        "インフィニティブレスレット",
        "つながりを保つために"
      ]
    },
    "food": {
      "Bubble Tea": [
        "タピオカミルクティー",
        "気分を少し上向きに"
      ],
      "Avocado": [
        "アボカド",
        "安定した活力に"
      ],
      "Strawberry": [
        "いちご",
        "甘い気分転換に"
      ],
      "Matcha": [
        "抹茶",
        "柔らかな集中に"
      ],
      "Croissant": [
        "クロワッサン",
        "朝に少しロマンを添えて"
      ],
      "Ramen": [
        "ラーメン",
        "心地よさと集中に"
      ],
      "Fried Rice": [
        "チャーハン",
        "今あるものを生かすために"
      ],
      "Sushi": [
        "寿司",
        "すっきり前へ進むために"
      ],
      "Yogurt": [
        "ヨーグルト",
        "やさしい始まりに"
      ],
      "Chocolate": [
        "チョコレート",
        "小さな気分転換に"
      ],
      "Blueberries": [
        "ブルーベリー",
        "頭をすっきりさせるひとときに"
      ],
      "Salmon": [
        "サーモン",
        "地に足のついた強さに"
      ],
      "Iced Coffee": [
        "アイスコーヒー",
        "動き始めるきっかけに"
      ],
      "Macarons": [
        "マカロン",
        "彩りのある休憩に"
      ],
      "Donut": [
        "ドーナツ",
        "遊び心を添えるために"
      ],
      "Dumplings": [
        "餃子",
        "包まれるような安心感に"
      ],
      "Mango": [
        "マンゴー",
        "明るい活力に"
      ],
      "Pancakes": [
        "パンケーキ",
        "ゆっくりした始まりに"
      ],
      "Tacos": [
        "タコス",
        "思いつきのプランに"
      ],
      "Salad": [
        "サラダ",
        "軽やかなリズムに"
      ],
      "Ice Cream": [
        "アイスクリーム",
        "やさしいご褒美に"
      ],
      "Cheesecake": [
        "チーズケーキ",
        "自分をやさしくもてなして"
      ],
      "Acai Bowl": [
        "アサイーボウル",
        "新鮮な活力に"
      ],
      "Apple": [
        "りんご",
        "爽やかな気分転換に"
      ],
      "Grapes": [
        "ぶどう",
        "気軽な甘さに"
      ],
      "Pasta": [
        "パスタ",
        "考えすぎずにくつろぐために"
      ],
      "Waffles": [
        "ワッフル",
        "ほっとする朝に"
      ],
      "Honey Toast": [
        "ハニートースト",
        "温もりを添えるために"
      ]
    },
    "carry": {
      "AirPods Case": [
        "AirPodsケース",
        "自分の気分を守るために"
      ],
      "Lip Balm": [
        "リップバーム",
        "心地よさを手元に"
      ],
      "Hair Ties": [
        "ヘアゴム",
        "物事に取り組むために"
      ],
      "Phone": [
        "スマートフォン",
        "一つの正直なメッセージに"
      ],
      "Sunglasses": [
        "サングラス",
        "自分の境界を守るために"
      ],
      "Water Bottle": [
        "水筒",
        "安定した活力に"
      ],
      "Perfume": [
        "香水",
        "周りの空気を切り替えるために"
      ],
      "Canvas Bag": [
        "キャンバスバッグ",
        "混乱を少なく持ち歩くために"
      ],
      "Notebook": [
        "ノート",
        "思いつきをつかまえるために"
      ],
      "Keychain": [
        "キーホルダー",
        "すっきりした切り替えに"
      ],
      "Lipstick": [
        "口紅",
        "自信を思い出す合図に"
      ],
      "Hand Cream": [
        "ハンドクリーム",
        "小さないたわりに"
      ],
      "Ring": [
        "指輪",
        "自分の意図を思い出すために"
      ],
      "Bracelet": [
        "ブレスレット",
        "自分の軸を保つために"
      ],
      "Necklace": [
        "ネックレス",
        "大切な意図を近くに置いて"
      ],
      "Mirror": [
        "鏡",
        "自分の様子を確かめるために"
      ],
      "Charger": [
        "充電器",
        "エネルギーを補うために"
      ],
      "Wallet": [
        "財布",
        "日々に役立つ幸運に"
      ],
      "Scrunchie": [
        "シュシュ",
        "気軽な気分転換に"
      ],
      "Claw Clip": [
        "ヘアクリップ",
        "すぐに集中するために"
      ],
      "Camera": [
        "カメラ",
        "美しさに気づくために"
      ],
      "Earbuds Case": [
        "イヤホンケース",
        "落ち着きを身近に"
      ],
      "Makeup Bag": [
        "化粧ポーチ",
        "準備が整った気分に"
      ],
      "Crystal Charm": [
        "クリスタルのチャーム",
        "小さな儀式に"
      ],
      "Coin Purse": [
        "小銭入れ",
        "意識してお金を使うために"
      ],
      "Pen": [
        "ペン",
        "考えを言葉にするために"
      ],
      "Mini Plush": [
        "小さなぬいぐるみ",
        "ほっとするひとときに"
      ],
      "Travel Mug": [
        "トラベルマグ",
        "温もりを持ち歩くために"
      ],
      "Glasses": [
        "眼鏡",
        "はっきり見るために"
      ],
      "Headphones": [
        "ヘッドホン",
        "集中を守るために"
      ]
    },
    "flower": {
      "Sunflower": [
        "ひまわり",
        "外へ伝わる自信に"
      ],
      "Rose": [
        "バラ",
        "大切な基準を保つ柔らかさに"
      ],
      "Tulip": [
        "チューリップ",
        "新しい始まりに"
      ],
      "Daisy": [
        "デイジー",
        "軽やかさを添えるために"
      ],
      "Lavender": [
        "ラベンダー",
        "忙しく動く心を落ち着かせて"
      ],
      "Peony": [
        "シャクヤク",
        "遠慮せずにやさしさを受け取って"
      ],
      "Lily": [
        "ユリ",
        "澄んだ心の空間に"
      ],
      "Cherry Blossom": [
        "桜",
        "つかの間の甘いひとときに"
      ],
      "Hydrangea": [
        "アジサイ",
        "やさしい豊かさに"
      ],
      "Orchid": [
        "ラン",
        "優雅な忍耐に"
      ],
      "Jasmine": [
        "ジャスミン",
        "静かな輝きに"
      ],
      "Camellia": [
        "ツバキ",
        "変わらない愛情に"
      ],
      "Iris": [
        "アイリス",
        "自分の見る目を信じるために"
      ],
      "Magnolia": [
        "モクレン",
        "落ち着いた優美さに"
      ],
      "Dandelion": [
        "タンポポ",
        "希望を持って切り替えるために"
      ],
      "Marigold": [
        "マリーゴールド",
        "温かい勇気に"
      ],
      "Baby's Breath": [
        "カスミソウ",
        "さりげない支えに"
      ],
      "Gardenia": [
        "クチナシ",
        "まっすぐなやさしさに"
      ],
      "Lotus": [
        "ハス",
        "澄んだ気持ちで立ち上がるために"
      ],
      "Poppy Seed": [
        "ケシの種",
        "創造的な大胆さに"
      ],
      "Pink Camellia": [
        "ピンクのツバキ",
        "控えめな自信に"
      ],
      "Forget-Me-Not": [
        "ワスレナグサ",
        "意味のあるつながりに"
      ],
      "Hibiscus": [
        "ハイビスカス",
        "温かさを表現するために"
      ],
      "Ranunculus": [
        "ラナンキュラス",
        "重なり合う気持ちに"
      ],
      "Anemone": [
        "アネモネ",
        "素直な柔らかさに"
      ],
      "Sweet Pea": [
        "スイートピー",
        "やさしい始まりに"
      ],
      "Cosmos": [
        "コスモス",
        "調和のとれた美しさに"
      ],
      "Snapdragon": [
        "キンギョソウ",
        "はっきり話すために"
      ],
      "Morning Glory": [
        "アサガオ",
        "もう一度始めるために"
      ],
      "Freesia": [
        "フリージア",
        "明るい正直さに"
      ]
    }
  },
  "ko": {
    "color": {
      "Sky Blue": [
        "하늘색",
        "차분한 답장을 위해"
      ],
      "Sage Green": [
        "세이지 그린",
        "중심을 잡기 위해"
      ],
      "Lavender": [
        "라벤더색",
        "부드러운 집중을 위해"
      ],
      "Sunset Pink": [
        "노을빛 분홍",
        "온기를 더하기 위해"
      ],
      "Ocean Blue": [
        "오션 블루",
        "명료한 생각을 위해"
      ],
      "Cream White": [
        "크림 화이트",
        "산뜻한 시작을 위해"
      ],
      "Mocha Brown": [
        "모카 브라운",
        "꾸준한 에너지를 위해"
      ],
      "Peach": [
        "복숭아색",
        "부담 없는 온기를 위해"
      ],
      "Mint Green": [
        "민트 그린",
        "산뜻한 전환을 위해"
      ],
      "Lilac": [
        "라일락색",
        "꿈꾸듯 집중하기 위해"
      ],
      "Coral": [
        "코럴색",
        "솔직하게 나아가기 위해"
      ],
      "Butter Yellow": [
        "버터 옐로",
        "낙관적인 마음을 위해"
      ],
      "Rose Pink": [
        "로즈 핑크",
        "다정한 자신감을 위해"
      ],
      "Dusty Blue": [
        "더스티 블루",
        "부드럽게 경계를 지키기 위해"
      ],
      "Emerald Green": [
        "에메랄드 그린",
        "성장하는 에너지를 위해"
      ],
      "Champagne": [
        "샴페인색",
        "정돈된 기분을 위해"
      ],
      "Soft Gray": [
        "부드러운 회색",
        "단순함을 지키기 위해"
      ],
      "Ivory": [
        "아이보리",
        "조용한 명료함을 위해"
      ],
      "Terracotta": [
        "테라코타색",
        "단단한 온기를 위해"
      ],
      "Plum": [
        "자두색",
        "더 깊은 직관을 위해"
      ],
      "Aqua": [
        "아쿠아색",
        "가벼운 소통을 위해"
      ],
      "Baby Blue": [
        "베이비 블루",
        "부드러운 시작을 위해"
      ],
      "Blush Pink": [
        "블러시 핑크",
        "돌봄을 받아들이기 위해"
      ],
      "Caramel": [
        "캐러멜색",
        "꾸준한 편안함을 위해"
      ],
      "Olive Green": [
        "올리브 그린",
        "실용적인 선택을 위해"
      ],
      "Burgundy": [
        "버건디",
        "흔들리지 않는 태도를 위해"
      ],
      "Midnight Blue": [
        "미드나이트 블루",
        "차분한 집중을 위해"
      ],
      "Apricot": [
        "살구색",
        "부드러운 용기를 위해"
      ],
      "Mauve": [
        "모브색",
        "돌아보는 마음을 위해"
      ],
      "Honey Beige": [
        "허니 베이지",
        "편안한 리듬을 위해"
      ]
    },
    "jewelry": {
      "Gold Ring": [
        "금반지",
        "조용한 자신감을 위해"
      ],
      "Silver Ring": [
        "은반지",
        "분명한 경계를 위해"
      ],
      "Pearl Earrings": [
        "진주 귀걸이",
        "하루를 부드럽게 받아들이도록"
      ],
      "Gold Necklace": [
        "금목걸이",
        "따뜻한 존재감을 위해"
      ],
      "Silver Necklace": [
        "은목걸이",
        "차분한 답장을 떠올리도록"
      ],
      "Rose Quartz": [
        "로즈쿼츠",
        "더 따뜻한 말투를 위해"
      ],
      "Moonstone": [
        "문스톤",
        "조용한 직관을 위해"
      ],
      "Amethyst": [
        "자수정",
        "직관적인 집중을 위해"
      ],
      "Pearl Bracelet": [
        "진주 팔찌",
        "우아한 속도 조절을 위해"
      ],
      "Hoop Earrings": [
        "링 귀걸이",
        "조금 더 대담한 기분을 위해"
      ],
      "Star Necklace": [
        "별 목걸이",
        "자신이 드러나는 느낌을 위해"
      ],
      "Heart Pendant": [
        "하트 펜던트",
        "더 따뜻한 말을 위해"
      ],
      "Crystal Earrings": [
        "크리스털 귀걸이",
        "가벼움을 더하기 위해"
      ],
      "Sapphire Ring": [
        "사파이어 반지",
        "분명한 결정을 위해"
      ],
      "Emerald Pendant": [
        "에메랄드 펜던트",
        "성장하는 에너지를 위해"
      ],
      "Opal Ring": [
        "오팔 반지",
        "미묘한 차이를 믿기 위해"
      ],
      "Silver Bangle": [
        "은 뱅글",
        "꾸준한 의도를 위해"
      ],
      "Charm Bracelet": [
        "참 팔찌",
        "작은 기억의 표시로"
      ],
      "Butterfly Necklace": [
        "나비 목걸이",
        "작은 변화를 위해"
      ],
      "Sun Pendant": [
        "태양 펜던트",
        "밝은 자신감을 위해"
      ],
      "Moon Pendant": [
        "달 펜던트",
        "조용한 감정에 이름을 붙이도록"
      ],
      "Diamond Studs": [
        "다이아몬드 스터드 귀걸이",
        "정돈된 명료함을 위해"
      ],
      "Rose Gold Ring": [
        "로즈골드 반지",
        "부드러운 자신감을 위해"
      ],
      "Quartz Bracelet": [
        "수정 팔찌",
        "감정을 새롭게 정리하기 위해"
      ],
      "Zodiac Necklace": [
        "별자리 목걸이",
        "자신의 때를 믿기 위해"
      ],
      "Clover Charm": [
        "클로버 참",
        "기분 좋은 타이밍을 위해"
      ],
      "Shell Necklace": [
        "조개 목걸이",
        "더 부드러운 속도를 위해"
      ],
      "Birthstone Ring": [
        "탄생석 반지",
        "나만의 행운을 위해"
      ],
      "Gem Earrings": [
        "보석 귀걸이",
        "작은 반짝임을 위해"
      ],
      "Infinity Bracelet": [
        "인피니티 팔찌",
        "연결을 지키기 위해"
      ]
    },
    "food": {
      "Bubble Tea": [
        "버블티",
        "기분을 조금 높이기 위해"
      ],
      "Avocado": [
        "아보카도",
        "꾸준한 에너지를 위해"
      ],
      "Strawberry": [
        "딸기",
        "달콤한 전환을 위해"
      ],
      "Matcha": [
        "말차",
        "부드러운 집중을 위해"
      ],
      "Croissant": [
        "크루아상",
        "아침을 조금 낭만적으로 만들기 위해"
      ],
      "Ramen": [
        "라멘",
        "편안함과 집중을 위해"
      ],
      "Fried Rice": [
        "볶음밥",
        "가진 것을 활용하기 위해"
      ],
      "Sushi": [
        "초밥",
        "산뜻하게 나아가기 위해"
      ],
      "Yogurt": [
        "요거트",
        "부드러운 시작을 위해"
      ],
      "Chocolate": [
        "초콜릿",
        "작은 기분 전환을 위해"
      ],
      "Blueberries": [
        "블루베리",
        "머리를 맑게 하는 시간을 위해"
      ],
      "Salmon": [
        "연어",
        "단단한 힘을 위해"
      ],
      "Iced Coffee": [
        "아이스커피",
        "움직이기 시작하도록"
      ],
      "Macarons": [
        "마카롱",
        "예쁜 쉼을 위해"
      ],
      "Donut": [
        "도넛",
        "장난스러운 마음을 위해"
      ],
      "Dumplings": [
        "만두",
        "포근한 느낌을 위해"
      ],
      "Mango": [
        "망고",
        "밝은 에너지를 위해"
      ],
      "Pancakes": [
        "팬케이크",
        "느긋한 시작을 위해"
      ],
      "Tacos": [
        "타코",
        "즉흥적인 계획을 위해"
      ],
      "Salad": [
        "샐러드",
        "가벼운 리듬을 위해"
      ],
      "Ice Cream": [
        "아이스크림",
        "부드러운 보상을 위해"
      ],
      "Cheesecake": [
        "치즈케이크",
        "자신을 다정하게 대하기 위해"
      ],
      "Acai Bowl": [
        "아사이볼",
        "산뜻한 에너지를 위해"
      ],
      "Apple": [
        "사과",
        "상쾌한 전환을 위해"
      ],
      "Grapes": [
        "포도",
        "편안한 달콤함을 위해"
      ],
      "Pasta": [
        "파스타",
        "생각을 덜고 편안해지기 위해"
      ],
      "Waffles": [
        "와플",
        "아늑한 아침을 위해"
      ],
      "Honey Toast": [
        "허니토스트",
        "온기를 더하기 위해"
      ]
    },
    "carry": {
      "AirPods Case": [
        "에어팟 케이스",
        "기분을 보호하기 위해"
      ],
      "Lip Balm": [
        "립밤",
        "편안함을 가까이 두세요"
      ],
      "Hair Ties": [
        "머리끈",
        "일을 처리하기 위해"
      ],
      "Phone": [
        "휴대전화",
        "솔직한 메시지 하나를 위해"
      ],
      "Sunglasses": [
        "선글라스",
        "자신의 경계를 지키기 위해"
      ],
      "Water Bottle": [
        "물병",
        "꾸준한 에너지를 위해"
      ],
      "Perfume": [
        "향수",
        "주변 분위기를 새롭게 하기 위해"
      ],
      "Canvas Bag": [
        "캔버스 가방",
        "덜 복잡하게 챙기기 위해"
      ],
      "Notebook": [
        "공책",
        "떠오른 생각을 담기 위해"
      ],
      "Keychain": [
        "열쇠고리",
        "산뜻한 전환을 위해"
      ],
      "Lipstick": [
        "립스틱",
        "자신감의 신호를 위해"
      ],
      "Hand Cream": [
        "핸드크림",
        "작은 돌봄을 위해"
      ],
      "Ring": [
        "반지",
        "자신의 의도를 기억하기 위해"
      ],
      "Bracelet": [
        "팔찌",
        "중심을 지키기 위해"
      ],
      "Necklace": [
        "목걸이",
        "의도를 가까이 두기 위해"
      ],
      "Mirror": [
        "거울",
        "자신을 살펴보기 위해"
      ],
      "Charger": [
        "충전기",
        "에너지를 회복하기 위해"
      ],
      "Wallet": [
        "지갑",
        "실용적인 행운을 위해"
      ],
      "Scrunchie": [
        "곱창 머리끈",
        "편안한 전환을 위해"
      ],
      "Claw Clip": [
        "집게핀",
        "빠르게 집중하기 위해"
      ],
      "Camera": [
        "카메라",
        "아름다움을 알아차리기 위해"
      ],
      "Earbuds Case": [
        "이어폰 케이스",
        "차분함을 가까이 두기 위해"
      ],
      "Makeup Bag": [
        "화장품 파우치",
        "준비된 기분을 위해"
      ],
      "Crystal Charm": [
        "크리스털 참",
        "작은 의식을 위해"
      ],
      "Coin Purse": [
        "동전 지갑",
        "신중한 소비를 위해"
      ],
      "Pen": [
        "펜",
        "생각에 이름을 붙이기 위해"
      ],
      "Mini Plush": [
        "작은 인형",
        "편안함을 위해"
      ],
      "Travel Mug": [
        "휴대용 머그",
        "온기를 가지고 다니기 위해"
      ],
      "Glasses": [
        "안경",
        "선명하게 보기 위해"
      ],
      "Headphones": [
        "헤드폰",
        "집중을 보호하기 위해"
      ]
    },
    "flower": {
      "Sunflower": [
        "해바라기",
        "드러나는 자신감을 위해"
      ],
      "Rose": [
        "장미",
        "기준을 지키는 부드러움을 위해"
      ],
      "Tulip": [
        "튤립",
        "새로운 시작을 위해"
      ],
      "Daisy": [
        "데이지",
        "가벼움을 더하기 위해"
      ],
      "Lavender": [
        "라벤더",
        "분주한 마음을 가라앉히세요"
      ],
      "Peony": [
        "작약",
        "미안해하지 말고 부드러움을 받아들여요"
      ],
      "Lily": [
        "백합",
        "맑은 감정의 공간을 위해"
      ],
      "Cherry Blossom": [
        "벚꽃",
        "잠깐의 달콤한 순간을 위해"
      ],
      "Hydrangea": [
        "수국",
        "부드러운 풍요를 위해"
      ],
      "Orchid": [
        "난초",
        "우아한 인내를 위해"
      ],
      "Jasmine": [
        "재스민",
        "조용한 빛을 위해"
      ],
      "Camellia": [
        "동백",
        "꾸준한 애정을 위해"
      ],
      "Iris": [
        "아이리스",
        "자신의 안목을 믿기 위해"
      ],
      "Magnolia": [
        "목련",
        "단단한 우아함을 위해"
      ],
      "Dandelion": [
        "민들레",
        "희망찬 전환을 위해"
      ],
      "Marigold": [
        "금잔화",
        "따뜻한 용기를 위해"
      ],
      "Baby's Breath": [
        "안개꽃",
        "가벼운 지지를 위해"
      ],
      "Gardenia": [
        "치자꽃",
        "분명한 다정함을 위해"
      ],
      "Lotus": [
        "연꽃",
        "맑게 피어나기 위해"
      ],
      "Poppy Seed": [
        "양귀비 씨앗",
        "창의적인 대담함을 위해"
      ],
      "Pink Camellia": [
        "분홍 동백",
        "겸손한 자신감을 위해"
      ],
      "Forget-Me-Not": [
        "물망초",
        "의미 있는 만남을 위해"
      ],
      "Hibiscus": [
        "히비스커스",
        "따뜻함을 표현하기 위해"
      ],
      "Ranunculus": [
        "라넌큘러스",
        "겹겹의 감정을 위해"
      ],
      "Anemone": [
        "아네모네",
        "솔직한 부드러움을 위해"
      ],
      "Sweet Pea": [
        "스위트피",
        "다정한 시작을 위해"
      ],
      "Cosmos": [
        "코스모스",
        "균형 잡힌 아름다움을 위해"
      ],
      "Snapdragon": [
        "금어초",
        "분명하게 말하기 위해"
      ],
      "Morning Glory": [
        "나팔꽃",
        "다시 시작하기 위해"
      ],
      "Freesia": [
        "프리지아",
        "밝은 솔직함을 위해"
      ]
    }
  }
};

export const DAILY_REPORT_METADATA: Record<HintLanguage, { upright: string; major: string; minor: string }> = {
  "en": {
    "upright": "Upright",
    "major": "Bigger message",
    "minor": "Daily guidance"
  },
  "zh": {
    "upright": "正位",
    "major": "更深的讯息",
    "minor": "日常指引"
  },
  "es": {
    "upright": "Al derecho",
    "major": "Mensaje más amplio",
    "minor": "Guía cotidiana"
  },
  "ja": {
    "upright": "正位置",
    "major": "大きなメッセージ",
    "minor": "日常のヒント"
  },
  "ko": {
    "upright": "정방향",
    "major": "더 큰 메시지",
    "minor": "일상의 안내"
  }
};

export function localizeDailyLuckyItem(item: DailyLuckyItem, language: HintLanguage): DailyLuckyItem {
  const canonical = { ...item, illustrationValue: item.value };
  if (language === "en") return canonical;
  if (item.key === "number") {
    return { ...canonical, value: new Intl.ListFormat(language, { type: "conjunction" }).format(item.value.split(" and ")) };
  }
  const [value, hint] = DAILY_LUCKY_COPY[language][item.key][item.value] ?? [item.value, item.hint];
  return { ...canonical, value, hint };
}
