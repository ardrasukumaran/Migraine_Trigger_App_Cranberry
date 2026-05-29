import lackOfSleep from "@/assets/triggers/icons/lack-of-sleep.png";
import wokeUp2hLate from "@/assets/triggers/icons/woke-up-2h-late.png";
import interruptedSleep from "@/assets/triggers/icons/interrupted-sleep.png";
import oversleeping from "@/assets/triggers/icons/oversleeping.png";
import stress from "@/assets/triggers/icons/stress.png";
import depressedMood from "@/assets/triggers/icons/depressed-mood.png";
import anxiety from "@/assets/triggers/icons/anxiety.png";
import oddStrongSmells from "@/assets/triggers/icons/odd-strong-smells.png";
import loudMusic from "@/assets/triggers/icons/loud-music.png";
import brightFlickeringLights from "@/assets/triggers/icons/bright-flickering-lights.png";
import overuseOfScreens from "@/assets/triggers/icons/overuse-of-screens.png";
import neckPain from "@/assets/triggers/icons/neck-pain.png";
import haveNotHad2LitresOfWater from "@/assets/triggers/icons/have-not-had-2-litres-of-water.png";
import allergicReaction from "@/assets/triggers/icons/allergic-reaction.png";
import sinus from "@/assets/triggers/icons/sinus.png";
import excessivePhysicalStrain from "@/assets/triggers/icons/excessive-physical-strain.png";
import dayOldFridgeLeftovers from "@/assets/triggers/icons/day-old-fridge-leftovers.png";
import overripeFruitVegetable from "@/assets/triggers/icons/overripe-fruit-vegetable.png";
import salamiSausagesBacon from "@/assets/triggers/icons/salami-sausages-bacon.png";
import saltedFish from "@/assets/triggers/icons/salted-fish.png";
import agedCheeseParmesanBrieCheddar from "@/assets/triggers/icons/aged-cheese-parmesan-brie-cheddar.png";
import alcoholAny from "@/assets/triggers/icons/alcohol-any.png";
import pickleAchaar from "@/assets/triggers/icons/pickle-achaar.png";
import driedFruitsRaisinsAnjeerDates from "@/assets/triggers/icons/dried-fruits-raisins-anjeer-dates.png";
import twoDayOldDosaIdliBatter from "@/assets/triggers/icons/2-day-old-dosa-idli-batter.png";
import peanutWalnutCashewSesameSeeds from "@/assets/triggers/icons/peanut-walnut-cashew-sesame-seeds.png";
import anyChineseFoodInstantNoodles from "@/assets/triggers/icons/any-chinese-food-instant-noodles.png";
import chocolate from "@/assets/triggers/icons/chocolate.png";
import sugarFreeOrAnythingWithIt from "@/assets/triggers/icons/sugar-free-or-anything-with-it.png";
import artificialColouringSoftDrinkSyrup from "@/assets/triggers/icons/artificial-colouring-soft-drink-syrup.png";
import nearExpiryPackagedFood from "@/assets/triggers/icons/near-expiry-packaged-food.png";
import twoDayOldMeatFish from "@/assets/triggers/icons/2-day-old-meat-fish.png";
import buttermilkChaas from "@/assets/triggers/icons/buttermilk-chaas.png";
import caffeinatedDrinkTeaCoffeeSoftDrink from "@/assets/triggers/icons/caffeinated-drink-tea-coffee-soft-drink.png";
import rawOnion from "@/assets/triggers/icons/raw-onion.png";
import brinjal from "@/assets/triggers/icons/brinjal.png";
import citrusFruitOrangeLemonLimePineapple from "@/assets/triggers/icons/citrus-fruit-orange-lemon-lime-pineapple.png";
import sweetsMithaiIceCream from "@/assets/triggers/icons/sweets-mithai-ice-cream.png";
import curd from "@/assets/triggers/icons/curd.png";
import papadFryums from "@/assets/triggers/icons/papad-fryums.png";
import rajmaChickpeas from "@/assets/triggers/icons/rajma-chickpeas.png";

export type FoodItem = { name: string; icon: string };

