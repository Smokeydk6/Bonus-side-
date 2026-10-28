"""Fetch and normalize bonus listings from explicitly configured sources."""

from __future__ import annotations

import hashlib
import json
import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup, Tag
from requests import RequestException


SOURCES = [
    {
        "url": "https://gratisdeals.dk/casino-bonusser/",
        "casino_name": "GratisDeals",
        "license_verified": False,
        "license_badge_text": "Dansk licens",
        "sponsored_marker": "#reklame",
        "selectors": {
            "container": "article",
            "casino": "h3",
            "offer": "p",
            "link": 'a[href^="/go/"], a[href*="record.stakeaffiliates.com"]',
            "license": "span",
        },
    },
]

OUTPUT_FILE = Path(__file__).with_name("bonuses.json")
REQUEST_TIMEOUT = 20
USER_AGENT = "BonusblikBonusFetcher/1.0 (scheduled bonus data updater)"
CONTAINER_SELECTORS = ("[data-bonus]", ".bonus-card", ".bonus-item", ".bonus", "article")
CASINO_SELECTORS = ("[data-casino-name]", ".casino-name", ".casino-title", '[itemprop="name"]', "h2", "h3")
OFFER_SELECTORS = ("[data-bonus-offer]", ".bonus-offer", ".offer", ".bonus-title", "[data-offer]")
SPINS_SELECTORS = ("[data-free-spins]", ".free-spins", ".freespins", '[class*="free-spin"]')
WAGERING_SELECTORS = ("[data-wagering]", ".wagering", ".wagering-requirement")

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("bonus-scraper")


def _clean_text(value: str) -> str:
    return " ".join(value.split())


def _configured_selectors(source: dict[str, object], key: str, fallback: tuple[str, ...]) -> tuple[str, ...]:
    selectors = source.get("selectors", {})
    value = selectors.get(key) if isinstance(selectors, dict) else None
    if isinstance(value, str):
        return (value,)
    if isinstance(value, (list, tuple)):
        return tuple(str(selector) for selector in value)
    return fallback


def _find_text(container: Tag, selectors: tuple[str, ...], data_attributes: tuple[str, ...] = ()) -> str:
    for attribute in data_attributes:
        value = container.get(attribute)
        if value:
            return _clean_text(str(value))

    for selector in selectors:
        element = container.select_one(selector)
        if element:
            for attribute in data_attributes:
                value = element.get(attribute)
                if value:
                    return _clean_text(str(value))
            text = _clean_text(element.get_text(" ", strip=True))
            if text:
                return text
    return ""


