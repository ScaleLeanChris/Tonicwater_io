"""
Articles MCP Server for article storage and management.
Stores articles in JSON files with full metadata for SEO.
"""

import json
import os
import re
from datetime import datetime
from pathlib import Path
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("articles-server")

# Storage directory
ARTICLES_DIR = Path(os.getenv("ARTICLES_DIR", "./articles_data"))
ARTICLES_DIR.mkdir(exist_ok=True)


def slugify(text: str) -> str:
    """Convert text to URL-friendly slug."""
    text = text.lower()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"\s+", "-", text)
    text = re.sub(r"-+", "-", text)
    return text.strip("-")


@mcp.tool()
async def save_article(
    title: str,
    content: str,
    meta_description: str,
    primary_keyword: str,
    secondary_keywords: list[str],
    image_url: str,
    schema_markup: dict | None = None,
) -> str:
    """
    Save a new article with full SEO metadata.

    Args:
        title: Article title
        content: Full markdown content
        meta_description: SEO meta description (150-160 chars)
        primary_keyword: Main target keyword
        secondary_keywords: List of secondary keywords
        image_url: URL or data URI of featured image
        schema_markup: Optional JSON-LD schema markup

    Returns:
        Confirmation message with article ID and slug
    """
    slug = slugify(title)
    article_id = f"{slug}-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    now = datetime.now().isoformat()

    article = {
        "id": article_id,
        "slug": slug,
        "title": title,
        "metaDescription": meta_description,
        "content": content,
        "primaryKeyword": primary_keyword,
        "secondaryKeywords": secondary_keywords,
        "imageUrl": image_url,
        "imageAlt": f"{title} - Premium Gin and Tonic Guide",
        "schemaMarkup": schema_markup or {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": title,
            "description": meta_description,
        },
        "status": "published",
        "createdAt": now,
        "publishedAt": now,
    }

    file_path = ARTICLES_DIR / f"{article_id}.json"
    with open(file_path, "w") as f:
        json.dump(article, f, indent=2)

    return f"Article saved successfully!\nID: {article_id}\nSlug: {slug}\nPath: {file_path}"


@mcp.tool()
async def get_articles(status: str = "all", limit: int = 10) -> str:
    """
    List articles from storage.

    Args:
        status: Filter by status ('published', 'draft', or 'all')
        limit: Maximum number of articles to return

    Returns:
        Formatted list of articles with metadata
    """
    articles = []

    for file_path in sorted(ARTICLES_DIR.glob("*.json"), reverse=True):
        try:
            with open(file_path) as f:
                article = json.load(f)
                if status == "all" or article.get("status") == status:
                    articles.append(article)
                    if len(articles) >= limit:
                        break
        except Exception:
            continue

    if not articles:
        return "No articles found."

    lines = [f"Found {len(articles)} articles:\n"]
    for a in articles:
        lines.append(
            f"- [{a.get('status', 'unknown')}] {a.get('title', 'Untitled')}\n"
            f"  Slug: {a.get('slug', 'N/A')} | "
            f"Keyword: {a.get('primaryKeyword', 'N/A')}\n"
            f"  Created: {a.get('createdAt', 'N/A')[:10]}"
        )

    return "\n".join(lines)


@mcp.tool()
async def get_article(slug: str) -> str:
    """
    Get a specific article by slug.

    Args:
        slug: The article's URL slug

    Returns:
        Full article data as JSON
    """
    for file_path in ARTICLES_DIR.glob("*.json"):
        try:
            with open(file_path) as f:
                article = json.load(f)
                if article.get("slug") == slug:
                    return json.dumps(article, indent=2)
        except Exception:
            continue

    return f"Article not found: {slug}"


@mcp.tool()
async def update_article_status(slug: str, status: str) -> str:
    """
    Update an article's publication status.

    Args:
        slug: The article's URL slug
        status: New status ('published' or 'draft')

    Returns:
        Confirmation message
    """
    for file_path in ARTICLES_DIR.glob("*.json"):
        try:
            with open(file_path) as f:
                article = json.load(f)
                if article.get("slug") == slug:
                    article["status"] = status
                    if status == "published" and not article.get("publishedAt"):
                        article["publishedAt"] = datetime.now().isoformat()
                    with open(file_path, "w") as fw:
                        json.dump(article, fw, indent=2)
                    return f"Article '{slug}' status updated to: {status}"
        except Exception:
            continue

    return f"Article not found: {slug}"


@mcp.tool()
async def delete_article(slug: str) -> str:
    """
    Delete an article by slug.

    Args:
        slug: The article's URL slug

    Returns:
        Confirmation message
    """
    for file_path in ARTICLES_DIR.glob("*.json"):
        try:
            with open(file_path) as f:
                article = json.load(f)
                if article.get("slug") == slug:
                    file_path.unlink()
                    return f"Article deleted: {slug}"
        except Exception:
            continue

    return f"Article not found: {slug}"


if __name__ == "__main__":
    mcp.run()
