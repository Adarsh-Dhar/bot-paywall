"""
Utility functions for the web scraper
"""

import re
import json
import os
from urllib.parse import urlparse
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


def validate_url(url):
    """
    Validate if a string is a valid URL

    Args:
        url (str): URL string to validate

    Returns:
        bool: True if valid, False otherwise
    """
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc]) and result.scheme in ['http', 'https']
    except Exception:
        return False


def sanitize_filename(name):
    """
    Sanitize a string to be used as a filename

    Args:
        name (str): String to sanitize

    Returns:
        str: Sanitized filename
    """
    # Remove invalid characters
    name = re.sub(r'[<>:"/\\|?*]', '', name)
    # Replace spaces with underscores
    name = name.replace(' ', '_')
    # Limit length
    return name[:100]


def generate_filename(url, format='json'):
    """
    Generate a filename based on the URL and timestamp

    Args:
        url (str): The URL that was scraped
        format (str): File format (json, txt, html)

    Returns:
        str: Generated filename
    """
    parsed = urlparse(url)
    domain = parsed.netloc.replace('www.', '')
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

    safe_domain = sanitize_filename(domain)
    filename = f"scraped_{safe_domain}_{timestamp}.{format}"

    return filename


def save_to_json(data, filename):
    """
    Save data to a JSON file

    Args:
        data (dict): Data to save
        filename (str): Output filename
    """
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    logger.info(f"Data saved to {filename}")


def save_to_txt(data, filename):
    """
    Save data to a text file

    Args:
        data (dict): Data to save
        filename (str): Output filename
    """
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(f"URL: {data.get('url', 'N/A')}\n")
        f.write(f"Title: {data.get('title', 'N/A')}\n")
        f.write(f"{'='*80}\n\n")

        if data.get('meta_description'):
            f.write(f"Description: {data['meta_description']}\n\n")

        # Write headings
        headings = data.get('headings', {})
        if any(headings.values()):
            f.write("HEADINGS:\n")
            f.write("-" * 80 + "\n")
            for level, heads in headings.items():
                if heads:
                    f.write(f"\n{level.upper()}:\n")
                    for h in heads:
                        f.write(f"  - {h}\n")
            f.write("\n")

        # Write main text
        f.write("\nMAIN CONTENT:\n")
        f.write("-" * 80 + "\n")
        f.write(data.get('text', 'No content found'))
        f.write("\n\n")

        # Write links
        links = data.get('links', [])
        if links:
            f.write(f"\nLINKS ({len(links)}):\n")
            f.write("-" * 80 + "\n")
            for i, link in enumerate(links[:50], 1):  # Limit to first 50 links
                f.write(f"{i}. {link['text']}\n   {link['url']}\n")
            if len(links) > 50:
                f.write(f"\n... and {len(links) - 50} more links\n")

        # Write images
        images = data.get('images', [])
        if images:
            f.write(f"\n\nIMAGES ({len(images)}):\n")
            f.write("-" * 80 + "\n")
            for i, img in enumerate(images[:30], 1):  # Limit to first 30 images
                f.write(f"{i}. {img['url']}\n")
                if img['alt']:
                    f.write(f"   Alt: {img['alt']}\n")
            if len(images) > 30:
                f.write(f"\n... and {len(images) - 30} more images\n")

    logger.info(f"Data saved to {filename}")


def save_to_html(data, filename):
    """
    Save data to an HTML file

    Args:
        data (dict): Data to save
        filename (str): Output filename
    """
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Scraped: {data.get('title', 'No Title')}</title>
    <style>
        body {{
            font-family: Arial, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
        }}
        .header {{
            background: #f4f4f4;
            padding: 20px;
            border-radius: 5px;
            margin-bottom: 20px;
        }}
        .section {{
            margin: 30px 0;
        }}
        .section h2 {{
            color: #333;
            border-bottom: 2px solid #007bff;
            padding-bottom: 10px;
        }}
        .link-item, .image-item {{
            margin: 10px 0;
            padding: 10px;
            background: #f9f9f9;
            border-left: 3px solid #007bff;
        }}
        .link-item a {{
            color: #007bff;
            text-decoration: none;
        }}
        .link-item a:hover {{
            text-decoration: underline;
        }}
        img {{
            max-width: 200px;
            height: auto;
            margin: 10px 0;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>{data.get('title', 'No Title')}</h1>
        <p><strong>URL:</strong> <a href="{data.get('url', '#')}">{data.get('url', 'N/A')}</a></p>
        <p><strong>Description:</strong> {data.get('meta_description', 'No description available')}</p>
    </div>
"""

    # Add headings section
    headings = data.get('headings', {})
    if any(headings.values()):
        html_content += '    <div class="section">\n        <h2>Headings</h2>\n'
        for level, heads in headings.items():
            if heads:
                html_content += f'        <h3>{level.upper()}</h3>\n        <ul>\n'
                for h in heads:
                    html_content += f'            <li>{h}</li>\n'
                html_content += '        </ul>\n'
        html_content += '    </div>\n'

    # Add main content
    html_content += f"""    <div class="section">
        <h2>Main Content</h2>
        <p>{data.get('text', 'No content found')[:5000]}...</p>
    </div>
"""

    # Add links
    links = data.get('links', [])
    if links:
        html_content += f'    <div class="section">\n        <h2>Links ({len(links)})</h2>\n'
        for link in links[:50]:
            html_content += f'''        <div class="link-item">
            <a href="{link['url']}" target="_blank">{link['text']}</a>
        </div>
'''
        if len(links) > 50:
            html_content += f'        <p><em>... and {len(links) - 50} more links</em></p>\n'
        html_content += '    </div>\n'

    # Add images
    images = data.get('images', [])
    if images:
        html_content += f'    <div class="section">\n        <h2>Images ({len(images)})</h2>\n'
        for img in images[:20]:
            html_content += f'''        <div class="image-item">
            <img src="{img['url']}" alt="{img['alt']}" onerror="this.style.display='none'">
            <p>{img['alt'] if img['alt'] else 'No alt text'}</p>
        </div>
'''
        if len(images) > 20:
            html_content += f'        <p><em>... and {len(images) - 20} more images</em></p>\n'
        html_content += '    </div>\n'

    html_content += """</body>
</html>"""

    with open(filename, 'w', encoding='utf-8') as f:
        f.write(html_content)

    logger.info(f"Data saved to {filename}")


def save_to_file(data, url, output_filename=None, format='json'):
    """
    Save scraped data to a file in the specified format

    Args:
        data (dict): Scraped data
        url (str): Original URL
        output_filename (str): Custom output filename (optional)
        format (str): Output format (json, txt, html)

    Returns:
        str: The filename where data was saved
    """
    # Generate filename if not provided
    if not output_filename:
        filename = generate_filename(url, format)
    else:
        # Ensure the file has the correct extension
        if not output_filename.endswith(f'.{format}'):
            filename = f"{output_filename}.{format}"
        else:
            filename = output_filename

    # Save based on format
    if format == 'json':
        save_to_json(data, filename)
    elif format == 'txt':
        save_to_txt(data, filename)
    elif format == 'html':
        save_to_html(data, filename)
    else:
        raise ValueError(f"Unsupported format: {format}")

    return filename