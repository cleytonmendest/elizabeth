---
title: 1. Getting started
---

# 1. Getting started

Follow in order. Each step takes 5 to 15 minutes.

---

## 1.1 Install the theme

1. In the Shopify admin, go to **Online Store → Themes**
2. Under **Theme library**, click **Add theme**
3. Pick Elizabeth
4. Click **Customize** to open the editor

> The theme is added as a **draft**. Your store keeps showing the old theme until you publish — the last step of this guide. You can change anything without anyone seeing it.

---

## 1.2 Logo and favicon

In the editor, open **Theme settings** (the gear icon in the sidebar) → **Logo**.

| Field | What to do |
| --- | --- |
| **Logo** | Upload a PNG or SVG **with a transparent background**. A white background shows up as a white rectangle whenever the header uses a dark scheme. |
| **Logo max width** | Between 50 and 300 px. Default is 100. Increase it if the logo looks small; don't go past 200 for horizontal logos, or the menu gets cramped on laptops. |
| **Favicon** | The browser tab icon. Square, at least 96×96 px. |

### About the "logo_svg" field

There's a text field for pasting SVG code. **Ignore it** unless someone handed you the code and explained why. The regular **Logo** field covers 99% of cases and is safer.

---

## 1.3 Fonts

**Theme settings → Typography.**

Two choices: the **heading** font and the **body** font.

Both come from Shopify's font library — there's no font file upload. That's deliberate: library fonts load faster and carry no separate licensing cost.

**A pairing that almost always works:** a serif for headings and a sans-serif for body. If in doubt, use the same font for both — it's safer than pairing badly.

### Text size

**Theme settings → Design → Text size.**

| Option | When to use |
| --- | --- |
| Compact | Large catalog, lots of information per screen |
| **Default** | The normal choice |
| Large | Audience that prefers bigger text |
| Extra large | Accessibility first |

This multiplies the **entire** scale: headings, body, captions, all together. The proportion between them stays fixed. You don't need to adjust sizes section by section.

---

## 1.4 Corner radius and width

**Theme settings → Design → Corner radius.**

| Option | Look |
| --- | --- |
| Square (0px) | Angular, editorial |
| Subtle (4px) | Nearly square |
| **Soft (8px)** | The default |
| Rounded (16px) | Friendlier, less formal |

It applies to buttons, cards, inputs and modals at once. Smaller and larger steps derive from this choice automatically.

**Theme settings → Layout:**

- **Store max width** — between 1400 and 2560 px, default 1920. On large monitors this is how far the content spreads.
- **Spacing between sections** — 0 to 100 px. Default 0 (each section controls its own spacing). Increase it if the home page feels cramped.
- **"Back to top" button** — on by default. Appears as you scroll.

---

## 1.5 Menus

Menus are **not** configured in the theme — they live in the Shopify admin.

1. **Online Store → Navigation**
2. Edit the **Main menu** (shown in the header) and the **Footer menu**
3. Go back to the theme editor

In the editor, click the **Header** section and pick your menu under **Main menu**.

### Mega menu

Under **Header → Desktop header type** there are layout options. If you choose one with a mega menu, the main menu opens as a panel with submenus visible.

To add an image to the mega menu, add the **Mega menu image** block inside the Header section.

> The mega menu only shows submenus that **exist in Navigation**. If the panel opens empty, the problem is the menu, not the theme — go back to Online Store → Navigation and add second-level items.

---

## 1.6 Sticky header

**Header → Sticky header.** When on, the header follows the scroll.

Turn it on if your menu is the main way people navigate. Turn it off if you want the full screen for content — on small phones a sticky header eats useful space.

---

## 1.7 Build the home page

The home page is made of **sections** you add, reorder and remove. In the editor sidebar:

- **Add section** — places a new one
- **Drag** by the six-dot handle — reorders
- **Eye icon** — hides without deleting

The theme has **23 sections** you can add. Each one is described in **[Sections, one by one](sections.html)**.

### A home page that works, in order

1. **Announcement Bar** — free shipping, delivery time, coupon
2. **Image banner** or **Image Slider** — the first thing a shopper sees
3. **Featured collection** — the products you want to sell now
4. **Highlighted Section** or **Shop the Look** — your brand story
5. **Customer Testimonials** — social proof
6. **Trust Badges** — shipping, returns, secure payment
7. **Blog Posts** — if you keep a blog

It doesn't have to be exactly this. It's a starting point that doesn't go wrong.

---

## 1.8 Cart and free shipping

**Theme settings → Cart.**

| Field | What it does |
| --- | --- |
| **Free shipping bar** | Turns on the progress bar in the cart |
| **Threshold** | The amount that unlocks free shipping |
| **Message** | The text while the shopper is short. Use `{{ amount }}` where the remaining amount goes |
| **Success message** | The text once they reach it |
| **Order notes** | A free-text field in the cart |

> The free shipping bar is **visual**. It does not create the shipping rule — that's **Settings → Shipping and delivery** in the admin. If the two don't match, the shopper sees "free shipping" and gets charged at checkout.

---

## 1.9 Cookie notice (GDPR / LGPD)

**Theme settings → Privacy and Cookies.**

When on, it shows the consent banner. Configure:

- **Message** — the banner text
- **Accept button** and, optionally, a **Decline button**
- **Privacy policy link** — point it at your policy page
- **Color scheme** — which palette the banner uses

> Create the privacy policy page first: **Online Store → Pages**. A cookie banner with a broken link is worse than no banner.

---

## 1.10 Social media

**Theme settings → Social media.** Paste the full URL for each network.

The icons show in the footer — as long as the **Payments and Social** block is there with the social option turned on.

> Nine fields exist, but only **Instagram, Facebook and YouTube** appear as footer icons. Twitter feeds the link preview on Twitter/X; Pinterest, Facebook and Instagram feed the structured data Google reads. **TikTok, Snapchat, Tumblr and Vimeo don't appear anywhere today** — filling them in does nothing.

---

## 1.11 Publish

1. Review in the editor, in both **mobile** and **desktop** modes (the icons at the top)
2. Click **Save**
3. Go back to **Online Store → Themes**
4. On Elizabeth, **Actions → Publish**

Done. Your store is live with the new theme.

> **Before publishing,** open the preview on a real phone. The editor simulates well, but it doesn't simulate a thumb on a small button.

---

**Next:** [Colors and brand identity →](colors-and-brand.html)
