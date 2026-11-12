
import os
import time

import httpx
from dotenv import load_dotenv
from google import genai
from google.genai.errors import APIError

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MAX_GENERATION_ATTEMPTS = 3
RETRY_DELAY_SECONDS = 0.5
GENAI_TIMEOUT_SECONDS = 15


class GeminiTemporarilyUnavailableError(Exception):
    pass


def build_fallback_description(title, category, product_type, price, condition):
    condition_text = condition or "Good"
    return (
        f"{title} is a {condition_text.lower()} {product_type} from the "
        f"{category} category, priced at INR {price:,.0f}. It has been "
        "carefully checked and is suitable for everyday use. This item "
        "offers a practical and budget-friendly option for buyers looking "
        "for a reliable second-hand product. The listing highlights the "
        "key details clearly so buyers can make an informed purchase decision."
    )


def generate_product_description(
    title,
    category,
    product_type,
    price,
    condition
):
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is missing in .env")

    client = genai.Client(
        api_key=GEMINI_API_KEY,
        http_options={"timeout": GENAI_TIMEOUT_SECONDS}
    )

    prompt = f"""
    You are a professional product description writer
    for a used-goods marketplace.

    Generate an attractive, clear and professional
    product description using these details:

    Product name: {title}
    Category: {category}
    Product type: {product_type}
    Price: {price}
    Condition: {condition}

    Requirements:
    1. Write 80 to 120 words.
    2. Use simple and professional English.
    3. Highlight the provided product details.
    4. Do not invent specifications or features.
    5. Do not make unsupported claims.
    6. Return only the product description.
    """

    response = None
    for attempt in range(MAX_GENERATION_ATTEMPTS):
        try:
            response = client.models.generate_content(
                model="gemini-flash-latest",
                contents=prompt
            )
            break
        except (APIError, httpx.TimeoutException, httpx.HTTPError) as error:
            if isinstance(error, APIError) and error.code not in (429, 503):
                raise

            if attempt == MAX_GENERATION_ATTEMPTS - 1:
                return build_fallback_description(
                    title,
                    category,
                    product_type,
                    price,
                    condition
                )

            time.sleep(RETRY_DELAY_SECONDS * (attempt + 1))

    if response is None or not getattr(response, "text", None):
        return build_fallback_description(
            title,
            category,
            product_type,
            price,
            condition
        )

    return response.text.strip()
