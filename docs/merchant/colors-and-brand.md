---
title: 2. Colors and brand identity
alt: /lojista/cores-e-marca.html
---

# 2. Colors and brand identity

This is the part of the theme that changes the look of your store the most, and the part most people configure wrong. Worth reading in full — it's ten minutes.

---

## The idea in one sentence

You don't pick a color for each thing. You build **palettes** (called *color schemes*) and then say **which palette each section uses**.

A store with 30 sections has 2 or 3 palettes, not 30 color decisions.

---

## Why it works this way

Imagine you want to change your brand's shade of pink.

- **Color per section:** you open 30 sections and change it 30 times. You miss one. It keeps the old pink until someone notices.
- **Per palette:** you change it in one place. All 30 follow.

And it works both ways: a section with a dark background automatically gets the light text from that palette. You'll never end up with black text on a black background by accident.

---

## Where they live

**Theme settings → Colors → Color schemes.**

The theme ships with two:

| | Background | Text |
| --- | --- | --- |
| **Scheme 1** | White | Near black |
| **Scheme 2** | Near black | White |

Click **Add scheme** to create more.

---

## What's inside a scheme

Each scheme has 13 colors. You don't need to touch all of them — the first five decide almost everything.

### The ones that matter

| Color | What it paints |
| --- | --- |
| **Background** | The background of every section using this scheme |
| **Text** | Headings, paragraphs, links |
| **Primary button** | The fill of the main button (Add to cart, Checkout) |
| **Primary button text** | The letters inside it |
| **Borders** | Card, input and divider lines |

### The supporting ones

| Color | What it paints |
| --- | --- |
| **Background gradient** | Replaces the flat background, if you fill it in |
| **Secondary button text** | Outline buttons, and link color |
| **Shadows** | Card and modal shadows |
| **Badge background** / **Badge text** | The "New" and "Sale" tags |
| **Success** / **Error** / **Warning** | System messages — "added to cart", "required field" |

> **Success, Error and Warning** carry meaning beyond aesthetics. Green, red and amber are what shoppers already understand. Swapping them for brand tones usually hurts comprehension.

---

## Contrast: the rule that isn't an opinion

The theme derives secondary text — captions, descriptions, counters — from **your** Background and Text pair. It doesn't use a fixed grey.

But that only works if the pair **you** choose has enough contrast.

### How to check without a tool

Squint and look at the screen from a distance. If the text disappears into the background, contrast is too low.

### How to check properly

Use a contrast checker (search for "WebAIM contrast checker"). Paste your **Background** and your **Text** colors.

| Result | Verdict |
| --- | --- |
| **4.5:1 or higher** | Passes. Go ahead. |
| Between 3:1 and 4.5:1 | Only acceptable for large text (headings) |
| Below 3:1 | Don't use it |

**Why it matters:** low contrast isn't just ugly. It's the single most common reason a theme fails Shopify's review, and it's what makes a 50-year-old shopper give up on her phone in daylight.

### Pairs that cause trouble

- Mid grey on white
- Beige on cream
- Light pink on white
- Any pastel used as **Text**

Pastels work beautifully as **Background**, with dark text on top.

---

## A recipe that works

If you don't have a defined palette, do this:

**Scheme 1 — the store default**
- Background: white or near-white
- Text: near black (avoid pure black — `#121212` reads better than `#000000`)
- Primary button: your brand color
- Button text: white or black, whichever contrasts more with your brand color

**Scheme 2 — for emphasis**
- Background: your brand color, or the near black
- Text: white
- Primary button: white
- Button text: the background color

**Scheme 3 — breathing room (optional)**
- Background: a very light tint of your brand (a beige, a very pale pink)
- Text: the same near black as Scheme 1
- Buttons: same as Scheme 1

Three schemes cover any store. More than five becomes noise.

---

## Applying them to sections

Every section has **Color scheme** at the top of its options.

Alternating is what gives a page rhythm:

```
Image banner          → Scheme 2  (dark, impact)
Featured collection   → Scheme 1  (light, products breathe)
Highlighted Section   → Scheme 3  (breathing room, changes the air)
Customer Testimonials → Scheme 1  (back to light)
Trust Badges          → Scheme 2  (dark close)
```

> **Don't use a different scheme in every section.** The eye reads that as disorganization, not variety.

### Sections with two schemes

Some have a second scheme field for a specific part:

| Section | Second scheme |
| --- | --- |
| **Footer** | The newsletter strip, separate from the rest of the footer |
| **Highlighted Section** | The decorative curved background |
| **Customer Testimonials** | The cards, separate from the section background |

### Account pages

**Theme settings → Colors → Account pages color scheme.**

Covers login, register, account, orders and addresses. Those pages don't appear in the editor as sections, so their scheme is chosen here.

---

## Test before publishing

In the editor, switch a section's scheme and **look**:

1. Is the text still readable?
2. Are the buttons visible, or did they disappear into the background?
3. Are card borders still visible?
4. On mobile too?

Do this with the **Product** section open. It's the page where the most different elements live together: price, compare-at price, badge, button, variant picker, stock status.

---

**Previous:** [← Getting started](getting-started.html) · **Next:** [Sections →](sections.html)
