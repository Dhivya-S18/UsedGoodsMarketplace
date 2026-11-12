
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Literal, Optional

from database import get_db
from models.models import User, Product, ProductInteraction
from auth_utils import get_current_user
from services.recommendation import get_recommendations
from services.image_storage import (
    MAX_IMAGE_SIZE_BYTES,
    UPLOAD_DIRECTORY,
    store_product_image
)
from services.genai_service import (
    GeminiTemporarilyUnavailableError,
    generate_product_description
)


router = APIRouter(prefix="/products", tags=["Products"])


# -------------------- REQUEST MODELS --------------------

class InteractionRequest(BaseModel):
    action: Literal["view", "click"]


class DescriptionRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=150)
    category: str
    product_type: str
    price: float = Field(..., gt=0)
    condition: str


# -------------------- POST PRODUCT API --------------------

@router.post("/")
async def create_product(
    title: str = Form(..., max_length=150),
    category: str = Form(..., max_length=100),
    product_type: str = Form(..., max_length=100),
    price: float = Form(..., gt=0),
    description: str = Form(...),
    condition: Optional[Literal["Like New", "Good", "Fair"]] = Form(None),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    image_url = None
    saved_image_path = None

    if image and image.filename:
        contents = await image.read(MAX_IMAGE_SIZE_BYTES + 1)
        if len(contents) > MAX_IMAGE_SIZE_BYTES:
            raise HTTPException(
                status_code=413,
                detail="Image must be 5 MB or smaller."
            )

        try:
            image_url = store_product_image(contents, image.content_type or "")
            saved_image_path = UPLOAD_DIRECTORY / image_url.rsplit("/", 1)[-1]
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error

    new_product = Product(
        seller_id=current_user.id,
        title=title,
        category=category,
        product_type=product_type,
        price=price,
        description=description,
        condition=condition,
        image_url=image_url
    )

    try:
        db.add(new_product)
        db.commit()
    except Exception:
        db.rollback()
        if saved_image_path:
            saved_image_path.unlink(missing_ok=True)
        raise

    db.refresh(new_product)

    return {
        "message": "Product posted successfully",
        "product": {
            "id": new_product.id,
            "seller_id": new_product.seller_id,
            "title": new_product.title,
            "category": new_product.category,
            "product_type": new_product.product_type,
            "price": float(new_product.price),
            "description": new_product.description,
            "condition": new_product.condition,
            "image_url": new_product.image_url
        }
    }


# -------------------- VIEW ALL PRODUCTS --------------------

@router.get("/")
def get_all_products(
    db: Session = Depends(get_db)
):
    products = db.query(Product).order_by(
        Product.created_at.desc()
    ).all()

    return {
        "total_products": len(products),
        "products": [
            {
                "id": product.id,
                "seller_id": product.seller_id,
                "title": product.title,
                "category": product.category,
                "product_type": product.product_type,
                "price": float(product.price),
                "description": product.description,
                "condition": product.condition,
                "image_url": product.image_url,
                "created_at": product.created_at
            }
            for product in products
        ]
    }


# -------------------- SEARCH AND FILTER PRODUCTS --------------------

@router.get("/search")
def search_products(
    keyword: Optional[str] = None,
    category: Optional[str] = None,
    product_type: Optional[str] = None,
    condition: Optional[Literal["Like New", "Good", "Fair"]] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Product)

    if keyword:
        query = query.filter(
            Product.title.ilike(f"%{keyword}%") |
            Product.description.ilike(f"%{keyword}%")
        )

    if category:
        query = query.filter(
            Product.category == category
        )

    if product_type:
        query = query.filter(
            Product.product_type == product_type
        )

    if condition:
        query = query.filter(
            Product.condition == condition
        )

    if min_price is not None:
        query = query.filter(
            Product.price >= min_price
        )

    if max_price is not None:
        query = query.filter(
            Product.price <= max_price
        )

    products = query.order_by(
        Product.created_at.desc()
    ).all()

    return {
        "total_products": len(products),
        "products": [
            {
                "id": product.id,
                "seller_id": product.seller_id,
                "title": product.title,
                "category": product.category,
                "product_type": product.product_type,
                "price": float(product.price),
                "description": product.description,
                "condition": product.condition,
                "image_url": product.image_url
            }
            for product in products
        ]
    }


# -------------------- PERSONALIZED RECOMMENDATIONS --------------------

@router.get("/recommendations/me")
def get_my_recommendations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    recommendations = get_recommendations(
        user_id=current_user.id,
        db=db,
        top_n=5
    )

    return {
        "message": "Personalized recommendations retrieved successfully",
        "total_recommendations": len(recommendations),
        "recommendations": [
            {
                "id": item["product"].id,
                "title": item["product"].title,
                "category": item["product"].category,
                "product_type": item["product"].product_type,
                "price": float(item["product"].price),
                "description": item["product"].description,
                "image_url": item["product"].image_url,
                "score": round(item["score"], 4)
            }
            for item in recommendations
        ]
    }


# -------------------- GENERATE AI PRODUCT DESCRIPTION --------------------

@router.post("/generate-description")
def generate_description(
    request: DescriptionRequest
):
    try:
        description = generate_product_description(
            title=request.title,
            category=request.category,
            product_type=request.product_type,
            price=request.price,
            condition=request.condition
        )

        return {
            "message": "Product description generated successfully",
            "description": description
        }

    except GeminiTemporarilyUnavailableError:
        raise HTTPException(
            status_code=503,
            detail=(
                "The AI description service is temporarily busy. "
                "Please try again shortly."
            )
        )
    except Exception:
        raise HTTPException(
            status_code=502,
            detail=(
                "The AI description could not be generated right now. "
                "Please try again."
            )
        )


# -------------------- GET PRODUCT DETAILS BY ID --------------------

@router.get("/{product_id}")
def get_product_details(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    product = db.query(Product).filter(
        Product.id == product_id
    ).first()

    if not product:
        raise HTTPException(
            status_code=404,
            detail="Product not found"
        )

    return {
        "id": product.id,
        "seller_id": product.seller_id,
        "title": product.title,
        "category": product.category,
        "product_type": product.product_type,
        "price": float(product.price),
        "description": product.description,
        "condition": product.condition,
        "image_url": product.image_url,
        "created_at": product.created_at
    }


# -------------------- CONTACT SELLER --------------------

@router.get("/{product_id}/seller")
def contact_seller(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    product = db.query(Product).filter(
        Product.id == product_id
    ).first()

    if not product:
        raise HTTPException(
            status_code=404,
            detail="Product not found"
        )

    seller = db.query(User).filter(
        User.id == product.seller_id
    ).first()

    if not seller:
        raise HTTPException(
            status_code=404,
            detail="Seller not found"
        )

    return {
        "product_id": product.id,
        "product_title": product.title,
        "seller": {
            "id": seller.id,
            "name": seller.name,
            "email": seller.email
        }
    }


# -------------------- RECORD PRODUCT INTERACTION --------------------

@router.post("/{product_id}/interactions")
def record_interaction(
    product_id: int,
    interaction_data: InteractionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    product = db.query(Product).filter(
        Product.id == product_id
    ).first()

    if not product:
        raise HTTPException(
            status_code=404,
            detail="Product not found"
        )

    new_interaction = ProductInteraction(
        user_id=current_user.id,
        product_id=product_id,
        action=interaction_data.action
    )

    db.add(new_interaction)
    db.commit()
    db.refresh(new_interaction)

    return {
        "message": "Interaction recorded successfully",
        "interaction": {
            "id": new_interaction.id,
            "user_id": new_interaction.user_id,
            "product_id": new_interaction.product_id,
            "action": new_interaction.action
        }
    }
