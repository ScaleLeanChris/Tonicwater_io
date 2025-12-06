#!/usr/bin/env python3
"""
TonicWater.io SEO Agent - Claude Agent SDK Implementation

This agent generates SEO-optimized articles about gin and tonic topics.
It uses MCP servers for DataForSEO keyword research, Imagen for image
generation, and local JSON storage for articles.

Usage:
    python src/main.py                    # Interactive mode
    python src/main.py --topic "keyword"  # Generate article for topic
    python src/main.py --batch            # Process multiple topics
"""

import argparse
import asyncio
import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv

# Load environment variables
load_dotenv()


def read_system_prompt() -> str:
    """Read the system prompt from CLAUDE.md."""
    claude_md = Path(__file__).parent.parent / "CLAUDE.md"
    if claude_md.exists():
        return claude_md.read_text()
    return "You are an SEO content generation agent for TonicWater.io."


async def run_agent_interactive():
    """Run the agent in interactive mode."""
    try:
        from claude_code_sdk import Claude, ClaudeOptions
    except ImportError:
        print("Claude Agent SDK not installed. Install with: pip install claude-code-sdk")
        print("\nFor now, demonstrating the agent structure...")
        demo_agent_structure()
        return

    system_prompt = read_system_prompt()

    options = ClaudeOptions(
        system_prompt=system_prompt,
        allowed_tools=[
            "mcp__dataseo__*",
            "mcp__imagen__*",
            "mcp__articles__*",
        ],
    )

    async with Claude(options=options) as agent:
        print("TonicWater.io SEO Agent")
        print("=" * 50)
        print("Type your request or 'quit' to exit.\n")

        while True:
            try:
                user_input = input("You: ").strip()
                if user_input.lower() in ("quit", "exit", "q"):
                    break
                if not user_input:
                    continue

                print("\nAgent: ", end="", flush=True)
                async for chunk in agent.stream(user_input):
                    print(chunk.text, end="", flush=True)
                print("\n")

            except KeyboardInterrupt:
                print("\nExiting...")
                break


async def run_agent_batch(topics: list[str]):
    """Run the agent in batch mode for multiple topics."""
    try:
        from claude_code_sdk import Claude, ClaudeOptions
    except ImportError:
        print("Claude Agent SDK not installed.")
        return

    system_prompt = read_system_prompt()

    options = ClaudeOptions(
        system_prompt=system_prompt,
        allowed_tools=[
            "mcp__dataseo__*",
            "mcp__imagen__*",
            "mcp__articles__*",
        ],
    )

    async with Claude(options=options) as agent:
        for topic in topics:
            print(f"\n{'=' * 60}")
            print(f"Generating article for: {topic}")
            print("=" * 60)

            prompt = f"""Generate a complete SEO article for the topic: "{topic}"

Please:
1. Research the keyword using DataForSEO (if available)
2. Write a comprehensive 1500-2000 word article
3. Generate a featured image using Imagen
4. Save the article with all metadata

Follow the SEO guidelines in your system prompt."""

            async for chunk in agent.stream(prompt):
                print(chunk.text, end="", flush=True)
            print("\n")


async def run_agent_single(topic: str):
    """Run the agent for a single topic."""
    await run_agent_batch([topic])


def demo_agent_structure():
    """Demonstrate the agent structure without the SDK."""
    print("\n" + "=" * 60)
    print("SEO Agent SDK Structure Demo")
    print("=" * 60)

    print("\n1. MCP Servers Available:")
    print("   - dataseo_server.py: Keyword research tools")
    print("     - search_keywords(keyword)")
    print("     - get_related_keywords(keyword)")
    print("     - get_trending_topics()")
    print("   - imagen_server.py: Image generation")
    print("     - generate_image(title, keyword)")
    print("   - articles_server.py: Article storage")
    print("     - save_article(...)")
    print("     - get_articles(status, limit)")
    print("     - get_article(slug)")

    print("\n2. System Prompt: CLAUDE.md")
    print("   Defines the agent's role and workflow")

    print("\n3. Environment Variables Required:")
    print("   - ANTHROPIC_API_KEY: Claude API key")
    print("   - DATAFORSEO_LOGIN: DataForSEO username")
    print("   - DATAFORSEO_PASSWORD: DataForSEO password")
    print("   - GEMINI_API_KEY: Google Gemini/Imagen API key")

    print("\n4. To install and run:")
    print("   pip install claude-code-sdk python-dotenv httpx")
    print("   python src/main.py")

    print("\n5. Or run MCP servers individually:")
    print("   python src/mcp_servers/dataseo_server.py")
    print("   python src/mcp_servers/imagen_server.py")
    print("   python src/mcp_servers/articles_server.py")


def main():
    parser = argparse.ArgumentParser(
        description="TonicWater.io SEO Content Generation Agent"
    )
    parser.add_argument(
        "--topic",
        type=str,
        help="Generate an article for a specific topic",
    )
    parser.add_argument(
        "--batch",
        action="store_true",
        help="Run in batch mode with default topics",
    )
    parser.add_argument(
        "--demo",
        action="store_true",
        help="Show agent structure demo",
    )

    args = parser.parse_args()

    if args.demo:
        demo_agent_structure()
        return

    if args.batch:
        default_topics = [
            "best gin for gin and tonic",
            "fever tree vs schweppes tonic water",
            "summer gin cocktail recipes",
        ]
        asyncio.run(run_agent_batch(default_topics))
    elif args.topic:
        asyncio.run(run_agent_single(args.topic))
    else:
        asyncio.run(run_agent_interactive())


if __name__ == "__main__":
    main()
