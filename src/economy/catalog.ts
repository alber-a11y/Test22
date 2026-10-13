// Каталог всех покупаемых предметов: транспорт, персонажи, краски, следы, бустеры.

export type Price = { coins: number } | { ads: number } | { free: true };

export type VehicleKind =
  | 'bmx' | 'scooter' | 'skate' | 'monowheel' | 'minimoto' | 'quad' | 'kart' | 'cross'
  | 'fire' | 'hover' | 'unicorn' | 'rocket';

export type RiderPose = 'pedal' | 'stand' | 'sit' | 'kart';

export interface VehicleDef {
  id: VehicleKind;
  name: { ru: string; en: string };
  price: Price;
  maxSpeed: number;
  accel: number;
  jump: number;
  turn: number;
  nitroRegenMul: number;
  pose: RiderPose;
  motor: boolean;
  color: number;
}

export const VEHICLES: VehicleDef[] = [
  { id: 'bmx', name: { ru: 'BMX', en: 'BMX' }, price: { free: true }, maxSpeed: 13, accel: 17, jump: 10, turn: 2.6, nitroRegenMul: 1, pose: 'pedal', motor: false, color: 0x2f80ed },
  { id: 'scooter', name: { ru: 'Самокат', en: 'Scooter' }, price: { coins: 500 }, maxSpeed: 13.3, accel: 18, jump: 10.1, turn: 2.8, nitroRegenMul: 1, pose: 'stand', motor: false, color: 0x27ae60 },
  { id: 'skate', name: { ru: 'Скейтборд', en: 'Skateboard' }, price: { coins: 1200 }, maxSpeed: 13.6, accel: 19, jump: 10.3, turn: 2.9, nitroRegenMul: 1.1, pose: 'stand', motor: false, color: 0xf2994a },
  { id: 'monowheel', name: { ru: 'Моноколесо', en: 'Monowheel' }, price: { coins: 2500 }, maxSpeed: 14, accel: 20, jump: 10.4, turn: 3.0, nitroRegenMul: 1.1, pose: 'stand', motor: true, color: 0x9b51e0 },
  { id: 'minimoto', name: { ru: 'Мини-мото', en: 'Mini Moto' }, price: { coins: 4000 }, maxSpeed: 14.5, accel: 23, jump: 10.4, turn: 2.9, nitroRegenMul: 1.2, pose: 'sit', motor: true, color: 0xeb5757 },
  { id: 'quad', name: { ru: 'Квадроцикл', en: 'Quad' }, price: { coins: 6500 }, maxSpeed: 14.8, accel: 24, jump: 10.5, turn: 2.8, nitroRegenMul: 1.2, pose: 'sit', motor: true, color: 0xf2c94c },
  { id: 'kart', name: { ru: 'Карт', en: 'Kart' }, price: { coins: 9000 }, maxSpeed: 15.2, accel: 27, jump: 10.6, turn: 3.1, nitroRegenMul: 1.3, pose: 'kart', motor: true, color: 0x56ccf2 },
  { id: 'cross', name: { ru: 'Кросс-байк', en: 'Dirt Bike' }, price: { coins: 12000 }, maxSpeed: 15.8, accel: 29, jump: 11, turn: 3.1, nitroRegenMul: 1.4, pose: 'sit', motor: true, color: 0xff6f00 },
  { id: 'fire', name: { ru: 'Огненный байк', en: 'Fire Bike' }, price: { ads: 3 }, maxSpeed: 15.6, accel: 28, jump: 10.9, turn: 3.2, nitroRegenMul: 1.5, pose: 'pedal', motor: false, color: 0x222222 },
  { id: 'hover', name: { ru: 'Ховерборд', en: 'Hoverboard' }, price: { ads: 3 }, maxSpeed: 15.4, accel: 27, jump: 11.2, turn: 3.4, nitroRegenMul: 1.5, pose: 'stand', motor: true, color: 0x00e5ff },
  { id: 'unicorn', name: { ru: 'Единорог', en: 'Unicorn Bike' }, price: { ads: 3 }, maxSpeed: 15.2, accel: 27, jump: 11.6, turn: 3.2, nitroRegenMul: 1.5, pose: 'pedal', motor: false, color: 0xffffff },
  { id: 'rocket', name: { ru: 'Ракето-мото', en: 'Rocket Moto' }, price: { ads: 3 }, maxSpeed: 16.5, accel: 32, jump: 11, turn: 3.0, nitroRegenMul: 2, pose: 'sit', motor: true, color: 0x8e44ad },
];

export type HairStyle = 'short' | 'spiky' | 'messy' | 'ponytail' | 'long' | 'buns' | 'bob' | 'none';
export type HatStyle = 'none' | 'cap' | 'helmet' | 'ninja' | 'crown' | 'catears' | 'pirate' | 'horn' | 'antenna' | 'beanie';

