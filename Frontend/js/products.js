
// products.js

document.addEventListener("DOMContentLoaded", () => {
    initializeHomePage();
    initializeProductsPage();
    initializeProductDetailsPage();
});

// Store products fetched from backend
let allProducts = [];
let activeCategory = "All";
let currentProductDetails = null;

// ---------------- COMMON PRODUCT LOADING ----------------

async function fetchProducts() {
    const result = await apiRequest(API.PRODUCTS, {
        method: "GET"
    });

    if (Array.isArray(result)) {
        return result;
    }

    if (Array.isArray(result.products)) {
        return result.products;
    }

    return [];
}

// ---------------- HOMEPAGE PRODUCTS ----------------

async function initializeHomePage() {
    const productGrid = document.getElementById("product-grid");
    const template = document.getElementById("product-card-template");

    // Run only on the homepage
    if (!productGrid || !template) return;

    const loadingMessage = document.getElementById("featured-loading");
    const emptyMessage = document.getElementById("featured-empty");
    const errorMessage = document.getElementById("featured-error");

    try {
        const products = await fetchProducts();

        productGrid.innerHTML = "";

        if (loadingMessage) loadingMessage.hidden = true;
        if (errorMessage) errorMessage.hidden = true;

        if (products.length === 0) {
            if (emptyMessage) emptyMessage.hidden = false;
            return;
        }

        if (emptyMessage) emptyMessage.hidden = true;

        // Display up to four real products on the homepage
        products.slice(0, 4).forEach((product) => {
            const card = template.content.cloneNode(true);

            const detailsUrl =
                `product-details.html?id=${encodeURIComponent(product.id)}`;

            // Set product detail links
            card.querySelectorAll('[data-field="link"]')
                .forEach((link) => {
                    link.href = detailsUrl;
                });

            // Set product image
            const image = card.querySelector('[data-field="image"]');

            if (image) {
                if (product.image_url) {
                    image.src = resolveImageUrl(product.image_url);
                    image.alt = product.title || "Product image";

                    image.onerror = () => {
                        image.hidden = true;
                    };
                } else {
                    image.hidden = true;
                }
            }

            // Set category
            const category = card.querySelector(
                '[data-field="category"]'
            );

            if (category) {
                category.textContent = product.category || "";
            }

            // Set title
            const title = card.querySelector(
                '[data-field="title"]'
            );

            if (title) {
                title.textContent = product.title || "Untitled product";
            }

            // Set price
            const price = card.querySelector(
                '[data-field="price"]'
            );

            if (price) {
                const amount = Number(product.price);

                price.textContent = Number.isFinite(amount)
                    ? `₹ ${amount.toLocaleString("en-IN")}`
                    : "Price unavailable";
            }

            productGrid.appendChild(card);
        });

    } catch (error) {
        console.error("Homepage products loading failed:", error);

        productGrid.innerHTML = "";

        if (loadingMessage) loadingMessage.hidden = true;
        if (emptyMessage) emptyMessage.hidden = true;

        if (errorMessage) {
            errorMessage.hidden = false;
            errorMessage.textContent =
                "Unable to load products. Please try again later.";
        }
    }
}

// ---------------- PRODUCTS PAGE ----------------

