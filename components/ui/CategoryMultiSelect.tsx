"use client"

import { useState } from "react"
import { X, Plus, Check } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"

// Предопределенные категории
const PREDEFINED_CATEGORIES = [
  "Наука",
  "История",
  "География",
  "Литература",
  "Искусство",
  "Спорт",
  "Музыка",
  "Кино",
  "Технологии",
  "Математика",
  "Биология",
  "Физика",
  "Химия",
  "Программирование",
  "Игры",
  "Образование",
  "Бизнес",
  "Культура",
  "Развлечения",
  "Общие знания",
]

interface CategoryMultiSelectProps {
  value: string[]
  onChange: (categories: string[]) => void
  label?: string
  placeholder?: string
}

export function CategoryMultiSelect({ value, onChange, label, placeholder }: CategoryMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [customCategory, setCustomCategory] = useState("")

  const toggleCategory = (category: string) => {
    if (value.includes(category)) {
      onChange(value.filter((c) => c !== category))
    } else {
      onChange([...value, category])
    }
  }

  const addCustomCategory = () => {
    const trimmed = customCategory.trim()
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed])
      setCustomCategory("")
    }
  }

  const removeCategory = (category: string) => {
    onChange(value.filter((c) => c !== category))
  }

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}

      {/* Selected categories */}
      <div className="flex flex-wrap gap-2 min-h-[40px] p-2 border rounded-md bg-background">
        {value.length === 0 ? (
          <span className="text-sm text-muted-foreground">{placeholder || "Выберите категории..."}</span>
        ) : (
          value.map((category) => (
            <Badge key={category} variant="secondary" className="flex items-center gap-1">
              {category}
              <button
                type="button"
                onClick={() => removeCategory(category)}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))
        )}
      </div>

      {/* Category picker */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="w-full bg-transparent">
            <Plus className="w-4 h-4 mr-2" />
            Добавить категорию
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Поиск категории..." />
            <CommandList>
              <CommandEmpty>
                <div className="p-4 space-y-2">
                  <p className="text-sm text-muted-foreground">Категория не найдена</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Своя категория"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          addCustomCategory()
                        }
                      }}
                    />
                    <Button size="sm" onClick={addCustomCategory} disabled={!customCategory.trim()}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CommandEmpty>
              <CommandGroup className="max-h-[300px] overflow-y-auto">
                {PREDEFINED_CATEGORIES.map((category) => {
                  const isSelected = value.includes(category)
                  return (
                    <CommandItem
                      key={category}
                      onSelect={() => {
                        toggleCategory(category)
                      }}
                      className="flex items-center justify-between cursor-pointer"
                    >
                      <span>{category}</span>
                      {isSelected && <Check className="w-4 h-4 text-primary" />}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
            <div className="border-t p-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Своя категория"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addCustomCategory()
                      setOpen(false)
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    addCustomCategory()
                    setOpen(false)
                  }}
                  disabled={!customCategory.trim()}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export default CategoryMultiSelect
