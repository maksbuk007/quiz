"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

interface AvatarSelectorProps {
  selectedAvatar: string
  onAvatarSelect: (avatar: string) => void
  disabled?: boolean
}

export const AVATAR_CATEGORIES = {
  all: {
    name: "Все",
    avatars: [],
  },
  popular: {
    name: "Популярные",
    avatars: ["cat", "dog", "fox", "bear", "panda", "tiger", "lion", "wolf", "rabbit", "penguin"],
  },
  land: {
    name: "Наземные",
    avatars: [
      "cat",
      "dog",
      "fox",
      "wolf",
      "bear",
      "panda",
      "koala",
      "tiger",
      "lion",
      "cow",
      "pig",
      "frog",
      "monkey",
      "rabbit",
      "hamster",
      "mouse",
      "elephant",
      "giraffe",
      "zebra",
      "horse",
      "unicorn",
      "dinosaur",
      "dragon",
      "trex",
      "crocodile",
      "lizard",
      "chipmunk",
      "hedgehog",
      "bat",
      "otter",
      "skunk",
      "kangaroo",
      "badger",
      "turkey",
      "dodo",
      "seal",
      "ram",
      "goat",
      "deer",
      "camel",
      "llama",
      "bison",
      "ox",
      "water_buffalo",
      "leopard",
      "mammoth",
      "rhino",
      "hippo",
      "gorilla",
      "orangutan",
      "sloth",
      "raccoon",
      "boar",
      "poodle",
      "guide_dog",
      "service_dog",
      "black_cat",
      "rooster",
      "hatching_chick",
      "baby_chick",
    ],
  },
  birds: {
    name: "Птицы",
    avatars: ["chicken", "penguin", "bird", "owl", "eagle", "duck", "swan", "peacock", "parrot", "flamingo"],
  },
  water: {
    name: "Морские",
    avatars: ["whale", "dolphin", "fish", "octopus", "crab", "shrimp", "lobster", "squid", "shark", "turtle"],
  },
  insects: {
    name: "Насекомые",
    avatars: [
      "bee",
      "butterfly",
      "spider",
      "ant",
      "ladybug",
      "snail",
      "beetle",
      "cricket",
      "mosquito",
      "fly",
      "worm",
      "cockroach",
    ],
  },
}

