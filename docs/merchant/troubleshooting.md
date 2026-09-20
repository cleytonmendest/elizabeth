---
title: 4. Troubleshooting
alt: /lojista/problemas-comuns.html
---

# 4. Troubleshooting

Each item gives **the symptom**, **the cause** and **what to do**. No fix here asks you to edit code.

---

## Collection filters don't show up

**Symptom:** you turned on **Enable filters** in the Collection Page section and nothing appears on the store.

**Cause:** filters come from Shopify, not from the theme. They're provided by the free **Search & Discovery** app, and without it there are no filters for the theme to show.

**What to do:**

1. Install **Shopify Search & Discovery** (free, from the Shopify App Store)
2. Open the app → **Filters**
3. Add the filters that make sense: Availability, Price, Color, Size
4. Go back to the store and reload the collection page

> If filters are on and still missing with the app installed: filters only appear when **there are products carrying that property**. A Color filter in a collection with no color option has nothing to show.

---

## The image is cropped

**Symptom:** the product photo is cut off in the card, or the banner crops the model's head.

**Cause:** the theme's image areas have a fixed aspect ratio. An image of a different ratio gets cropped from the center to fit.

**What to do:**

- **In product cards:** use all your photos in the **same aspect ratio**. Portrait 4:5 works best for fashion. One square photo among portrait ones throws off the whole grid.
- **In the banner:** leave room around the main subject when shooting or cropping. The banner crops more on mobile than on desktop, because the area is taller and narrower.
- **Check on a phone** before publishing. The crop is different on each.

> There's no "don't crop" option. A uniform ratio is what fixes it, and it's also what makes a store look professional.

---

## The section doesn't appear on the store

**Symptom:** you added the section, it shows in the editor, but not on the published store.

Check, in this order:

1. **Did you save?** The editor doesn't save on its own.
2. **Is the section hidden?** The eye icon in the sidebar hides without deleting. A crossed-out eye means hidden.
3. **Is the theme published?** If you're editing the draft, the store is still on the old theme. **Online Store → Themes** shows which one is published.
4. **Does the section depend on content that doesn't exist?**
   - *Featured collection* with no collection picked shows nothing
   - *Recently viewed* stays empty until there's browsing
   - *Blog Posts* with no blog or no posts stays empty
   - *Countdown Timer* with a date in the past **disappears**

---

## The text vanished into the image

**Symptom:** the heading over the banner or the video is unreadable.

**Cause:** the text sits over a light part of the image, without enough separation.

**What to do:** raise the **scrim opacity** in that section. The scrim is the layer between the image and the text, and it exists for exactly this.

If it's still bad at maximum, the photo is the problem — pick one with a more uniform area where the text goes.

---

## The colors went wrong after I changed the scheme

**Symptom:** you switched a section's scheme and something became invisible, or the buttons disappeared.

**Cause:** that scheme's **Background** and **Text** pair doesn't have enough contrast, or the button color ended up too close to the background.

**What to do:** see [Colors and brand → Contrast](colors-and-brand.html#contrast-the-rule-that-isnt-an-opinion). In short: measure the contrast between Background and Text and make sure it's at least **4.5:1**.

A shortcut to check the whole store at once: open your store's **style guide** page (the address ends in `/pages/style-guide` if you created the page with that template). It shows every component in every scheme side by side.

---

## The logo shows up with a white rectangle

**Cause:** the file has a white background instead of a transparent one.

**What to do:** export the logo as **PNG with transparency** or **SVG**. In light schemes nobody notices; in dark ones the rectangle jumps out.

---

## The mega menu opens empty

**Cause:** the main menu has no second-level items.

**What to do:** **Online Store → Navigation** → open the main menu → add sub-items inside each item. The theme shows what exists in the menu; it doesn't invent hierarchy.

---

## The free shipping bar shows the wrong amount

**Cause:** the amount configured in the theme isn't the same as the store's shipping rules.

**What to do:** the bar is **visual**. It reads the value you typed in **Theme settings → Cart**, not the shipping rules. Set both to the same number:

- In the theme: Theme settings → Cart → Threshold
- In the store: Settings → Shipping and delivery

---

## The newsletter modal shows up too often

**What to do:** in **Newsletter Modal**, increase:

- **Delay before showing** — at least 10 seconds
- **Don't show again for** — at least 7 days

And keep the **"No thanks"** link visible. A modal with no clear way out makes the shopper close the tab, not the modal.

---

## I filled in a social network and no icon appeared

**Cause:** only **Instagram, Facebook and YouTube** become footer icons.

TikTok, Snapchat, Tumblr and Vimeo have fields but don't appear anywhere. Twitter feeds the link preview on Twitter/X; Pinterest feeds the structured data Google reads — neither becomes an icon.

**What to do:** also check that the **Payments and Social** block is present in the footer with the social option turned on.

---

## The account pages have the wrong colors

**Cause:** login, register, account, orders and addresses don't appear in the editor as sections, so they don't inherit any section's scheme.

**What to do:** **Theme settings → Colors → Account pages color scheme**.

---

## The store is slow

Before suspecting the theme, check:

1. **Image size.** A 5 MB photo straight off the camera is the most common cause. Export at 2000 px wide at most.
2. **Installed apps.** Each app adds code. Uninstall what you don't use — disabling isn't enough, the code usually stays.
3. **Autoplay video** in several sections of the same page.
4. **Number of sections on the home page.** Above 10, consider cutting.

---

## It's not here

Open a ticket at [github.com/cleytonmendest/elizabeth/issues](https://github.com/cleytonmendest/elizabeth/issues/new) saying:

- **which page** (home, product, collection…)
- **which section**
- **which color scheme**
- **phone or computer**
- what you expected and what happened

Without those five, most reports aren't reproducible, and a problem that can't be reproduced can't be fixed.

---

**Previous:** [← Sections](sections.html) · **Next:** [FAQ →](faq.html)
