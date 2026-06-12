import csv
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "data" / "products.csv"
CSV_OUTPUT = ROOT / "data" / "etsy_listings.csv"
JSON_OUTPUT = ROOT / "data" / "etsy_listings.json"


PRODUCT_MAP = {
    "vase": {
        "etsy_category": "Home & Living > Home Decor > Vases",
        "name": "vase",
        "use": "dried flowers, shelf styling, console tables and modern home accents",
        "tags": ["stone vase", "ceramic look vase", "dried flower vase", "shelf decor"],
    },
    "candle_holder": {
        "etsy_category": "Home & Living > Home Decor > Candleholders",
        "name": "candle holder",
        "use": "dinner tables, coffee tables, bedside styling and cozy home corners",
        "tags": ["candle holder", "minimal candle", "table decor", "cozy decor"],
    },
    "tray": {
        "etsy_category": "Home & Living > Home Decor > Decorative Trays",
        "name": "decorative tray",
        "use": "jewelry, candles, perfumes, coffee table styling and vanity organization",
        "tags": ["decorative tray", "jewelry tray", "vanity tray", "trinket dish"],
    },
    "bowl": {
        "etsy_category": "Home & Living > Home Decor > Decorative Bowls",
        "name": "decorative bowl",
        "use": "entryway styling, small accessories, shelf decor and coffee table styling",
        "tags": ["decor bowl", "catchall bowl", "entryway bowl", "table accent"],
    },
    "wall_decor": {
        "etsy_category": "Home & Living > Home Decor > Wall Decor",
        "name": "wall decor",
        "use": "gallery walls, entryways, living rooms and calm modern interiors",
        "tags": ["wall decor", "minimal wall art", "home wall accent", "modern decor"],
    },
    "bookend": {
        "etsy_category": "Home & Living > Office > Bookends",
        "name": "bookend",
        "use": "bookshelves, work desks, reading corners and office styling",
        "tags": ["bookend", "shelf decor", "desk decor", "book lover gift"],
    },
    "incense_holder": {
        "etsy_category": "Home & Living > Spirituality & Religion > Incense Holders",
        "name": "incense holder",
        "use": "incense rituals, meditation corners, bedside styling and calm home spaces",
        "tags": ["incense holder", "zen decor", "meditation gift", "ritual decor"],
    },
}


BASE_TAGS = [
    "stone powder decor",
    "handmade decor",
    "minimalist decor",
    "modern home decor",
    "housewarming gift",
    "neutral home decor",
    "aesthetic decor",
]


def clean(value):
    return (value or "").strip()


def split_keywords(value):
    return [item.strip() for item in clean(value).split(",") if item.strip()]


def limit_title(title):
    return title[:137].rstrip(" ,-|")


def make_title(row, product):
    color = clean(row["color"]).title()
    style = clean(row["style"]).title()
    set_count = clean(row["set_count"])
    set_text = f" Set of {set_count}" if set_count and set_count != "1" else ""
    keywords = split_keywords(row.get("keywords", ""))
    keyword_text = f", {keywords[0].title()}" if keywords else ""
    title = (
        f"{color} {style} Stone Powder {product['name'].title()}{set_text}, "
        f"Handmade Minimalist Home Decor{keyword_text}, Housewarming Gift"
    )
    return limit_title(title)


def make_tags(row, product):
    candidates = []
    candidates.extend(product["tags"])
    candidates.extend(split_keywords(row.get("keywords", "")))
    candidates.extend(
        [
            f"{clean(row['color'])} decor",
            f"{clean(row['style'])} decor",
            *BASE_TAGS,
        ]
    )

    tags = []
    seen = set()
    for tag in candidates:
        tag = tag.lower().replace("  ", " ").strip()
        if not tag or tag in seen:
            continue
        seen.add(tag)
        tags.append(tag[:20])
        if len(tags) == 13:
            break
    return tags


def make_description(row, product):
    product_name = clean(row["product_name_tr"])
    color = clean(row["color"])
    style = clean(row["style"])
    dimensions = clean(row["dimensions"])
    set_count = clean(row["set_count"]) or "1"
    notes = clean(row.get("notes", ""))

    return "\n".join(
        [
            f"{product_name} is a handmade stone powder {product['name']} designed for calm, modern and giftable home styling.",
            "",
            "DETAILS",
            f"- Material: stone powder composite",
            f"- Color: {color}",
            f"- Style: {style}",
            f"- Size: {dimensions}",
            f"- Quantity: {set_count} piece(s)",
            f"- Use: {product['use']}",
            "",
            "WHY YOU WILL LOVE IT",
            "- Handmade decorative object with a ceramic-like matte look",
            "- Works beautifully in neutral, minimalist, scandi and modern interiors",
            "- A thoughtful gift for housewarmings, birthdays, weddings and new home celebrations",
            "",
            "CARE",
            "- Wipe gently with a soft dry or slightly damp cloth",
            "- Keep away from long water exposure",
            "- Each piece is handmade, so tiny surface differences may appear",
            "",
            f"Note: {notes}" if notes else "",
        ]
    ).strip()


def make_photo_checklist(product):
    return " | ".join(
        [
            "main image on clean background",
            "lifestyle image in home setting",
            "close-up texture detail",
            "scale image with hand or common object",
            "dimension image",
            f"use-case image for {product['name']}",
            "packaging or gift-ready image",
        ]
    )


def build_listing(row):
    product = PRODUCT_MAP.get(clean(row["product_type"]), PRODUCT_MAP["tray"])
    tags = make_tags(row, product)
    return {
        "sku": clean(row["sku"]),
        "etsy_title": make_title(row, product),
        "etsy_description": make_description(row, product),
        "etsy_tags": ", ".join(tags),
        "etsy_category": product["etsy_category"],
        "materials": "stone powder composite, water-based pigment, protective finish",
        "photo_checklist": make_photo_checklist(product),
    }


def main():
    with INPUT.open("r", encoding="utf-8-sig", newline="") as source:
        rows = list(csv.DictReader(source))

    listings = [build_listing(row) for row in rows]

    with CSV_OUTPUT.open("w", encoding="utf-8", newline="") as target:
        writer = csv.DictWriter(target, fieldnames=list(listings[0].keys()))
        writer.writeheader()
        writer.writerows(listings)

    with JSON_OUTPUT.open("w", encoding="utf-8") as target:
        json.dump(listings, target, ensure_ascii=False, indent=2)

    print(f"Generated {len(listings)} Etsy listings")


if __name__ == "__main__":
    main()

