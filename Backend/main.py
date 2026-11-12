from fastapi import FastAPI
from sqlalchemy import text
from database import engine
from routes.auth import router as auth_router
from fastapi import Depends
from auth_utils import get_current_user
from models.models import User
from routes.products import router as product_router
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from services.image_storage import UPLOAD_DIRECTORY

app = FastAPI()
UPLOAD_DIRECTORY.mkdir(parents=True, exist_ok=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth_router)
app.include_router(product_router)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIRECTORY), name="uploads")

@app.get("/")
def home():
    return {
        "message": "Used Goods Marketplace API is running!"
    }


@app.get("/test-db")
def test_database():
    with engine.connect() as connection:
        result = connection.execute(text("SELECT DATABASE()"))

        return {
            "message": "Database connected successfully!",
            "database": result.scalar()
        }

@app.get("/protected")
def protected_route(
    current_user: User = Depends(get_current_user)
):
    return {
        "message": "You are authenticated!",
        "user_id": current_user.id,
        "name": current_user.name,
        "email": current_user.email
    }