def _parse_bonus_card(container: Tag, source: dict[str, object], page_url: str) -> dict[str, object] | None:
    casino_selectors = _configured_selectors(source, "casino", CASINO_SELECTORS)
    offer_selectors = _configured_selectors(source, "offer", OFFER_SELECTORS)
    spins_selectors = _configured_selectors(source, "spins", SPINS_SELECTORS)
    wagering_selectors = _configured_selectors(source, "wagering", WAGERING_SELECTORS)
    casino_name = _find_text(
        container,
        casino_selectors,
        ("data-casino-name",),
    ) or str(source["casino_name"])
    offer = _find_text(container, offer_selectors, ("data-bonus-offer", "data-offer"))

    if not offer:
        offer_match = re.search(r"[^.!?\n]*(?:\d[\d.,]*\s*%|\d[\d.,]*\s*(?:kr|dkk))[^.!?\n]*", container.get_text(" ", strip=True), re.I)
        offer = _clean_text(offer_match.group(0)) if offer_match else ""
    if not offer:
        return None

    spins_text = _find_text(container, spins_selectors, ("data-free-spins",))
    spins_match = re.search(r"\b(\d+)\s*(?:free\s*)?spins?\b", spins_text or container.get_text(" ", strip=True), re.I)
    free_spins = int(spins_match.group(1)) if spins_match else int(spins_text) if spins_text.isdigit() else None

    wagering = _find_text(container, wagering_selectors, ("data-wagering",))
    if not wagering:
        wagering_match = re.search(r"\b\d+(?:[.,]\d+)?\s*x(?:\s*(?:bonus|deposit))?\b", container.get_text(" ", strip=True), re.I)
        wagering = _clean_text(wagering_match.group(0)) if wagering_match else ""

    link_selectors = _configured_selectors(source, "link", ("a[href]",))
    link_element = container.select_one(", ".join(link_selectors))
    offer_url = urljoin(page_url, str(link_element["href"])) if link_element else ""
    if offer_url and urlparse(offer_url).scheme not in ("http", "https"):
        offer_url = ""

    is_new = str(container.get("data-is-new", "")).lower() == "true"
    classes = container.get("class", [])
    is_new = is_new or any("new" in str(class_name).lower() for class_name in classes)
    license_badge_text = str(source.get("license_badge_text", "")).casefold()
    license_selectors = _configured_selectors(source, "license", ("span",))
    license_claimed = bool(license_badge_text) and any(
        _clean_text(element.get_text(" ", strip=True)).casefold() == license_badge_text
        for element in container.select(", ".join(license_selectors))
    )
    sponsored_marker = str(source.get("sponsored_marker", "")).casefold()
    is_sponsored = bool(sponsored_marker) and sponsored_marker in container.get_text(" ", strip=True).casefold()
    stable_id = hashlib.sha256(f"{page_url}|{casino_name}".encode("utf-8")).hexdigest()[:16]

    return {
        "id": f"scraped-{stable_id}",
        "casinoName": casino_name,
        "offer": offer,
        "freeSpins": free_spins,
        "wagering": wagering,
        "url": offer_url,
        "isNew": is_new,
        "licenseVerified": bool(source.get("license_verified", False)),
        "licenseClaimedBySource": license_claimed,
        "isSponsored": is_sponsored,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "isDemo": False,
    }


def parse_bonus_html(html: str, source: dict[str, object], page_url: str) -> list[dict[str, object]]:
    """Parse common bonus-card markup; adjust selectors for each target site."""
    soup = BeautifulSoup(html, "html.parser")
    container_selectors = _configured_selectors(source, "container", CONTAINER_SELECTORS)
    for selector in container_selectors:
        cards = soup.select(selector)
        if not cards:
            continue
        parsed = [bonus for card in cards if (bonus := _parse_bonus_card(card, source, page_url))]
        if parsed:
            return parsed
    return []


def fetch_source(source: dict[str, object], session: requests.Session | None = None) -> list[dict[str, object]]:
    client = session or requests.Session()
    response = client.get(
        str(source["url"]),
        headers={"User-Agent": USER_AGENT},
        timeout=REQUEST_TIMEOUT,
    )
    response.raise_for_status()
    return parse_bonus_html(response.text, source, response.url)


def collect_bonuses(sources: list[dict[str, object]] = SOURCES) -> list[dict[str, object]]:
    bonuses = []
    failures = []
    session = requests.Session()

    for source in sources:
        url = str(source["url"])
        try:
            found = fetch_source(source, session)
            if not found:
                raise ValueError("No bonus cards matched the configured selectors")
            bonuses.extend(found)
            logger.info("Fetched %d bonus(es) from %s", len(found), url)
        except (RequestException, ValueError) as error:
            failures.append(f"{url}: {error}")
            logger.error("Could not update %s: %s", url, error)

    if failures:
        raise RuntimeError("Bonus feed was not updated because one or more sources failed: " + "; ".join(failures))
    if not bonuses:
        raise RuntimeError("No bonuses were collected; existing bonuses.json was left unchanged")

    return bonuses


def write_bonuses(bonuses: list[dict[str, object]], output_file: Path = OUTPUT_FILE) -> None:
    output_file.parent.mkdir(parents=True, exist_ok=True)
    temporary_file = output_file.with_suffix(output_file.suffix + ".tmp")
    temporary_file.write_text(json.dumps(bonuses, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary_file.replace(output_file)


def main() -> None:
    bonuses = collect_bonuses()
    write_bonuses(bonuses)
    logger.info("Wrote %d bonus(es) to %s", len(bonuses), OUTPUT_FILE)


if __name__ == "__main__":
    main()