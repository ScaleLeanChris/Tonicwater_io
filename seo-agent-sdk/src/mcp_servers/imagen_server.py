"""
Imagen MCP Server for AI image generation.
Uses Google's Imagen 3 API via Gemini for high-quality image generation.
"""

import os
import httpx
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("imagen-server")


@mcp.tool()
async def generate_image(title: str, keyword: str) -> str:
    """
    Generate a professional featured image for a gin and tonic article.

    Args:
        title: The article title
        keyword: The primary keyword for context

    Returns:
        Base64 data URL of the generated image or fallback path
    """
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        return "fallback:/images/default-gin-tonic.jpg"

    prompt = f"""A beautiful, professional photograph of a gin and tonic cocktail for an article titled "{title}".

The image should feature:
- An elegant crystal or highball glass with a perfectly mixed gin and tonic
- Visible ice cubes and bubbles from the tonic
- Appropriate botanical garnishes (citrus, herbs, berries) based on the gin style
- Soft, natural lighting with a sophisticated bar or home setting
- Shallow depth of field for professional look
- Color palette that evokes freshness and premium quality

Style: Editorial food photography, magazine quality, warm ambient lighting"""

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict",
                headers={
                    "Content-Type": "application/json",
                    "x-goog-api-key": api_key,
                },
                json={
                    "instances": [{"prompt": prompt}],
                    "parameters": {
                        "sampleCount": 1,
                        "aspectRatio": "16:9",
                        "personGeneration": "dont_allow",
                    },
                },
            )

            if response.status_code != 200:
                return f"fallback:/images/default-gin-tonic.jpg (API error: {response.status_code})"

            data = response.json()
            prediction = data.get("predictions", [{}])[0]

            if prediction.get("bytesBase64Encoded"):
                mime_type = prediction.get("mimeType", "image/png")
                base64_data = prediction["bytesBase64Encoded"]
                return f"data:{mime_type};base64,{base64_data}"

            return "fallback:/images/default-gin-tonic.jpg"

    except Exception as e:
        return f"fallback:/images/default-gin-tonic.jpg (error: {str(e)})"


@mcp.tool()
async def create_image_prompt(article_title: str, topic: str) -> str:
    """
    Generate an optimized image prompt for article featured images.

    Args:
        article_title: The title of the article
        topic: The main topic/keyword

    Returns:
        Optimized prompt for image generation
    """
    return f"""Professional food photography of a gin and tonic cocktail.

Context: Featured image for "{article_title}"
Topic: {topic}

Requirements:
- High-end crystal or copa glass with gin and tonic
- Premium quality ice cubes with visible bubbles
- Elegant botanical garnishes matching the topic
- Soft natural lighting, shallow depth of field
- Sophisticated bar or home setting background
- Color palette: cool greens, citrus yellows, crystal clear
- Style: Editorial food photography, magazine cover quality
- Aspect ratio: 16:9 for blog headers"""


if __name__ == "__main__":
    mcp.run()