export const FOOD_SETS: { label: string; items: FoodItem[] }[] = [
  {
    label: "Fresh & fermented",
    items: [
      { name: "Raw onion", icon: rawOnion },
      { name: "Brinjal", icon: brinjal },
      { name: "Rajma/ Chickpeas", icon: rajmaChickpeas },
      { name: "Any Chinese food/ Instant noodles", icon: anyChineseFoodInstantNoodles },
      { name: "Salted Fish", icon: saltedFish },
      { name: "Salami/ Sausages/ Bacon", icon: salamiSausagesBacon },
      { name: "2-day old dosa/ idli batter", icon: twoDayOldDosaIdliBatter },
      { name: "Day-old fridge leftovers", icon: dayOldFridgeLeftovers },
      { name: "Near-expiry packaged food", icon: nearExpiryPackagedFood },
    ],
  },
  {
    label: "Dairy & condiments",
    items: [
      { name: "2-day-old meat/ fish", icon: twoDayOldMeatFish },
      { name: "Curd", icon: curd },
      { name: "Buttermilk/ Chaas", icon: buttermilkChaas },
      { name: "Aged cheese: parmesan, brie, cheddar", icon: agedCheeseParmesanBrieCheddar },
      { name: "Pickle/ Achaar", icon: pickleAchaar },
      { name: "Papad/ Fryums", icon: papadFryums },
      { name: "Peanut/ Walnut/ Cashew/ Sesame seeds", icon: peanutWalnutCashewSesameSeeds },
      { name: "Dried Fruits (Raisins/ Anjeer/ Dates)", icon: driedFruitsRaisinsAnjeerDates },
      { name: "Sweets/ Mithai/ Ice cream", icon: sweetsMithaiIceCream },
    ],
  },
  {
    label: "Drinks & additives",
    items: [
      { name: "Chocolate", icon: chocolate },
      { name: "Sugar free or anything with it", icon: sugarFreeOrAnythingWithIt },
      { name: "Overripe fruit/ vegetable", icon: overripeFruitVegetable },
      { name: "Citrus fruit (Orange/ Lemon/ Lime/ Pineapple)", icon: citrusFruitOrangeLemonLimePineapple },
      { name: "Caffeinated drink (tea/ coffee/ soft drink)", icon: caffeinatedDrinkTeaCoffeeSoftDrink },
      { name: "Alcohol (any)", icon: alcoholAny },
      { name: "Artificial colouring (any soft drink or syrup)", icon: artificialColouringSoftDrinkSyrup },
    ],
  },
];

export const NON_FOOD_SETS: { label: string; items: FoodItem[] }[] = [
  {
    label: "Sleep & emotions",
    items: [
      { name: "Have not had 2 litres of water", icon: haveNotHad2LitresOfWater },
      { name: "Lack of sleep", icon: lackOfSleep },
      { name: "Woke up 2h late", icon: wokeUp2hLate },
      { name: "Interrupted sleep", icon: interruptedSleep },
      { name: "Oversleeping", icon: oversleeping },
      { name: "Stress", icon: stress },
      { name: "Depressed mood", icon: depressedMood },
      { name: "Anxiety", icon: anxiety },
    ],
  },
  {
    label: "Environment & physical",
    items: [
      { name: "Odd/ strong smells", icon: oddStrongSmells },
      { name: "Loud music", icon: loudMusic },
      { name: "Bright/ flickering lights", icon: brightFlickeringLights },
      { name: "Overuse of screens", icon: overuseOfScreens },
      { name: "Neck pain", icon: neckPain },
      { name: "Allergic reaction", icon: allergicReaction },
      { name: "Sinus", icon: sinus },
      { name: "No warm-up/ cool-down", icon: excessivePhysicalStrain },
    ],
  },
];

export const LIFESTYLE = ["Poor sleep", "Skipped meal", "Dehydration", "Long screen time", "Intense exercise", "Travel"];
export const ENVIRONMENT = ["Bright light", "Loud noise", "Strong smell", "Weather change", "High humidity", "Heat"];
export const HORMONAL = ["Period", "Ovulation", "PMS", "Pregnancy", "Menopause"];

export const SYMPTOMS = ["Aura", "Nausea", "Light sensitivity", "Sound sensitivity", "Throbbing", "Vision changes", "Dizziness", "Neck pain"];
export const LOCATIONS = ["Left", "Right", "Front", "Back", "Whole head"];

export const RECENT_ATTACKS = [
  { date: "Tue, May 12", duration: "4h 20m", intensity: 7, triggers: ["Red wine", "Poor sleep"] },
  { date: "Sat, May 09", duration: "2h 10m", intensity: 5, triggers: ["Weather change"] },
  { date: "Wed, May 06", duration: "6h 45m", intensity: 8, triggers: ["Skipped meal", "Bright light"] },
];

export const TOP_TRIGGERS = [
  { name: "Poor sleep", correlation: 82, count: 14 },
  { name: "Red wine", correlation: 71, count: 9 },
  { name: "Skipped meal", correlation: 64, count: 11 },
  { name: "Weather change", correlation: 58, count: 8 },
  { name: "Bright light", correlation: 49, count: 6 },
];

// Calendar heatmap mock — last 35 days, intensity 0–10
export const CALENDAR_DATA: number[] = [
  0, 0, 3, 0, 0, 0, 5,
  0, 0, 0, 7, 0, 0, 0,
  0, 4, 0, 0, 0, 8, 0,
  0, 0, 0, 0, 5, 0, 0,
  6, 0, 0, 0, 0, 0, 7,
];

export const BADGES = [
  { name: "First check-in", earned: true, desc: "You showed up for yourself" },
  { name: "Gentle week", earned: true, desc: "5+ clear days in a week" },
  { name: "Pattern spotter", earned: true, desc: "Identified 3 triggers" },
  { name: "Calmer month", earned: false, desc: "Fewer attacks than last month" },
  { name: "Doctor ready", earned: false, desc: "Exported first report" },
];