export interface CharacterDef {
  id: string;
  name: { ru: string; en: string };
  gender: 'boy' | 'girl';
  price: Price;
  skin: number;
  hair: HairStyle;
  hairColor: number;
  hat: HatStyle;
  hatColor: number;
  shirt: number;
  pants: number;
  shoes: number;
  extra?: 'cape' | 'backpack' | 'mask' | 'eyepatch' | 'bolts' | 'stitches';
  face?: 'happy' | 'grin' | 'cool' | 'zombie' | 'robot';
}

export const CHARACTERS: CharacterDef[] = [
  { id: 'bobby', name: { ru: 'Бобби', en: 'Bobby' }, gender: 'boy', price: { free: true }, skin: 0xffcc66, hair: 'short', hairColor: 0x3b2a20, hat: 'cap', hatColor: 0x222831, shirt: 0x2d9cdb, pants: 0x333344, shoes: 0xffffff, face: 'happy' },
  { id: 'lily', name: { ru: 'Лили', en: 'Lily' }, gender: 'girl', price: { free: true }, skin: 0xffd9b3, hair: 'ponytail', hairColor: 0xd35400, hat: 'none', hatColor: 0, shirt: 0xff6fa8, pants: 0x5b4bd6, shoes: 0xffffff, face: 'happy' },
  { id: 'max', name: { ru: 'Макс', en: 'Max' }, gender: 'boy', price: { coins: 300 }, skin: 0xe0a46c, hair: 'spiky', hairColor: 0xf2c94c, hat: 'none', hatColor: 0, shirt: 0xeb5757, pants: 0x2d3e8f, shoes: 0x222222, face: 'grin', extra: 'backpack' },
  { id: 'mia', name: { ru: 'Мия', en: 'Mia' }, gender: 'girl', price: { coins: 300 }, skin: 0xf6c7a0, hair: 'buns', hairColor: 0x2c1810, hat: 'none', hatColor: 0, shirt: 0x27ae60, pants: 0xf2994a, shoes: 0xffffff, face: 'happy' },
  { id: 'ninja', name: { ru: 'Ниндзя', en: 'Ninja' }, gender: 'boy', price: { coins: 800 }, skin: 0xffcc66, hair: 'none', hairColor: 0x111111, hat: 'ninja', hatColor: 0xe53935, shirt: 0x26262e, pants: 0x26262e, shoes: 0x111111, face: 'cool' },
  { id: 'kitty', name: { ru: 'Кошечка', en: 'Kitty' }, gender: 'girl', price: { coins: 800 }, skin: 0xffe0c2, hair: 'bob', hairColor: 0xff9ec7, hat: 'catears', hatColor: 0xff9ec7, shirt: 0xffffff, pants: 0xff6fa8, shoes: 0xff6fa8, face: 'happy' },
  { id: 'astro', name: { ru: 'Космонавт', en: 'Astronaut' }, gender: 'boy', price: { coins: 1500 }, skin: 0xffcc66, hair: 'short', hairColor: 0x3b2a20, hat: 'helmet', hatColor: 0xf5f5f5, shirt: 0xf5f5f5, pants: 0xdfe6e9, shoes: 0x636e72, face: 'grin', extra: 'backpack' },
  { id: 'princess', name: { ru: 'Принцесса', en: 'Princess' }, gender: 'girl', price: { coins: 1500 }, skin: 0xffd9b3, hair: 'long', hairColor: 0xf7d154, hat: 'crown', hatColor: 0xffc107, shirt: 0xc86dd7, pants: 0xe8a0f0, shoes: 0xffc107, face: 'happy' },
  { id: 'pirate', name: { ru: 'Пират', en: 'Pirate' }, gender: 'boy', price: { coins: 2500 }, skin: 0xe0a46c, hair: 'messy', hairColor: 0x2c1810, hat: 'pirate', hatColor: 0x222222, shirt: 0xffffff, pants: 0x8e5b3a, shoes: 0x3b2a20, face: 'grin', extra: 'eyepatch' },
  { id: 'hero', name: { ru: 'Супергёрл', en: 'Supergirl' }, gender: 'girl', price: { coins: 2500 }, skin: 0xffd9b3, hair: 'long', hairColor: 0x2c1810, hat: 'none', hatColor: 0, shirt: 0x2d9cdb, pants: 0xeb5757, shoes: 0xeb5757, face: 'cool', extra: 'cape' },
  { id: 'zombie', name: { ru: 'Зомби', en: 'Zombie' }, gender: 'boy', price: { coins: 4000 }, skin: 0x8bc34a, hair: 'messy', hairColor: 0x3e2723, hat: 'none', hatColor: 0, shirt: 0x8d6e63, pants: 0x455a64, shoes: 0x3e2723, face: 'zombie', extra: 'stitches' },
  { id: 'robot', name: { ru: 'Робот', en: 'Robot' }, gender: 'boy', price: { ads: 3 }, skin: 0xb0bec5, hair: 'none', hairColor: 0, hat: 'antenna', hatColor: 0xff5252, shirt: 0x607d8b, pants: 0x455a64, shoes: 0x37474f, face: 'robot', extra: 'bolts' },
  { id: 'unigirl', name: { ru: 'Единорожка', en: 'Unicorn Girl' }, gender: 'girl', price: { ads: 3 }, skin: 0xffe0c2, hair: 'long', hairColor: 0xb388ff, hat: 'horn', hatColor: 0xffd54f, shirt: 0xffffff, pants: 0x80deea, shoes: 0xb388ff, face: 'happy' },
  { id: 'cool', name: { ru: 'Стиляга', en: 'Cool Kid' }, gender: 'boy', price: { ads: 3 }, skin: 0x8d5524, hair: 'spiky', hairColor: 0x111111, hat: 'beanie', hatColor: 0xffeb3b, shirt: 0x111111, pants: 0x1565c0, shoes: 0xffeb3b, face: 'cool', extra: 'mask' },
];