async function initializeProductsPage() {
    const productGrid = document.getElementById("products-grid");

    if (!productGrid) return;

    await loadProducts();

    // Search
    const searchForm = document.getElementById("search-form");

    searchForm?.addEventListener("submit", (event) => {
        event.preventDefault();
        applyProductFilters();
    });

    // Price and condition filters
    const filterForm = document.getElementById("filter-form");

    filterForm?.addEventListener("submit", (event) => {
        event.preventDefault();
        applyProductFilters();
    });

    // Category filters
    document.querySelectorAll("#category-filters [data-category]")
        .forEach((button) => {
            button.addEventListener("click", () => {
                const category = button.dataset.category;

                document.querySelectorAll(
                    "#category-filters [data-category]"
                ).forEach((chip) => {
                    const active = chip.dataset.category === category;

                    chip.classList.toggle("is-active", active);
                    chip.setAttribute("aria-pressed", String(active));
                });

                activeCategory = category;
                applyProductFilters();
            });
        });

    // Clear filters
    document.getElementById("clear-filters")
        ?.addEventListener("click", () => {
            searchForm?.reset();
            filterForm?.reset();

            activeCategory = "All";

            document.querySelectorAll(
                "#category-filters [data-category]"
            ).forEach((chip) => {
                const active = chip.dataset.category === "All";

                chip.classList.toggle("is-active", active);
                chip.setAttribute("aria-pressed", String(active));
            });

            showFilterMessage("");
            applyProductFilters();
        });

    // Support homepage search and category links
    applyUrlFilters();
}

// ---------------- LOAD PRODUCTS ----------------

async function loadProducts() {
    const grid = document.getElementById("products-grid");

    if (!grid) return;

    grid.innerHTML = "<p>Loading products...</p>";

    try {
        allProducts = await fetchProducts();

        const sampleNotice = document.getElementById("sample-notice");

        if (sampleNotice) {
            sampleNotice.hidden = true;
        }

        applyProductFilters();

    } catch (error) {
        showProductMessage(error.message);
    }
}

// ---------------- SEARCH AND FILTER ----------------

function applyProductFilters() {
    const searchValue =
        document.getElementById("product-search")?.value
            .trim()
            .toLowerCase() || "";

    const minValue =
        document.getElementById("min-price")?.value.trim() || "";

    const maxValue =
        document.getElementById("max-price")?.value.trim() || "";

    const condition =
        document.getElementById("condition-filter")?.value || "All";

    const minPrice = minValue === "" ? null : Number(minValue);
    const maxPrice = maxValue === "" ? null : Number(maxValue);

    if (
        (minPrice !== null && (!Number.isFinite(minPrice) || minPrice < 0)) ||
        (maxPrice !== null && (!Number.isFinite(maxPrice) || maxPrice < 0))
    ) {
        showFilterMessage("Enter valid non-negative prices.");
        return;
    }

    if (
        minPrice !== null &&
        maxPrice !== null &&
        minPrice > maxPrice
    ) {
        showFilterMessage(
            "Minimum price cannot be higher than maximum price."
        );
        return;
    }

    showFilterMessage("");

    const filteredProducts = allProducts.filter((product) => {
        const title = (product.title || "").toLowerCase();
        const category = (product.category || "").toLowerCase();
        const type = (product.product_type || "").toLowerCase();

        const matchesSearch =
            !searchValue ||
            `${title} ${category} ${type}`.includes(searchValue);

        const matchesCategory =
            activeCategory === "All" ||
            category === activeCategory.toLowerCase();

        const price = Number(product.price);

        const matchesMin =
            minPrice === null || price >= minPrice;

        const matchesMax =
            maxPrice === null || price <= maxPrice;

        const matchesCondition =
            condition === "All" ||
            (product.condition || "").toLowerCase() ===
                condition.toLowerCase();

        return (
            matchesSearch &&
            matchesCategory &&
            matchesMin &&
            matchesMax &&
            matchesCondition
        );
    });

    renderProducts(filteredProducts);
}

// ---------------- RENDER PRODUCTS ----------------