export const AVATARS = [
  { id: "cat", emoji: "🐱", name: "Котик", color: "bg-orange-100 dark:bg-orange-900/30" },
  { id: "dog", emoji: "🐶", name: "Собачка", color: "bg-amber-100 dark:bg-amber-900/30" },
  { id: "fox", emoji: "🦊", name: "Лисичка", color: "bg-orange-200 dark:bg-orange-800/30" },
  { id: "wolf", emoji: "🐺", name: "Волк", color: "bg-gray-200 dark:bg-gray-800/30" },
  { id: "bear", emoji: "🐻", name: "Медведь", color: "bg-amber-200 dark:bg-amber-800/30" },
  { id: "panda", emoji: "🐼", name: "Панда", color: "bg-gray-100 dark:bg-gray-900/30" },
  { id: "koala", emoji: "🐨", name: "Коала", color: "bg-gray-200 dark:bg-gray-800/30" },
  { id: "tiger", emoji: "🐯", name: "Тигр", color: "bg-orange-200 dark:bg-orange-800/30" },
  { id: "lion", emoji: "🦁", name: "Лев", color: "bg-yellow-200 dark:bg-yellow-800/30" },
  { id: "cow", emoji: "🐮", name: "Корова", color: "bg-pink-100 dark:bg-pink-900/30" },
  { id: "pig", emoji: "🐷", name: "Свинка", color: "bg-pink-200 dark:bg-pink-800/30" },
  { id: "frog", emoji: "🐸", name: "Лягушка", color: "bg-green-200 dark:bg-green-800/30" },
  { id: "monkey", emoji: "🐵", name: "Обезьянка", color: "bg-amber-200 dark:bg-amber-800/30" },
  { id: "chicken", emoji: "🐥", name: "Цыпленок", color: "bg-yellow-100 dark:bg-yellow-900/30" },
  { id: "penguin", emoji: "🐧", name: "Пингвин", color: "bg-blue-100 dark:bg-blue-900/30" },
  { id: "bird", emoji: "🐦", name: "Птичка", color: "bg-blue-200 dark:bg-blue-800/30" },
  { id: "owl", emoji: "🦉", name: "Сова", color: "bg-amber-100 dark:bg-amber-900/30" },
  { id: "eagle", emoji: "🦅", name: "Орел", color: "bg-gray-300 dark:bg-gray-700/30" },
  { id: "duck", emoji: "🦆", name: "Утка", color: "bg-yellow-200 dark:bg-yellow-800/30" },
  { id: "swan", emoji: "🦢", name: "Лебедь", color: "bg-gray-100 dark:bg-gray-900/30" },
  { id: "peacock", emoji: "🦚", name: "Павлин", color: "bg-blue-200 dark:bg-blue-800/30" },
  { id: "parrot", emoji: "🦜", name: "Попугай", color: "bg-green-200 dark:bg-green-800/30" },
  { id: "flamingo", emoji: "🦩", name: "Фламинго", color: "bg-pink-200 dark:bg-pink-800/30" },
  { id: "turtle", emoji: "🐢", name: "Черепаха", color: "bg-green-100 dark:bg-green-900/30" },
  { id: "snake", emoji: "🐍", name: "Змея", color: "bg-green-300 dark:bg-green-700/30" },
  { id: "whale", emoji: "🐋", name: "Кит", color: "bg-blue-200 dark:bg-blue-800/30" },
  { id: "dolphin", emoji: "🐬", name: "Дельфин", color: "bg-blue-300 dark:bg-blue-700/30" },
  { id: "fish", emoji: "🐠", name: "Рыбка", color: "bg-blue-100 dark:bg-blue-900/30" },
  { id: "octopus", emoji: "🐙", name: "Осьминог", color: "bg-purple-200 dark:bg-purple-800/30" },
  { id: "crab", emoji: "🦀", name: "Краб", color: "bg-red-200 dark:bg-red-800/30" },
  { id: "shrimp", emoji: "🦐", name: "Креветка", color: "bg-pink-100 dark:bg-pink-900/30" },
  { id: "lobster", emoji: "🦞", name: "Омар", color: "bg-red-100 dark:bg-red-900/30" },
  { id: "squid", emoji: "🦑", name: "Кальмар", color: "bg-purple-100 dark:bg-purple-900/30" },
  { id: "shark", emoji: "🦈", name: "Акула", color: "bg-gray-300 dark:bg-gray-700/30" },
  { id: "horse", emoji: "🐴", name: "Лошадь", color: "bg-amber-200 dark:bg-amber-800/30" },
  { id: "unicorn", emoji: "🦄", name: "Единорог", color: "bg-pink-200 dark:bg-pink-800/30" },
  { id: "zebra", emoji: "🦓", name: "Зебра", color: "bg-gray-200 dark:bg-gray-800/30" },
  { id: "giraffe", emoji: "🦒", name: "Жираф", color: "bg-yellow-200 dark:bg-yellow-800/30" },
  { id: "elephant", emoji: "🐘", name: "Слон", color: "bg-gray-200 dark:bg-gray-800/30" },
  { id: "rabbit", emoji: "🐰", name: "Кролик", color: "bg-pink-100 dark:bg-pink-900/30" },
  { id: "hamster", emoji: "🐹", name: "Хомяк", color: "bg-amber-100 dark:bg-amber-900/30" },
  { id: "mouse", emoji: "🐭", name: "Мышка", color: "bg-gray-100 dark:bg-gray-900/30" },
  { id: "bee", emoji: "🐝", name: "Пчелка", color: "bg-yellow-200 dark:bg-yellow-800/30" },
  { id: "butterfly", emoji: "🦋", name: "Бабочка", color: "bg-purple-100 dark:bg-purple-900/30" },
  { id: "spider", emoji: "🕷️", name: "Паук", color: "bg-gray-300 dark:bg-gray-700/30" },
  { id: "ant", emoji: "🐜", name: "Муравей", color: "bg-red-100 dark:bg-red-900/30" },
  { id: "ladybug", emoji: "🐞", name: "Божья коровка", color: "bg-red-200 dark:bg-red-800/30" },
  { id: "snail", emoji: "🐌", name: "Улитка", color: "bg-green-100 dark:bg-green-900/30" },
  { id: "beetle", emoji: "🪲", name: "Жук", color: "bg-green-300 dark:bg-green-700/30" },
  { id: "cricket", emoji: "🦗", name: "Сверчок", color: "bg-green-200 dark:bg-green-800/30" },
  { id: "dinosaur", emoji: "🦖", name: "Динозавр", color: "bg-green-300 dark:bg-green-700/30" },
  { id: "dragon", emoji: "🐉", name: "Дракон", color: "bg-red-200 dark:bg-red-800/30" },
  { id: "trex", emoji: "🦕", name: "T-Rex", color: "bg-green-200 dark:bg-green-800/30" },
  { id: "crocodile", emoji: "🐊", name: "Крокодил", color: "bg-green-300 dark:bg-green-700/30" },
  { id: "lizard", emoji: "🦎", name: "Ящерица", color: "bg-green-200 dark:bg-green-800/30" },
  { id: "chipmunk", emoji: "🐿️", name: "Бурундук", color: "bg-amber-200 dark:bg-amber-800/30" },
  { id: "hedgehog", emoji: "🦔", name: "Ёжик", color: "bg-amber-100 dark:bg-amber-900/30" },
  { id: "bat", emoji: "🦇", name: "Летучая мышь", color: "bg-gray-300 dark:bg-gray-700/30" },
  { id: "otter", emoji: "🦦", name: "Выдра", color: "bg-blue-200 dark:bg-blue-800/30" },
  { id: "skunk", emoji: "🦨", name: "Скунс", color: "bg-gray-200 dark:bg-gray-800/30" },
  { id: "kangaroo", emoji: "🦘", name: "Кенгуру", color: "bg-amber-200 dark:bg-amber-800/30" },
  { id: "badger", emoji: "🦡", name: "Барсук", color: "bg-gray-200 dark:bg-gray-800/30" },
  { id: "turkey", emoji: "🦃", name: "Индюк", color: "bg-amber-200 dark:bg-amber-800/30" },
  { id: "dodo", emoji: "🦤", name: "Додо", color: "bg-gray-200 dark:bg-gray-800/30" },
  { id: "feather", emoji: "🪶", name: "Перо", color: "bg-blue-100 dark:bg-blue-900/30" },
  { id: "seal", emoji: "🦭", name: "Тюлень", color: "bg-gray-200 dark:bg-gray-800/30" },
  { id: "tropical_fish", emoji: "🐡", name: "Тропическая рыба", color: "bg-yellow-200 dark:bg-yellow-800/30" },
  { id: "blowfish", emoji: "🐟", name: "Рыба-шар", color: "bg-blue-200 dark:bg-blue-800/30" },
  { id: "jellyfish", emoji: "🪼", name: "Медуза", color: "bg-purple-100 dark:bg-purple-900/30" },
  { id: "coral", emoji: "🪸", name: "Коралл", color: "bg-pink-200 dark:bg-pink-800/30" },
  { id: "scorpion", emoji: "🦂", name: "Скорпион", color: "bg-red-200 dark:bg-red-800/30" },
  { id: "mosquito", emoji: "🦟", name: "Комар", color: "bg-gray-200 dark:bg-gray-800/30" },
  { id: "fly", emoji: "🪰", name: "Муха", color: "bg-gray-300 dark:bg-gray-700/30" },
  { id: "worm", emoji: "🪱", name: "Червяк", color: "bg-pink-100 dark:bg-pink-900/30" },
  { id: "cockroach", emoji: "🪳", name: "Таракан", color: "bg-amber-200 dark:bg-amber-800/30" },
  { id: "ram", emoji: "🐏", name: "Баран", color: "bg-gray-100 dark:bg-gray-900/30" },
  { id: "goat", emoji: "🐐", name: "Козёл", color: "bg-gray-200 dark:bg-gray-800/30" },
  { id: "deer", emoji: "🦌", name: "Олень", color: "bg-amber-200 dark:bg-amber-800/30" },
  { id: "camel", emoji: "🐪", name: "Верблюд", color: "bg-amber-200 dark:bg-amber-800/30" },
  { id: "llama", emoji: "🦙", name: "Лама", color: "bg-amber-100 dark:bg-amber-900/30" },
  { id: "bison", emoji: "🦬", name: "Бизон", color: "bg-amber-300 dark:bg-amber-700/30" },
  { id: "ox", emoji: "🐂", name: "Бык", color: "bg-amber-200 dark:bg-amber-800/30" },
  { id: "water_buffalo", emoji: "🐃", name: "Буйвол", color: "bg-gray-300 dark:bg-gray-700/30" },
  { id: "leopard", emoji: "🐆", name: "Леопард", color: "bg-yellow-200 dark:bg-yellow-800/30" },
  { id: "mammoth", emoji: "🦣", name: "Мамонт", color: "bg-amber-200 dark:bg-amber-800/30" },
  { id: "rhino", emoji: "🦏", name: "Носорог", color: "bg-gray-300 dark:bg-gray-700/30" },
  { id: "hippo", emoji: "🦛", name: "Бегемот", color: "bg-gray-200 dark:bg-gray-800/30" },
  { id: "gorilla", emoji: "🦍", name: "Горилла", color: "bg-gray-300 dark:bg-gray-700/30" },
  { id: "orangutan", emoji: "🦧", name: "Орангутан", color: "bg-orange-200 dark:bg-orange-800/30" },
  { id: "sloth", emoji: "🦥", name: "Ленивец", color: "bg-amber-100 dark:bg-amber-900/30" },
  { id: "raccoon", emoji: "🦝", name: "Енот", color: "bg-gray-200 dark:bg-gray-800/30" },
  { id: "boar", emoji: "🐗", name: "Кабан", color: "bg-amber-300 dark:bg-amber-700/30" },
  { id: "poodle", emoji: "🐩", name: "Пудель", color: "bg-pink-100 dark:bg-pink-900/30" },
  { id: "guide_dog", emoji: "🦮", name: "Собака-поводырь", color: "bg-amber-200 dark:bg-amber-800/30" },
  { id: "service_dog", emoji: "🐕‍🦺", name: "Служебная собака", color: "bg-orange-200 dark:bg-orange-800/30" },
  { id: "black_cat", emoji: "🐈‍⬛", name: "Чёрная кошка", color: "bg-gray-300 dark:bg-gray-700/30" },
  { id: "rooster", emoji: "🐓", name: "Петух", color: "bg-red-200 dark:bg-red-800/30" },
  { id: "hatching_chick", emoji: "🐣", name: "Вылупляющийся цыплёнок", color: "bg-yellow-100 dark:bg-yellow-900/30" },
  { id: "baby_chick", emoji: "🐤", name: "Птенец", color: "bg-yellow-200 dark:bg-yellow-800/30" },
]