export interface PaintDef { id: string; color: number; price: Price; rainbow?: boolean }
export const PAINTS: PaintDef[] = [
  { id: 'default', color: -1, price: { free: true } },
  { id: 'red', color: 0xe53935, price: { free: true } },
  { id: 'blue', color: 0x1e88e5, price: { free: true } },
  { id: 'green', color: 0x43a047, price: { free: true } },
  { id: 'yellow', color: 0xfdd835, price: { coins: 300 } },
  { id: 'orange', color: 0xfb8c00, price: { coins: 300 } },
  { id: 'pink', color: 0xff4f9a, price: { coins: 300 } },
  { id: 'purple', color: 0x8e24aa, price: { coins: 300 } },
  { id: 'black', color: 0x212121, price: { coins: 500 } },
  { id: 'white', color: 0xf5f5f5, price: { coins: 500 } },
  { id: 'gold', color: 0xffc107, price: { coins: 1500 } },
  { id: 'rainbow', color: 0xff0000, price: { ads: 3 }, rainbow: true },
];

export type TrailKind = 'dust' | 'stars' | 'hearts' | 'bubbles' | 'fire' | 'rainbow';
export interface TrailDef { id: TrailKind; name: { ru: string; en: string }; price: Price }
export const TRAILS: TrailDef[] = [
  { id: 'dust', name: { ru: 'Пыль', en: 'Dust' }, price: { free: true } },
  { id: 'stars', name: { ru: 'Звёзды', en: 'Stars' }, price: { coins: 800 } },
  { id: 'hearts', name: { ru: 'Сердечки', en: 'Hearts' }, price: { coins: 800 } },
  { id: 'bubbles', name: { ru: 'Пузыри', en: 'Bubbles' }, price: { coins: 1500 } },
  { id: 'fire', name: { ru: 'Огонь', en: 'Fire' }, price: { coins: 2500 } },
  { id: 'rainbow', name: { ru: 'Радуга', en: 'Rainbow' }, price: { ads: 3 } },
];

export type BoosterKind = 'shield' | 'magnet' | 'x2' | 'superjump' | 'nitro';
export interface BoosterDef { id: BoosterKind; name: { ru: string; en: string }; desc: { ru: string; en: string }; price: number; icon: string }
export const BOOSTERS: BoosterDef[] = [
  { id: 'shield', name: { ru: 'Щит', en: 'Shield' }, desc: { ru: 'Одно падение без потери жизни', en: 'One fall without losing a life' }, price: 150, icon: 'shield' },
  { id: 'magnet', name: { ru: 'Магнит', en: 'Magnet' }, desc: { ru: 'Притягивает монеты', en: 'Attracts coins' }, price: 120, icon: 'magnet' },
  { id: 'x2', name: { ru: 'Монеты x2', en: 'Coins x2' }, desc: { ru: 'Двойные монеты за уровень', en: 'Double coins for the level' }, price: 200, icon: 'x2' },
  { id: 'superjump', name: { ru: 'Супер-прыжок', en: 'Super Jump' }, desc: { ru: 'Прыжок выше на 35%', en: 'Jump 35% higher' }, price: 150, icon: 'jump' },
  { id: 'nitro', name: { ru: 'Нитро', en: 'Nitro' }, desc: { ru: 'Полный бак нитро и быстрая перезарядка', en: 'Full nitro and fast recharge' }, price: 120, icon: 'nitro' },
];

export const vehicleById = (id: string) => VEHICLES.find((v) => v.id === id) ?? VEHICLES[0];
export const characterById = (id: string) => CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
export const paintById = (id: string) => PAINTS.find((p) => p.id === id) ?? PAINTS[0];
export const trailById = (id: string) => TRAILS.find((t) => t.id === id) ?? TRAILS[0];