function renderProducts(products) {
    const grid = document.getElementById("products-grid");
    const count = document.getElementById("product-count");
    const empty = document.getElementById("no-products");

    if (!grid) return;

    grid.innerHTML = "";

    if (count) {
        count.textContent =
            `Showing ${products.length} of ${allProducts.length} products`;
    }

    if (products.length === 0) {
        grid.hidden = true;

        if (empty) {
            empty.hidden = false;
        }

        return;
    }

    grid.hidden = false;

    if (empty) {
        empty.hidden = true;
    }

    products.forEach((product) => {
        const card = document.createElement("article");
        card.className = "product-card";

        const detailsUrl =
            `product-details.html?id=${encodeURIComponent(product.id)}`;

        const media = document.createElement("a");
        media.className = "product-media";
        media.href = detailsUrl;

        const image = document.createElement("img");

        image.alt = product.title || "Product image";

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

        const meta = document.createElement("ul");
        meta.className = "product-meta";

        const type = document.createElement("li");
        type.className = "product-type";
        type.textContent = product.product_type || "";

        const condition = document.createElement("li");
        condition.className = "product-condition";
        condition.textContent = product.condition || "";

        meta.append(type, condition);

        const footer = document.createElement("div");
        footer.className = "product-footer";

        const price = document.createElement("p");
        price.className = "product-price";

        const amount = Number(product.price);

        price.textContent = Number.isFinite(amount)
            ? `₹ ${amount.toLocaleString("en-IN")}`
            : "Price unavailable";

        const viewLink = document.createElement("a");
        viewLink.className = "btn btn-secondary btn-sm";
        viewLink.href = detailsUrl;
        viewLink.textContent = "View Details";

        footer.append(price, viewLink);
        body.append(category, title, meta, footer);
        card.append(media, body);

        grid.appendChild(card);
    });
}

// ---------------- FILTER MESSAGES ----------------

function showFilterMessage(message) {
    const element = document.getElementById("filter-message");

    if (!element) return;

    element.textContent = message;
    element.hidden = !message;
}

function showProductMessage(message) {
    const grid = document.getElementById("products-grid");

    if (!grid) return;

    grid.hidden = false;
    grid.textContent = `Unable to load products: ${message}`;

    const count = document.getElementById("product-count");

    if (count) {
        count.textContent = "";
    }
}

// ---------------- URL FILTERS ----------------

function applyUrlFilters() {
    const params = new URLSearchParams(window.location.search);

    const category = params.get("category");
    const query = params.get("q");

    const validCategories = [
        "All",
        "Electronics",
        "Furniture",
        "Books",
        "Other"
    ];

    if (
        category &&
        validCategories.some(
            (item) => item.toLowerCase() === category.toLowerCase()
        )
    ) {
        activeCategory = validCategories.find(
            (item) => item.toLowerCase() === category.toLowerCase()
        );

        document.querySelectorAll(
            "#category-filters [data-category]"
        ).forEach((chip) => {
            const active =
                chip.dataset.category === activeCategory;

            chip.classList.toggle("is-active", active);
            chip.setAttribute("aria-pressed", String(active));
        });
    }

    if (query) {
        const searchInput = document.getElementById("product-search");

        if (searchInput) {
            searchInput.value = query;
        }
    }

    applyProductFilters();
}

// ---------------- PRODUCT DETAILS PAGE ----------------

async function initializeProductDetailsPage() {
    const detailsContainer =
        document.getElementById("product-details-content");

    if (!detailsContainer) return;

    const params = new URLSearchParams(window.location.search);
    const productId = params.get("id");

    if (!productId || !/^\d+$/.test(productId)) {
        showProductDetailsError("Invalid product ID.");
        return;
    }

    if (!AuthStorage.isLoggedIn()) {
        const nextPage = `product-details.html?id=${encodeURIComponent(productId)}`;
        window.location.replace(`login.html?next=${encodeURIComponent(nextPage)}`);
        return;
    }

    const contactButton = document.getElementById("contact-seller-btn");

    if (contactButton) {
        contactButton.addEventListener("click", () => {
            loadSellerDetails(productId);
        });
    }

    try {
        const product = await apiRequest(
            `/products/${encodeURIComponent(productId)}`,
            { method: "GET" }
        );

        renderProductDetails(product);
        recordInteraction(productId, "view");

    } catch (error) {
        if (error.status === 401) {
            AuthStorage.clear();
            const nextPage = `product-details.html?id=${encodeURIComponent(productId)}`;
            window.location.replace(`login.html?next=${encodeURIComponent(nextPage)}`);
            return;
        }
        showProductDetailsError(error.message);
    }
}

