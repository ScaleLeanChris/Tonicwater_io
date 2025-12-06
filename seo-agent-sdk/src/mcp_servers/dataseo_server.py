"""
DataForSEO MCP Server for keyword research and SEO analysis.
Provides tools for keyword research, trending topics, and SERP analysis.
"""

import os
import httpx
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("dataseo-server")

DATASEO_API_URL = "https://api.dataforseo.com/v3"


def get_auth():
    """Get DataForSEO credentials from environment."""
    login = os.getenv("DATAFORSEO_LOGIN", "")
    password = os.getenv("DATAFORSEO_PASSWORD", "")
    if not login or not password:
        return None
    return (login, password)


@mcp.tool()
async def search_keywords(keyword: str, location_code: int = 2840) -> str:
    """
    Search for keyword metrics including search volume, competition, and CPC.

    Args:
        keyword: The keyword to research
        location_code: Geographic location code (2840 = USA, default)

    Returns:
        Keyword metrics as formatted text
    """
    auth = get_auth()
    if not auth:
        return "DataForSEO credentials not configured. Skipping keyword research."

    try:
        async with httpx.AsyncClient(auth=auth, timeout=30.0) as client:
            response = await client.post(
                f"{DATASEO_API_URL}/keywords_data/google_ads/search_volume/live",
                json=[{
                    "keywords": [keyword],
                    "location_code": location_code,
                    "language_code": "en",
                }],
            )
            response.raise_for_status()
            data = response.json()

            result = data.get("tasks", [{}])[0].get("result", [{}])[0]
            if not result:
                return f"No data found for keyword: {keyword}"

            return (
                f"Keyword: {keyword}\n"
                f"Search Volume: {result.get('search_volume', 'N/A')}\n"
                f"Competition: {result.get('competition', 'N/A')}\n"
                f"CPC: ${result.get('cpc', 'N/A')}"
            )
    except Exception as e:
        return f"DataForSEO error: {str(e)}"


@mcp.tool()
async def get_related_keywords(keyword: str, limit: int = 10) -> str:
    """
    Get related keywords and variations for a given seed keyword.

    Args:
        keyword: The seed keyword
        limit: Maximum number of related keywords to return

    Returns:
        List of related keywords with metrics
    """
    auth = get_auth()
    if not auth:
        return "DataForSEO credentials not configured."

    try:
        async with httpx.AsyncClient(auth=auth, timeout=30.0) as client:
            response = await client.post(
                f"{DATASEO_API_URL}/dataforseo_labs/google/related_keywords/live",
                json=[{
                    "keyword": keyword,
                    "location_code": 2840,
                    "language_code": "en",
                    "limit": limit,
                }],
            )
            response.raise_for_status()
            data = response.json()

            items = (
                data.get("tasks", [{}])[0]
                .get("result", [{}])[0]
                .get("items", [])
            )

            if not items:
                return f"No related keywords found for: {keyword}"

            keywords = []
            for item in items[:limit]:
                kw_data = item.get("keyword_data", {})
                keywords.append(
                    f"- {kw_data.get('keyword', 'N/A')}: "
                    f"{kw_data.get('keyword_info', {}).get('search_volume', 'N/A')} searches"
                )

            return f"Related keywords for '{keyword}':\n" + "\n".join(keywords)
    except Exception as e:
        return f"DataForSEO error: {str(e)}"


@mcp.tool()
async def get_trending_topics() -> str:
    """
    Get trending gin and tonic related topics based on search volume.

    Returns:
        List of trending topics with search volumes
    """
    auth = get_auth()
    if not auth:
        # Return default topics if no credentials
        default_topics = [
            "best gin for gin and tonic",
            "fever tree tonic water review",
            "hendricks gin cocktails",
            "summer gin cocktails",
            "botanical gin guide",
            "gin and tonic garnishes",
            "premium tonic water comparison",
            "gin tasting notes",
            "craft gin brands",
            "gin cocktail recipes",
        ]
        return "Trending topics (default list):\n" + "\n".join(
            f"- {topic}" for topic in default_topics
        )

    try:
        async with httpx.AsyncClient(auth=auth, timeout=30.0) as client:
            response = await client.post(
                f"{DATASEO_API_URL}/dataforseo_labs/google/keyword_suggestions/live",
                json=[{
                    "keyword": "gin and tonic",
                    "location_code": 2840,
                    "language_code": "en",
                    "limit": 20,
                    "filters": [["keyword_info.search_volume", ">", 100]],
                    "order_by": ["keyword_info.search_volume,desc"],
                }],
            )
            response.raise_for_status()
            data = response.json()

            items = (
                data.get("tasks", [{}])[0]
                .get("result", [{}])[0]
                .get("items", [])
            )

            if not items:
                return "No trending topics found."

            topics = []
            for item in items[:15]:
                keyword = item.get("keyword", "")
                volume = item.get("keyword_info", {}).get("search_volume", 0)
                topics.append(f"- {keyword}: {volume} monthly searches")

            return "Trending gin & tonic topics:\n" + "\n".join(topics)
    except Exception as e:
        return f"DataForSEO error: {str(e)}"


if __name__ == "__main__":
    mcp.run()