export default function AvatarSelector({ selectedAvatar, onAvatarSelect, disabled = false }: AvatarSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")

  const filteredAvatars = AVATARS.filter((avatar) => {
    const matchesSearch = avatar.name.toLowerCase().includes(searchQuery.toLowerCase())

    if (selectedCategory === "all") {
      return matchesSearch
    }

    const matchesCategory = Object.entries(AVATAR_CATEGORIES).some(
      ([key, cat]) => key === selectedCategory && cat.avatars.includes(avatar.id),
    )
    return matchesSearch && matchesCategory
  })

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Поиск аватара..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-11 border-2 bg-background text-foreground"
          disabled={disabled}
        />
      </div>

      <div className="flex gap-2 flex-wrap">
        {Object.entries(AVATAR_CATEGORIES).map(([key, category]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSelectedCategory(key)}
            disabled={disabled}
            className={`
              px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all border-2
              ${
                selectedCategory === key
                  ? "bg-primary border-primary text-primary-foreground shadow-md scale-105"
                  : "bg-background border-border text-foreground hover:border-primary/50 hover:bg-muted"
              }
              ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
            `}
          >
            {category.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-6 sm:grid-cols-7 md:grid-cols-8 lg:grid-cols-10 gap-2 max-h-64 overflow-y-auto p-2 border-2 rounded-lg bg-background scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
        {filteredAvatars.map((avatar) => (
          <button
            key={avatar.id}
            type="button"
            className={`
              aspect-square rounded-xl flex items-center justify-center 
              text-lg sm:text-xl md:text-2xl lg:text-3xl
              transition-all duration-200 border-2
              ${avatar.color}
              ${
                selectedAvatar === avatar.id
                  ? "border-primary shadow-lg scale-110 ring-2 ring-primary/50"
                  : "border-transparent hover:border-primary/50 hover:scale-105"
              }
              ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
            `}
            onClick={() => !disabled && onAvatarSelect(avatar.id)}
            title={avatar.name}
            disabled={disabled}
          >
            {avatar.emoji}
          </button>
        ))}
      </div>

      {selectedAvatar && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border-2 border-primary/20">
          <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-xl flex items-center justify-center text-2xl sm:text-3xl md:text-4xl bg-background border-2 border-primary/30">
            {AVATARS.find((a) => a.id === selectedAvatar)?.emoji}
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-foreground">Выбранный аватар</div>
            <div className="text-xs text-muted-foreground">{AVATARS.find((a) => a.id === selectedAvatar)?.name}</div>
          </div>
        </div>
      )}
    </div>
  )
}
