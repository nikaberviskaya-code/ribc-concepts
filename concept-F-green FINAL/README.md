# Российско-Индийский деловой совет — концепт редизайна

Статический сайт, без сборки.

```
index.html        разметка
css/style.css     все стили (токены, секции, адаптив)
js/boot.js        включение режима анимаций до первого кадра
js/main.js        меню, форма, счётчики, GSAP / ScrollTrigger
vendor/           gsap, ScrollTrigger, three.iife.js
js/webgl.js       three.js: нити в первом блоке и глобус с дугами
assets/portrait.webp  портрет в блоке с цитатой
```

## Запуск
Открыть `index.html` двойным щелчком — отдельный сервер не нужен.

## Зависимости
- `vendor/` — GSAP, ScrollTrigger и three.js (r187) лежат локально, работает офлайн
- Шрифты Oswald, Inter Tight, Source Serif 4 — Google Fonts (нужен интернет, иначе системные шрифты)

## Дизайн-токены
`--ink #0A1F18`, `--green #0F6B4F`, `--saffron #FF9A3D`, `--sky #E7EFEA`.
Радиусы 32 / 24 / 16. Отдельные акценты: оранжевый заголовка «Индией» `#FF8A1F`.
