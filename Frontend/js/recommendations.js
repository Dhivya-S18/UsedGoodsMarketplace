// recommendations.js

document.addEventListener("DOMContentLoaded", () => {
    initializeRecommendations();
});

window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
        initializeRecommendations();
    }
});

function getRecommendationsContainer() {
    return (
        document.getElementById("recommendations-results") ||
        document.getElementById("recommendations-container")
    );
}

async function initializeRecommendations() {
    const container = getRecommendationsContainer();

    // Do nothing on pages without the recommendations section.
    if (!container) return;

    if (!AuthStorage.isLoggedIn()) {
        container.innerHTML = `
            <p class="recommendations-placeholder">
                Please log in to view your personalized recommendations.
            </p>
        `;
        return;
    }

    await loadRecommendations();
}

async function loadRecommendations() {
    const container = getRecommendationsContainer();

    if (!container) return;

    container.innerHTML = `
        <p class="recommendations-placeholder">
            Finding products based on your browsing activity...
        </p>
    `;

    try {
        const result = await apiRequest(API.RECOMMENDATIONS, {
            method: "GET"
        });

        const recommendations = result.recommendations || [];

        renderRecommendations(recommendations);

    } catch (error) {
        container.innerHTML = `
            <p class="recommendations-placeholder">
                ${escapeHTML(error.message)}
            </p>
        `;
    }
}

function renderRecommendations(products) {
    const container = getRecommendationsContainer();

    if (!container) return;

    container.innerHTML = "";

    if (products.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3 class="empty-state-title">
                    No recommendations yet
                </h3>
                <p class="empty-state-text">
                    Browse and interact with products to build your
                    personalized recommendations.
                </p>
            </div>
        `;
        return;
    }

    const grid = document.createElement("div");
    grid.className = "product-grid recommendations-grid";

    products.forEach((product) => {
        const card = document.createElement("article");
        card.className = "product-card";

        const media = document.createElement("a");
        media.className = "product-media";
        media.href =
            `product-details.html?id=${encodeURIComponent(product.id)}`;

        const image = document.createElement("img");
        image.alt = product.title || "Recommended product";

        if (product.image_url) {
            image.src = resolveImageUrl(product.image_url);
            image.onerror = () => {
                image.hidden = true;
            };
        } else {
            image.hidden = true;
        }

        media.appendChild(image);

        const body = document.createElement("div");
        body.className = "product-body";

        const category = document.createElement("p");
        category.className = "product-category";
        category.textContent = product.category || "";

        const title = document.createElement("h3");
        title.className = "product-title";
        title.textContent = product.title || "Untitled product";

        const price = document.createElement("p");
        price.className = "product-price";
        price.textContent =
            `₹${Number(product.price).toLocaleString("en-IN")}`;

        const viewLink = document.createElement("a");
        viewLink.className = "btn btn-secondary btn-sm";
        viewLink.href =
            `product-details.html?id=${encodeURIComponent(product.id)}`;
        viewLink.textContent = "View Details";

        body.append(category, title, price, viewLink);
        card.append(media, body);
        grid.appendChild(card);
    });

    container.appendChild(grid);
}