---
title: 5. FAQ
---

# 5. FAQ

---

## Setup

### Do I need to know how to code?
No. Nothing in this guide asks you to edit code, and nothing in the theme requires it to work.

### Can I try it without anyone seeing?
Yes. Install the theme — it arrives as a **draft**. The store stays on the old theme until you click **Publish**.

### How do I go back if I break everything?
**Online Store → Themes → Actions → Version history.** Shopify keeps previous versions of the theme. You can also duplicate the theme before changing anything, as a backup.

### I changed something and I don't see any difference on the store
Three causes, in this order: you didn't save; you're editing a theme that isn't the published one; your browser has the page cached (reload with Ctrl+F5, or Cmd+Shift+R on a Mac).

---

## Appearance

### Can I use my own font?
Not by upload. Fonts come from Shopify's library, which is large and covers most brands. That's deliberate: a library font loads faster and carries no separate licensing cost.

### How many color schemes should I create?
Two or three. Five is the limit before it turns into a mess. See [Colors and brand](colors-and-brand.html).

### Can I change the corner radius of just one button?
No, and that's deliberate. Corner radius is a store-wide choice — buttons, cards, inputs and modals at once. One button different from the rest reads as a defect, not as intent.

### The text is too small
**Theme settings → Design → Text size.** It scales the whole thing while keeping the proportion between headings and body. You don't need to adjust it section by section.

### Can I make the site wider?
**Theme settings → Layout → Store max width**, up to 2560 px. Above 1920 the content starts to feel sparse on ordinary monitors.

---

## Products and collections

### What's the ideal photo size?
**Portrait 4:5** and 2000 px wide at most. The important part isn't the size: it's that **they all share the same ratio**. Photos of different ratios throw off the grid.

### How do I turn on filters?
Install the free **Shopify Search & Discovery** app and configure the filters there. See [Troubleshooting](troubleshooting.html#collection-filters-dont-show-up).

### What is "second image on hover"?
When on, hovering a card shows the product's second photo. It works well in fashion — a front shot and a back shot. It only appears on products with **two or more photos**.

### What is "quick add"?
A button on the card that saves opening the product. It behaves in two ways: on a **single-variant** product it adds to the cart right there; on a product with color or size it **takes the shopper to the product page**, because she has to choose. On a sold-out product it doesn't appear at all.

---

## Cart and checkout

### Can I change the checkout page?
Not with the theme. Shopify's checkout is configured in **Settings → Checkout** in the admin, and the theme has no access to it.

### Does the free shipping bar create the shipping rule?
No. It's visual. The real rule is **Settings → Shipping and delivery**. Configure both with the same amount.

### How do I offer installments?
That depends on the payment gateway, not on the theme. Configure it in **Settings → Payments**. If the gateway exposes installments, they show up.

---

## Blog and pages

### How do I create the FAQ page?
**Online Store → Pages → Add page.** Then, in the theme editor, open that page and add the **FAQ / Collapsible content** section.

### How do I create the About page?
Same thing: create the page in the admin and build the content with the **Rich text**, **Highlighted Section** and **Multicolumn** sections.

---

## Languages and currencies

### Is the theme translated?
Yes, Portuguese and English. To add other languages: **Settings → Languages** in the admin, then translate with the **Translate & Adapt** app (free, from Shopify).

### How do I show the language and currency selector?
In the **Footer** section, turn on **Show language selector** and **Show country/currency selector**. They only appear if the store has more than one language or market configured in **Settings → Markets**.

---

## Accessibility and compliance

### Is the theme GDPR-ready?
It ships the cookie consent banner, configurable in **Theme settings → Privacy and Cookies**. The **privacy policy** itself is a page you write and link there. A banner with no policy doesn't satisfy the law.

### Is the theme accessible?
It's built to meet WCAG 2.1 level AA, and that's verified automatically on every change. But **your choices matter**: a low-contrast color pair breaks the accessibility of a store that was compliant. See [Contrast](colors-and-brand.html#contrast-the-rule-that-isnt-an-opinion).

### Do images need alternative text?
Yes. The **Alt text** field exists in the image sections and on product photos in the admin. Describe what the image shows — it's what screen readers read, and what Google indexes.

---

## Support

### I found a bug. Where do I report it?
[github.com/cleytonmendest/elizabeth/issues](https://github.com/cleytonmendest/elizabeth/issues/new), with: which page, which section, which color scheme, phone or computer, what you expected and what happened.

### Can I request a new feature?
Yes, same place. Describe **the problem you have**, not the solution you imagined — often there's a way with what's already there.

---

**Previous:** [← Troubleshooting](troubleshooting.html) · [Back to start](index.html)
