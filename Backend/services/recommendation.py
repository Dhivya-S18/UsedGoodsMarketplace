
import joblib
import pandas as pd
from pathlib import Path
from sklearn.metrics import pairwise_distances

from models.models import Product, ProductInteraction


# Load the saved KNN model
BASE_DIR = Path(__file__).resolve().parents[2]
MODEL_PATH = BASE_DIR / "ML" / "models" / "knn_recommendation.pkl"

model_bundle = joblib.load(MODEL_PATH)

knn_model = model_bundle["model"]
preprocessor = model_bundle["preprocessor"]

print("KNN recommendation model loaded successfully!")


def get_recommendations(user_id, db, top_n=5):
    interactions = (
        db.query(ProductInteraction, Product)
        .join(Product, ProductInteraction.product_id == Product.id)
        .filter(ProductInteraction.user_id == user_id)
        .all()
    )

    if not interactions:
        return []

    interacted_ids = {
        interaction.product_id
        for interaction, product in interactions
    }

    candidates = (
        db.query(Product)
        .filter(
            ~Product.id.in_(interacted_ids),
            Product.seller_id != user_id
        )
        .all()
    )

    if not candidates:
        return []

    feature_columns = [
        "category",
        "product_type",
        "price",
        "action_weight"
    ]
    history_data = []
    interaction_weights = []

    for interaction, product in interactions:
        weight = 2 if interaction.action == "click" else 1
        interaction_weights.append(weight)
        history_data.append({
            "category": product.category,
            "product_type": product.product_type,
            "price": float(product.price),
            "action_weight": weight
        })

    candidate_data = [
        {
            "category": product.category,
            "product_type": product.product_type,
            "price": float(product.price),
            "action_weight": 1
        }
        for product in candidates
    ]

    history_features = preprocessor.transform(
        pd.DataFrame(history_data, columns=feature_columns)
    )
    candidate_features = preprocessor.transform(
        pd.DataFrame(candidate_data, columns=feature_columns)
    )
    distances = pairwise_distances(
        history_features,
        candidate_features,
        metric=knn_model.metric
    )

    recommendations = []
    for candidate_index, product in enumerate(candidates):
        score = sum(
            weight / (1 + distances[history_index, candidate_index])
            for history_index, weight in enumerate(interaction_weights)
        )
        recommendations.append({
            "product": product,
            "score": round(float(score), 4)
        })

    recommendations.sort(
        key=lambda item: item["score"],
        reverse=True
    )

    return recommendations[:top_n]