// ---------------- RENDER PRODUCT DETAILS ----------------

function renderProductDetails(product) {
    const container =
        document.getElementById("product-details-content");

    if (!container) return;

    currentProductDetails = product;

    document.getElementById("breadcrumb-product").textContent =
        product.title || "Product";
    document.getElementById("product-category").textContent =
        product.category || "";
    document.getElementById("spec-category").textContent =
        product.category || "";
    document.getElementById("product-title").textContent =
        product.title || "";

    const amount = Number(product.price);
    document.getElementById("product-price").textContent =
        Number.isFinite(amount)
            ? `₹ ${amount.toLocaleString("en-IN")}`
            : "Price unavailable";

    document.getElementById("product-type").textContent =
        product.product_type || "";
    document.getElementById("product-condition").textContent =
        product.condition || "Not specified";
    document.getElementById("product-description").textContent =
        product.description || "";

    const image = document.getElementById("product-image");
    const imageFallback = document.getElementById("image-fallback");

    image.alt = product.title || "Product image";
    image.onerror = () => {
        image.hidden = true;
        imageFallback.hidden = false;
    };

    if (product.image_url) {
        image.src = resolveImageUrl(product.image_url);
        image.hidden = false;
        imageFallback.hidden = true;
    } else {
        image.removeAttribute("src");
        image.hidden = true;
        imageFallback.hidden = false;
    }

    document.getElementById("sample-badge").hidden = true;
    document.getElementById("sample-notice").hidden = true;
    document.getElementById("product-not-found").hidden = true;
    document.title = `${product.title || "Product Details"} – ReUse`;
    container.hidden = false;
}

function showProductDetailsError(message) {
    const detailsContainer =
        document.getElementById("product-details-content");
    const notFound = document.getElementById("product-not-found");

    if (detailsContainer) detailsContainer.hidden = true;
    if (notFound) notFound.hidden = false;

    const messageElement = document.getElementById("not-found-text");

    if (messageElement) {
        messageElement.textContent = message;
    }

    document.getElementById("breadcrumb-product").textContent =
        "Product not found";
    document.title = "Product not found – ReUse";
}

// ---------------- SELLER DETAILS ----------------

async function loadSellerDetails(productId) {
    const message = document.getElementById("contact-message");
    const contactButton = document.getElementById("contact-seller-btn");

    if (!message || !contactButton) return;

    contactButton.disabled = true;
    message.classList.remove("is-error");
    message.textContent = "Loading seller details...";
    message.hidden = false;

    try {
        const result = await apiRequest(
            `/products/${encodeURIComponent(productId)}/seller`,
            { method: "GET" }
        );

        if (!result.seller || !result.seller.name || !result.seller.email) {
            throw new Error("Seller information is unavailable.");
        }

        message.replaceChildren();

        const sellerName = document.createElement("span");
        sellerName.textContent = `Seller: ${result.seller.name} — Email: `;

        const emailLink = document.createElement("a");
        emailLink.href = `mailto:${result.seller.email}`;
        emailLink.textContent = result.seller.email;
        emailLink.addEventListener("click", () => {
            recordInteraction(productId, "click");
        });

        message.append(sellerName, emailLink);

    } catch (error) {
        message.classList.add("is-error");
        message.textContent =
            `Unable to load seller details. ${error.message}`;
    } finally {
        contactButton.disabled = false;
        message.hidden = false;
    }
}

// ---------------- BROWSING HISTORY ----------------

async function recordInteraction(productId, action) {
    try {
        await apiRequest(
            `/products/${encodeURIComponent(productId)}/interactions`,
            {
                method: "POST",
                body: JSON.stringify({ action })
            }
        );

    } catch (error) {
        console.error("Interaction recording failed:", error.message);
    }
}

// ---------------- HTML ESCAPING ----------------

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[character];
    });
}
