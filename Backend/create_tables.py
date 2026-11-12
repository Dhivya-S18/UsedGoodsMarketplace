from sqlalchemy import inspect, text

from database import engine, Base
from models.models import User, Product, ProductInteraction

Base.metadata.create_all(bind=engine)

product_columns = {
    column["name"]
    for column in inspect(engine).get_columns("products")
}

if "product_condition" not in product_columns:
    with engine.begin() as connection:
        connection.execute(
            text(
                "ALTER TABLE products "
                "ADD COLUMN product_condition VARCHAR(50) NULL"
            )
        )
    print("Added nullable product_condition column.")

if "image_url" not in product_columns:
    with engine.begin() as connection:
        connection.execute(
            text(
                "ALTER TABLE products "
                "ADD COLUMN image_url VARCHAR(500) NULL"
            )
        )
    print("Added nullable image_url column.")

print("Database tables are ready.")